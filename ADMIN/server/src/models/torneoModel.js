// models/torneoModel.js  ✅ MySQL + mysql2/promise
const { getPool } = require('../config/db');

/* =========================
   Helpers de agendado (JS)
   ========================= */
function pad2(n){ return String(n).padStart(2,'0'); }
function normHHMM(hhmm) {
  // Acepta '7:00' o '07:00' y devuelve '07:00:00'
  const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = pad2(m[1]);
  const mm = m[2];
  return `${hh}:${mm}:00`;
}



function toSqlTime(hhmm){
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if(!m) return null;
  return `${pad2(m[1])}:${m[2]}:00`;
}
function formatYMD(d){
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth()+1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}
function nextWeekday(baseDate, weekday){
  // weekday: 0..6  (Dom..Sáb)
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const diff = (weekday - d.getDay() + 7) % 7;
  if (diff === 0) return d;
  d.setDate(d.getDate() + diff);
  return d;
}

/* =========================
   Config de agendado
   ========================= */
async function getTorneoSchedulingConfig(torneo_id){
  const pool = await getPool();

  // Torneo: día de semana + start_date
  const [[torneo]] = await pool.execute(
    `SELECT id, dia_semana, start_date FROM torneos WHERE id=:tid`,
    { tid: torneo_id }
  );
  if (!torneo) throw new Error('Torneo no encontrado');

  const dia_semana = torneo.dia_semana;
  const start_date = torneo.start_date ? new Date(torneo.start_date) : null;

  // Franjas
  const [fr] = await pool.execute(
    `SELECT 
       DATE_FORMAT(hora_inicio,'%H:%i:%s') AS hi,
       DATE_FORMAT(hora_fin,   '%H:%i:%s') AS hf
     FROM torneo_franjas
     WHERE torneo_id=:tid
     ORDER BY hora_inicio`,
    { tid: torneo_id }
  );
  const franjas = (fr || []).map(r => ({ hi: r.hi, hf: r.hf }));

  // Canchas
  const [ch] = await pool.execute(
    `SELECT c.id, c.nombre
       FROM torneo_canchas tc
       JOIN canchas c ON c.id=tc.cancha_id
      WHERE tc.torneo_id=:tid
      ORDER BY c.id`,
    { tid: torneo_id }
  );
  const canchas = (ch || []).map(r => ({ id: r.id, nombre: r.nombre }));

  return { dia_semana, start_date, franjas, canchas };
}

function* buildSlotsIterator({ startDate, dia_semana, franjas, canchas }) {
  // Genera slots infinitos: fecha→franja→cancha
  let d = nextWeekday(startDate, Number(dia_semana));
  for (;;) {
    const fecha = formatYMD(d);
    for (const f of franjas) {
      const hora  = toSqlTime(f.hi); // HH:MM:SS
      const hasta = toSqlTime(f.hf); // HH:MM:SS
      for (const c of canchas) {
        yield { fecha, hora, hasta, canchaNombre: c.nombre };
      }
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
  }
}

/* =========================
   CRUD / Lecturas básicas
   ========================= */
async function crearTorneo(data) {
  const {
    nombre,
    tipo_futbol,                // '5' | '7'
    tipo_torneo,                // 'liga' | 'playoffs' | mixto...
    ida_vuelta,
    clasificados,
    dia_semana = null,          // 0..6 (Dom..Sáb)
    franjas = [],               // [{hi, hf}] o [{inicio, fin}]
    canchas = [],               // [ids]
    dur_minutos_partido = null,
    start_date = null,
    costo_inscripcion_q = 0
  } = data;

  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) torneos
    const [res] = await conn.execute(
      `INSERT INTO torneos (
         nombre, tipo_futbol, tipo_torneo, ida_vuelta, clasificados,
         dia_semana, dur_minutos_partido, start_date, costo_inscripcion_q
       )
       VALUES (
         :nombre, :tipo_futbol, :tipo_torneo, :ida_vuelta, :clasificados,
         :dia, :dur, :sd, :costo
       )`,
      {
        nombre,
        tipo_futbol,
        tipo_torneo,
        ida_vuelta: ida_vuelta ? 1 : 0,
        clasificados: clasificados || 0,
        dia: (dia_semana === '' || dia_semana === null || dia_semana === undefined)
              ? null : Number(dia_semana),
        dur: (dur_minutos_partido ?? null),
        sd: start_date ? new Date(start_date) : null,
        costo: Number(costo_inscripcion_q || 0)
      }
    );
    const torneoId = res.insertId;

    // 2) franjas
    if (Array.isArray(franjas) && franjas.length) {
      for (const f of franjas) {
        // Acepta { inicio, fin } o { hi, hf }
      const rawHi = (f?.inicio ?? f?.hi ?? '').toString().slice(0,5);
      const rawHf = (f?.fin    ?? f?.hf ?? '').toString().slice(0,5);
      const hi = normHHMM(rawHi);
      const hf = normHHMM(rawHf);
      if (!hi || !hf) continue; // evita basuras → NO inserta '00:00:00'

     await conn.execute(
        `INSERT INTO torneo_franjas (torneo_id, hora_inicio, hora_fin)
         VALUES (:tid, :hi, :hf)`,
        { tid: torneoId, hi, hf }
      );
      }
    }

    // 3) canchas
    if (Array.isArray(canchas) && canchas.length) {
      for (const canchaId of canchas) {
        const cid = Number(canchaId);
        if (!cid) continue;
        await conn.execute(
          `INSERT INTO torneo_canchas (torneo_id, cancha_id)
           VALUES (:tid, :cid)`,
          { tid: torneoId, cid }
        );
      }
    }

    await conn.commit();
    return { insertId: torneoId };
  } catch (e) {
    try { await conn.rollback(); } catch(_) {}
    throw e;
  } finally {
    conn.release();
  }
}

async function obtenerTorneos() {
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT 
      t.*,
      (SELECT COUNT(1) FROM jornadas j WHERE j.torneo_id = t.id) AS jornadas_count
    FROM torneos t
    ORDER BY t.fecha_creacion DESC
  `);
  return rows;
}

async function obtenerEquiposPorTorneo(torneo_id) {
  const pool = await getPool();
  const [rows] = await pool.execute(
    'SELECT id FROM equipos WHERE torneo_id=:tid',
    { tid: torneo_id }
  );
  return rows;
}

async function obtenerConfiguracionTorneo(torneo_id) {
  const pool = await getPool();
  const [rows] = await pool.execute(
    'SELECT * FROM torneos WHERE id=:tid',
    { tid: torneo_id }
  );
  return rows;
}

async function contarJornadas(torneo_id) {
  const pool = await getPool();
  const [[row]] = await pool.execute(
    'SELECT COUNT(1) AS n FROM jornadas WHERE torneo_id=:tid',
    { tid: torneo_id }
  );
  return row?.n || 0;
}

async function setFase(torneo_id, fase) {
  const pool = await getPool();
  await pool.execute(
    'UPDATE torneos SET fase=:fase WHERE id=:tid',
    { tid: torneo_id, fase }
  );
}

async function eliminarTorneo(id) {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // --- ELIMINACIÓN (fase de playoffs) ------------------------------------
    // 1) Romper self-FK en elim_matches
    await conn.execute(`
      UPDATE elim_matches em
      JOIN eliminatorias e ON e.id = em.eliminatoria_id
      SET em.next_match_id = NULL,
          em.parent_match_id = NULL
      WHERE e.torneo_id = :tid
    `, { tid: id });

    // 2) Detalle de eliminación por MATCH
    await conn.execute(`
      DELETE epd
      FROM elim_partido_detalle epd
      JOIN elim_matches em ON em.id = epd.match_id
      JOIN eliminatorias e ON e.id = em.eliminatoria_id
      WHERE e.torneo_id = :tid
    `, { tid: id });

    // 3) Detalle de eliminación por JUGADOR (por si hay registros sueltos)
    await conn.execute(`
      DELETE epd
      FROM elim_partido_detalle epd
      JOIN jugadores j  ON j.id = epd.jugador_id
      JOIN equipos   eq ON eq.id = j.equipo_id
      WHERE eq.torneo_id = :tid
    `, { tid: id });

    // 4) Partidos de eliminación
    await conn.execute(`
      DELETE em
      FROM elim_matches em
      JOIN eliminatorias e ON e.id = em.eliminatoria_id
      WHERE e.torneo_id = :tid
    `, { tid: id });

    // 5) Config de rondas
    await conn.execute(`
      DELETE er
      FROM elim_rounds er
      JOIN eliminatorias e ON e.id = er.eliminatoria_id
      WHERE e.torneo_id = :tid
    `, { tid: id });

    // 6) Cabecera eliminatorias
    await conn.execute(`DELETE FROM eliminatorias WHERE torneo_id = :tid`, { tid: id });

    // --- LIGUILLA (liga) ----------------------------------------------------
    // 7) Detalle de partido por PARTIDO (más seguro que confiar en cascada múltiple)
    await conn.execute(`
      DELETE pd
      FROM partido_detalle pd
      JOIN partidos p ON p.id = pd.partido_id
      JOIN jornadas j ON j.id = p.jornada_id
      WHERE j.torneo_id = :tid
    `, { tid: id });

    // 8) Detalle de partido por JUGADOR (cubre cualquier rezago)
    await conn.execute(`
      DELETE pd
      FROM partido_detalle pd
      JOIN jugadores j  ON j.id = pd.jugador_id
      JOIN equipos   eq ON eq.id = j.equipo_id
      WHERE eq.torneo_id = :tid
    `, { tid: id });

    // 9) Partidos
    await conn.execute(`
      DELETE p
      FROM partidos p
      JOIN jornadas j ON j.id = p.jornada_id
      WHERE j.torneo_id = :tid
    `, { tid: id });

    // 10) Jornadas
    await conn.execute(`DELETE FROM jornadas WHERE torneo_id = :tid`, { tid: id });

    // --- EQUIPOS / JUGADORES ----------------------------------------------
    // 11) Jugadores
    await conn.execute(`
      DELETE j
      FROM jugadores j
      JOIN equipos e ON e.id = j.equipo_id
      WHERE e.torneo_id = :tid
    `, { tid: id });

    // 12) Equipos
    await conn.execute(`DELETE FROM equipos WHERE torneo_id = :tid`, { tid: id });

    // --- CONFIG DEL TORNEO --------------------------------------------------
    // 13) Franjas y canchas
    await conn.execute(`DELETE FROM torneo_franjas WHERE torneo_id = :tid`, { tid: id });
    await conn.execute(`DELETE FROM torneo_canchas  WHERE torneo_id = :tid`, { tid: id });

    // 14) Torneo
    await conn.execute(`DELETE FROM torneos WHERE id = :tid`, { tid: id });

    await conn.commit();
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}


/* =========================
   Crear Fixture (Liguilla) con agenda
   ========================= */
async function crearFixture(torneo_id, calendario) {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) jornadas
    for (let i = 0; i < calendario.length; i++) {
      await conn.execute(
        'INSERT INTO jornadas (numero, torneo_id) VALUES (:n, :tid)',
        { n: i + 1, tid: torneo_id }
      );
    }

    // 2) map numero->id
    const [jr] = await conn.execute(
      'SELECT id, numero FROM jornadas WHERE torneo_id=:tid',
      { tid: torneo_id }
    );
    const map = new Map(jr.map(r => [r.numero, r.id]));

    // 3) insert partidos (sin agenda)
    const insertedIds = [];
    for (let i = 0; i < calendario.length; i++) {
      const jornada_id = map.get(i + 1);
      for (const p of calendario[i]) {
        const [ins] = await conn.execute(
          `INSERT INTO partidos 
             (jornada_id, equipo_local_id, equipo_visita_id, goles_local, goles_visita)
           VALUES (:jid, :loc, :vis, NULL, NULL)`,
          { jid: jornada_id, loc: p.local_id, vis: p.visita_id }
        );
        insertedIds.push({ id: ins.insertId, jornada_id });
      }
    }

    // 4) agenda automática
    const cfg = await getTorneoSchedulingConfig(torneo_id);
    const valid = !(cfg.dia_semana == null || (cfg.franjas||[]).length === 0 || (cfg.canchas||[]).length === 0);

    if (valid) {
      // Base: start_date del torneo; si falta, hoy
      const baseStart = cfg.start_date ? new Date(cfg.start_date) : new Date();
      const wd = baseStart.getDay();
      const wanted = Number(cfg.dia_semana);
      const startDate = (wd === wanted) ? baseStart : nextWeekday(baseStart, wanted);

      const it = buildSlotsIterator({
        startDate,
        dia_semana: cfg.dia_semana,
        franjas: cfg.franjas.map(f => ({ hi: f.hi.slice(0,5), hf: f.hf.slice(0,5) })),
        canchas: cfg.canchas
      });

      for (const p of insertedIds) {
        const slot = it.next().value;
        if (!slot) break;
        await conn.execute(
          `UPDATE partidos
             SET fecha=:f,
                 hora = TIME(:h),
                 cancha=:c
           WHERE id=:id`,
          { id: p.id, f: slot.fecha, h: slot.hora, c: slot.canchaNombre }
        );
      }
    }

    await conn.commit();
  } catch (e) {
    try { await conn.rollback(); } catch(_) {}
    throw e;
  } finally {
    conn.release();
  }
}

/* =========================
   Utilidades de canchas/agenda
   ========================= */
// Todas las canchas ACTIVAS por tipo de fútbol ('5'|'7') → ids
async function listCanchaIdsByTipo(tipo_futbol_char) {
  const tf = String(tipo_futbol_char || '5') === '7' ? 'F7' : 'F5';
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT id FROM canchas
     WHERE activa=1 AND tipo_futbol=:tf
     ORDER BY id`,
    { tf }
  );
  return rows.map(x => x.id);
}

// Franjas de torneos por weekday / tipo / canchas (agenda base semanal)
async function listAgendaByWeekday({ weekday, tipo_futbol, canchaIds }) {
  const pool = await getPool();
  const w = Number(weekday);
  const tf = String(tipo_futbol || '5'); // en torneos es '5'/'7'

  if (!Array.isArray(canchaIds) || canchaIds.length === 0) return [];

  const ids = canchaIds.map(Number).filter(Boolean);
  const placeholders = ids.map((_, i) => `:id${i}`).join(',');

  const params = { w, tf };
  ids.forEach((v, i) => (params[`id${i}`] = v));

  const [rows] = await pool.execute(
    `
    SELECT
      c.id   AS cancha_id,
      DATE_FORMAT(tf.hora_inicio,'%H:%i') AS hi,
      DATE_FORMAT(tf.hora_fin,   '%H:%i') AS hf
    FROM torneos t
    JOIN torneo_franjas tf ON tf.torneo_id = t.id
    JOIN torneo_canchas tc ON tc.torneo_id = t.id
    JOIN canchas c         ON c.id = tc.cancha_id
    WHERE t.dia_semana = :w
      AND t.tipo_futbol = :tf
      AND c.id IN (${placeholders})
    `,
    params
  );
  return rows || [];
}

// peers de un set de canchas (incluye self)
async function getPeersForCanchas(canchaIds) {
  const ids = canchaIds.map(Number).filter(Boolean);
  if (!ids.length) return { peersMap: new Map(), peersAll: new Set() };

  const pool = await getPool();
  const placeholders = ids.map((_, i) => `:id${i}`).join(',');
  const params = {};
  ids.forEach((v, i) => (params[`id${i}`] = v));

  const [rows] = await pool.execute(
    `
    SELECT cgd1.cancha_id AS base_id, cgd2.cancha_id AS peer_id
    FROM cancha_grupo_det cgd1
    JOIN cancha_grupo_det cgd2 ON cgd1.grupo_id = cgd2.grupo_id
    WHERE cgd1.cancha_id IN (${placeholders})
    `,
    params
  );

  const peersMap = new Map(); // base -> Set(peerIds including base)
  const peersAll = new Set(ids);

  for (const row of rows) {
    const s = peersMap.get(row.base_id) || new Set([row.base_id]);
    s.add(row.peer_id);
    peersMap.set(row.base_id, s);
    peersAll.add(row.peer_id);
  }
  // asegura self
  for (const id of ids) {
    if (!peersMap.has(id)) peersMap.set(id, new Set([id]));
  }
  return { peersMap, peersAll };
}

// Ocupación de torneos por día (SEMANA) sobre un set de canchas (cualquier tipo)
async function listAgendaByWeekdayAnyTipo({ weekday, canchaIds }) {
  const ids = canchaIds.map(Number).filter(Boolean);
  if (!ids.length) return [];
  const pool = await getPool();

  const placeholders = ids.map((_, i) => `:id${i}`).join(',');
  const params = { w: Number(weekday) };
  ids.forEach((v, i) => (params[`id${i}`] = v));

  const [rows] = await pool.execute(
    `
    SELECT
      c.id AS cancha_id,
      DATE_FORMAT(tf.hora_inicio,'%H:%i') AS hi,
      DATE_FORMAT(tf.hora_fin,   '%H:%i') AS hf
    FROM torneos t
    JOIN torneo_franjas tf ON tf.torneo_id = t.id
    JOIN torneo_canchas tc ON tc.torneo_id = t.id
    JOIN canchas c         ON c.id = tc.cancha_id
    WHERE t.dia_semana = :w
      AND c.id IN (${placeholders})
    `,
    params
  );
  return rows || [];
}

// Igual a reservas.hasOverlap pero para agenda semanal de torneos
async function hasTorneoOverlapForBase({ cancha_id, weekday, desde, hasta }) {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT 1 AS overlap
    FROM torneos t
    JOIN torneo_franjas tf ON tf.torneo_id = t.id
    JOIN torneo_canchas  tc ON tc.torneo_id = t.id
    WHERE t.dia_semana = :w
      AND tc.cancha_id IN (
        SELECT cgd2.cancha_id
        FROM cancha_grupo_det cgd1
        JOIN cancha_grupo_det cgd2 ON cgd1.grupo_id = cgd2.grupo_id
        WHERE cgd1.cancha_id = :cid
        UNION
        SELECT :cid
      )
      AND ( TIME(:d) < tf.hora_fin AND TIME(:h) > tf.hora_inicio )
    LIMIT 1
    `,
    { cid: cancha_id, w: Number(weekday), d: desde, h: hasta }
  );
  return !!rows[0];
}

module.exports = {
  crearTorneo,
  obtenerTorneos,
  obtenerEquiposPorTorneo,
  obtenerConfiguracionTorneo,
  crearFixture,
  contarJornadas,
  setFase,
  eliminarTorneo,
  getTorneoSchedulingConfig,
  listCanchaIdsByTipo,
  listAgendaByWeekday,
  getPeersForCanchas,
  listAgendaByWeekdayAnyTipo,
  hasTorneoOverlapForBase,
};
