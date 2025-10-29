const svc = require('../services/jugadoresService');

exports.listByEquipo = async (req, res) => {
  try {
    const equipoId = parseInt(req.params.equipoId);
    const out = await svc.listByEquipo(equipoId);
    res.json(out);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.createForEquipo = async (req, res) => {
  try {
    const equipoId = parseInt(req.params.equipoId);
    const { nombre, dorsal, posicion } = req.body || {};
    const out = await svc.create({ equipo_id: equipoId, nombre, dorsal, posicion });
    res.status(201).json(out);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.updateById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, dorsal, posicion } = req.body || {};
    const out = await svc.update({ id, nombre, dorsal, posicion });
    res.json(out);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.deleteById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const out = await svc.remove(id);
    res.json(out);
  } catch (e) { res.status(400).json({ error: e.message }); }
};
