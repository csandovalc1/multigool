// models/partidoDetalleModel.js  ✅ MySQL
const { getPool } = require('../config/db');

async function obtenerEventosPorPartido(partido_id) {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT pd.*, j.nombre AS jugador
    FROM partido_detalle pd
    JOIN jugadores j ON pd.jugador_id = j.id
    WHERE pd.partido_id = :pid
    ORDER BY pd.minuto ASC, pd.id ASC
    `,
    { pid: Number(partido_id) }
  );
  return rows;
}

async function agregarEvento({ partido_id, jugador_id, tipo, minuto }) {
  const pool = await getPool();
  await pool.execute(
    `
    INSERT INTO partido_detalle (partido_id, jugador_id, tipo, minuto)
    VALUES (:partido_id, :jugador_id, :tipo, :minuto)
    `,
    {
      partido_id: Number(partido_id),
      jugador_id: Number(jugador_id),
      // ENUM en DB: 'gol','amarilla','roja'
      tipo: String(tipo).trim(),
      minuto: minuto == null || minuto === '' ? null : Number(minuto),
    }
  );
  // Si quisieras el id:
  // const [r] = await pool.execute(...); return { id: Number(r.insertId) };
}

async function eliminarEvento(id) {
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM partido_detalle WHERE id = :id`,
    { id: Number(id) }
  );
}

async function eliminarEventosDePartido(partido_id) {
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM partido_detalle WHERE partido_id = :pid`,
    { pid: Number(partido_id) }
  );
}

module.exports = {
  obtenerEventosPorPartido,
  agregarEvento,
  eliminarEvento,
  eliminarEventosDePartido,
};
