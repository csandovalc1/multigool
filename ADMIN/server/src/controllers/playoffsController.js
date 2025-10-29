const svc = require('../services/playoffsService');

// INIT / CLOSE
exports.initPlayoffs = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const payload = req.body || {};
    const result = await svc.initPlayoffsForTorneo(torneoId, payload);
    res.status(201).json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.closeSeries = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const { round_key, match_no, penales_home, penales_away } = req.body;
    const result = await svc.closeSeries(torneoId, { round_key, match_no, penales_home, penales_away });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// READ
exports.getSummary = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const result = await svc.getSummary(torneoId);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getBracket = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const result = await svc.getBracket(torneoId);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getRound = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const round_key = req.params.round_key;
    const result = await svc.getRoundMatches(torneoId, round_key);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// WRITE
exports.updateMatch = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const body = req.body ?? {};

    const {
      match_id,
      fecha,
      hora,
      cancha,
      home_goals,
      away_goals,
    } = body;

    if (!match_id) throw new Error('match_id es requerido');

    console.log('[PATCH /playoffs/:torneoId/match]', {
      torneoId, match_id, fecha, hora, cancha, home_goals, away_goals
    });

    const result = await svc.updateMatch(torneoId, {
      match_id: Number(match_id),
      fecha: (fecha && String(fecha).trim()) ? String(fecha).trim() : null,
      hora: (hora !== undefined && hora !== null) ? String(hora).trim() : null,
      cancha: (cancha && String(cancha).trim()) ? String(cancha).trim() : null,
      home_goals: (home_goals === '' || home_goals === undefined || home_goals === null) ? null : Number(home_goals),
      away_goals: (away_goals === '' || away_goals === undefined || away_goals === null) ? null : Number(away_goals),
    });

    res.json(result);
  } catch (e) {
    console.error('[updateMatch][ERROR]', e);
    res.status(400).json({ error: e.message || 'Bad Request' });
  }
};

exports.assignSlot = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const { match_id, slot, team_id } = req.body || {};

    if (!match_id || !team_id || !['home', 'away'].includes(String(slot))) {
      throw new Error('Parámetros inválidos');
    }

    const result = await svc.assignSlot(torneoId, {
      match_id: Number(match_id),
      slot: String(slot),
      team_id: Number(team_id),
    });

    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.undoSeries = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const { round_key, match_no } = req.body;
    const result = await svc.undoSeries(torneoId, { round_key, match_no });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// ADMIN
exports.deleteEliminatoria = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const result = await svc.deleteEliminatoria(torneoId);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.getState = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const result = await svc.getState(torneoId);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
};


// === EVENTOS (eliminatoria) ===
exports.getElimEvents = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const matchId = parseInt(req.params.matchId);
    const rows = await svc.getElimEvents(torneoId, matchId);
    res.json(rows);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.delElimEvents = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const matchId = parseInt(req.params.matchId);
    await svc.deleteElimEventsByMatch(torneoId, matchId);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.createElimEvent = async (req, res) => {
  try {
    const torneoId = parseInt(req.params.torneoId);
    const { match_id, jugador_id, tipo, minuto } = req.body || {};
    if (!match_id || !jugador_id || !tipo) throw new Error('match_id, jugador_id y tipo son requeridos');
    const id = await svc.insertElimEvent(torneoId, {
      match_id: Number(match_id),
      jugador_id: Number(jugador_id),
      tipo: String(tipo),
      minuto: (minuto == null ? null : Number(minuto))
    });
    res.status(201).json({ id });
  } catch (e) { res.status(400).json({ error: e.message }); }
};
