const model = require('../models/partidoDetalleModel');
exports.getEventos = async (req, res) => {
try { res.json(await model.obtenerEventosPorPartido(parseInt(req.params.partido_id))); }
catch(e){ res.status(500).json({ error: e.message }); }
};
exports.postEvento = async (req, res) => {
try { await model.agregarEvento(req.body); res.json({ mensaje: 'Evento registrado' }); }
catch(e){ res.status(500).json({ error: e.message }); }
};
exports.deleteEvento = async (req, res) => {
try { await model.eliminarEvento(parseInt(req.params.id)); res.json({ mensaje: 'Evento eliminado' }); }
catch(e){ res.status(500).json({ error: e.message }); }
};
exports.deleteEventosDePartido = async (req, res) => {
try { await model.eliminarEventosDePartido(parseInt(req.params.partido_id)); res.json({ mensaje: 'Eventos del partido eliminados' }); }
catch(e){ res.status(500).json({ error: e.message }); }
};