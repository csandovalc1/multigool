// controllers/cierresController.js
const cierresModel = require('../models/cierresModel');
const { sql, getPool } = require('../config/db');

exports.listByMonth = async (req, res) => {
  try {
    const y = Number(req.query.year);
    const m = Number(req.query.month);
    if (!y || !m) return res.status(400).json({ error: 'year y month son requeridos' });
    const data = await cierresModel.listByMonth({ year: y, month: m });
    res.json({ dates: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { fecha, motivo } = req.body || {};
    if (!fecha) return res.status(400).json({ error: 'fecha requerida (YYYY-MM-DD)' });

    // Solo checamos reservas
    const conflicts = await cierresModel.findConflicts(fecha);
    const hasConflicts = (conflicts.reservas.length) > 0;
    const force = req.query.force === '1';

    // Si hay conflictos y NO es forzado, respondemos 409 con detalle (solo reservas)
    if (hasConflicts && !force) {
      return res.status(409).json(conflicts);
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // upsert del cierre
      await cierresModel.insert({ fecha, motivo: motivo || null }, tx);

      if (hasConflicts) {
        // cancelar reservas; no tocamos partidos/torneos
        const canceladas = await cierresModel.cancelReservationsForDate(fecha, tx);
        await tx.commit();
        return res.status(201).json({
          ok: true,
          canceladas
        });
      }

      await tx.commit();
      return res.status(201).json({ ok: true });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const fecha = req.params.fecha;
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' });
    await cierresModel.remove(fecha);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
