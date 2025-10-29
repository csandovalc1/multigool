const model = require('../models/canchaModel');

exports.list = async (req, res) => {
  try {
    const data = await model.listAll();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.listActive = async (req, res) => {
  try {
    const data = await model.listActive();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { nombre, tipo_futbol, activa } = req.body;
    if (!nombre || !tipo_futbol) return res.status(400).json({ error: 'nombre y tipo_futbol son requeridos' });
    const r = await model.create({ nombre, tipo_futbol, activa: activa !== undefined ? !!activa : true });
    res.json({ id: r.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, tipo_futbol, activa } = req.body;
    if (!id) return res.status(400).json({ error: 'id inválido' });
    if (!nombre || !tipo_futbol) return res.status(400).json({ error: 'nombre y tipo_futbol son requeridos' });
    await model.update(id, { nombre, tipo_futbol, activa: !!activa });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.toggle = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { activa } = req.body;
    if (!id) return res.status(400).json({ error: 'id inválido' });
    if (activa === undefined) return res.status(400).json({ error: 'activa es requerido' });
    await model.setActiva(id, !!activa);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    await model.remove(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
