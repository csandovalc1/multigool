const model = require('../models/partidoModel');

exports.actualizarGoles = async (req, res) => {
  try {
    const { partido_id, goles_local, goles_visita } = req.body;
    await model.actualizarGoles(partido_id, goles_local, goles_visita);
    res.json({ mensaje: 'Goles actualizados' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.finalizarPartido = async (req, res) => {
  try {
    const { partido_id, goles_local, goles_visita } = req.body;
    if (goles_local == null || goles_visita == null) return res.status(400).json({ error: 'Faltan goles' });
    await model.finalizar(partido_id, goles_local, goles_visita);
    res.json({ mensaje: 'Partido finalizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.listarPorRango = async (req, res) => {
  try {
    const { desde, hasta, torneo_id } = req.query;
    const data = await model.listarPorRango({ desde, hasta, torneo_id: torneo_id ? Number(torneo_id) : null });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// NUEVO: editar fecha/hora/cancha
exports.editarDatos = async (req, res) => {
  try {
    const { partido_id, fecha, hora, cancha } = req.body;
    if (!partido_id) return res.status(400).json({ error: 'partido_id es requerido' });
    await model.editarDatos({ partido_id: Number(partido_id), fecha: fecha ?? null, hora: hora ?? null, cancha: cancha ?? null });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
