// models/jugadoresModel.js  ✅ MySQL
const { getPool } = require('../config/db');

exports.listByEquipo = async (equipo_id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
      SELECT id, nombre, dorsal, posicion, equipo_id
      FROM jugadores
      WHERE equipo_id = :eid
      ORDER BY IFNULL(dorsal, 9999), nombre
    `,
    { eid: Number(equipo_id) }
  );
  return rows;
};

exports.findByEquipoAndDorsal = async (equipo_id, dorsal, exceptId = null) => {
  const pool = await getPool();
  let q = `
    SELECT id
    FROM jugadores
    WHERE equipo_id = :eid AND dorsal = :d
  `;
  const params = { eid: Number(equipo_id), d: Number(dorsal) };
  if (exceptId) {
    q += ` AND id <> :xid`;
    params.xid = Number(exceptId);
  }
  q += ` ORDER BY id LIMIT 1`;

  const [rows] = await pool.execute(q, params);
  return rows[0] || null;
};

exports.create = async ({ equipo_id, nombre, dorsal, posicion }) => {
  const pool = await getPool();
  const [r] = await pool.execute(
    `
      INSERT INTO jugadores (equipo_id, nombre, dorsal, posicion)
      VALUES (:eid, :nom, :dor, :pos)
    `,
    {
      eid: Number(equipo_id),
      nom: String(nombre).trim(),
      dor: dorsal == null || dorsal === '' ? null : Number(dorsal),
      pos: posicion ? String(posicion).trim() : null
    }
  );
  return Number(r.insertId);
};

exports.getById = async (id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM jugadores WHERE id = :id`,
    { id: Number(id) }
  );
  return rows[0] || null;
};

exports.update = async ({ id, nombre, dorsal, posicion }) => {
  const pool = await getPool();
  await pool.execute(
    `
      UPDATE jugadores
      SET nombre = :nom,
          dorsal = :dor,
          posicion = :pos
      WHERE id = :id
    `,
    {
      id: Number(id),
      nom: String(nombre).trim(),
      dor: dorsal == null || dorsal === '' ? null : Number(dorsal),
      pos: posicion ? String(posicion).trim() : null
    }
  );
  return { ok: true };
};

exports.remove = async (id) => {
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM jugadores WHERE id = :id`,
    { id: Number(id) }
  );
  return { ok: true };
};
