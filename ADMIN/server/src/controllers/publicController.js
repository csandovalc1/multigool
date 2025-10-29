// controllers/publicController.js
const pub = require('../models/publicModel');

exports.listTorneosActivos = async (_req, res) => {
  try { res.json(await pub.listTorneosActivos()); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getTorneoSummary = async (req, res) => {
  try { res.json(await pub.getTorneoSummary(parseInt(req.params.id))); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getTabla = async (req, res) => {
  try { res.json(await pub.getTabla(parseInt(req.params.id))); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getFixture = async (req, res) => {
  try { res.json(await pub.getFixture(parseInt(req.params.id))); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getPlayoffsBracket = async (req, res) => {
  try { res.json(await pub.getPlayoffsBracket(parseInt(req.params.id))); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getPlayoffsRound = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.id);
    const roundKey = String(req.params.round_key).toUpperCase();
    res.json(await pub.getPlayoffsRound(torneoId, roundKey));
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getGoleadores = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.id);
    const includePlayoffs = String(req.query.playoffs ?? '1') === '1';
    res.json(await pub.getGoleadores(torneoId, includePlayoffs));
  } catch (e) { res.status(400).json({ error: e.message }); }
};


// Calendario
exports.listFields = async (_req, res) => {
  try { res.json(await pub.listFields()); }
  catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getCalendarDay = async (req, res) => {
  try {
    const ymd = String(req.query.date || '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error('date inválida');
    res.json(await pub.getCalendarDay(ymd));
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getCalendarMonth = async (req, res) => {
  try {
    const year  = parseInt(req.query.year);
    const month = parseInt(req.query.month);
    if (!year || !month) throw new Error('year/month requeridos');
    res.json(await pub.getCalendarMonth({ year, month }));
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.lookupReservation = async (req, res) => {
  try {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!code) throw new Error('code requerido');
    res.json(await pub.lookupReservation(code));
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// ===== Galería pública =====
exports.getGaleriaPublic = async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit || '12');
    const offset = parseInt(req.query.offset || '0');
    const rows = await pub.listGaleriaPublic({ limit, offset });
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
};