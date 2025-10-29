const model = require('../models/jugadoresModel');

function assertNombre(nombre) {
  if (!nombre || !String(nombre).trim()) throw new Error('nombre es requerido');
}

function normDorsal(d) {
  if (d === undefined || d === null || d === '') return null;
  const n = Number(d);
  if (!Number.isFinite(n) || n < 0) throw new Error('dorsal inválido');
  return n;
}

exports.listByEquipo = async (equipo_id) => {
  if (!equipo_id) throw new Error('equipo_id requerido');
  return await model.listByEquipo(equipo_id);
};

exports.create = async ({ equipo_id, nombre, dorsal, posicion }) => {
  if (!equipo_id) throw new Error('equipo_id requerido');
  assertNombre(nombre);
  const d = normDorsal(dorsal);
  // regla: dorsal único por equipo (si no es null)
  if (d !== null) {
    const exists = await model.findByEquipoAndDorsal(equipo_id, d);
    if (exists) throw new Error('Dorsal ya está en uso en este equipo');
  }
  const id = await model.create({ equipo_id, nombre: String(nombre).trim(), dorsal: d, posicion: posicion || null });
  return { ok: true, id };
};

exports.update = async ({ id, nombre, dorsal, posicion }) => {
  if (!id) throw new Error('id requerido');
  const current = await model.getById(id);
  if (!current) throw new Error('Jugador no existe');
  const newNombre = (nombre !== undefined ? String(nombre).trim() : current.nombre);
  assertNombre(newNombre);
  const d = (dorsal !== undefined) ? normDorsal(dorsal) : current.dorsal;
  // si cambia dorsal, checar unicidad
  if (d !== null) {
    const exists = await model.findByEquipoAndDorsal(current.equipo_id, d, id);
    if (exists) throw new Error('Dorsal ya está en uso en este equipo');
  }
  await model.update({ id, nombre: newNombre, dorsal: d, posicion: posicion !== undefined ? (posicion || null) : current.posicion });
  return { ok: true };
};

exports.remove = async (id) => {
  if (!id) throw new Error('id requerido');
  await model.remove(id);
  return { ok: true, deleted: 1 };
};
