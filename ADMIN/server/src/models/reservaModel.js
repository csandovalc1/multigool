// models/reservaModel.js  ✅ MySQL
const { getPool } = require('../config/db');

/* ==============================
 * Transacciones
 * ============================== */
const withTransaction = async (fn) => {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* noop */ }
    throw err;
  } finally {
    conn.release();
  }
};

/* ==============================
 * Helper: validar cierre por fecha
 * ============================== */
const assertDateOpen = async (fechaYMD, conn = null) => {
  const db = conn || (await getPool());
  const [rows] = await db.execute(
    `SELECT 1 AS closed FROM calendario_cierres WHERE fecha = :f LIMIT 1`,
    { f: String(fechaYMD) } // <-- string exacto 'YYYY-MM-DD'
  );
  if (rows[0]?.closed) {
    const err = new Error('La fecha seleccionada está CERRADA y no admite reservas.');
    err.code = 'DATE_CLOSED';
    err.http = 409;
    throw err;
  }
};


/* ==============================
 * LISTADOS Y GETTERS
 * ============================== */

exports.listByDate = async ({ fecha, tipo_futbol, cancha_id, q, codigo, estado }) => {
  const pool = await getPool();
  const params = {};
  let qstr = `
    SELECT 
      r.*,
      CAST(r.price_total AS DECIMAL(10,2)) AS price_total_q,
      DATE_FORMAT(r.hora_inicio, '%H:%i:%s') AS hi_txt,
      DATE_FORMAT(r.hora_fin,    '%H:%i:%s') AS hf_txt,
      c.nombre AS cancha_nombre, 
      c.tipo_futbol
    FROM reservas r
    JOIN canchas c ON c.id = r.cancha_id
    WHERE 1=1`;

  if (fecha)      { qstr += ` AND r.fecha = :f`;         params.f  = new Date(fecha); }
  if (tipo_futbol){ qstr += ` AND c.tipo_futbol = :tf`;  params.tf = tipo_futbol; }
  if (cancha_id)  { qstr += ` AND c.id = :cid`;          params.cid = cancha_id; }

  if (codigo) {
    qstr += ` AND r.codigo_reserva = :cod`;
    params.cod = codigo;
  }

  if (estado)     { qstr += ` AND r.estado = :estado`;   params.estado = estado; }

  if (q) {
    qstr += `
      AND (
        r.cliente_nombres   LIKE :q OR
        r.cliente_apellidos LIKE :q OR
        r.cliente_email     LIKE :q OR
        r.cliente_telefono  LIKE :q OR
        r.codigo_reserva    LIKE :q
      )`;
    params.q = `%${q}%`;
  }

  qstr += ` ORDER BY r.fecha DESC, c.nombre, r.hora_inicio`;
  const [rows] = await pool.execute(qstr, params);
  return rows;
};

/* === Reservas por RANGO (semana) === */
exports.listByRange = async ({ start, end, tipo_futbol, cancha_id, q, codigo, estado }) => {
  const pool = await getPool();
  const params = { s: new Date(start), e: new Date(end) };
  let qstr = `
    SELECT 
      r.*,
      CAST(r.price_total AS DECIMAL(10,2)) AS price_total_q,
      DATE_FORMAT(r.hora_inicio, '%H:%i:%s') AS hi_txt,
      DATE_FORMAT(r.hora_fin,    '%H:%i:%s') AS hf_txt,
      c.nombre AS cancha_nombre, 
      c.tipo_futbol
    FROM reservas r
    JOIN canchas c ON c.id = r.cancha_id
    WHERE r.fecha BETWEEN :s AND :e`;

  if (tipo_futbol){ qstr += ` AND c.tipo_futbol = :tf`; params.tf = tipo_futbol; }
  if (cancha_id)  { qstr += ` AND c.id = :cid`;         params.cid = cancha_id; }

  if (codigo) { qstr += ` AND r.codigo_reserva = :cod`; params.cod = codigo; }
  if (estado)     { qstr += ` AND r.estado = :estado`;  params.estado = estado; }

  if (q) {
    qstr += `
      AND (
        r.cliente_nombres   LIKE :q OR
        r.cliente_apellidos LIKE :q OR
        r.cliente_email     LIKE :q OR
        r.cliente_telefono  LIKE :q OR
        r.codigo_reserva    LIKE :q
      )`;
    params.q = `%${q}%`;
  }

  qstr += ` ORDER BY r.fecha ASC, c.nombre, r.hora_inicio`;
  const [rows] = await pool.execute(qstr, params);
  return rows;
};

exports.getCancha = async (id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM canchas WHERE id=:id AND activa=1`,
    { id }
  );
  return rows[0] || null;
};

/* ==============================
 * OVERLAPS con bloqueo direccional F5↔F7 (no F5↔F5)
 * ============================== */

const overlapBaseSQL = (extraWhere = '') => `
  SELECT 1 AS overlap
  FROM reservas r
  WHERE r.cancha_id IN (
    SELECT cancha_id FROM (
      /* self */
      SELECT s.self_id AS cancha_id
      FROM (SELECT id AS self_id, UPPER(tipo_futbol) AS self_tipo FROM canchas WHERE id = :cid) s
      UNION ALL
      /* peers F5<->F7 según tipo de la self */
      SELECT p.peer_id
      FROM (SELECT UPPER(c2.tipo_futbol) AS peer_tipo, c2.id AS peer_id
            FROM cancha_grupo_det cgd1
            JOIN cancha_grupo_det cgd2 ON cgd1.grupo_id = cgd2.grupo_id
            JOIN canchas c2           ON c2.id = cgd2.cancha_id
            WHERE cgd1.cancha_id = :cid) p
      JOIN (SELECT UPPER(tipo_futbol) AS self_tipo FROM canchas WHERE id = :cid) s2
        ON ( (s2.self_tipo = 'F5' AND p.peer_tipo = 'F7')
          OR (s2.self_tipo = 'F7' AND p.peer_tipo = 'F5') )
    ) z
  )
  AND r.fecha = :f
  AND r.estado IN ('pendiente','pagada','completada')
  AND ( TIME(:d) < r.hora_fin AND TIME(:h) > r.hora_inicio )
  ${extraWhere}
  LIMIT 1
`;

exports.hasOverlap = async ({ cancha_id, fecha, desde, hasta }) => {
  const pool = await getPool();
  const [rows] = await pool.execute(overlapBaseSQL(), {
    cid: cancha_id,
    f: new Date(fecha),
    d: desde,
    h: hasta
  });
  return !!rows[0];
};

exports.hasOverlapExcept = async ({ id, cancha_id, fecha, desde, hasta }) => {
  const pool = await getPool();
  const [rows] = await pool.execute(overlapBaseSQL(`AND r.id <> :id`), {
    id,
    cid: cancha_id,
    f: new Date(fecha),
    d: desde,
    h: hasta
  });
  return !!rows[0];
};

/* ==============================
 * CRUD RESERVAS (100% transaccional)
 * ============================== */

exports.create = async ({
  cancha_id, fecha, hora_inicio, hora_fin, dur_minutos, notas,
  cliente_nombres, cliente_apellidos, cliente_email, cliente_telefono,
  price_total_q
}) => {
  return withTransaction(async (conn) => {
    await assertDateOpen(fecha, conn);

    const price_total = Number(Number(price_total_q || 0).toFixed(2));

    const insertSQL = `
INSERT INTO reservas (
        cancha_id, fecha, hora_inicio, hora_fin, dur_minutos, notas,
        cliente_nombres, cliente_apellidos, cliente_email, cliente_telefono,
        price_total
      )
      VALUES (
        :cid, :f, :hi, :hf, :dur, :notas,
        :n, :a, :e, :t,
        :pt
      )
    `;
    const params = {
      cid: cancha_id,
      f: new Date(fecha),
      hi: hora_inicio,
      hf: hora_fin,
      dur: dur_minutos,
      notas: notas || null,
      n: cliente_nombres,
      a: cliente_apellidos || null,
      e: cliente_email || null,
      t: cliente_telefono || null,
      pt: price_total
    };

    const [res] = await conn.execute(insertSQL, params);
    const id = res.insertId;

    const [[row]] = await conn.execute(
      `SELECT id, codigo_reserva AS code, price_total AS total_q FROM reservas WHERE id=:id`,
      { id }
    );
    return row; // { id, code, total_q }
  });
};

exports.cancel = async (id) => {
  const pool = await getPool();
  await pool.execute(
    `UPDATE reservas SET estado='cancelado' WHERE id=:id`,
    { id }
  );
};

exports.getById = async (id) => {
  const pool = await getPool();
  const [[row]] = await pool.execute(
    `SELECT r.* FROM reservas r WHERE r.id = :id`,
    { id }
  );
  return row || null;
};

// === CIERRES ===
exports.isDateClosed = async (fechaYMD) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT 1 AS closed FROM calendario_cierres WHERE fecha = :f LIMIT 1`,
    { f: String(fechaYMD) } // <-- string, no Date()
  );
  return !!rows[0];
};


exports.updateEstado = async (id, estado) => {
  const pool = await getPool();
  await pool.execute(
    `UPDATE reservas SET estado=:e WHERE id=:id`,
    { id, e: estado }
  );
  return { ok: true };
};

exports.updateCore = async ({ id, cancha_id, fecha, hora_inicio, hora_fin, dur_minutos, estado, price_total_q }) => {
  return withTransaction(async (conn) => {
    await assertDateOpen(fecha, conn);

    const params = {
      id,
      cid: cancha_id,
      f: new Date(fecha),
      hi: hora_inicio,
      hf: hora_fin,
      dur: dur_minutos
    };

    let q = `
      SET cancha_id=:cid,
          fecha=:f,
          hora_inicio=:hi,
          hora_fin=:hf,
          dur_minutos=:dur`;

    if (Number.isFinite(Number(price_total_q))) {
      q += `, price_total=:pt`;
      params.pt = Number(Number(price_total_q).toFixed(2));
    }
    if (estado) {
      q += `, estado=:estado`;
      params.estado = estado;
    }

    q += ` WHERE id=:id`;
    await conn.execute(q, params);
    return { ok: true };
  });
};

/* ==============================
 * AUTOCOMPLETAR VENCIDAS
 * ============================== */
exports.autoCompletePast = async () => {
  const pool = await getPool();
  const q = `
    UPDATE reservas r
    JOIN (
      SELECT TIMESTAMPADD(HOUR, -6, UTC_TIMESTAMP()) AS now_gt
    ) z
    SET r.estado = 'completada'
    WHERE r.estado IN ('pendiente','pagada')
      AND (
        r.fecha < DATE(z.now_gt)
        OR (r.fecha = DATE(z.now_gt) AND r.hora_fin <= TIME(z.now_gt))
      )
  `;
  const [res] = await pool.execute(q);
  return res.affectedRows || 0;
};

/* ==============================
 * PARTIDOS DE TORNEO (liguilla + eliminación)
 * ============================== */

exports.listTorneoPartidosByDate = async (fechaYMD) => {
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT 
      t.id AS torneo_id,
      CASE WHEN t.tipo_futbol = '5' THEN 'F5' 
           WHEN t.tipo_futbol = '7' THEN 'F7' 
           ELSE 'F5' END AS tipo_futbol,
      DATE_FORMAT(p.hora, '%H:%i:%s') AS hi_txt,
      DATE_FORMAT(TIMESTAMPADD(MINUTE, IFNULL(t.dur_minutos_partido,60), p.hora), '%H:%i:%s') AS hf_txt,
      p.cancha AS cancha_text
    FROM partidos p
    JOIN jornadas j ON j.id = p.jornada_id
    JOIN torneos t  ON t.id = j.torneo_id
    WHERE p.fecha = :f
  `, { f: new Date(fechaYMD) });
  return rows;
};

exports.listElimMatchesByDate = async (fechaYMD) => {
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT
      t.id AS torneo_id,
      CASE WHEN t.tipo_futbol = '5' THEN 'F5' 
           WHEN t.tipo_futbol = '7' THEN 'F7' 
           ELSE 'F5' END AS tipo_futbol,
      DATE_FORMAT(m.hora, '%H:%i:%s') AS hi_txt,
      DATE_FORMAT(TIMESTAMPADD(MINUTE, IFNULL(t.dur_minutos_partido,60), m.hora), '%H:%i:%s') AS hf_txt,
      m.cancha AS cancha_text
    FROM elim_matches m
    JOIN eliminatorias e ON e.id = m.eliminatoria_id
    JOIN torneos t       ON t.id = e.torneo_id
    WHERE m.fecha = :f
  `, { f: new Date(fechaYMD) });
  return rows;
};

/* ==============================
 * AGENDA de TORNEO (día + franjas + canchas)
 * ============================== */
exports.listTorneoAgendaByDate = async ({ fechaYMD, weekday }) => {
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT
      t.id AS torneo_id,
      CASE WHEN t.tipo_futbol = '5' THEN 'F5'
           WHEN t.tipo_futbol = '7' THEN 'F7'
           ELSE 'F5' END AS tipo_futbol,
      DATE_FORMAT(tf.hora_inicio, '%H:%i:%s') AS hi_txt,
      DATE_FORMAT(tf.hora_fin,    '%H:%i:%s') AS hf_txt,
      c.id   AS cancha_id,
      c.nombre AS cancha_nombre
    FROM torneos t
    JOIN torneo_franjas tf ON tf.torneo_id = t.id
    JOIN torneo_canchas tc ON tc.torneo_id = t.id
    JOIN canchas c         ON c.id = tc.cancha_id
    WHERE t.dia_semana = :w
  `, { w: Number(weekday) });
  return rows;
};

/* ==============================
 * ACADEMIA por fecha (bloquea reservas)
 * ============================== */
exports.listAcademiaByDate = async (fechaYMD) => {
  // weekday 1..7 (Lun=1..Dom=7), bitpos 0..6
  const d = new Date(`${fechaYMD}T00:00:00`);
  const w0 = d.getDay();               // 0..6 (Dom=0)
  const bitpos = (w0 === 0 ? 6 : w0 - 1);

  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT 
      c.id, c.nombre, c.cancha_id,
      DATE_FORMAT(c.hora_inicio, '%H:%i:%s') AS hi_txt,
      DATE_FORMAT(c.hora_fin,    '%H:%i:%s') AS hf_txt
    FROM ac_categorias c
    WHERE c.cancha_id IS NOT NULL
      AND c.hora_inicio IS NOT NULL
      AND c.hora_fin    IS NOT NULL
      AND (c.dias_mask & POW(2, :bitpos)) > 0
  `, { bitpos });

  return rows.map(x => ({
    categoria_id: x.id,
    categoria_nombre: x.nombre,
    cancha_id: Number(x.cancha_id),
    hi_txt: (x.hi_txt || '').slice(0,5),
    hf_txt: (x.hf_txt || '').slice(0,5),
  }));
};
