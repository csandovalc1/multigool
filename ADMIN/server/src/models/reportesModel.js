// models/reportesModel.js  ✅ MySQL
const { getPool } = require('../config/db');

// estados
const ESTADOS_OCUPACION = ['pendiente', 'pagada', 'completada'];
const ESTADOS_REALES    = ['pagada', 'completada'];

/* ---------------- Helpers ---------------- */
function whereFecha(desde, hasta, col = 'r.fecha') {
  const parts = [];
  if (desde) parts.push(`${col} >= :desde`);
  if (hasta) parts.push(`${col} < DATE_ADD(:hasta, INTERVAL 1 DAY)`);
  return parts.length ? (' AND ' + parts.join(' AND ')) : '';
}
function tipoJoin(tipo, alias = 'c') {
  return tipo ? ` AND ${alias}.tipo_futbol = :tipo` : '';
}
function bucketExpr(col, gran) {
  if (gran === 'day')  return `DATE_FORMAT(${col}, '%Y-%m-%d')`;
  if (gran === 'week') {
    // ISO-week: YEARWEEK(date, 3) => yyyynn (iso-year *100 + iso-week)
    // periodo: "YYYY-Www"
    return `CONCAT(LPAD(FLOOR(YEARWEEK(${col}, 3)/100),4,'0'), '-W', LPAD(MOD(YEARWEEK(${col},3),100),2,'0'))`;
  }
  return `DATE_FORMAT(${col}, '%Y-%m')`; // month
}

/* ===================== Reservas ===================== */
exports.ingresosReservas = async ({ desde, hasta, gran = 'month', tipo }) => {
  const pool = await getPool();
  const bucket = bucketExpr('r.fecha', gran);

  const q = `
    SELECT ${bucket} AS periodo,
           SUM(IFNULL(r.price_total,0)) AS q_total
    FROM reservas r
    JOIN canchas c ON c.id = r.cancha_id
    WHERE 1=1
      ${whereFecha(desde, hasta, 'r.fecha')}
      ${tipoJoin(tipo, 'c')}
      AND r.estado IN ('${ESTADOS_REALES.join("','")}')
    GROUP BY ${bucket}
    ORDER BY ${bucket}
  `;

  const params = {};
  if (desde) params.desde = new Date(desde);
  if (hasta) params.hasta = new Date(hasta);
  if (tipo)  params.tipo  = tipo;

  const [rows] = await pool.execute(q, params);
  return rows;
};

exports.reservasPorCancha = async ({ desde, hasta, tipo }) => {
  const pool = await getPool();
  const q = `
    SELECT c.nombre AS cancha,
           COUNT(*) AS reservas,
           SUM(TIMESTAMPDIFF(MINUTE, r.hora_inicio, r.hora_fin)) AS minutos,
           SUM(IFNULL(r.price_total,0)) AS q_total
    FROM reservas r
    JOIN canchas c ON c.id = r.cancha_id
    WHERE 1=1
      ${whereFecha(desde, hasta, 'r.fecha')}
      ${tipoJoin(tipo, 'c')}
      AND r.estado IN ('${ESTADOS_OCUPACION.join("','")}')
    GROUP BY c.nombre
    ORDER BY reservas DESC
  `;
  const params = {};
  if (desde) params.desde = new Date(desde);
  if (hasta) params.hasta = new Date(hasta);
  if (tipo)  params.tipo  = tipo;

  const [rows] = await pool.execute(q, params);
  return rows;
};

exports.heatmapHoras = async ({ desde, hasta, tipo }) => {
  const pool = await getPool();
  const q = `
    SELECT (DAYOFWEEK(r.fecha)-1) AS weekday,  -- 0=Dom ... 6=Sáb
           HOUR(r.hora_inicio)     AS hour,
           COUNT(*)                AS cnt
    FROM reservas r
    JOIN canchas c ON c.id = r.cancha_id
    WHERE 1=1
      ${whereFecha(desde, hasta, 'r.fecha')}
      ${tipoJoin(tipo, 'c')}
      AND r.estado IN ('${ESTADOS_OCUPACION.join("','")}')
    GROUP BY (DAYOFWEEK(r.fecha)-1), HOUR(r.hora_inicio)
  `;
  const params = {};
  if (desde) params.desde = new Date(desde);
  if (hasta) params.hasta = new Date(hasta);
  if (tipo)  params.tipo  = tipo;

  const [rows] = await pool.execute(q, params);
  return rows;
};

/* ===================== Torneos ===================== */
exports.ingresosTorneos = async () => {
  const pool = await getPool();
  const q = `
    SELECT t.id, t.nombre, t.tipo_futbol, t.tipo_torneo,
           IFNULL(t.costo_inscripcion_q,0) AS costo_inscripcion_q,
           COUNT(e.id) AS equipos,
           IFNULL(t.costo_inscripcion_q,0) * COUNT(e.id) AS q_total
    FROM torneos t
    LEFT JOIN equipos e ON e.torneo_id = t.id
    GROUP BY t.id, t.nombre, t.tipo_futbol, t.tipo_torneo, t.costo_inscripcion_q
    ORDER BY q_total DESC, t.nombre
  `;
  const [rows] = await pool.execute(q);
  return rows;
};

exports.ingresosTorneosPeriodo = async ({ desde, hasta, gran='month', tipo, criterio='registro' }) => {
  const pool = await getPool();
  const params = {};
  if (desde) params.desde = new Date(desde);
  if (hasta) params.hasta = new Date(hasta);
  if (tipo)  params.tipo  = tipo ? tipo.replace('F','') : null; // '5'|'7'

  const fechaWhere = (col) => {
    const parts = [];
    if (desde) parts.push(`${col} >= :desde`);
    if (hasta) parts.push(`${col} < DATE_ADD(:hasta, INTERVAL 1 DAY)`);
    return parts.length ? (' AND ' + parts.join(' AND ')) : '';
  };

  let q;
  if (criterio === 'registro') {
    const bucket = bucketExpr('e.fecha_registro', gran);
    q = `
      SELECT ${bucket} AS periodo,
             SUM(IFNULL(t.costo_inscripcion_q,0)) AS q_total
      FROM equipos e
      JOIN torneos t ON t.id = e.torneo_id
      WHERE 1=1
        ${fechaWhere('e.fecha_registro')}
        ${tipo ? ` AND t.tipo_futbol = :tipo ` : ''}
      GROUP BY ${bucket}
      ORDER BY ${bucket}
    `;
  } else if (criterio === 'inicio') {
    const bucket = bucketExpr('t.start_date', gran);
    q = `
      SELECT ${bucket} AS periodo,
             SUM(IFNULL(t.costo_inscripcion_q,0) * IFNULL(eq.cnt,0)) AS q_total
      FROM torneos t
      LEFT JOIN (
        SELECT torneo_id, COUNT(*) AS cnt
        FROM equipos
        GROUP BY torneo_id
      ) eq ON eq.torneo_id = t.id
      WHERE 1=1
        ${fechaWhere('t.start_date')}
        ${tipo ? ` AND t.tipo_futbol = :tipo ` : ''}
      GROUP BY ${bucket}
      ORDER BY ${bucket}
    `;
  } else {
    const bucket = bucketExpr('t.fecha_creacion', gran);
    q = `
      SELECT ${bucket} AS periodo,
             SUM(IFNULL(t.costo_inscripcion_q,0) * IFNULL(eq.cnt,0)) AS q_total
      FROM torneos t
      LEFT JOIN (
        SELECT torneo_id, COUNT(*) AS cnt
        FROM equipos
        GROUP BY torneo_id
      ) eq ON eq.torneo_id = t.id
      WHERE 1=1
        ${fechaWhere('t.fecha_creacion')}
        ${tipo ? ` AND t.tipo_futbol = :tipo ` : ''}
      GROUP BY ${bucket}
      ORDER BY ${bucket}
    `;
  }

  const [rows] = await pool.execute(q, params);
  return rows;
};

exports.balanceGeneral = async ({ desde, hasta, tipo }) => {
  const pool = await getPool();

  // Reservas (reales)
  const qReservas = `
    SELECT SUM(IFNULL(r.price_total,0)) AS q
    FROM reservas r
    JOIN canchas c ON c.id = r.cancha_id
    WHERE 1=1
      ${whereFecha(desde, hasta, 'r.fecha')}
      ${tipoJoin(tipo, 'c')}
      AND r.estado IN ('${ESTADOS_REALES.join("','")}')
  `;
  const p1 = {};
  if (desde) p1.desde = new Date(desde);
  if (hasta) p1.hasta = new Date(hasta);
  if (tipo)  p1.tipo  = tipo;

  const [[r1]] = await pool.execute(qReservas, p1);
  const reservas_q = Number(r1?.q || 0);

  // Torneos (costo_inscripcion * equipos)
  const qTorneos = `
    SELECT SUM(IFNULL(t.costo_inscripcion_q,0) * IFNULL(eq.cnt,0)) AS q
    FROM torneos t
    LEFT JOIN (
      SELECT torneo_id, COUNT(*) AS cnt
      FROM equipos
      GROUP BY torneo_id
    ) eq ON eq.torneo_id = t.id
  `;
  const [[r2]] = await pool.execute(qTorneos);
  const torneos_q = Number(r2?.q || 0);

  return { reservas_q, torneos_q, total_q: reservas_q + torneos_q };
};

exports.proyeccionMesActual = async () => {
  const pool = await getPool();

  // @ini = primer día del mes; @hoy = hoy; @diasMes = días del mes; @diasTrans = días transcurridos (incluye hoy)
  const q = `
    SELECT
      DATE_FORMAT(CURDATE(), '%Y-%m') AS mes,
      /* total real del mes (pagada/completada) */
      IFNULL((
        SELECT SUM(IFNULL(price_total,0)) FROM reservas
        WHERE fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND fecha <  DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
          AND estado IN ('pagada','completada')
      ),0) AS actual_q,

      /* proyección lineal = (sum hasta hoy de pendientes+pagadas+completadas)/días_trans * días_mes */
      CASE 
        WHEN DATEDIFF(CURDATE(), DATE_FORMAT(CURDATE(), '%Y-%m-01')) + 1 > 0 THEN
          (
            IFNULL((
              SELECT SUM(IFNULL(price_total,0)) FROM reservas
              WHERE fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                AND fecha <= CURDATE()
                AND estado IN ('pendiente','pagada','completada')
            ),0)
            / (DATEDIFF(CURDATE(), DATE_FORMAT(CURDATE(), '%Y-%m-01')) + 1)
          ) * DAY(LAST_DAY(CURDATE()))
        ELSE 0
      END AS proyeccion_q
  `;
  const [[row]] = await pool.execute(q);
  return row || { mes:'', actual_q:0, proyeccion_q:0 };
};
