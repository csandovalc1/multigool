// playoffsService.js
const { sql, getPool } = require('../config/db');
const standings = require('./../services/standingsService');
const model = require('../models/playoffsModel');

function nextPow2(n){
  if (n <= 1) return 2;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function defaultRoundsConfig(nBracket, ida_vuelta, away_goals) {
  const defMap = {
    2:  [{ key: 'F',   p: 1 }],
    4:  [{ key: 'SF',  p: 2 }, { key: 'F',   p: 1 }],
    8:  [{ key: 'QF',  p: 4 }, { key: 'SF',  p: 2 }, { key: 'F',   p: 1 }],
    16: [{ key: 'R16', p: 8 }, { key: 'QF',  p: 4 }, { key: 'SF',  p: 2 }, { key: 'F', p: 1 }],
    32: [{ key: 'R32', p: 16 }, { key: 'R16', p: 8 }, { key: 'QF',  p: 4 }, { key: 'SF',  p: 2 }, { key: 'F', p: 1 }],
  };
  const def = defMap[nBracket];
  if (!def) throw new Error(`No soportado nBracket=${nBracket} (usa 2,4,8,16,32 o pasa rounds explícito)`);
  return def.map((r, idx) => ({
    round_key: r.key,
    partidos: r.p,
    ida_vuelta,
    away_goals,
    orden: idx + 1
  }));
}

function buildFirstRoundPairsFromSlots(seedSlots) {
  const pairs = [];
  for (let i = 0; i < seedSlots.length; i += 2) {
    pairs.push([ seedSlots[i] ?? null, seedSlots[i+1] ?? null ]);
  }
  return pairs;
}

async function autoAdvanceByesAllRounds(elimId, roundsCfg){
  // Recorre ronda por ronda, avanzando cualquier serie con exactamente un null
  for (const r of roundsCfg) {
    const legs = await model.getMatchesByRound(elimId, r.round_key);
    const seriesMap = {};
    for (const m of legs) {
      seriesMap[m.match_no] ??= [];
      seriesMap[m.match_no].push(m);
    }
    for (const k of Object.keys(seriesMap)) {
      seriesMap[k].sort((a,b)=>a.leg-b.leg);
    }

    for (const [matchNoStr, arr] of Object.entries(seriesMap)) {
      const match_no = Number(matchNoStr);
      const leg1 = arr.find(x=>x.leg===1) || arr[0];

      const h = leg1.home_id ?? null;
      const a = leg1.away_id ?? null;

      const oneBye = (h!=null && a==null) || (h==null && a!=null);
      // si es bye-bye (ambos null) no hacemos nada
      if (!oneBye) continue;

      const winner = h != null ? h : a;

      await model.setSeriesWinner(elimId, r.round_key, match_no, winner);

      if (leg1.next_match_id) {
        const next = await model.getMatchById(leg1.next_match_id);
        if (next && next.id) {
          await model.propagateWinnerToNext({
            eliminatoria_id: elimId,
            next_round_key: next.round_key,
            next_match_no: next.match_no,
            next_slot: leg1.next_slot,
            winner_id: winner
          });
        }
      }
    }
  }
}


async function ensureTorneoForPlayoffs(torneoId) {
  const t = await model.getTorneoById(torneoId);
  if (!t) throw new Error('Torneo no existe');
  if (t.fase !== 'liga') throw new Error(`El torneo no está en fase 'liga' (fase actual: ${t.fase})`);
  const existing = await model.getEliminatoriaByTorneo(torneoId);
  if (existing) throw new Error('Este torneo ya tiene eliminatorias creadas');
  return t;
}

exports.initPlayoffsForTorneo = async (torneoId, {
  nombre,
  ida_vuelta,
  away_goals,
  rounds,
  seed_from_table = true,
  seed_count,
  seed_team_ids,
  auto_advance_byes = false,
  start_date,                
}) => {
  const pool = await getPool();
  const torneo = await ensureTorneoForPlayoffs(torneoId);

  const g_ida_vuelta = (typeof ida_vuelta === 'boolean') ? ida_vuelta : !!torneo.po_ida_vuelta;
  const g_away_goals = (typeof away_goals === 'boolean') ? away_goals : !!torneo.po_away_goals;

  let provided = Array.isArray(seed_team_ids) ? seed_team_ids : [];
  const teamIds = provided.filter(v => v !== null && v !== undefined).map(Number);
  let N = teamIds.length;

  // =========================
  // 1) Semilla desde TABLA
  // =========================
  if (seed_from_table) {
    // Trae tabla de posiciones (ordenada) y arma listado de ids
    const tabla = await standings.getTablaByTorneo(torneoId);
    const allIds = (tabla || []).map(x => x.team_id);
    const total = allIds.length;

    // Respeta torneos.clasificados (K):
    // - Si K>0: usa top K
    // - Si K=0/null: usa a todos (total)
    const K = Number(torneo?.clasificados || 0) > 0
      ? Math.min(Number(torneo.clasificados), total)
      : total;

    if (K < 2) throw new Error('No hay suficientes equipos clasificados para iniciar playoffs');

    // N = K (equipos reales a entrar al bracket)
    N = K;

    // Bracket size M calculado desde K (no desde total)
    let M = nextPow2(N);
    if (![2,4,8,16,32].includes(M)) {
      M = [2,4,8,16,32].find(s => s >= N) || 32;
    }

    // Slots: colocar top K en 0..K-1, resto byes (null)
    const slots = new Array(M).fill(null);
    allIds.slice(0, K).forEach((id, idx)=>{ slots[idx] = id; });

    // Rondas (igual que antes)
    let roundsCfg;
    if (Array.isArray(rounds) && rounds.length) {
      roundsCfg = rounds.map((r, i) => ({
        round_key: r.round_key,
        partidos: Number(r.partidos),
        ida_vuelta: typeof r.ida_vuelta === 'boolean' ? r.ida_vuelta : g_ida_vuelta,
        away_goals: typeof r.away_goals === 'boolean' ? r.away_goals : g_away_goals,
        orden: i + 1
      }));
    } else {
      roundsCfg = defaultRoundsConfig(M, g_ida_vuelta, g_away_goals);
    }

    // Crear eliminatoria (igual que antes)
const elimId = await model.createEliminatoria({
    torneo_id: torneoId,
    nombre: nombre || null,
    ida_vuelta: g_ida_vuelta ? 1 : 0,
    away_goals: g_away_goals ? 1 : 0,
    start_date: start_date || null,   // ⬅️ NUEVO
  });

    // Insert rounds
    await model.insertRounds(elimId, roundsCfg);

    // Primera ronda
    const firstRoundPairs = buildFirstRoundPairsFromSlots(slots);
    const firstRound = roundsCfg[0];
    if (firstRound.partidos !== firstRoundPairs.length) {
      throw new Error(`Config inconsistente: ${firstRound.partidos} partidos configurados vs ${firstRoundPairs.length} pares calculados`);
    }

    // Generar bracket + programar (fecha/hora/cancha) se hace en el model como antes
    await model.generateBracket({ eliminatoria_id: elimId, roundsCfg, firstRoundPairs });

if (auto_advance_byes) {
  await autoAdvanceByesAllRounds(elimId, roundsCfg);
}


    // Actualizar fase a playoffs
    await pool.request().input('tid', sql.Int, torneoId)
      .query("UPDATE torneos SET fase='playoffs' WHERE id=@tid");

    return {
      ok: true,
      eliminatoria_id: elimId,
      rounds: roundsCfg.length,
      matches_created: roundsCfg.reduce((a,r)=>a + r.partidos*(r.ida_vuelta?2:1),0)
    };
  }

  // =========================
  // 2) Semilla Manual / Automática
  // =========================
  if (N < 2) throw new Error('No hay cantidad válida de equipos para iniciar playoffs');

  let M = seed_count && [2,4,8,16,32].includes(Number(seed_count)) ? Number(seed_count) : nextPow2(N);
  if (![2,4,8,16,32].includes(M)) {
    M = [2,4,8,16,32].find(s => s >= N) || 32;
  }

  let slots;
  if (provided.length === M) {
    slots = provided.map(v => (v==null ? null : Number(v)));
  } else {
    slots = new Array(M).fill(null);
    teamIds.forEach((id, idx)=>{ slots[idx] = id; });
  }

const elimId = await model.createEliminatoria({
    torneo_id: torneoId,
    nombre: nombre || null,
    ida_vuelta: g_ida_vuelta ? 1 : 0,
    away_goals: g_away_goals ? 1 : 0,
    start_date: start_date || null,   // ⬅️ NUEVO
  });

  let roundsCfg;
  if (Array.isArray(rounds) && rounds.length) {
    roundsCfg = rounds.map((r, i) => ({
      round_key: r.round_key,
      partidos: Number(r.partidos),
      ida_vuelta: typeof r.ida_vuelta === 'boolean' ? r.ida_vuelta : g_ida_vuelta,
      away_goals: typeof r.away_goals === 'boolean' ? r.away_goals : g_away_goals,
      orden: i + 1
    }));
  } else {
    roundsCfg = defaultRoundsConfig(M, g_ida_vuelta, g_away_goals);
  }
  await model.insertRounds(elimId, roundsCfg);

  const firstRoundPairs = buildFirstRoundPairsFromSlots(slots);
  const firstRound = roundsCfg[0];
  if (firstRound.partidos !== firstRoundPairs.length) {
    throw new Error(`Config inconsistente: ${firstRound.partidos} partidos configurados vs ${firstRoundPairs.length} pares calculados`);
  }

  await model.generateBracket({ eliminatoria_id: elimId, roundsCfg, firstRoundPairs });
if (auto_advance_byes) {
  await autoAdvanceByesAllRounds(elimId, roundsCfg);
}


  await pool.request().input('tid', sql.Int, torneoId)
    .query("UPDATE torneos SET fase='playoffs' WHERE id=@tid");

  return { ok: true, eliminatoria_id: elimId, rounds: roundsCfg.length, matches_created: roundsCfg.reduce((a,r)=>a + r.partidos*(r.ida_vuelta?2:1),0) };
};


exports.closeSeries = async (torneoId, { round_key, match_no, penales_home, penales_away }) => {
  const torneo = await model.getTorneoById(torneoId);
  if (!torneo) throw new Error('Torneo no existe');
  if (torneo.fase !== 'playoffs') throw new Error(`El torneo no está en playoffs (fase actual: ${torneo.fase})`);

  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) throw new Error('No existe eliminatoria para este torneo');

  const roundCfg = await model.getRound(elim.id, round_key);
  if (!roundCfg) throw new Error(`Ronda ${round_key} no configurada`);

  const already = await model.getSeriesWinner(elim.id, round_key, match_no);
  if (already) throw new Error('La serie ya está finalizada');

  const seriesMatches = await model.getSeriesMatches(elim.id, round_key, match_no);
  if (!seriesMatches.length) throw new Error('Serie no encontrada');

  const leg1 = seriesMatches.find(m => m.leg === 1) || seriesMatches[0];
  const seriesHome = leg1.home_id;
  const seriesAway = leg1.away_id;

  if (!seriesHome || !seriesAway) {
    const winner = seriesHome || seriesAway;
    if (!winner) throw new Error('La serie no tiene equipos asignados');
    await model.setSeriesWinner(elim.id, round_key, match_no, winner);

    if (leg1.next_match_id) {
      const next = await model.getMatchById(leg1.next_match_id);
      if (next && next.id) {
        await model.propagateWinnerToNext({
          eliminatoria_id: elim.id,
          next_round_key: next.round_key,
          next_match_no: next.match_no,
          next_slot: leg1.next_slot,
          winner_id: winner
        });
      }
    }
    return { ok: true, winner_id: winner };
  }

  let winnerId = null;

  if (!roundCfg.ida_vuelta) {
    if (leg1.home_goals == null || leg1.away_goals == null) throw new Error('Faltan goles del partido único');
    if (leg1.home_goals > leg1.away_goals) winnerId = seriesHome;
    else if (leg1.home_goals < leg1.away_goals) winnerId = seriesAway;
    else {
      if (penales_home == null || penales_away == null) throw new Error('Empate: debes enviar penales_home/penales_away');
      winnerId = (Number(penales_home) > Number(penales_away)) ? seriesHome : seriesAway;
      await model.updatePenales(leg1.id, Number(penales_home), Number(penales_away));
    }
  } else {
    const leg2 = seriesMatches.find(m => m.leg === 2);
    if (!leg2) throw new Error('Falta leg 2 en una serie ida/vuelta');

    let totalHome = 0, totalAway = 0, awayGoalsHome = 0, awayGoalsAway = 0;
    for (const m of [leg1, leg2]) {
      const hg = m.home_goals ?? 0;
      const ag = m.away_goals ?? 0;
      if (m.home_id === seriesHome) {
        totalHome += hg; totalAway += ag; awayGoalsAway += ag;
      } else {
        totalHome += ag; totalAway += hg; awayGoalsHome += ag;
      }
    }

    if (totalHome > totalAway) winnerId = seriesHome;
    else if (totalHome < totalAway) winnerId = seriesAway;
    else if (roundCfg.away_goals) {
      if (awayGoalsHome > awayGoalsAway) winnerId = seriesHome;
      else if (awayGoalsHome < awayGoalsAway) winnerId = seriesAway;
    }

    if (!winnerId) {
      if (penales_home == null || penales_away == null)
        throw new Error('Global empatado: debes enviar penales_home/penales_away');
      winnerId = (Number(penales_home) > Number(penales_away)) ? seriesHome : seriesAway;
      await model.updatePenales(leg2.id, Number(penales_home), Number(penales_away));
    }
  }

  await model.setSeriesWinner(elim.id, round_key, match_no, winnerId);

  const next = leg1.next_match_id ? await model.getMatchById(leg1.next_match_id) : null;
  if (next && next.id) {
    await model.propagateWinnerToNext({
      eliminatoria_id: elim.id,
      next_round_key: next.round_key,
      next_match_no: next.match_no,
      next_slot: leg1.next_slot,
      winner_id: winnerId
    });
  } else {
    if (round_key === 'F') {
      await model.markTorneoFinalizado(torneoId);
    }
  }

  return { ok: true, winner_id: winnerId };
};

// ---- LECTURAS ----
exports.getSummary = async (torneoId) => {
  const torneo = await model.getTorneoById(torneoId);
  if (!torneo) throw new Error('Torneo no existe');
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  const rounds = elim ? await model.getRounds(elim.id) : [];
  return {
    torneo: { id: torneo.id, nombre: torneo.nombre, fase: torneo.fase, tipo_torneo: torneo.tipo_torneo },
    eliminatoria: elim ? {
      id: elim.id, ida_vuelta: !!elim.ida_vuelta, away_goals: !!elim.away_goals, nombre: elim.nombre
    } : null,
    rounds
  };
};

exports.getBracket = async (torneoId) => {
  const torneo = await model.getTorneoById(torneoId);
  if (!torneo) throw new Error('Torneo no existe');
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) return { torneo: { id: torneo.id, fase: torneo.fase }, eliminatoria: null, rounds: [] };

  const rounds = await model.getRounds(elim.id);
  const matches = await model.getAllMatchesByElim(elim.id);

  const byRound = {};
  for (const r of rounds) byRound[r.round_key] = {};
  for (const m of matches) {
    byRound[m.round_key] ??= {};
    byRound[m.round_key][m.match_no] ??= [];
    byRound[m.round_key][m.match_no].push(m);
  }
  for (const rk of Object.keys(byRound)) {
    for (const mn of Object.keys(byRound[rk])) {
      byRound[rk][mn].sort((a,b)=>a.leg-b.leg);
    }
  }

  return {
    torneo: { id: torneo.id, fase: torneo.fase },
    eliminatoria: { id: elim.id, ida_vuelta: !!elim.ida_vuelta, away_goals: !!elim.away_goals },
    rounds: rounds.map(r => ({
      round_key: r.round_key,
      partidos: r.partidos,
      ida_vuelta: !!r.ida_vuelta,
      series: Object.entries(byRound[r.round_key] || {}).map(([match_no, legs]) => ({
        match_no: Number(match_no),
        winner_id: legs[0]?.winner_id || null,
        next_match_id: legs[0]?.next_match_id || null,
        next_slot: legs[0]?.next_slot || null,
        legs
      }))
    }))
  };
};

exports.getRoundMatches = async (torneoId, round_key) => {
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) throw new Error('No existe eliminatoria');
  const roundCfg = await model.getRound(elim.id, round_key);
  if (!roundCfg) throw new Error('Ronda no configurada');
  const legs = await model.getMatchesByRound(elim.id, round_key);
  const series = {};
  for (const m of legs) {
    series[m.match_no] ??= [];
    series[m.match_no].push(m);
  }
  for (const k of Object.keys(series)) series[k].sort((a,b)=>a.leg-b.leg);
  return { eliminatoria_id: elim.id, round: roundCfg, series };
};

// ---- UPDATE LEG ----
exports.updateMatch = async (torneoId, { match_id, fecha, hora, cancha, home_goals, away_goals }) => {
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) throw new Error('No existe eliminatoria');
  const match = await model.getMatchById(match_id);
  if (!match || match.eliminatoria_id !== elim.id) throw new Error('Match no pertenece a esta eliminatoria');

  const winnerSeries = await model.getSeriesWinner(match.eliminatoria_id, match.round_key, match.match_no);
  if (winnerSeries) throw new Error('La serie ya está finalizada. Usa undo-series si necesitas corregir');

  await model.updateMatch({
    id: match_id,
    fecha: fecha ?? match.fecha,
    hora: hora ?? match.hora,
    cancha: cancha ?? match.cancha,
    home_goals: (home_goals !== undefined ? Number(home_goals) : match.home_goals),
    away_goals: (away_goals !== undefined ? Number(away_goals) : match.away_goals)
  });

  return { ok: true };
};

// ---- UNDO SERIES ----
exports.undoSeries = async (torneoId, { round_key, match_no }) => {
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) throw new Error('No existe eliminatoria');
  const legs = await model.getSeriesMatches(elim.id, round_key, match_no);
  if (!legs.length) throw new Error('Serie no encontrada');

  const base = legs.find(x => x.leg === 1) || legs[0];
  if (base.next_match_id && base.next_slot) {
    await model.clearWinnerFromNext({
      eliminatoria_id: elim.id,
      next_match_id: base.next_match_id,
      next_slot: base.next_slot
    });
  }

  await model.clearSeriesWinner(elim.id, round_key, match_no);

  return { ok: true };
};

// ---- DELETE ELIM ----
exports.deleteEliminatoria = async (torneoId) => {
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) return { ok: true, deleted: 0 };
  await model.deleteEliminatoria(elim.id);
  const torneo = await model.getTorneoById(torneoId);
  if (torneo?.fase === 'playoffs') {
    const pool = await getPool();
    await pool.request().input('tid', sql.Int, torneoId)
      .query("UPDATE torneos SET fase='liga' WHERE id=@tid");
  }
  return { ok: true, deleted: 1 };
};

// ---- STATE ----
exports.getState = async (torneoId) => {
  const torneo = await model.getTorneoById(torneoId);
  if (!torneo) throw new Error('Torneo no existe');
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  return {
    torneo_id: torneo.id,
    fase: torneo.fase,
    eliminatoria_id: elim?.id || null
  };
};

// Asignar equipo a un BYE/TBD en la serie (reabre si estaba cerrada)
exports.assignSlot = async (torneoId, { match_id, slot, team_id }) => {
  const torneo = await model.getTorneoById(torneoId);
  if (!torneo) throw new Error('Torneo no existe');
  if (torneo.fase !== 'playoffs') throw new Error(`El torneo no está en playoffs (fase actual: ${torneo.fase})`);

  if (!match_id || !team_id || !['home','away'].includes(slot)) {
    throw new Error('Parámetros inválidos');
  }

  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) throw new Error('No existe eliminatoria para este torneo');

  const leg = await model.getMatchById(match_id);
  if (!leg || leg.eliminatoria_id !== elim.id) throw new Error('Match no pertenece a esta eliminatoria');

  // Si la serie está cerrada, la reabrimos (undo) ANTES de asignar
  const winner = await model.getSeriesWinner(elim.id, leg.round_key, leg.match_no);
  if (winner) {
    // Limpia ganador y quita propagación al siguiente
    await exports.undoSeries(torneoId, { round_key: leg.round_key, match_no: leg.match_no });
  }

  // Ejecutar asignación (actualiza leg1 y leg2 coherentemente)
  await model.assignTeamToLegSlot({ match_id, slot, team_id });

  return { ok: true };
};

// === EVENTOS (eliminatoria) ===
exports.getElimEvents = async (torneoId, match_id) => {
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) throw new Error('No existe eliminatoria');
  const match = await model.getMatchById(match_id);
  if (!match || match.eliminatoria_id !== elim.id) throw new Error('Match no pertenece a esta eliminatoria');
  return await model.getElimEventsByMatch(match_id);
};

exports.deleteElimEventsByMatch = async (torneoId, match_id) => {
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) throw new Error('No existe eliminatoria');
  const match = await model.getMatchById(match_id);
  if (!match || match.eliminatoria_id !== elim.id) throw new Error('Match no pertenece a esta eliminatoria');
  await model.deleteElimEventsByMatch(match_id);
  return { ok: true };
};

exports.insertElimEvent = async (torneoId, { match_id, jugador_id, tipo, minuto }) => {
  const elim = await model.getEliminatoriaByTorneo(torneoId);
  if (!elim) throw new Error('No existe eliminatoria');
  const match = await model.getMatchById(match_id);
  if (!match || match.eliminatoria_id !== elim.id) throw new Error('Match no pertenece a esta eliminatoria');
  return await model.insertElimEvent({ match_id, jugador_id, tipo, minuto });
};
