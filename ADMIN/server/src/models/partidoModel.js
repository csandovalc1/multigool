// models/partidoModel.js  ✅ MySQL
const { getPool } = require('../config/db');

async function actualizarGoles(partido_id, goles_local, goles_visita) {
  const pool = await getPool();
  await pool.execute(
    `UPDATE partidos
     SET goles_local = :gl, goles_visita = :gv
     WHERE id = :id`,
    { id: Number(partido_id), gl: Number(goles_local), gv: Number(goles_visita) }
  );
}

/**
 * Finaliza un partido.
 * Si NO tienes columna `estado`, deja este método igual que actualizarGoles.
 * Si la agregas, se marca 'finalizado'.
 */
async function finalizar(partido_id, gl, gv) {
  const pool = await getPool();
  // Por defecto: sin columna estado
  await pool.execute(
    `UPDATE partidos
     SET goles_local = :gl, goles_visita = :gv
     WHERE id = :id`,
    { id: Number(partido_id), gl: Number(gl), gv: Number(gv) }
  );

  // Si agregas la columna `estado`, usa esto en su lugar:
  // await pool.execute(
  //   `UPDATE partidos
  //    SET goles_local = :gl, goles_visita = :gv, estado = 'finalizado'
  //    WHERE id = :id`,
  //   { id: Number(partido_id), gl: Number(gl), gv: Number(gv) }
  // );
}

async function listarPorRango({ desde, hasta, torneo_id }) {
  const pool = await getPool();
  const params = {};
  let q = `
    SELECT
      p.id,
      DATE_FORMAT(p.fecha, '%Y-%m-%d') AS fecha,
      DATE_FORMAT(p.hora,  '%H:%i')    AS hora,
      p.cancha,
      p.equipo_local_id,
      p.equipo_visita_id,
      p.goles_local,
      p.goles_visita,
      el.nombre AS equipo_local,
      ev.nombre AS equipo_visita,
      j.torneo_id
    FROM partidos p
    JOIN jornadas j ON p.jornada_id = j.id
    JOIN equipos el ON p.equipo_local_id = el.id
    JOIN equipos ev ON p.equipo_visita_id = ev.id
    WHERE 1=1
  `;

  if (desde) { q += ` AND p.fecha >= :desde`; params.desde = String(desde).slice(0, 10); }
  if (hasta) { q += ` AND p.fecha <= :hasta`; params.hasta = String(hasta).slice(0, 10); }
  if (torneo_id) { q += ` AND j.torneo_id = :tid`; params.tid = Number(torneo_id); }

  q += ` ORDER BY p.fecha ASC, p.hora ASC`;

  const [rows] = await pool.execute(q, params);
  return rows;
}

// Actualizar programación (fecha/hora/cancha)
async function editarDatos({ partido_id, fecha, hora, cancha }) {
  const pool = await getPool();

  // Normalizar hora a 'HH:MM:SS' o NULL
  let horaText = null;
  if (hora !== undefined && hora !== null) {
    const s = String(hora).trim();
    if (s === '') {
      horaText = null;
    } else if (/^\d{2}:\d{2}$/.test(s)) {
      horaText = `${s}:00`;
    } else if (/^\d{2}:\d{2}:\d{2}$/.test(s)) {
      horaText = s;
    } else {
      horaText = null;
    }
  }

  await pool.execute(
    `
    UPDATE partidos
    SET
      fecha  = :fecha,
      hora   = :hora,
      cancha = :cancha
    WHERE id = :id
    `,
    {
      id: Number(partido_id),
      fecha: fecha ? String(fecha).slice(0, 10) : null, // MySQL DATE
      hora: horaText,                                    // MySQL TIME
      cancha: cancha ? String(cancha) : null
    }
  );
}

module.exports = {
  actualizarGoles,
  finalizar,
  listarPorRango,
  editarDatos,
};
