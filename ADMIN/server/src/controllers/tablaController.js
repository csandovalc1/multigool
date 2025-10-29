const { getTablaByTorneo } = require('../services/standingsService');
exports.getTabla = async (req, res) => {
try { res.json(await getTablaByTorneo(parseInt(req.params.torneo_id))); }
catch(e){ res.status(500).json({ error: e.message }); }
};