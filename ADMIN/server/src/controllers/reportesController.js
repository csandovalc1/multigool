const model = require('../models/reportesModel');

function parseRango(q) {
  const desde = q.desde || null;
  const hasta = q.hasta || null;
  const gran  = (q.gran || 'month').toLowerCase(); // day|week|month
  const tipo  = q.tipo || null; // F5|F7
  return { desde, hasta, gran, tipo };
}

exports.ingresosReservas = async (req, res) => {
  try {
    const { desde, hasta, gran, tipo } = parseRango(req.query);
    const rows = await model.ingresosReservas({ desde, hasta, gran, tipo });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.reservasPorCancha = async (req, res) => {
  try {
    const { desde, hasta, tipo } = parseRango(req.query);
    const rows = await model.reservasPorCancha({ desde, hasta, tipo });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.heatmapHoras = async (req, res) => {
  try {
    const { desde, hasta, tipo } = parseRango(req.query);
    const rows = await model.heatmapHoras({ desde, hasta, tipo });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.ingresosTorneos = async (_req, res) => {
  try {
    const rows = await model.ingresosTorneos();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.ingresosTorneosPeriodo = async (req, res) => {
  try {
    const { desde, hasta, gran, tipo } = parseRango(req.query);
    const criterio = (req.query.criterio || 'registro').toLowerCase(); // 'registro' | 'inicio' | 'creacion'
    const rows = await model.ingresosTorneosPeriodo({ desde, hasta, gran, tipo, criterio });
    res.json(rows); // [{periodo, q_total}]
  } catch (e) { res.status(500).json({ error: e.message }); }
};


exports.balanceGeneral = async (req, res) => {
  try {
    const { desde, hasta, tipo } = parseRango(req.query);
    const rows = await model.balanceGeneral({ desde, hasta, tipo });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.proyeccionMesActual = async (_req, res) => {
  try {
    const row = await model.proyeccionMesActual();
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
