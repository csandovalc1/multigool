// models/publicModel.js  ✅ MySQL
const { getPool } = require('../config/db');
const playoffsModel = require('./playoffsModel');
const standingsSvc  = require('../services/standingsService');
const reservaModel  = require('./reservaModel');

// —— helpers ——
// Normaliza valores TIME a "HH:MM"
function timeToHHMM(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) {
    const hh = String(v.getUTCHours()).padStart(2, '0');
    const mm = String(v.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const s = String(v);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}
function pad2(n){ return String(n).padStart(2,'0'); }
function toMinutes(hhmm){ const [h,m] = hhmm.split(':').map(Number); return h*60+m; }
function fromMinutes(min){ const h = Math.floor(min/60), m = min%60; return `${pad2(h)}:${pad2(m)}`; }
function ymdWeekday(ymd){ return new Date(ymd+'T00:00:00').getDay(); }

// Reglas fijas del calendario público
const OPEN_TIME  = '07:00';
const CLOSE_TIME = '22:00';
const SLOT_MIN   = 60;

// Construye slots horarios
function buildTimeGrid({ openHHMM, closeHHMM, slotMinutes }) {
  const out = [];
  const start = toMinutes(openHHMM);
  const end   = toMinutes(closeHHMM);
  for (let t = start; t < end; t += slotMinutes) out.push(fromMinutes(t));
  return out;
}

// Dado un slot [t, t+slot) se solapa con intervalo [a, b)?
function overlapsSlot(slotStartMin, slotMinutes, aHHMM, bHHMM) {
  const a = toMinutes(aHHMM), b = toMinutes(bHHMM);
  const s = slotStartMin, e = s + slotMinutes;
  return (s < b) && (e > a);
}

// ===== Galería pública =====
exports.listGaleriaPublic = async ({ limit = 24, offset = 0 } = {}) => {
  const lim = Math.max(1, Math.min(100, Number(limit) || 24));
  const off = Math.max(0, Number(offset) || 0);

  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT id, url, descripcion, estado,
           DATE_FORMAT(publish_at, '%Y-%m-%d %H:%i:%s') AS publish_at
    FROM galeria
    WHERE estado = 'publicada'
    ORDER BY IFNULL(publish_at, created_at) DESC, id DESC
    LIMIT :lim OFFSET :off
    `,
    { lim, off }
  );

  return (rows || []).map(x => ({
    id: x.id,
    url: x.url,
    descripcion: x.descripcion || null,
    estado: x.estado,
    publish_at: x.publish_at || null
  }));
};

/* ========= Torneos públicos ========= */
exports.listTorneosActivos = async () => {
  const pool = await getPool();

  const [rows] = await pool.execute(`
    SELECT 
      t.id, t.nombre, t.tipo_futbol, t.tipo_torneo, t.fase, t.dia_semana, t.dur_minutos_partido,
      (
        SELECT MAX(p.fecha)
        FROM partidos p
        JOIN jornadas j ON p.jornada_id = j.id
        WHERE j.torneo_id = t.id
      ) AS last_match_liga,
      (
        SELECT MAX(m.fecha)
        FROM elim_matches m
        JOIN eliminatorias e ON m.eliminatoria_id = e.id
        WHERE e.torneo_id = t.id
      ) AS last_match_po
    FROM torneos t
    ORDER BY t.fecha_creacion DESC
  `);

  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const visible = rows.filter((t) => {
    const f = String(t.fase).toLowerCase();

    // si sigue activo en liga o playoffs → sí
    if (f === 'liga' || f === 'playoffs') return true;

    // si está finalizado, evaluamos "gracia"
    const lastLiga = t.last_match_liga ? new Date(t.last_match_liga) : null;
    const lastPO   = t.last_match_po   ? new Date(t.last_match_po)   : null;
    const lastDate = lastPO || lastLiga;
    if (!lastDate) return false;

    const diff = now - lastDate.getTime();
    return diff <= ONE_MONTH_MS;
  });

  return visible;
};


exports.getTorneoSummary = async (torneoId) => {
  const t = await playoffsModel.getTorneoById(torneoId);
  if (!t) throw new Error('Torneo no existe');
  const elim = await playoffsModel.getEliminatoriaByTorneo(torneoId);
  const rounds = elim ? await playoffsModel.getRounds(elim.id) : [];
  return {
    torneo: { id: t.id, nombre: t.nombre, fase: t.fase, tipo_torneo: t.tipo_torneo, tipo_futbol: t.tipo_futbol },
    eliminatoria: elim ? { id: elim.id, nombre: elim.nombre, ida_vuelta: !!elim.ida_vuelta, away_goals: !!elim.away_goals } : null,
    rounds,
  };
};

exports.getTabla = async (torneoId) => {
  const raw = await standingsSvc.getTablaByTorneo(torneoId);
  return (raw || []).map((r) => {
    const equipo_id = r.equipo_id ?? r.team_id ?? r.id ?? null;
    const equipo_nombre = r.equipo_nombre ?? r.equipo ?? r.team_name ?? r.nombre ?? '';
    const PJ = Number(r.PJ ?? r.pj ?? r.partidos_jugados ?? r.j ?? r.jugados ?? 0);
    const G  = Number(r.G  ?? r.g  ?? r.ganados          ?? r.w ?? r.victorias ?? 0);
    const E  = Number(r.E  ?? r.e  ?? r.empatados        ?? r.d ?? r.empates   ?? 0);
    const P  = Number(r.P  ?? r.p  ?? r.perdidos         ?? r.l ?? r.derrotas  ?? 0);
    const GF = Number(r.GF ?? r.gf ?? r.goles_favor      ?? r.goles_a_favor   ?? 0);
    const GC = Number(r.GC ?? r.gc ?? r.goles_contra     ?? r.goles_en_contra ?? 0);
    const DGc = (r.DG ?? r.dg ?? (Number.isFinite(GF) && Number.isFinite(GC) ? (GF - GC) : 0));
    const Pts = Number(r.Pts ?? r.pts ?? r.puntos ?? r.points ?? 0);
    return { team_id: equipo_id, equipo: equipo_nombre, PJ, G, E, P, GF, GC, DG: Number(DGc), Pts,
             equipo_id, equipo_nombre, pj:PJ, g:G, e:E, p:P, gf:GF, gc:GC, dg:Number(DGc), pts:Pts };
  });
};

exports.getFixture = async (torneoId) => {
  const pool = await getPool();

  const [rows] = await pool.execute(
    `
    SELECT 
      j.id AS jornada_id, j.numero AS jornada_num,
      p.id AS partido_id, p.fecha,
      DATE_FORMAT(p.hora, '%H:%i') AS hora_txt,
      p.cancha,
      el.nombre AS local_name, ev.nombre AS visita_name,
      p.equipo_local_id, p.equipo_visita_id,
      p.goles_local, p.goles_visita
    FROM jornadas j
    JOIN partidos p       ON p.jornada_id = j.id
    LEFT JOIN equipos el  ON el.id = p.equipo_local_id
    LEFT JOIN equipos ev  ON ev.id = p.equipo_visita_id
    WHERE j.torneo_id = :tid
    ORDER BY p.fecha ASC, p.hora ASC, j.numero ASC
    `,
    { tid: Number(torneoId) }
  );

  const [eq] = await pool.execute(
    `SELECT id, nombre FROM equipos WHERE torneo_id = :tid`,
    { tid: Number(torneoId) }
  );
  const equipos = eq || [];

  const jornadas = {};
  for (const row of (rows || [])) {
    jornadas[row.jornada_num] ??= [];
    jornadas[row.jornada_num].push(row);
  }

  const descanso = {};
  for (const jn of Object.keys(jornadas)) {
    const present = new Set();
    for (const p of jornadas[jn]) {
      if (p.equipo_local_id != null) present.add(Number(p.equipo_local_id));
      if (p.equipo_visita_id != null) present.add(Number(p.equipo_visita_id));
    }
    const rest = (equipos || []).find(e => !present.has(Number(e.id)));
    if (rest) descanso[jn] = { id: rest.id, nombre: rest.nombre };
  }

  return { jornadas, descanso };
};

exports.getPlayoffsBracket = async (torneoId) => {
  const t = await playoffsModel.getTorneoById(torneoId);
  if (!t) throw new Error('Torneo no existe');

  const elim = await playoffsModel.getEliminatoriaByTorneo(torneoId);
  if (!elim) return { torneo: { id: t.id, fase: t.fase }, eliminatoria: null, rounds: [] };

  const rounds  = await playoffsModel.getRounds(elim.id);
  const matches = await playoffsModel.getAllMatchesByElim(elim.id);

  const norm = matches.map(m => ({
    ...m,
    local_name:  m.home_name ?? null,
    visita_name: m.away_name ?? null,
    goles_local: (m.home_goals ?? null),
    goles_visita:(m.away_goals ?? null),
    hora_txt: timeToHHMM(m.hora),
  }));

  const byRound = {};
  for (const r of rounds) byRound[r.round_key] = {};
  for (const m of norm) {
    byRound[m.round_key] ??= {};
    byRound[m.round_key][m.match_no] ??= [];
    byRound[m.round_key][m.match_no].push(m);
  }
  for (const rk of Object.keys(byRound)) {
    for (const mn of Object.keys(byRound[rk])) {
      byRound[rk][mn].sort((a,b)=>a.leg-b.leg);
    }
  }

  return {
    torneo: { id: t.id, fase: t.fase },
    eliminatoria: { id: elim.id, ida_vuelta: !!elim.ida_vuelta, away_goals: !!elim.away_goals },
    rounds: rounds.map(r => ({
      round_key: r.round_key,
      partidos: r.partidos,
      ida_vuelta: !!r.ida_vuelta,
      series: Object.entries(byRound[r.round_key] || {}).map(([match_no, legs]) => ({
        match_no: Number(match_no),
        winner_id: legs[0]?.winner_id || null,
        next_match_id: legs[0]?.next_match_id || null,
        next_slot: legs[0]?.next_slot || null,
        legs: legs.map(m => ({
          ...m,
          local_name: m.home_name,
          visita_name: m.away_name,
          goles_local: m.home_goals,
          goles_visita: m.away_goals,
          hora_txt: timeToHHMM(m.hora),
        }))
      }))
    }))
  };
};

exports.getPlayoffsRound = async (torneoId, round_key) => {
  const elim = await playoffsModel.getEliminatoriaByTorneo(torneoId);
  if (!elim) throw new Error('No existe eliminatoria');
  const roundCfg = await playoffsModel.getRound(elim.id, round_key);
  if (!roundCfg) throw new Error(`Ronda ${round_key} no configurada`);

  const legs = await playoffsModel.getMatchesByRound(elim.id, round_key);
  const norm = legs.map(m => ({
    ...m,
    local_name:  m.home_name ?? null,
    visita_name: m.away_name ?? null,
    goles_local: (m.home_goals ?? null),
    goles_visita:(m.away_goals ?? null),
    hora_txt: (m.hora != null) ? timeToHHMM(m.hora) : null
  }));

  const series = {};
  for (const m of norm) {
    series[m.match_no] ??= [];
    series[m.match_no].push(m);
  }
  for (const k of Object.keys(series)) series[k].sort((a,b)=>a.leg-b.leg);
  return { eliminatoria_id: elim.id, round: roundCfg, series };
};

exports.getGoleadores = async (torneoId, includePlayoffs = true) => {
  const pool = await getPool();

  // Liga
  const [liga] = await pool.execute(
    `
    SELECT pd.jugador_id, j.nombre AS jugador_nombre, e.nombre AS equipo_nombre, COUNT(*) AS goles
    FROM partido_detalle pd
    JOIN partidos p   ON p.id = pd.partido_id
    JOIN jornadas jor ON jor.id = p.jornada_id
    JOIN jugadores j  ON j.id = pd.jugador_id
    JOIN equipos e    ON e.id = j.equipo_id
    WHERE jor.torneo_id = :tid
      AND pd.tipo = 'gol'
    GROUP BY pd.jugador_id, j.nombre, e.nombre
    `,
    { tid: Number(torneoId) }
  );

  // Playoffs
  let po = [];
  if (includePlayoffs) {
    const [rows] = await pool.execute(
      `
      SELECT epd.jugador_id, j.nombre AS jugador_nombre, e.nombre AS equipo_nombre, COUNT(*) AS goles
      FROM elim_partido_detalle epd
      JOIN elim_matches m   ON m.id = epd.match_id
      JOIN eliminatorias el ON el.id = m.eliminatoria_id
      JOIN jugadores j      ON j.id = epd.jugador_id
      JOIN equipos e        ON e.id = j.equipo_id
      WHERE el.torneo_id = :tid
        AND epd.tipo = 'gol'
      GROUP BY epd.jugador_id, j.nombre, e.nombre
      `,
      { tid: Number(torneoId) }
    );
    po = rows || [];
  }

  const agg = new Map();
  for (const r of (liga || [])) agg.set(r.jugador_id, { ...r, goles: Number(r.goles) });
  for (const r of (po || [])) {
    const cur = agg.get(r.jugador_id) || { ...r, goles: 0 };
    cur.goles += Number(r.goles);
    agg.set(r.jugador_id, cur);
  }
  return Array.from(agg.values()).sort((a,b)=>b.goles - a.goles);
};

// ===== Campos visibles (F5) =====
exports.listFields = async () => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT id, nombre, tipo_futbol
    FROM canchas
    WHERE activa = 1
      AND (tipo_futbol = '5' OR tipo_futbol = 'F5')
    ORDER BY id
    `
  );
  return (rows || []).map(x => ({ id: x.id, nombre: x.nombre, tipo_futbol: 'F5' }));
};

/* =========================
   Calendario — DÍA
   ========================= */
exports.getCalendarDay = async (ymd) => {
  const pool = await getPool();

  // — día cerrado total —
  const [[closed]] = await pool.execute(
    `SELECT 1 AS x FROM calendario_cierres WHERE fecha = :f LIMIT 1`,
    { f: ymd }
  );

  if (closed && closed.x) {
    const fields = await exports.listFields();
    const times = buildTimeGrid({ openHHMM: OPEN_TIME, closeHHMM: CLOSE_TIME, slotMinutes: SLOT_MIN });
    const slots = times.map(t => ({
      time: t,
      status: Object.fromEntries(fields.map(f => [String(f.id), 'RESERVED'])),
      meta:   Object.fromEntries(fields.map(f => [String(f.id), { type:'CLOSED' }]))
    }));
    return { date: ymd, slot_minutes: SLOT_MIN, open_time: OPEN_TIME, close_time: CLOSE_TIME, fields, slots, isClosed: true, banner: { label: 'CERRADO' } };
  }

  // 1) fields
  const fields = await exports.listFields();
  const fieldIdSet = new Set(fields.map(f => String(f.id)));
  const displayedFieldIds = fields.map(f => String(f.id));
  const weekday0 = ymdWeekday(ymd); // 0..6 (Dom..Sáb)
  const weekday1to7 = (weekday0 === 0 ? 7 : weekday0); // 1..7 (Lun=1..Dom=7)

  // 2) leer fuentes del día (estas dependen de tus modelos ya migrados)
  const [reservas, liga, elim, agenda] = await Promise.all([
    reservaModel.listByDate({ fecha: ymd }),
    reservaModel.listTorneoPartidosByDate(ymd),
    reservaModel.listElimMatchesByDate(ymd),
    reservaModel.listTorneoAgendaByDate({ fechaYMD: ymd, weekday: weekday0 })
  ]);

  // 2.1) ENTRENOS ACADEMIA (por categoría con dias_mask + cancha_id + hora)
  const bitpos = weekday1to7 - 1; // 0..6
  const [academias] = await pool.execute(
    `
    SELECT c.id, c.nombre, c.cancha_id,
           DATE_FORMAT(c.hora_inicio, '%H:%i') AS hi_txt,
           DATE_FORMAT(c.hora_fin,    '%H:%i') AS hf_txt
    FROM ac_categorias c
    WHERE c.cancha_id IS NOT NULL
      AND c.hora_inicio IS NOT NULL
      AND c.hora_fin    IS NOT NULL
      AND (c.dias_mask & POW(2, :bitpos)) > 0
    `,
    { bitpos }
  );

  // 3) normalizar a bloques
  const blocks = [];
  const normTipo = (t) => (String(t||'').toUpperCase().includes('7') ? 'F7' : 'F5');

  // reservas
  for (const r of (reservas || [])) {
    const fid  = String(r.cancha_id);
    const tipo = normTipo(r.tipo_futbol);
    const hi = (r.hi_txt||'').slice(0,5), hf = (r.hf_txt||'').slice(0,5);
    if (tipo === 'F7') for (const did of displayedFieldIds) blocks.push({ fieldKey: did, hi, hf, type: 'RESERVED', tipo });
    else if (fieldIdSet.has(fid)) blocks.push({ fieldKey: fid, hi, hf, type: 'RESERVED', tipo });
  }

  // liga
  for (const p of (liga || [])) {
    const tipo = normTipo(p.tipo_futbol);
    const hi = (p.hi_txt||'').slice(0,5), hf = (p.hf_txt||'').slice(0,5);
    const torneo_id = p.torneo_id || null;
    if (tipo === 'F7') for (const did of displayedFieldIds) blocks.push({ fieldKey: did, hi, hf, type: 'TOURNAMENT', tipo, torneo_id });
    else {
      const key = (p.cancha_text || '').trim(); if (!key) continue;
      blocks.push({ fieldKey: key, hi, hf, type: 'TOURNAMENT', tipo, torneo_id });
    }
  }

  // eliminación
  for (const m of (elim || [])) {
    const tipo = normTipo(m.tipo_futbol);
    const hi = (m.hi_txt||'').slice(0,5), hf = (m.hf_txt||'').slice(0,5);
    const torneo_id = m.torneo_id || null;
    if (tipo === 'F7') for (const did of displayedFieldIds) blocks.push({ fieldKey: did, hi, hf, type: 'TOURNAMENT', tipo, torneo_id });
    else {
      const key = (m.cancha_text || '').trim(); if (!key) continue;
      blocks.push({ fieldKey: key, hi, hf, type: 'TOURNAMENT', tipo, torneo_id });
    }
  }

  // agenda torneo
  for (const a of (agenda || [])) {
    const fid  = String(a.cancha_id);
    const tipo = normTipo(a.tipo_futbol);
    const hi = (a.hi_txt||'').slice(0,5), hf = (a.hf_txt||'').slice(0,5);
    const torneo_id = a.torneo_id || null;
    if (tipo === 'F7') for (const did of displayedFieldIds) blocks.push({ fieldKey: did, hi, hf, type: 'TOURNAMENT', tipo, torneo_id });
    else if (fieldIdSet.has(fid)) blocks.push({ fieldKey: fid, hi, hf, type: 'TOURNAMENT', tipo, torneo_id });
  }

  // ACADEMIA (se pinta como TOURNAMENT; meta.academia para detallar)
  for (const c of (academias || [])) {
    const fid = String(c.cancha_id);
    const hi = (c.hi_txt||'').slice(0,5), hf = (c.hf_txt||'').slice(0,5);
    if (!fieldIdSet.has(fid)) continue;
    blocks.push({ fieldKey: fid, hi, hf, type: 'TOURNAMENT', tipo: 'F5', academia: true, categoria_id: c.id, categoria_nombre: c.nombre });
  }

  // 4) grilla
  const nameToId = new Map(fields.map(f => [f.nombre.trim(), String(f.id)]));
  const slot_minutes = SLOT_MIN, open_time = OPEN_TIME, close_time = CLOSE_TIME;
  const times = buildTimeGrid({ openHHMM: open_time, closeHHMM: close_time, slotMinutes: slot_minutes });

  const slots = times.map((t) => {
    const row = { time: t, status: {}, meta: {} };
    for (const f of fields) { const fid = String(f.id); row.status[fid] = 'AVAILABLE'; row.meta[fid] = null; }
    const tMin = toMinutes(t);
    for (const b of blocks) {
      const key = String(b.fieldKey);
      const byId   = fieldIdSet.has(key) ? key : null;
      const byName = nameToId.get(key)   ? nameToId.get(key) : null;
      const fid = byId || byName || null;
      if (!fid) continue;
      if (overlapsSlot(tMin, slot_minutes, b.hi, b.hf)) {
        const cur = row.status[fid];
        if (b.type === 'TOURNAMENT') {
          row.status[fid] = 'TOURNAMENT';
          if (!row.meta[fid]) row.meta[fid] = {};
          if (b.torneo_id && !row.meta[fid].torneo_id) row.meta[fid].torneo_id = b.torneo_id;
          if (b.academia) row.meta[fid].academia = { categoria_id: b.categoria_id, categoria_nombre: b.categoria_nombre, hi: b.hi, hf: b.hf };
        } else if (b.type === 'RESERVED' && cur !== 'TOURNAMENT') {
          row.status[fid] = 'RESERVED';
        }
      }
    }
    return row;
  });

  return { date: ymd, slot_minutes, open_time, close_time, fields, slots };
};

// Lookup de reserva por código
exports.lookupReservation = async (code) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT 
      r.id,
      r.codigo_reserva,
      DATE_FORMAT(r.fecha, '%Y-%m-%d')      AS fecha,
      DATE_FORMAT(r.hora_inicio, '%H:%i')   AS hi,
      DATE_FORMAT(r.hora_fin,    '%H:%i')   AS hf,
      r.dur_minutos,
      r.estado,
      r.notas,
      r.cliente_nombres,
      r.cliente_apellidos,
      r.cliente_email,
      r.cliente_telefono,
      c.nombre AS cancha,
      CASE 
        WHEN c.tipo_futbol IN ('5','F5') THEN 'F5'
        WHEN c.tipo_futbol IN ('7','F7') THEN 'F7'
        ELSE 'F5'
      END AS tipo_futbol
    FROM reservas r
    JOIN canchas c ON c.id = r.cancha_id
    WHERE UPPER(r.codigo_reserva) = :code
    LIMIT 1
    `,
    { code: String(code || '').trim().toUpperCase() }
  );

  const row = rows?.[0];
  if (!row) throw new Error('Reserva no encontrada');

  return {
    id: row.id,
    code: row.codigo_reserva,
    codigo_reserva: row.codigo_reserva,
    fecha: row.fecha,
    hi: row.hi,
    hf: row.hf,
    dur_minutos: Number(row.dur_minutos || 0),
    estado: row.estado || 'pendiente',
    notas: row.notas || null,
    cancha: row.cancha,
    tipo_futbol: row.tipo_futbol,
    total_q: null, // la columna no existe
    cliente: {
      nombres:  row.cliente_nombres  || null,
      apellidos:row.cliente_apellidos|| null,
      email:    row.cliente_email    || null,
      telefono: row.cliente_telefono || null,
    },
  };
};

/* =========================
   Calendario — MES (2 líneas: disponibilidad + nota)
   ========================= */
exports.getCalendarMonth = async ({ year, month /* 1..12 */ }) => {
  const y = Number(year);
  const m0 = Number(month) - 1;
  const start = new Date(y, m0, 1);
  const end   = new Date(y, m0 + 1, 1);

  // canchas F5 visibles
  const fields = await exports.listFields();
  const fieldIdSet = new Set(fields.map(f => String(f.id)));
  const nameToId   = new Map(fields.map(f => [String(f.nombre).trim(), String(f.id)]));
  const displayedFieldIds = fields.map(f => String(f.id));
  const normTipo = (t) => (String(t||'').toUpperCase().includes('7') ? 'F7' : 'F5');

  const pool = await getPool();

  // RESERVAS del mes
  const [resR] = await pool.execute(
    `
    SELECT 
      DATE_FORMAT(r.fecha, '%Y-%m-%d') AS ymd,
      r.cancha_id,
      DATE_FORMAT(r.hora_inicio, '%H:%i') AS hi_txt,
      DATE_FORMAT(r.hora_fin,    '%H:%i') AS hf_txt,
      r.dur_minutos, c.tipo_futbol
    FROM reservas r
    JOIN canchas c ON c.id = r.cancha_id
    WHERE r.fecha >= :start AND r.fecha < :end
      AND r.estado IN ('pendiente', 'pagada')
    `,
    { start, end }
  );

  // PARTIDOS LIGA del mes
  const [resL] = await pool.execute(
    `
    SELECT 
      DATE_FORMAT(p.fecha, '%Y-%m-%d') AS ymd,
      DATE_FORMAT(p.hora, '%H:%i') AS hi_txt,
      DATE_FORMAT(ADDTIME(p.hora, SEC_TO_TIME(IFNULL(t.dur_minutos_partido,60)*60)), '%H:%i') AS hf_txt,
      p.cancha AS cancha_text,
      CASE WHEN t.tipo_futbol = '5' THEN 'F5' 
           WHEN t.tipo_futbol = '7' THEN 'F7' 
           ELSE 'F5' END AS tipo_futbol
    FROM partidos p
    JOIN jornadas j ON j.id = p.jornada_id
    JOIN torneos t  ON t.id = j.torneo_id
    WHERE p.fecha >= :start AND p.fecha < :end
    `,
    { start, end }
  );

  // PARTIDOS ELIM del mes
  const [resE] = await pool.execute(
    `
    SELECT 
      DATE_FORMAT(m.fecha, '%Y-%m-%d') AS ymd,
      DATE_FORMAT(m.hora, '%H:%i') AS hi_txt,
      DATE_FORMAT(ADDTIME(m.hora, SEC_TO_TIME(IFNULL(t.dur_minutos_partido,60)*60)), '%H:%i') AS hf_txt,
      m.cancha AS cancha_text,
      CASE WHEN t.tipo_futbol = '5' THEN 'F5' 
           WHEN t.tipo_futbol = '7' THEN 'F7' 
           ELSE 'F5' END AS tipo_futbol
    FROM elim_matches m
    JOIN eliminatorias e ON e.id = m.eliminatoria_id
    JOIN torneos t       ON t.id = e.torneo_id
    WHERE m.fecha >= :start AND m.fecha < :end
    `,
    { start, end }
  );

  // CIERRES del mes
  const [closedDaysR] = await pool.execute(
    `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS ymd FROM calendario_cierres WHERE fecha >= :start AND fecha < :end`,
    { start, end }
  );
  const closedSet = new Set((closedDaysR || []).map(x => x.ymd));

  // AGENDA por weekday (torneo)
  const agendaByW = new Map();
  for (let w = 0; w < 7; w++) {
    const lst = await reservaModel.listTorneoAgendaByDate({
      fechaYMD: new Date(start).toISOString().slice(0,10),
      weekday: w
    });
    agendaByW.set(w, (lst || []).map(a => ({
      cancha_id: String(a.cancha_id),
      hi: (a.hi_txt || '').slice(0,5),
      hf: (a.hf_txt || '').slice(0,5),
      tipo_futbol: normTipo(a.tipo_futbol)
    })));
  }

  // ACADEMIA semanal (todas las categorías, luego filtramos por weekday)
  const [acRows] = await pool.execute(
    `
    SELECT 
      id, nombre, dias_mask, cancha_id,
      DATE_FORMAT(hora_inicio, '%H:%i') AS hi_txt,
      DATE_FORMAT(hora_fin,    '%H:%i') AS hf_txt
    FROM ac_categorias
    WHERE cancha_id IS NOT NULL
      AND hora_inicio IS NOT NULL
      AND hora_fin    IS NOT NULL
    `
  );
  const academyAll = (acRows || []).map(r => ({
    id: r.id,
    nombre: r.nombre,
    dias_mask: Number(r.dias_mask || 0),
    cancha_id: String(r.cancha_id),
    hi: (r.hi_txt || '').slice(0,5),
    hf: (r.hf_txt || '').slice(0,5),
  }));

  // Indexación por día
  const dayKey = (d) => (typeof d === 'string' ? d : new Date(d).toISOString().slice(0,10));
  const buckets = {}; // key -> { blocks: [], hasTournament: bool, hasAcademia: bool }
  const addBucket = (key) => (buckets[key] ??= { blocks: [], hasTournament: false, hasAcademia: false });

  // RESERVAS -> blocks
  for (const r of (resR || [])) {
    const key = dayKey(r.ymd);
    const b = addBucket(key);
    const fid = String(r.cancha_id);
    const tipo = normTipo(r.tipo_futbol);
    const hi = (r.hi_txt||'').slice(0,5), hf = (r.hf_txt||'').slice(0,5);
    if (tipo === 'F7') {
      for (const did of displayedFieldIds) b.blocks.push({ fieldKey: did, hi, hf, type: 'RESERVED', tipo });
    } else {
      if (fieldIdSet.has(fid)) b.blocks.push({ fieldKey: fid, hi, hf, type: 'RESERVED', tipo });
    }
  }

  // LIGA -> blocks
  for (const p of (resL || [])) {
    const key = dayKey(p.ymd);
    const b = addBucket(key);
    const tipo = normTipo(p.tipo_futbol);
    const hi = (p.hi_txt||'').slice(0,5), hf = (p.hf_txt||'').slice(0,5);
    if (tipo === 'F7') {
      for (const did of displayedFieldIds) b.blocks.push({ fieldKey: did, hi, hf, type: 'TOURNAMENT', tipo });
    } else {
      const k  = String(p.cancha_text || '').trim();
      if (k) b.blocks.push({ fieldKey: k, hi, hf, type: 'TOURNAMENT', tipo });
    }
    b.hasTournament = true;
  }

  // ELIM -> blocks
  for (const m of (resE || [])) {
    const key = dayKey(m.ymd);
    const b = addBucket(key);
    const tipo = normTipo(m.tipo_futbol);
    const hi = (m.hi_txt||'').slice(0,5), hf = (m.hf_txt||'').slice(0,5);
    if (tipo === 'F7') {
      for (const did of displayedFieldIds) b.blocks.push({ fieldKey: did, hi, hf, type: 'TOURNAMENT', tipo });
    } else {
      const k  = String(m.cancha_text || '').trim();
      if (k) b.blocks.push({ fieldKey: k, hi, hf, type: 'TOURNAMENT', tipo });
    }
    b.hasTournament = true;
  }

  // Recorremos días del mes y resolvemos estado
  const summary = {};
  const times = buildTimeGrid({ openHHMM: OPEN_TIME, closeHHMM: CLOSE_TIME, slotMinutes: SLOT_MIN });

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d);
    const w0 = d.getDay();           // 0..6
    const w1 = (w0 === 0 ? 7 : w0);  // 1..7
    const b = addBucket(key);

    // + agenda de torneo fija por weekday
    for (const a of (agendaByW.get(w0) || [])) {
      if (a.tipo_futbol === 'F7') {
        for (const did of displayedFieldIds) b.blocks.push({ fieldKey: did, hi: a.hi, hf: a.hf, type: 'TOURNAMENT', tipo: 'F7' });
      } else if (fieldIdSet.has(a.cancha_id)) {
        b.blocks.push({ fieldKey: a.cancha_id, hi: a.hi, hf: a.hf, type: 'TOURNAMENT', tipo: 'F5' });
      }
      b.hasTournament = true;
    }

    // + Academia por weekday (bit w1-1)
    const bit = (1 << (w1 - 1));
    for (const ac of academyAll) {
      if ((ac.dias_mask & bit) === 0) continue;
      if (!fieldIdSet.has(ac.cancha_id)) continue;
      b.blocks.push({ fieldKey: ac.cancha_id, hi: ac.hi, hf: ac.hf, type: 'TOURNAMENT', tipo: 'F5', academia: true });
      b.hasAcademia = true;
    }

    // Cerrado
    if (closedSet.has(key)) {
      summary[key] = {
        availability: { label: 'Cerrado', type: 'CLOSED' },
        tag: null
      };
      continue;
    }

    // Si no hay bloques → Disponible
    if (!b.blocks.length) {
      summary[key] = {
        availability: { label: 'Disponible', type: 'AVAILABLE' },
        tag: null
      };
      continue;
    }

    // ¿queda algún slot AVAILABLE?
    let anyAvailable = false;
    outer:
    for (const t of times) {
      const tMin = toMinutes(t);
      for (const f of fields) {
        let status = 'AVAILABLE';
        for (const blk of b.blocks) {
          const keyK = String(blk.fieldKey);
          const byId   = fieldIdSet.has(keyK) ? keyK : null;
          const byName = nameToId.get(keyK)   ? nameToId.get(keyK) : null;
          const fid = byId || byName || null;
          if (!fid || String(f.id) !== fid) continue;
          if (overlapsSlot(tMin, SLOT_MIN, blk.hi, blk.hf)) {
            status = (blk.type === 'TOURNAMENT') ? 'TOURNAMENT'
                    : (status === 'TOURNAMENT' ? 'TOURNAMENT' : 'RESERVED');
          }
        }
        if (status === 'AVAILABLE') { anyAvailable = true; break outer; }
      }
    }

    // Línea 1: disponibilidad
    const availability = anyAvailable
      ? { label: 'Disponible', type: 'AVAILABLE' }
      : { label: 'Ocupado',    type: 'RESERVED'  };

    // Línea 2: tag (si hay Academia o Torneo)
    let tag = null;
    if (b.hasAcademia) tag = { label: 'Academia', type: 'TOURNAMENT' };
    else if (b.hasTournament) tag = { label: 'Torneo', type: 'TOURNAMENT' };

    summary[key] = { availability, tag };
  }

  return { summary };
};
