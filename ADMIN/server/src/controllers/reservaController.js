// controllers/reservaController.js
const reservaModel = require('../models/reservaModel');
const canchaModel  = require('../models/canchaModel');
const mailer       = require('../services/mailer');
const { buildReservaEmail } = require('../emails/reservaConfirm');
const { getPricePerHour }  = require('../config/pricing');

// --------- helpers de tiempo ----------
const pad2 = (n) => String(n).padStart(2,'0');
const toSqlTime = (t) => {
  if (t === null || t === undefined) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return `${pad2(m[1])}:${m[2]}:${pad2(m[3] ?? '00')}`;
};
const addMinutes = (hhmmOrHMS, mins) => {
  const s = toSqlTime(hhmmOrHMS);
  if (!s) return null;
  const [h,m] = s.split(':').map(Number);
  const d = new Date(1970,0,1,h,m,0);
  d.setMinutes(d.getMinutes() + Number(mins || 0));
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
};
const toMin = (hhmm) => {
  const [h, m] = String(hhmm).slice(0,5).split(':').map(Number);
  return (Number.isFinite(h) && Number.isFinite(m)) ? h*60 + m : null;
};
const fromMin = (min) => `${pad2(Math.floor(min/60))}:${pad2(min%60)}`;
const floorHour = (min) => Math.floor(min / 60) * 60;
const ceilHour  = (min) => Math.ceil(min / 60) * 60;

function addDaysYMD(ymd, delta) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;
}

// Hora/fecha actual en GUATEMALA (UTC-6)
function nowGuatemala() {
  const nowUtc = new Date();
  const gt = new Date(nowUtc.getTime() - 6 * 60 * 60 * 1000);
  const y = gt.getUTCFullYear();
  const m = pad2(gt.getUTCMonth() + 1);
  const d = pad2(gt.getUTCDate());
  const hh = pad2(gt.getUTCHours());
  const mm = pad2(gt.getUTCMinutes());
  const ss = pad2(gt.getUTCSeconds());
  return {
    dateYMD: `${y}-${m}-${d}`,
    timeHMS: `${hh}:${mm}:${ss}`,
    minutes: Number(hh) * 60 + Number(mm),
  };
}

// weekday 0..6 del string YYYY-MM-DD (en UTC para evitar TZ)
const weekdayOf = (ymd) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  return d.getUTCDay(); // 0..6 Domingo..Sábado
};

// helper de solape con una lista de intervalos (en minutos)
const overlapsAny = (intervals, sM, eM) =>
  (intervals || []).some(iv => (sM < iv.eM && eM > iv.sM));

/* ===============================
 * GET /reservas/semana?start=YYYY-MM-DD&tipo_futbol=F5&dur=60
 * Devuelve: { dias, canchas, bloques, config }
 * =============================== */
exports.listSemana = async (req, res) => {
  try {
    const start = String(req.query.start || '').trim();
    const tipo  = String(req.query.tipo_futbol || '').trim() || null;
    let { dur } = req.query;

    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return res.status(400).json({ error: 'start (YYYY-MM-DD) es requerido' });
    }

    const dias = Array.from({ length: 7 }, (_, i) => addDaysYMD(start, i));
    const end  = dias[dias.length - 1];

    // Config base (mismo rango que usas en slots)
    const config = { open: '07:00', close: '22:00', step: 60 };
    const step = Number.isFinite(Number(dur)) && Number(dur) > 0 ? Math.round(Number(dur)) : config.step;

    // Canchas activas (filtradas por tipo si viene)
    const allCanchas = await canchaModel.listActive();
    const canchas = (tipo ? allCanchas.filter(c => c.tipo_futbol === tipo) : allCanchas)
      .map(c => ({ id: c.id, nombre: c.nombre, tipo_futbol: c.tipo_futbol }))
      .sort((a,b) => a.nombre.localeCompare(b.nombre));

    // Peers direccionales y mapa de nombre->id (para partidos que vienen con texto)
    const dirPeersMap = await canchaModel.getDirectionalPeersMap(); // { id: [peerIds...] }
    const nameToId    = await canchaModel.mapNameToId();           // Map(lower(nombre)) -> id

    // 1) RESERVAS en rango
    const reservas = await reservaModel.listByRange({
      start, end, tipo_futbol: tipo, cancha_id: null, q: null, codigo: null
    });

    const bloques = [];

    for (const r of reservas) {
      bloques.push({
        id: r.id,
        code: r.codigo_reserva || null,
        cancha_id: r.cancha_id,
        fecha: (r.fecha instanceof Date ? r.fecha.toISOString().slice(0,10) : String(r.fecha).slice(0,10)),
        hi: (r.hi_txt || '').slice(0,5),
        hf: (r.hf_txt || '').slice(0,5),
        estado: r.estado,
        cliente: {
          nombre: [r.cliente_nombres, r.cliente_apellidos].filter(Boolean).join(' ').trim() || null,
          telefono: r.cliente_telefono || null
        },
        price_total_q: Number(r.price_total_q || 0)
      });
    }

    // helpers de push
    const pushBlock = (cid, fecha, hi, hf, estado='torneo') => {
      bloques.push({
        id: null,
        code: null,
        cancha_id: cid,
        fecha,
        hi, hf,
        estado,
        cliente: null,
        price_total_q: null
      });
    };

    for (const d of dias) {
      // Partidos (liguilla + eliminación)
      const lig = await reservaModel.listTorneoPartidosByDate(d);
      const eli = await reservaModel.listElimMatchesByDate(d);
      const matches = [...lig, ...eli];

      for (const m of matches) {
        const sMreal = toMin(m.hi_txt), eMreal = toMin(m.hf_txt);
        if (sMreal == null || eMreal == null) continue;

        const hi = fromMin(sMreal);
        const hf = fromMin(eMreal);

        const cid = nameToId.get(String(m.cancha_text || '').trim().toLowerCase());
        if (!cid) continue;

        pushBlock(cid, d, hi, hf, 'torneo');
        for (const peer of (dirPeersMap[cid] || [])) pushBlock(peer, d, hi, hf, 'torneo');
      }

      // Agenda (franjas de torneo por weekday)
      const agenda = await reservaModel.listTorneoAgendaByDate({ fechaYMD: d, weekday: weekdayOf(d) });
      for (const a of agenda) {
        const sM = toMin(a.hi_txt), eM = toMin(a.hf_txt);
        if (sM == null || eM == null) continue;
        const hi = fromMin(floorHour(sM));
        const hf = fromMin(ceilHour(eM));

        pushBlock(a.cancha_id, d, hi, hf, 'torneo');
        for (const peer of (dirPeersMap[a.cancha_id] || [])) pushBlock(peer, d, hi, hf, 'torneo');
      }

      // ACADEMIA (bloqueo direccional F5↔F7, sin F5↔F5)
      const ac = await reservaModel.listAcademiaByDate(d);
      for (const c of ac) {
        const sM = toMin(c.hi_txt), eM = toMin(c.hf_txt);
        if (sM == null || eM == null) continue;
        const hi = fromMin(floorHour(sM));
        const hf = fromMin(ceilHour(eM));

        // propia cancha
        pushBlock(c.cancha_id, d, hi, hf, 'academia');
        // pares direccionales (F7→F5 y F5→F7; NO F5→F5)
        for (const peer of (dirPeersMap[c.cancha_id] || [])) {
          pushBlock(peer, d, hi, hf, 'academia');
        }
      }
    }

    return res.json({ dias, canchas, bloques, config: { ...config, step } });
  } catch (e) {
    console.error('listSemana error:', e);
    res.status(500).json({ error: e.message });
  }
};

// ===============================
// GET /reservas/slots  (bloquea TORNEO + ACADEMIA con propagación direccional)
exports.getSlots = async (req, res) => {
  try {
    const { fecha, tipo_futbol } = req.query;
    let { dur } = req.query;
    if (!fecha || !tipo_futbol) {
      return res.status(400).json({ error: 'fecha y tipo_futbol son requeridos' });
    }

    // Ventana operativa base
    const DEF_OPEN  = '07:00';
    const DEF_CLOSE = '22:00';
    const DEF_STEP  = 60;

    // Recursos candidatos por tipo
    const all = await canchaModel.listActive();
    const recursos = (all || []).filter(c => c.tipo_futbol === tipo_futbol);

    // *** peers direccionales ***
    const dirPeersMap = await canchaModel.getDirectionalPeersMap(); // { cancha_id: [peerId...] }
    const nameToId    = await canchaModel.mapNameToId();            // nombre->id para partidos con texto

    // === RESERVAS (bloquean: pendiente/pagada) ===
    const blocking = new Set(['pendiente','pagada','completada']);
    const allRes = await reservaModel.listByDate({ fecha, tipo_futbol: null });
    const resQueBloquean = allRes.filter(r => blocking.has(String(r.estado)));

    // Intervalos por cancha (minutos)
    const resByCancha = new Map(); // cancha_id -> [{sM,eM}]
    const push = (map, cid, sM, eM) => {
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid).push({ sM, eM });
    };

    for (const r of resQueBloquean) {
      const sM = toMin(r.hi_txt), eM = toMin(r.hf_txt);
      if (sM == null || eM == null) continue;
      // Siempre bloquea la propia cancha
      push(resByCancha, r.cancha_id, sM, eM);
      // Propagación direccional (F5↔F7, no F5↔F5)
      const peers = dirPeersMap[r.cancha_id] || [];
      for (const p of peers) push(resByCancha, p, sM, eM);
    }

    // === PARTIDOS DE TORNEO (liguilla + eliminatoria) ===
    const lig = await reservaModel.listTorneoPartidosByDate(fecha);
    const eli = await reservaModel.listElimMatchesByDate(fecha);
    const matches = [...lig, ...eli];

    const tourByCancha = new Map(); // cancha_id -> [{sM,eM}] con redondeo por horas
    for (const m of matches) {
      const sMreal = toMin(m.hi_txt), eMreal = toMin(m.hf_txt);
      if (sMreal == null || eMreal == null) continue;
      const sM = floorHour(sMreal), eM = ceilHour(eMreal);
      const cid = nameToId.get(String(m.cancha_text || '').trim().toLowerCase());
      if (!cid) continue;
      // bloquea cancha del match
      push(tourByCancha, cid, sM, eM);
      // y propaga direccionalmente
      const peers = dirPeersMap[cid] || [];
      for (const p of peers) push(tourByCancha, p, sM, eM);
    }

    // === AGENDA DE TORNEO (día + franjas + canchas) ===
    const weekday = weekdayOf(fecha);
    const agenda = await reservaModel.listTorneoAgendaByDate({ fechaYMD: fecha, weekday });
    for (const a of agenda) {
      const sM = floorHour(toMin(a.hi_txt));
      const eM = ceilHour(toMin(a.hf_txt));
      if (sM == null || eM == null) continue;
      // bloquea cancha de agenda
      push(tourByCancha, a.cancha_id, sM, eM);
      // y propaga direccionalmente
      const peers = dirPeersMap[a.cancha_id] || [];
      for (const p of peers) push(tourByCancha, p, sM, eM);
    }

    // === ACADEMIA (día + franjas) — con propagación direccional F5↔F7, no F5↔F5
    const academia = await reservaModel.listAcademiaByDate(fecha);
    for (const c of academia) {
      const sM = floorHour(toMin(c.hi_txt));
      const eM = ceilHour(toMin(c.hf_txt));
      if (sM == null || eM == null) continue;
      // propia cancha
      push(tourByCancha, c.cancha_id, sM, eM);
      // pares direccionales (F7→F5 y F5→F7)
      const peers = dirPeersMap[c.cancha_id] || [];
      for (const p of peers) push(tourByCancha, p, sM, eM);
    }

    // Fecha/hora GT para corte de hoy
    const nowUtc = new Date();
    const gt = new Date(nowUtc.getTime() - 6 * 60 * 60 * 1000);
    const todayYMD = `${gt.getUTCFullYear()}-${pad2(gt.getUTCMonth()+1)}-${pad2(gt.getUTCDate())}`;
    const isTodayGT = todayYMD === String(fecha);
    const nowMinutes = gt.getUTCHours() * 60 + gt.getUTCMinutes();

    const step  = Number.isFinite(Number(dur)) && Number(dur) > 0 ? Math.round(Number(dur)) : DEF_STEP;
    const openM = toMin(DEF_OPEN);
    const closeM= toMin(DEF_CLOSE);

    if (String(fecha) < todayYMD) return res.json([]);

    const cutoff = isTodayGT ? Math.ceil(nowMinutes / step) * step : openM;

    const out = [];
    for (const c of recursos) {
      const slots = [];
      for (let curM = openM; curM + step <= closeM; curM += step) {
        if (isTodayGT && curM < cutoff) continue;

        const sM = curM, eM = curM + step;

        const hasResOverlap  = overlapsAny(resByCancha.get(c.id), sM, eM);
        const hasTourOverlap = overlapsAny(tourByCancha.get(c.id), sM, eM);

        if (!hasResOverlap && !hasTourOverlap) {
          slots.push({ hora: fromMin(sM), hasta: fromMin(eM) });
        }
      }
      out.push({ cancha_id: c.id, cancha_nombre: c.nombre, tipo_futbol: c.tipo_futbol, slots });
    }

    res.json(out);
  } catch (e) {
    console.error('getSlots error:', e);
    res.status(500).json({ error: e.message });
  }
};

// ===============================
// Validación de bloqueos torneo (partidos + agenda) con peers (direccional)
async function hasTournamentApproxOverlap({ cancha_id, fecha, desde, hasta }) {
  const dirPeersMap = await canchaModel.getDirectionalPeersMap();
  const nameToId    = await canchaModel.mapNameToId();

  const sM = toMin(desde), eM = toMin(hasta);
  if (sM == null || eM == null) return false;

  // Partidos en esa fecha
  const [lig, eli] = await Promise.all([
    reservaModel.listTorneoPartidosByDate(fecha),
    reservaModel.listElimMatchesByDate(fecha),
  ]);
  const matches = [...lig, ...eli];

  // Agenda (día + franjas + canchas)
  const agenda = await reservaModel.listTorneoAgendaByDate({ fechaYMD: fecha, weekday: weekdayOf(fecha) });

  // intervals por cancha (con rounding a horas)
  const tourByCancha = new Map();
  const push = (map, cid, a, b) => {
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid).push({ sM: a, eM: b });
  };

  for (const m of matches) {
    const ms = floorHour(toMin(m.hi_txt));
    const me = ceilHour(toMin(m.hf_txt));
    if (ms == null || me == null) continue;
    const cid = nameToId.get(String(m.cancha_text || '').trim().toLowerCase());
    if (!cid) continue;
    push(tourByCancha, cid, ms, me);
    const peers = dirPeersMap[cid] || [];
    for (const p of peers) push(tourByCancha, p, ms, me);
  }

  for (const a of agenda) {
    const ms = floorHour(toMin(a.hi_txt));
    const me = ceilHour(toMin(a.hf_txt));
    if (ms == null || me == null) continue;
    push(tourByCancha, a.cancha_id, ms, me);
    const peers = dirPeersMap[a.cancha_id] || [];
    for (const p of peers) push(tourByCancha, p, ms, me);
  }

  const toCheck = new Set([cancha_id, ...(dirPeersMap[cancha_id] || [])]);
  for (const cid of toCheck) {
    if (overlapsAny(tourByCancha.get(cid), sM, eM)) return true;
  }
  return false;
}

// ===============================
// Validación de bloqueos ACADEMIA con peers (direccional: F7↔F5, no F5↔F5)
async function hasAcademiaApproxOverlap({ cancha_id, fecha, desde, hasta }) {
  const dirPeersMap = await canchaModel.getDirectionalPeersMap();

  const sM = toMin(desde), eM = toMin(hasta);
  if (sM == null || eM == null) return false;

  // ACADEMIA en esa fecha
  const ac = await reservaModel.listAcademiaByDate(fecha);

  // intervals por cancha (redondeados al bloque de hora como en slots)
  const acByCancha = new Map();
  const push = (map, cid, a, b) => {
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid).push({ sM: a, eM: b });
  };

  for (const c of ac) {
    const ms = floorHour(toMin(c.hi_txt));
    const me = ceilHour(toMin(c.hf_txt));
    if (ms == null || me == null) continue;

    // propia cancha
    push(acByCancha, c.cancha_id, ms, me);
    // pares direccionales (F7→F5 y F5→F7)
    for (const p of (dirPeersMap[c.cancha_id] || [])) {
      push(acByCancha, p, ms, me);
    }
  }

  // Evaluar contra self + peers direccionales del recurso a reservar
  const toCheck = new Set([cancha_id, ...(dirPeersMap[cancha_id] || [])]);
  for (const cid of toCheck) {
    if (overlapsAny(acByCancha.get(cid), sM, eM)) return true;
  }
  return false;
}

// ===============================
// POST /reservas
exports.create = async (req,res) => {
  try{
    const { cancha_id, fecha, hora, dur_minutos, notas, cliente } = req.body || {};
    if (!cancha_id || !fecha || !hora || !cliente?.nombres)
      return res.status(400).json({ error: 'cancha_id, fecha, hora y cliente.nombres son requeridos' });

    const c = await reservaModel.getCancha(Number(cancha_id));
    if (!c) return res.status(404).json({ error: 'Cancha no encontrada o inactiva' });

    const baseDur = 60;
    const dur = Number.isFinite(Number(dur_minutos)) && Number(dur_minutos) > 0 ? Math.round(Number(dur_minutos)) : baseDur;

    const hi  = toSqlTime(hora);
    if (!hi) return res.status(400).json({ error: 'Hora inválida, usa HH:MM' });
    const hf  = addMinutes(hi, dur);

    // rango permitido
    const open = '07:00:00';
    const close= '22:00:00';
    if (hi < open || hf > close)
      return res.status(400).json({ error: 'Horario fuera del rango permitido (07:00–22:00)' });

    // no pasado (Guatemala)
    const gt = nowGuatemala();
    if (String(fecha) === gt.dateYMD && hi < gt.timeHMS) {
      return res.status(400).json({ error: 'No puedes reservar en una hora que ya pasó (hora local Guatemala)' });
    }
    if (String(fecha) < gt.dateYMD) {
      return res.status(400).json({ error: 'No puedes reservar en una fecha pasada' });
    }

    // solapes con reservas
    const overlapRes = await reservaModel.hasOverlap({ cancha_id: c.id, fecha, desde: hi, hasta: hf });
    if (overlapRes) return res.status(409).json({ error: 'Ese horario ya está reservado' });

    // solapes con TORNEOS (partidos + agenda)
    const overlapTor = await hasTournamentApproxOverlap({
      cancha_id: c.id, fecha, desde: hi.slice(0,5), hasta: hf.slice(0,5)
    });
    if (overlapTor) return res.status(409).json({ error: 'Ese horario está ocupado por torneo' });

    // solapes con ACADEMIA (propagación direccional)
    const overlapAcad = await hasAcademiaApproxOverlap({
      cancha_id: c.id, fecha, desde: hi.slice(0,5), hasta: hf.slice(0,5)
    });
    if (overlapAcad) return res.status(409).json({ error: 'Ese horario está ocupado por academia' });

    // crear
// precio por modalidad (F5/F7)
    const rate = getPricePerHour(c.tipo_futbol); // c viene de getCancha()
    const hours = Math.max(0, Number(dur) / 60);
    const price_total_q = Number((hours * rate).toFixed(2));

    const created = await reservaModel.create({
      cancha_id: c.id,
      fecha,
      hora_inicio: hi,
      hora_fin: hf,
      dur_minutos: dur,
      notas: notas || null,
      cliente_nombres:  cliente.nombres,
      cliente_apellidos:cliente.apellidos || null,
      cliente_email:    cliente.email || null,
      cliente_telefono: cliente.telefono || null,
      price_total_q
    });

    // respondemos rápido
    res.status(201).json({
      ok:true,
      id: created.id,
      code: created.code,
      total_q: Number(created.total_q).toFixed(2)
    });

    // correo (si hay email)
    if (cliente?.email) {
      queueMicrotask(async () => {
        try {
          const pub = require('../models/publicModel');
          const r = await pub.lookupReservation(created.code);
          const payload = { ...r, total_q: Number(created.total_q || 0) };
          const { subject, text, html } = buildReservaEmail(payload);
          await mailer.sendMail({ to: String(cliente.email).trim(), subject, text, html });
        } catch (err) {
          console.error('send confirmation email failed:', err?.message || err);
        }
      });
    }

  } catch(e) {
    console.error('create reserva error:', e);
    res.status(500).json({ error: e.message });
  }
};

// ===============================
// PATCH /reservas/:id
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { cancha_id, fecha, hora, dur_minutos, estado } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id inválido' });

    if (estado && !cancha_id && !fecha && !hora && !dur_minutos) {
      await reservaModel.updateEstado(id, estado);
      return res.json({ ok: true });
    }

    const cur = await reservaModel.getById(id);
    if (!cur) return res.status(404).json({ error: 'Reserva no encontrada' });

    const cid  = cancha_id ? Number(cancha_id) : cur.cancha_id;
    const f    = fecha || cur.fecha.toISOString().slice(0,10);
    const hTxt = hora || String(cur.hora_inicio).slice(0,5);
    const dur  = Number.isFinite(Number(dur_minutos)) && Number(dur_minutos) > 0
                  ? Math.round(Number(dur_minutos))
                  : cur.dur_minutos;

    const c = await reservaModel.getCancha(cid);
    if (!c) return res.status(404).json({ error: 'Cancha no encontrada o inactiva' });

    const hi = toSqlTime(hTxt);
    if (!hi) return res.status(400).json({ error: 'Hora inválida, usa HH:MM' });
    const hf = addMinutes(hi, dur);

    const open = '07:00:00';
    const close= '22:00:00';
    if (hi < open || hf > close)
      return res.status(400).json({ error: 'Horario fuera del rango permitido (07:00–22:00)' });

    const gt = nowGuatemala();
    if (String(f) === gt.dateYMD && hi < gt.timeHMS) {
      return res.status(400).json({ error: 'No puedes mover a una hora que ya pasó (hora local Guatemala)' });
    }
    if (String(f) < gt.dateYMD) {
      return res.status(400).json({ error: 'No puedes mover a una fecha pasada' });
    }

    // Overlap con reservas (self + peers direccionales)
    const overlapRes = await reservaModel.hasOverlapExcept({
      id, cancha_id: cid, fecha: f, desde: hi, hasta: hf
    });
    if (overlapRes) return res.status(409).json({ error: 'Ese horario ya está reservado' });

    // Overlap con TORNEOS (partidos + agenda)
    const overlapTor = await hasTournamentApproxOverlap({
      cancha_id: cid, fecha: f, desde: hi.slice(0,5), hasta: hf.slice(0,5)
    });
    if (overlapTor) return res.status(409).json({ error: 'Ese horario está ocupado por torneo' });

    // Overlap con ACADEMIA (direccional)
    const overlapAcad = await hasAcademiaApproxOverlap({
      cancha_id: cid, fecha: f, desde: hi.slice(0,5), hasta: hf.slice(0,5)
    });
    if (overlapAcad) return res.status(409).json({ error: 'Ese horario está ocupado por academia' });

const rate = getPricePerHour(c.tipo_futbol);
    const hours = Math.max(0, Number(dur) / 60);
    const price_total_q = Number((hours * rate).toFixed(2));

    await reservaModel.updateCore({
      id, cancha_id: cid, fecha: f, hora_inicio: hi, hora_fin: hf, dur_minutos: dur, estado, price_total_q
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('update reserva error:', e);
    res.status(500).json({ error: e.message });
  }
};

// ===============================
exports.cancel = async (req,res) => {
  try{
    await reservaModel.cancel(Number(req.params.id));
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error: e.message }); }
};

// ===============================
exports.listByDate = async (req, res) => {
  try {
const fecha      = req.query.fecha || null;
    const from       = req.query.from  || null;
    const to         = req.query.to    || null;
    const tipo_futbol= req.query.tipo_futbol || null;
    const cancha_id  = req.query.cancha_id ? Number(req.query.cancha_id) : null;
    const q          = req.query.q || null;
    const codigo     = req.query.codigo || null;
    const estado     = req.query.estado || null; // << usar estado

    let data;
    // Si viene rango (from/to), usamos el listado por rango
    if (from || to) {
      // Si solo viene uno, usamos el mismo para ambos extremos
      const start = from || fecha || to;
      const end   = to   || fecha || from;
      data = await reservaModel.listByRange({
        start, end, tipo_futbol, cancha_id, q, codigo, estado
      });
    } else {
      data = await reservaModel.listByDate({
        fecha, tipo_futbol, cancha_id, q, codigo, estado
      });
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.setEstado = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body || {};
    const valid = new Set(['pendiente', 'pagada', 'completada', 'cancelado']);
    if (!id || !valid.has(String(estado))) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }
    await reservaModel.updateEstado(id, String(estado));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.autoComplete = async (_req, res) => {
  try {
    const updated = await reservaModel.autoCompletePast();
    res.json({ ok:true, updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
