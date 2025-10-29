const model = require('../models/newsModel');
exports.create = async (req, res)=>{ try{ const id = await model.create(req.body); res.status(201).json({ id }); }catch(e){ res.status(500).json({ error: e.message }); }}
exports.list = async (_req, res)=>{ try{ res.json(await model.list()); }catch(e){ res.status(500).json({ error: e.message }); }}
exports.update = async (req, res)=>{ try{ await model.update(parseInt(req.params.id), req.body); res.json({ ok:true }); }catch(e){ res.status(500).json({ error: e.message }); }}
exports.publish = async (req, res)=>{ try{ await model.publish(parseInt(req.params.id)); res.json({ ok:true }); }catch(e){ res.status(500).json({ error: e.message }); }}
exports.unpublish = async (req, res)=>{ try{ await model.unpublish(parseInt(req.params.id)); res.json({ ok:true }); }catch(e){ res.status(500).json({ error: e.message }); }}
exports.remove = async (req, res)=>{ try{ await model.remove(parseInt(req.params.id)); res.json({ ok:true }); }catch(e){ res.status(500).json({ error: e.message }); }}