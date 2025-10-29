// controllers/academiaController.js
const model = require('../models/academiaModel');

// ===== Público =====
exports.publicInfo = async (req, res) => {
  try {
    const categorias = await model.listCategoriasPublic();
    res.json({ categorias });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ===== Admin: Categorías =====
exports.listCategorias = async (req, res) => {
  try { res.json(await model.listCategorias()); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createCategoria = async (req, res) => {
  try {
    const { nombre, edad_min, edad_max, cupo, mensualidad_q, dias, hora_inicio, hora_fin, cancha_id } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
    if (edad_min == null || edad_max == null) return res.status(400).json({ error: 'rangos de edad requeridos' });
    const r = await model.createCategoria({ nombre, edad_min, edad_max, cupo, mensualidad_q, dias, hora_inicio, hora_fin, cancha_id });
    res.json({ id: r.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateCategoria = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    const { nombre, edad_min, edad_max, cupo, mensualidad_q, dias, hora_inicio, hora_fin, cancha_id } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
    await model.updateCategoria(id, { nombre, edad_min, edad_max, cupo, mensualidad_q, dias, hora_inicio, hora_fin, cancha_id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteCategoria = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    await model.deleteCategoria(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// ===== Admin: Alumnos =====
exports.listAlumnos = async (req, res) => {
  try { res.json(await model.listAlumnos()); }
  catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createAlumno = async (req, res) => {
  try {
    const { nombres, apellidos, fecha_nacimiento, telefono, categoria_id } = req.body;
    if (!nombres) return res.status(400).json({ error: 'nombres requerido' });
    const r = await model.createAlumno({ nombres, apellidos, fecha_nacimiento, telefono, categoria_id });
    res.json({ id: r.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateAlumno = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    const { nombres, apellidos, fecha_nacimiento, telefono, categoria_id } = req.body;
    if (!nombres) return res.status(400).json({ error: 'nombres requerido' });
    await model.updateAlumno(id, { nombres, apellidos, fecha_nacimiento, telefono, categoria_id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.deleteAlumno = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    await model.deleteAlumno(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
