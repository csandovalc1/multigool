// models/canchaModel.js  (MySQL)
const { getPool } = require('../config/db');

// ========================
// Listados
// ========================
exports.listAll = async () => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT id, nombre, tipo_futbol, activa
     FROM canchas
     ORDER BY nombre ASC`
  );
  return rows;
};

exports.list = async ({ tipo_futbol } = {}) => {
  const pool = await getPool();
  const params = {};
  let q = `SELECT * FROM canchas WHERE activa = 1`;
  if (tipo_futbol) {
    q += ` AND tipo_futbol = :tf`;
    params.tf = String(tipo_futbol);
  }
  q += ` ORDER BY nombre`;
  const [rows] = await pool.execute(q, params);
  return rows;
};

exports.listActive = async () => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT id, nombre, tipo_futbol, activa
     FROM canchas
     WHERE activa = 1
     ORDER BY id`
  );
  return rows;
};

// ========================
// Utilidades
// ========================
exports.mapNameToId = async () => {
  const all = await exports.listActive();
  const map = new Map();
  for (const c of all) map.set(String(c.nombre).trim().toLowerCase(), c.id);
  return map;
};

/**
 * Mapa direccional de propagación por grupos.
 * Resultado: { cancha_id: number[] } (sin incluirse a sí misma).
 */
exports.getDirectionalPeersMap = async () => {
  const pool = await getPool();

  // Grupos activos
  const [grupos] = await pool.execute(
    `SELECT id, tipo_futbol
     FROM cancha_grupos
     WHERE activa = 1`
  );

  // Membresías
  const [membresias] = await pool.execute(
    `SELECT grupo_id, cancha_id
     FROM cancha_grupo_det`
  );

  // Canchas activas y por tipo
  const all = await exports.listActive();
  const tipoByCancha = new Map(all.map(c => [c.id, String(c.tipo_futbol)]));
  const byTipo = new Map(); // 'F7' -> Set(cancha_id)
  for (const c of all) {
    const k = String(c.tipo_futbol);
    if (!byTipo.has(k)) byTipo.set(k, new Set());
    byTipo.get(k).add(c.id);
  }

  // Canchas por grupo
  const membersByGroup = new Map(); // grupo_id -> Set(cancha_id)
  for (const row of membresias) {
    if (!membersByGroup.has(row.grupo_id)) membersByGroup.set(row.grupo_id, new Set());
    membersByGroup.get(row.grupo_id).add(row.cancha_id);
  }

  // Construcción del mapa
  const peersDir = new Map(); // cancha_id -> Set(peerId)
  const ensure = (cid) => { if (!peersDir.has(cid)) peersDir.set(cid, new Set()); return peersDir.get(cid); };

  for (const g of grupos) {
    const tipoGrupo = String(g.tipo_futbol);                 // ej. 'F7'
    const miembros = membersByGroup.get(g.id) || new Set();  // ids

    // Particionar miembros del grupo por tipo
    const miembrosTipoGrupo = new Set();
    const miembrosOtros = new Set();
    for (const cid of miembros) {
      (tipoByCancha.get(cid) === tipoGrupo ? miembrosTipoGrupo : miembrosOtros).add(cid);
    }

    // Extender con TODAS las canchas del sistema del mismo tipo
    const allSameType = byTipo.get(tipoGrupo) || new Set();
    const extendTipoGrupo = new Set([...miembrosTipoGrupo, ...allSameType]);

    // Reglas direccionales
    for (const cid of miembrosOtros) {
      const set = ensure(cid);
      for (const dst of extendTipoGrupo) if (dst !== cid) set.add(dst);
    }
    for (const cid of miembrosTipoGrupo) {
      const set = ensure(cid);
      for (const dst of miembrosOtros) if (dst !== cid) set.add(dst);
    }
    for (const cid of allSameType) {
      const set = ensure(cid);
      for (const dst of miembrosOtros) if (dst !== cid) set.add(dst);
    }
  }

  const out = {};
  for (const [cid, set] of peersDir.entries()) out[cid] = Array.from(set);
  return out;
};

// ========================
// CRUD básico
// ========================
exports.getById = async (id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM canchas WHERE id = :id`,
    { id: Number(id) }
  );
  return rows[0] || null;
};

exports.create = async ({ nombre, tipo_futbol, activa = true }) => {
  const pool = await getPool();
  const [r] = await pool.execute(
    `INSERT INTO canchas (nombre, tipo_futbol, activa)
     VALUES (:nombre, :tipo, :activa)`,
    {
      nombre: String(nombre),
      tipo: String(tipo_futbol),
      activa: activa ? 1 : 0
    }
  );
  return { id: Number(r.insertId) };
};

exports.update = async (id, { nombre, tipo_futbol, activa }) => {
  const pool = await getPool();
  await pool.execute(
    `UPDATE canchas
     SET nombre = :nombre,
         tipo_futbol = :tipo,
         activa = :activa
     WHERE id = :id`,
    {
      id: Number(id),
      nombre: String(nombre),
      tipo: String(tipo_futbol),
      activa: activa ? 1 : 0
    }
  );
  return { ok: true };
};

exports.setActiva = async (id, activa) => {
  const pool = await getPool();
  await pool.execute(
    `UPDATE canchas
     SET activa = :activa
     WHERE id = :id`,
    { id: Number(id), activa: activa ? 1 : 0 }
  );
  return { ok: true };
};

exports.remove = async (id) => {
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM canchas WHERE id = :id`,
    { id: Number(id) }
  );
  return { ok: true };
};
