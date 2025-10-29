// models/galeriaModel.js  ✅ MySQL
const { getPool } = require('../config/db');

exports.list = async () => {
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT 
      id,
      url,
      descripcion,
      estado,
      DATE_FORMAT(publish_at, '%Y-%m-%d %H:%i:%s') AS publish_at,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM galeria_fotos
    ORDER BY 
      CASE WHEN publish_at IS NULL THEN 1 ELSE 0 END ASC,
      publish_at DESC,
      created_at DESC,
      id DESC
  `);
  return rows;
};

exports.getById = async (id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM galeria_fotos WHERE id = :id`,
    { id: Number(id) }
  );
  return rows[0] || null;
};

exports.bulkInsert = async (items) => {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const it of items) {
      await conn.execute(
        `
          INSERT INTO galeria_fotos (url, descripcion)
          VALUES (:url, :desc)
        `,
        {
          url: it.url,
          desc: it.descripcion || null
        }
      );
    }

    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

exports.update = async (id, { descripcion }) => {
  const pool = await getPool();
  await pool.execute(
    `
      UPDATE galeria_fotos
      SET descripcion = :desc,
          updated_at = NOW()
      WHERE id = :id
    `,
    {
      id: Number(id),
      desc: descripcion || null
    }
  );
  return { ok: true };
};

exports.publish = async (id) => {
  const pool = await getPool();
  await pool.execute(
    `
      UPDATE galeria_fotos
      SET estado = 'publicada',
          publish_at = NOW(),
          updated_at = NOW()
      WHERE id = :id
    `,
    { id: Number(id) }
  );
  return { ok: true };
};

exports.unpublish = async (id) => {
  const pool = await getPool();
  await pool.execute(
    `
      UPDATE galeria_fotos
      SET estado = 'borrador',
          publish_at = NULL,
          updated_at = NOW()
      WHERE id = :id
    `,
    { id: Number(id) }
  );
  return { ok: true };
};

exports.remove = async (id) => {
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM galeria_fotos WHERE id = :id`,
    { id: Number(id) }
  );
  return { ok: true };
};
