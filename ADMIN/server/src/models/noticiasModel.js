// models/noticiasModel.js  ✅ MySQL
const { getPool } = require('../config/db');

exports.list = async () => {
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT
      id, titulo, slug, resumen, estado,
      portada_url,
      is_important,
      DATE_FORMAT(banner_start, '%Y-%m-%d')           AS banner_start,
      DATE_FORMAT(banner_end,   '%Y-%m-%d')           AS banner_end,
      DATE_FORMAT(publish_at,   '%Y-%m-%d %H:%i:%s')  AS publish_at,
      DATE_FORMAT(created_at,   '%Y-%m-%d %H:%i:%s')  AS created_at
    FROM noticias
    ORDER BY IFNULL(publish_at, created_at) DESC, id DESC
  `);
  return rows;
};

exports.getById = async (id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM noticias WHERE id = :id`,
    { id: Number(id) }
  );
  return rows[0] || null;
};

exports.getBySlug = async (slug) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM noticias WHERE slug = :slug`,
    { slug: String(slug) }
  );
  return rows[0] || null;
};

exports.create = async ({
  titulo, slug, resumen, cuerpo_md,
  portada_url, imagenes,
  is_important, banner_start, banner_end
}) => {
  const pool = await getPool();
  try {
    const [r] = await pool.execute(
      `
      INSERT INTO noticias
        (titulo, slug, resumen, cuerpo_md, portada_url, imagenes_json, is_important, banner_start, banner_end)
      VALUES
        (:titulo, :slug, :resumen, :cuerpo, :portada, :imgs, :imp, :bstart, :bend)
      `,
      {
        titulo: String(titulo).trim(),
        slug: String(slug).trim(),
        resumen: resumen ? String(resumen).trim() : null,
        cuerpo: String(cuerpo_md),
        portada: portada_url || null,
        imgs: JSON.stringify(imagenes || []),
        imp: is_important ? 1 : 0,
        bstart: banner_start || null,  // 'YYYY-MM-DD' o null
        bend: banner_end   || null
      }
    );
    return { id: Number(r.insertId) };
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      const e = new Error('slug ya existe');
      e.code = 'E_DUP_SLUG';
      throw e;
    }
    throw err;
  }
};

exports.update = async (id, {
  titulo, resumen, cuerpo_md,
  portada_url, imagenes,
  is_important, banner_start, banner_end
}) => {
  const pool = await getPool();
  await pool.execute(
    `
    UPDATE noticias
    SET titulo        = :titulo,
        resumen       = :resumen,
        cuerpo_md     = :cuerpo,
        portada_url   = :portada,
        imagenes_json = :imgs,
        is_important  = :imp,
        banner_start  = :bstart,
        banner_end    = :bend,
        updated_at    = UTC_TIMESTAMP()
    WHERE id = :id
    `,
    {
      id: Number(id),
      titulo: String(titulo).trim(),
      resumen: resumen ? String(resumen).trim() : null,
      cuerpo: String(cuerpo_md),
      portada: portada_url || null,
      imgs: JSON.stringify(imagenes || []),
      imp: is_important ? 1 : 0,
      bstart: banner_start || null,
      bend: banner_end || null
    }
  );
  return { ok: true };
};

exports.publish = async (id) => {
  const pool = await getPool();
  await pool.execute(
    `
    UPDATE noticias
    SET estado     = 'publicada',
        publish_at = UTC_TIMESTAMP(),
        updated_at = UTC_TIMESTAMP()
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
    UPDATE noticias
    SET estado     = 'borrador',
        publish_at = NULL,
        updated_at = UTC_TIMESTAMP()
    WHERE id = :id
    `,
    { id: Number(id) }
  );
  return { ok: true };
};

exports.remove = async (id) => {
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM noticias WHERE id = :id`,
    { id: Number(id) }
  );
  return { ok: true };
};

/**
 * Anuncios activos hoy en Guatemala:
 * - is_important = 1
 * - estado = 'publicada'
 * - hoy GT ∈ [banner_start, banner_end] con nulos tratados como "hoy"
 */
exports.listActiveAnnouncements = async () => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT
      id, titulo, slug, resumen, portada_url,
      DATE_FORMAT(banner_start, '%Y-%m-%d')          AS banner_start,
      DATE_FORMAT(banner_end,   '%Y-%m-%d')          AS banner_end,
      DATE_FORMAT(publish_at,   '%Y-%m-%d %H:%i:%s') AS publish_at
    FROM noticias
    WHERE is_important = 1
      AND estado = 'publicada'
      AND DATE(TIMESTAMPADD(HOUR, -6, UTC_TIMESTAMP()))
          BETWEEN IFNULL(banner_start, DATE(TIMESTAMPADD(HOUR, -6, UTC_TIMESTAMP())))
              AND IFNULL(banner_end,   DATE(TIMESTAMPADD(HOUR, -6, UTC_TIMESTAMP())))
    ORDER BY publish_at DESC, id DESC
    `
  );
  return rows;
};
