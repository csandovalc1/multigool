// models/equipoModel.js  (MySQL)
const { getPool } = require('../config/db');

/**
 * Inserta un equipo.
 * - Respeta DEFAULT de la tabla si no mandas fecha_registro.
 * - Maneja UNIQUE (nombre, torneo_id) con error legible.
 */
async function agregarEquipo(nombre, torneo_id, logo_path, fecha_registro) {
  const pool = await getPool();

  // Armado dinámico de columnas para respetar DEFAULT cuando no hay fecha_registro
  const cols = ['nombre', 'torneo_id', 'logo_path'];
  const vals = [':nombre', ':torneo_id', ':logo_path'];
  const params = {
    nombre: String(nombre).trim(),
    torneo_id: Number(torneo_id),
    logo_path: logo_path || null
  };

  if (fecha_registro) {
    cols.push('fecha_registro');
    vals.push(':fecha_registro');
    // Espera 'YYYY-MM-DD HH:MM:SS' o ISO; MySQL acepta ambos si son válidos.
    const fr = new Date(fecha_registro);
    if (Number.isNaN(fr.getTime())) {
      throw new Error('fecha_registro inválida');
    }
    // Normalizo a 'YYYY-MM-DD HH:MM:SS'
    const pad = n => String(n).padStart(2, '0');
    const frStr = `${fr.getFullYear()}-${pad(fr.getMonth() + 1)}-${pad(fr.getDate())} ${pad(fr.getHours())}:${pad(fr.getMinutes())}:${pad(fr.getSeconds())}`;
    params.fecha_registro = frStr;
  }

  const sql = `
    INSERT INTO equipos (${cols.join(', ')})
    VALUES (${vals.join(', ')})
  `;

  try {
    const [r] = await pool.execute(sql, params);
    return { insertId: Number(r.insertId) };
  } catch (err) {
    // Manejo de duplicados por UNIQUE (nombre, torneo_id)
    if (err && err.code === 'ER_DUP_ENTRY') {
      const e = new Error('Ya existe un equipo con ese nombre en este torneo');
      e.code = 'E_DUP_TEAM';
      throw e;
    }
    throw err;
  }
}

async function obtenerEquiposPorTorneo(torneo_id) {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        nombre,
        torneo_id,
        logo_path,
        DATE_FORMAT(fecha_registro, '%Y-%m-%d %H:%i:%s') AS fecha_registro
      FROM equipos
      WHERE torneo_id = :tid
      ORDER BY id ASC
    `,
    { tid: Number(torneo_id) }
  );
  return rows;
}

async function eliminarEquipo(id) {
  const pool = await getPool();
  await pool.execute(
    'DELETE FROM equipos WHERE id = :id',
    { id: Number(id) }
  );
}

async function updateLogo(id, logo_path) {
  const pool = await getPool();
  await pool.execute(
    'UPDATE equipos SET logo_path = :logo_path WHERE id = :id',
    { id: Number(id), logo_path: logo_path || null }
  );
}

module.exports = { agregarEquipo, obtenerEquiposPorTorneo, eliminarEquipo, updateLogo };
