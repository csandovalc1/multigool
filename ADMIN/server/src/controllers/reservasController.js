const model = require('../models/reservasModel');
exports.list = async (req, res)=>{
try { res.json(await model.list(req.query)); } catch(e){ res.status(500).json({ error: e.message }); }
};
exports.create = async (req, res)=>{
try { await model.create(req.body); res.status(201).json({ ok:true }); } catch(e){ res.status(400).json({ error: e.message }); }
};
exports.update = async (req, res)=>{
try { await model.update(parseInt(req.params.id), req.body); res.json({ ok:true }); } catch(e){ res.status(400).json({ error: e.message }); }
};