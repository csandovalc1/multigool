// models/fixtureModel.js  (MySQL)
const { getPool } = require('../config/db');

async function obtenerJornadasPorTorneo(torneo_id) {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT id, numero, torneo_id
    FROM jornadas
    WHERE torneo_id = :tid
    ORDER BY numero ASC
    `,
    { tid: Number(torneo_id) }
  );
  return rows;
}

async function obtenerPartidosPorJornada(jornada_id) {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT
      p.id,
      p.jornada_id,
      p.equipo_local_id,
      p.equipo_visita_id,
      p.goles_local,
      p.goles_visita,
      DATE_FORMAT(p.fecha, '%Y-%m-%d') AS fecha,
      DATE_FORMAT(p.hora,  '%H:%i')    AS hora,
      p.cancha,
      el.nombre AS equipo_local,
      ev.nombre AS equipo_visita
    FROM partidos p
    JOIN equipos el ON p.equipo_local_id = el.id
    JOIN equipos ev ON p.equipo_visita_id = ev.id
    WHERE p.jornada_id = :jid
    ORDER BY p.id ASC
    `,
    { jid: Number(jornada_id) }
  );
  return rows;
}

module.exports = { obtenerJornadasPorTorneo, obtenerPartidosPorJornada };
