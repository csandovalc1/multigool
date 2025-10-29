const fixtureModel = require('../models/fixtureModel');
exports.getJornadasPorTorneo = async (req, res) => {
try { res.json(await fixtureModel.obtenerJornadasPorTorneo(parseInt(req.params.torneo_id))); }
catch(e){ res.status(500).json({ error: e.message }); }
};
exports.getPartidosPorJornada = async (req, res) => {
try { res.json(await fixtureModel.obtenerPartidosPorJornada(parseInt(req.params.jornada_id))); }
catch(e){ res.status(500).json({ error: e.message }); }
};