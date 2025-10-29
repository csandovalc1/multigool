// models/grupoModel.js  ✅ MySQL
const { getPool } = require('../config/db');

/* ========= LECTURAS ========= */

// Todos los grupos (opcional filtrar por tipo)
exports.listGrupos = async ({ tipo_futbol } = {}) => {
  const pool = await getPool();
  let q = `
    SELECT g.id, g.nombre, g.tipo_futbol, g.activa
    FROM cancha_grupos g
    WHERE 1=1
  `;
  const params = {};
  if (tipo_futbol) {
    q += ` AND g.tipo_futbol = :tf`;
    params.tf = String(tipo_futbol);
  }
  q += ` ORDER BY g.nombre`;
  const [rows] = await pool.execute(q, params);
  return rows;
};

// Canchas físicas miembro de un grupo
exports.getFisicasByGrupo = async (grupoId) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
      SELECT c.*
      FROM cancha_grupo_det d
      JOIN canchas c ON c.id = d.cancha_id
      WHERE d.grupo_id = :gid AND c.activa = 1
      ORDER BY c.nombre
    `,
    { gid: Number(grupoId) }
  );
  return rows;
};

// Grupos que incluyen una cancha física dada
exports.getGruposByCanchaFisica = async (canchaFisicaId) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
      SELECT g.*
      FROM cancha_grupo_det d
      JOIN cancha_grupos g ON g.id = d.grupo_id
      WHERE d.cancha_id = :cid AND g.activa = 1
    `,
    { cid: Number(canchaFisicaId) }
  );
  return rows;
};

// Dado un grupo, busca la "cancha virtual" homónima (mismo nombre y tipo) si existe
exports.getVirtualCanchaByGrupo = async (grupoId) => {
  const pool = await getPool();
  const [[grupo]] = await pool.execute(
    `SELECT * FROM cancha_grupos WHERE id = :gid AND activa = 1`,
    { gid: Number(grupoId) }
  );
  if (!grupo) return null;

  const [rows] = await pool.execute(
    `
      SELECT id, nombre, tipo_futbol
      FROM canchas
      WHERE nombre = :n AND tipo_futbol = :tf AND activa = 1
      ORDER BY id
      LIMIT 1
    `,
    { n: String(grupo.nombre), tf: String(grupo.tipo_futbol) }
  );
  return rows[0] || null;
};

// Dada una cancha (id) intenta resolver el grupo homónimo (por nombre y tipo)
exports.getGrupoByCanchaVirtual = async (canchaVirtualId) => {
  const pool = await getPool();
  const [[cancha]] = await pool.execute(
    `SELECT * FROM canchas WHERE id = :cid`,
    { cid: Number(canchaVirtualId) }
  );
  if (!cancha) return null;

  const [rows] = await pool.execute(
    `
      SELECT *
      FROM cancha_grupos
      WHERE nombre = :n AND tipo_futbol = :tf AND activa = 1
      ORDER BY id
      LIMIT 1
    `,
    { n: String(cancha.nombre), tf: String(cancha.tipo_futbol) }
  );
  return rows[0] || null;
};

// Devuelve las canchas "virtuales" (ids en canchas) de los grupos que comparten cualquiera de las físicas dadas
exports.getVirtualCanchasQueCompartenFisicas = async (canchaFisicaIds = []) => {
  if (!Array.isArray(canchaFisicaIds) || canchaFisicaIds.length === 0) return [];
  const pool = await getPool();

  const ids = canchaFisicaIds.map(Number).filter(Number.isFinite);
  if (ids.length === 0) return [];

  const ph = ids.map((_, i) => `:p${i}`).join(',');
  const params = Object.fromEntries(ids.map((v, i) => [`p${i}`, v]));

  // 1) grupos que incluyen alguna de esas físicas
  const [gr] = await pool.execute(
    `SELECT DISTINCT d.grupo_id FROM cancha_grupo_det d WHERE d.cancha_id IN (${ph})`,
    params
  );
  const grupoIds = gr.map(x => x.grupo_id);
  if (grupoIds.length === 0) return [];

  // 2) por homonimia, para cada grupo, buscar cancha (mismo nombre/tipo)
  const out = [];
  for (const gid of grupoIds) {
    const virt = await exports.getVirtualCanchaByGrupo(gid);
    if (virt?.id) out.push(virt.id);
  }
  return out;
};

// Lista de grupos activos de un tipo con su cancha virtual homónima (si existe)
exports.getGruposConVirtualByTipo = async (tipo_futbol) => {
  const pool = await getPool();
  const [grupos] = await pool.execute(
    `
      SELECT g.*
      FROM cancha_grupos g
      WHERE g.activa = 1 AND g.tipo_futbol = :tf
      ORDER BY g.nombre
    `,
    { tf: String(tipo_futbol) }
  );

  const enriched = [];
  for (const g of grupos) {
    const [virt] = await pool.execute(
      `
        SELECT id, nombre, tipo_futbol
        FROM canchas
        WHERE nombre = :n AND tipo_futbol = :tf AND activa = 1
        ORDER BY id
        LIMIT 1
      `,
      { n: String(g.nombre), tf: String(g.tipo_futbol) }
    );
    const v = virt[0] || null;
    enriched.push({
      ...g,
      virtual_cancha_id: v?.id || null,
      virtual_cancha_nombre: v?.nombre || null
    });
  }
  return enriched;
};

/* ========= ESCRITURAS ========= */

exports.createGrupo = async ({ nombre, tipo_futbol, activa = true }) => {
  const pool = await getPool();
  const [r] = await pool.execute(
    `
      INSERT INTO cancha_grupos (nombre, tipo_futbol, activa)
      VALUES (:n, :tf, :a)
    `,
    { n: String(nombre), tf: String(tipo_futbol), a: activa ? 1 : 0 }
  );
  return Number(r.insertId);
};

exports.updateGrupo = async (id, { nombre, tipo_futbol, activa }) => {
  const pool = await getPool();
  await pool.execute(
    `
      UPDATE cancha_grupos
      SET nombre = :n, tipo_futbol = :tf, activa = :a
      WHERE id = :id
    `,
    {
      id: Number(id),
      n: String(nombre),
      tf: String(tipo_futbol),
      a: activa ? 1 : 0
    }
  );
  return { ok: true };
};

exports.setActiva = async (id, activa) => {
  const pool = await getPool();
  await pool.execute(
    `UPDATE cancha_grupos SET activa = :a WHERE id = :id`,
    { id: Number(id), a: activa ? 1 : 0 }
  );
  return { ok: true };
};

exports.removeGrupo = async (id) => {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`DELETE FROM cancha_grupo_det WHERE grupo_id = :id`, { id: Number(id) });
    await conn.execute(`DELETE FROM cancha_grupos WHERE id = :id`, { id: Number(id) });
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// Reemplaza TODOS los miembros del grupo
exports.setMiembros = async (grupo_id, cancha_ids = []) => {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `DELETE FROM cancha_grupo_det WHERE grupo_id = :gid`,
      { gid: Number(grupo_id) }
    );

    for (const cid of cancha_ids.map(Number).filter(Number.isFinite)) {
      await conn.execute(
        `INSERT INTO cancha_grupo_det (grupo_id, cancha_id) VALUES (:gid, :cid)`,
        { gid: Number(grupo_id), cid }
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
