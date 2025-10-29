// controllers/grupoController.js
const grupoModel = require('../models/grupoModel');

exports.list = async (req, res) => {
  try {
    const data = await grupoModel.listGrupos({
      tipo_futbol: req.query.tipo_futbol || null
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { nombre, tipo_futbol, activa } = req.body || {};
    if (!nombre || !tipo_futbol) return res.status(400).json({ error: 'nombre y tipo_futbol son requeridos' });
    const id = await grupoModel.createGrupo({ nombre, tipo_futbol, activa: activa !== undefined ? !!activa : true });
    res.json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, tipo_futbol, activa } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id inválido' });
    if (!nombre || !tipo_futbol) return res.status(400).json({ error: 'nombre y tipo_futbol son requeridos' });
    await grupoModel.updateGrupo(id, { nombre, tipo_futbol, activa: !!activa });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.toggle = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { activa } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id inválido' });
    if (activa === undefined) return res.status(400).json({ error: 'activa es requerido' });
    await grupoModel.setActiva(id, !!activa);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    await grupoModel.removeGrupo(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// Miembros (canchas físicas)
exports.getMiembros = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const items = await grupoModel.getFisicasByGrupo(id);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
exports.setMiembros = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cancha_ids = Array.isArray(req.body?.cancha_ids) ? req.body.cancha_ids : [];
    await grupoModel.setMiembros(id, cancha_ids);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
