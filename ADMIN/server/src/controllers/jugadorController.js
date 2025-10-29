const jugadorModel = require('../models/jugadorModel');
exports.getJugadoresPorEquipo = async (req, res) => {
try { res.json(await jugadorModel.obtenerJugadoresPorEquipo(parseInt(req.params.equipo_id))); }
catch(e){ res.status(500).json({ error: e.message }); }
};
exports.agregarJugador = async (req, res) => {
try { await jugadorModel.agregarJugador(req.body); res.json({ mensaje: 'Jugador agregado' }); }
catch(e){ res.status(500).json({ error: e.message }); }
};
exports.eliminarJugador = async (req, res) => {
try { await jugadorModel.eliminarJugador(parseInt(req.params.id)); res.json({ mensaje: 'Jugador eliminado' }); }
catch(e){ res.status(500).json({ error: e.message }); }
};