// models/playoffsModel.js  ✅ MySQL
const { getPool } = require('../config/db');

/* =========================================================
   Helpers: tiempo / fechas / slots
   ========================================================= */
function pad2(n){ return String(n).padStart(2,'0'); }
function toSqlTime(hhmm){
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if(!m) return null;
  return `${pad2(m[1])}:${m[2]}:00`;
}
function formatYMD(d){
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth()+1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}
function nextWeekday(baseDate, weekday){
  // weekday: 0..6  (Dom..Sáb)
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const diff = (weekday - d.getDay() + 7) % 7;
  if (diff === 0) return d;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Lee del torneo su configuración de agendado:
 * - dia_semana (0..6)
 * - franjas [{hi:"HH:MM:SS", hf:"HH:MM:SS"}]
 * - canchas [{id, nombre}]
 * Recibe eliminatoria_id → resuelve torneo_id.
 */
async function getTorneoSchedulingConfigByEliminatoria(eliminatoria_id){
  const pool = await getPool();

  // torneo_id
  const [[elim]] = await pool.execute(
    `SELECT torneo_id FROM eliminatorias WHERE id = :eid`,
    { eid: Number(eliminatoria_id) }
  );
  const torneo_id = elim?.torneo_id;
  if (!torneo_id) throw new Error('Eliminatoria sin torneo asociado');

  // dia_semana
  const [[tor]] = await pool.execute(
    `SELECT dia_semana FROM torneos WHERE id = :tid`,
    { tid: Number(torneo_id) }
  );
  const dia_semana = tor?.dia_semana;

  // franjas
  const [fr] = await pool.execute(
    `
    SELECT 
      DATE_FORMAT(hora_inicio, '%H:%i:%s') AS hi,
      DATE_FORMAT(hora_fin,   '%H:%i:%s') AS hf
    FROM torneo_franjas
    WHERE torneo_id = :tid
    ORDER BY hora_inicio
    `,
    { tid: Number(torneo_id) }
  );
  const franjas = (fr || []).map(r => ({ hi: r.hi, hf: r.hf }));

  // canchas
  const [ch] = await pool.execute(
    `
    SELECT c.id, c.nombre
    FROM torneo_canchas tc
    JOIN canchas c ON c.id = tc.cancha_id
    WHERE tc.torneo_id = :tid
    ORDER BY c.id
    `,
    { tid: Number(torneo_id) }
  );
  const canchas = (ch || []).map(r => ({ id: r.id, nombre: r.nombre }));

  return { torneo_id, dia_semana, franjas, canchas };
}

async function getLigaLastDateByEliminatoria(eliminatoria_id){
  const pool = await getPool();

  const [[elim]] = await pool.execute(
    `SELECT torneo_id FROM eliminatorias WHERE id = :eid`,
    { eid: Number(eliminatoria_id) }
  );
  const torneo_id = elim?.torneo_id;
  if (!torneo_id) throw new Error('Eliminatoria sin torneo asociado');

  const [[row]] = await pool.execute(
    `
    SELECT DATE_FORMAT(MAX(p.fecha), '%Y-%m-%d') AS max_ymd
    FROM partidos p
    JOIN jornadas j ON j.id = p.jornada_id
    WHERE j.torneo_id = :tid
    `,
    { tid: Number(torneo_id) }
  );

  return row?.max_ymd || null; // 'YYYY-MM-DD' o null
}

/**
 * Genera todos los slots (fecha/hora/cancha) para **un solo día** dado:
 */
function getSlotsForDate(fechaYMD, franjas, canchas){
  const out = [];
  for (const f of franjas) {
    const hora = toSqlTime(f.hi.slice(0,5));
    for (const c of canchas) {
      out.push({ fecha: fechaYMD, hora, canchaNombre: c.nombre });
    }
  }
  return out;
}

/**
 * Asigna slots a matchIds, empezando en `weekOffset` semanas desde la fecha base.
 */
async function scheduleMatchesBatch({ conn, matchIds, baseDate, dia_semana, franjas, canchas, initialWeekOffset = 0 }) {
  if (!matchIds.length) return 0;

  const capacityPerDay = franjas.length * canchas.length;
  if (capacityPerDay <= 0) return 0;

  let assigned = 0;
  let weekOffset = initialWeekOffset;

  while (assigned < matchIds.length) {
    const day0 = nextWeekday(baseDate, Number(dia_semana));
    const d = new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + (weekOffset * 7));
    const fecha = formatYMD(d);
    const slots = getSlotsForDate(fecha, franjas, canchas);

    const remaining = matchIds.length - assigned;
    const toAssign = Math.min(remaining, slots.length);

    for (let i = 0; i < toAssign; i++) {
      const matchId = matchIds[assigned + i];
      const slot = slots[i];
      await conn.execute(
        `
        UPDATE elim_matches
        SET fecha = :f,
            hora  = :h,
            cancha = :c
        WHERE id = :id
        `,
        {
          id: Number(matchId),
          f: slot.fecha,
          h: slot.hora,
          c: slot.canchaNombre,
        }
      );
    }

    assigned += toAssign;
    weekOffset += 1; // siguiente semana para agrupar por ronda
  }

  return (weekOffset - initialWeekOffset);
}

/* =========================================================
   Lecturas base
   ========================================================= */
exports.getTorneoById = async (id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM torneos WHERE id = :id`,
    { id: Number(id) }
  );
  return rows[0] || null;
};

exports.getEliminatoriaByTorneo = async (torneo_id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM eliminatorias WHERE torneo_id = :tid`,
    { tid: Number(torneo_id) }
  );
  return rows[0] || null;
};

exports.createEliminatoria = async ({ torneo_id, nombre, ida_vuelta, away_goals, start_date }) => {
  const pool = await getPool();
  const [r] = await pool.execute(
    `
    INSERT INTO eliminatorias (torneo_id, nombre, ida_vuelta, away_goals, start_date)
    VALUES (:tid, :nombre, :iv, :ag, :sd)
    `,
    {
      tid: Number(torneo_id),
      nombre: String(nombre).trim(),
      iv: ida_vuelta ? 1 : 0,
      ag: away_goals ? 1 : 0,
      sd: start_date || null, // 'YYYY-MM-DD' o null
    }
  );
  return Number(r.insertId);
};

exports.insertRounds = async (eliminatoria_id, roundsCfg) => {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of roundsCfg) {
      await conn.execute(
        `
        INSERT INTO elim_rounds (eliminatoria_id, round_key, orden, ida_vuelta, away_goals, partidos)
        VALUES (:eid, :rk, :ord, :iv, :ag, :p)
        `,
        {
          eid: Number(eliminatoria_id),
          rk: String(r.round_key),
          ord: Number(r.orden),
          iv: r.ida_vuelta ? 1 : 0,
          ag: r.away_goals ? 1 : 0,
          p: Number(r.partidos),
        }
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

exports.getRound = async (eliminatoria_id, round_key) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM elim_rounds WHERE eliminatoria_id = :eid AND round_key = :rk`,
    { eid: Number(eliminatoria_id), rk: String(round_key) }
  );
  return rows[0] || null;
};

/* =========================================================
   Bracket generation + PROGRAMACIÓN (fecha/hora/cancha)
   ========================================================= */
exports.generateBracket = async ({ eliminatoria_id, roundsCfg, firstRoundPairs }) => {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // matchId[round_key][match_no][leg] = id
    const matchId = {};

    // 1) Crea rondas y partidos
    for (const r of roundsCfg) {
      matchId[r.round_key] = {};
      for (let m = 1; m <= r.partidos; m++) {
        matchId[r.round_key][m] = {};

        // solo en primera ronda se setean participantes
        let homeId = null, awayId = null;
        if (r.round_key === roundsCfg[0].round_key) {
          const pair = firstRoundPairs[m - 1];
          homeId = pair?.[0] || null;
          awayId = pair?.[1] || null;
        }

        // leg 1
        const [r1] = await conn.execute(
          `
          INSERT INTO elim_matches (eliminatoria_id, round_key, match_no, leg, home_id, away_id, estado)
          VALUES (:eid, :rk, :m, 1, :home, :away, 'programado')
          `,
          {
            eid: Number(eliminatoria_id),
            rk: String(r.round_key),
            m: Number(m),
            home: homeId,
            away: awayId,
          }
        );
        const id1 = Number(r1.insertId);
        matchId[r.round_key][m][1] = id1;

        // leg 2 si aplica
        if (r.ida_vuelta) {
          const [r2] = await conn.execute(
            `
            INSERT INTO elim_matches (eliminatoria_id, round_key, match_no, leg, home_id, away_id, estado, parent_match_id)
            VALUES (:eid, :rk, :m, 2, :home, :away, 'programado', :parent)
            `,
            {
              eid: Number(eliminatoria_id),
              rk: String(r.round_key),
              m: Number(m),
              home: awayId,
              away: homeId,
              parent: id1,
            }
          );
          const id2 = Number(r2.insertId);
          matchId[r.round_key][m][2] = id2;
        }
      }
    }

    // 2) Cableado next_match (todas menos la última ronda)
    for (let i = 0; i < roundsCfg.length - 1; i++) {
      const cur = roundsCfg[i];
      const nxt = roundsCfg[i + 1];
      for (let m = 1; m <= cur.partidos; m++) {
        const nextNo = Math.ceil(m / 2);
        const nextSlot = (m % 2 === 1) ? 'home' : 'away';
        const leg1Id = matchId[cur.round_key][m][1];
        const leg2Id = matchId[cur.round_key][m][2] || null;
        const nextLeg1Id = matchId[nxt.round_key][nextNo][1];

        await conn.execute(
          `UPDATE elim_matches SET next_match_id = :next, next_slot = :slot WHERE id = :id`,
          { next: nextLeg1Id, slot: nextSlot, id: leg1Id }
        );
        if (leg2Id) {
          await conn.execute(
            `UPDATE elim_matches SET next_match_id = :next, next_slot = :slot WHERE id = :id`,
            { next: nextLeg1Id, slot: nextSlot, id: leg2Id }
          );
        }
      }
    }

    // 3) PROGRAMACIÓN (fecha/hora/cancha)
    try {
      const { dia_semana, franjas, canchas } = await getTorneoSchedulingConfigByEliminatoria(eliminatoria_id);
      const validDia = !(dia_semana === null || dia_semana === undefined);
      const validFr  = Array.isArray(franjas) && franjas.length > 0;
      const validCh  = Array.isArray(canchas) && canchas.length > 0;

      if (validDia && validFr && validCh) {
        const lastLigaYMD = await getLigaLastDateByEliminatoria(eliminatoria_id);

        const [[elimRow]] = await conn.execute(
          `SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date FROM eliminatorias WHERE id = :eid`,
          { eid: Number(eliminatoria_id) }
        );
        const elimStartYMD = elimRow?.start_date || null;

        const today = new Date();
        const todayFloor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        let dayAfterLiga = null;
        if (lastLigaYMD) {
          const [yy, mm, dd] = lastLigaYMD.split('-').map(Number);
          const lastDate = new Date(yy, mm - 1, dd);
          dayAfterLiga = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1);
        }

        let elimStart = null;
        if (elimStartYMD) {
          const [ey, em, ed] = elimStartYMD.split('-').map(Number);
          elimStart = new Date(ey, em - 1, ed);
        }

        // baseDate = max(hoy, dayAfterLiga, elimStart)
        let baseDate = todayFloor;
        if (dayAfterLiga && dayAfterLiga > baseDate) baseDate = dayAfterLiga;
        if (elimStart   && elimStart   > baseDate) baseDate = elimStart;

        let weekCursor = 0;

        for (const r of roundsCfg) {
          const leg1Ids = [];
          for (let m = 1; m <= r.partidos; m++) {
            const id1 = matchId[r.round_key][m][1];
            if (id1) leg1Ids.push(id1);
          }

          const consumedWeeksForLeg1 = await scheduleMatchesBatch({
            conn,
            matchIds: leg1Ids,
            baseDate,
            dia_semana,
            franjas,
            canchas,
            initialWeekOffset: weekCursor
          });
          weekCursor += Math.max(consumedWeeksForLeg1, 1);

          if (r.ida_vuelta) {
            const leg2Ids = [];
            for (let m = 1; m <= r.partidos; m++) {
              const id2 = matchId[r.round_key][m][2];
              if (id2) leg2Ids.push(id2);
            }
            const consumedWeeksForLeg2 = await scheduleMatchesBatch({
              conn,
              matchIds: leg2Ids,
              baseDate,
              dia_semana,
              franjas,
              canchas,
              initialWeekOffset: weekCursor
            });
            weekCursor += Math.max(consumedWeeksForLeg2, 1);
          } else {
            weekCursor += 1;
          }
        }
      }
    } catch (schedErr) {
      console.error('[generateBracket][SCHEDULER]', schedErr);
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

/* =========================================================
   Serie / cierre
   ========================================================= */
exports.getSeriesMatches = async (eliminatoria_id, round_key, match_no) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT * FROM elim_matches
    WHERE eliminatoria_id = :eid AND round_key = :rk AND match_no = :m
    ORDER BY leg ASC
    `,
    { eid: Number(eliminatoria_id), rk: String(round_key), m: Number(match_no) }
  );
  return rows;
};

exports.updatePenales = async (match_id, pen_h, pen_a) => {
  const pool = await getPool();
  await pool.execute(
    `
    UPDATE elim_matches
    SET penales_home = :ph,
        penales_away = :pa
    WHERE id = :id
    `,
    { id: Number(match_id), ph: pen_h == null ? null : Number(pen_h), pa: pen_a == null ? null : Number(pen_a) }
  );
};

exports.setSeriesWinner = async (eliminatoria_id, round_key, match_no, winner_id) => {
  const pool = await getPool();
  await pool.execute(
    `
    UPDATE elim_matches
    SET winner_id = :w,
        estado = 'finalizado'
    WHERE eliminatoria_id = :eid AND round_key = :rk AND match_no = :m
    `,
    { eid: Number(eliminatoria_id), rk: String(round_key), m: Number(match_no), w: Number(winner_id) }
  );
};

exports.getMatchById = async (id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT m.*, eh.nombre AS home_name, ea.nombre AS away_name
    FROM elim_matches m
    LEFT JOIN equipos eh ON eh.id = m.home_id
    LEFT JOIN equipos ea ON ea.id = m.away_id
    WHERE m.id = :id
    `,
    { id: Number(id) }
  );
  return rows[0] || null;
};

exports.propagateWinnerToNext = async ({ eliminatoria_id, next_round_key, next_match_no, next_slot, winner_id }) => {
  const pool = await getPool();

  const [legs] = await pool.execute(
    `
    SELECT id, leg
    FROM elim_matches
    WHERE eliminatoria_id = :eid AND round_key = :rk AND match_no = :m
    ORDER BY leg ASC
    `,
    { eid: Number(eliminatoria_id), rk: String(next_round_key), m: Number(next_match_no) }
  );
  if (!legs.length) return;

  const slotColLeg1 = (next_slot === 'home') ? 'home_id' : 'away_id';
  const slotColLeg2 = (next_slot === 'home') ? 'away_id' : 'home_id';

  await pool.execute(
    `UPDATE elim_matches SET ${slotColLeg1} = :w WHERE id = :id1`,
    { id1: Number(legs[0].id), w: Number(winner_id) }
  );

  if (legs[1]) {
    await pool.execute(
      `UPDATE elim_matches SET ${slotColLeg2} = :w WHERE id = :id2`,
      { id2: Number(legs[1].id), w: Number(winner_id) }
    );
  }
};

exports.markTorneoFinalizado = async (torneo_id) => {
  const pool = await getPool();
  await pool.execute(
    `UPDATE torneos SET fase = 'finalizado' WHERE id = :tid`,
    { tid: Number(torneo_id) }
  );
};

/* =========================================================
   Lecturas varias
   ========================================================= */
exports.getRounds = async (eliminatoria_id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM elim_rounds WHERE eliminatoria_id = :eid ORDER BY orden ASC`,
    { eid: Number(eliminatoria_id) }
  );
  return rows;
};

exports.getAllMatchesByElim = async (eliminatoria_id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT m.*, eh.nombre AS home_name, ea.nombre AS away_name
    FROM elim_matches m
    LEFT JOIN equipos eh ON eh.id = m.home_id
    LEFT JOIN equipos ea ON ea.id = m.away_id
    WHERE m.eliminatoria_id = :eid
    ORDER BY m.round_key, m.match_no, m.leg
    `,
    { eid: Number(eliminatoria_id) }
  );
  return rows;
};

exports.getMatchesByRound = async (eliminatoria_id, round_key) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT m.*, eh.nombre AS home_name, ea.nombre AS away_name
    FROM elim_matches m
    LEFT JOIN equipos eh ON eh.id = m.home_id
    LEFT JOIN equipos ea ON ea.id = m.away_id
    WHERE m.eliminatoria_id = :eid AND m.round_key = :rk
    ORDER BY m.match_no, m.leg
    `,
    { eid: Number(eliminatoria_id), rk: String(round_key) }
  );
  return rows;
};

/* =========================================================
   Update de leg / admin / undo
   ========================================================= */
exports.updateMatch = async (args = {}) => {
  const { match_id, id, fecha, hora, cancha, home_goals, away_goals } = args;
  const matchId = (match_id ?? id);
  if (!matchId) throw new Error('match_id (o id) es requerido');

  // Normaliza hora a HH:MM:SS
  let horaTxt = null;
  if (hora != null) {
    const s = String(hora).trim();
    if (s === '')      horaTxt = null;
    else if (/^\d{2}:\d{2}$/.test(s))      horaTxt = `${s}:00`;
    else if (/^\d{2}:\d{2}:\d{2}$/.test(s)) horaTxt = s;
    else               horaTxt = null;
  }

  const pool = await getPool();
  await pool.execute(
    `
    UPDATE elim_matches
    SET fecha       = :fecha,
        hora        = :hora,
        cancha      = :cancha,
        home_goals  = :hg,
        away_goals  = :ag
    WHERE id = :id
    `,
    {
      id: Number(matchId),
      fecha: fecha ? String(fecha).slice(0,10) : null,
      hora: horaTxt,
      cancha: cancha ? String(cancha) : null,
      hg: (home_goals === undefined || home_goals === null || home_goals === '') ? null : Number(home_goals),
      ag: (away_goals === undefined || away_goals === null || away_goals === '') ? null : Number(away_goals),
    }
  );
};

exports.getSeriesWinner = async (eliminatoria_id, round_key, match_no) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT winner_id
    FROM elim_matches
    WHERE eliminatoria_id = :eid AND round_key = :rk AND match_no = :m AND winner_id IS NOT NULL
    ORDER BY id
    LIMIT 1
    `,
    { eid: Number(eliminatoria_id), rk: String(round_key), m: Number(match_no) }
  );
  return rows[0]?.winner_id || null;
};

exports.clearWinnerFromNext = async ({ eliminatoria_id, next_match_id, next_slot }) => {
  const pool = await getPool();
  const next = await exports.getMatchById(next_match_id);
  if (!next) return;

  const [legs] = await pool.execute(
    `
    SELECT id, leg
    FROM elim_matches
    WHERE eliminatoria_id = :eid AND round_key = :rk AND match_no = :m
    ORDER BY leg ASC
    `,
    { eid: Number(eliminatoria_id), rk: String(next.round_key), m: Number(next.match_no) }
  );
  if (!legs.length) return;

  const slotColLeg1 = (next_slot === 'home') ? 'home_id' : 'away_id';
  const slotColLeg2 = (next_slot === 'home') ? 'away_id' : 'home_id';

  await pool.execute(
    `UPDATE elim_matches SET ${slotColLeg1} = NULL WHERE id = :id1`,
    { id1: Number(legs[0].id) }
  );
  if (legs[1]) {
    await pool.execute(
      `UPDATE elim_matches SET ${slotColLeg2} = NULL WHERE id = :id2`,
      { id2: Number(legs[1].id) }
    );
  }
};

exports.clearSeriesWinner = async (eliminatoria_id, round_key, match_no) => {
  const pool = await getPool();
  await pool.execute(
    `
    UPDATE elim_matches
    SET winner_id = NULL, estado = 'programado'
    WHERE eliminatoria_id = :eid AND round_key = :rk AND match_no = :m
    `,
    { eid: Number(eliminatoria_id), rk: String(round_key), m: Number(match_no) }
  );
};

exports.deleteEliminatoria = async (eliminatoria_id) => {
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM eliminatorias WHERE id = :id`,
    { id: Number(eliminatoria_id) }
  );
};

// Asigna un equipo a un slot (home/away) de la serie (leg1) y sincroniza leg2 si existe.
exports.assignTeamToLegSlot = async ({ match_id, slot, team_id }) => {
  if (!match_id || !team_id || !['home','away'].includes(slot)) {
    throw new Error('Parámetros inválidos (match_id, slot, team_id)');
  }

  const pool = await getPool();
  const base = await exports.getMatchById(match_id);
  if (!base) throw new Error('Match no encontrado');

  const [ms] = await pool.execute(
    `
    SELECT * FROM elim_matches
    WHERE eliminatoria_id = :eid AND round_key = :rk AND match_no = :m
    ORDER BY leg ASC
    `,
    { eid: Number(base.eliminatoria_id), rk: String(base.round_key), m: Number(base.match_no) }
  );
  if (!ms.length) throw new Error('Serie no encontrada');

  const leg1 = ms.find(x => x.leg === 1) || ms[0];
  const leg2 = ms.find(x => x.leg === 2) || null;

  if (leg1.winner_id) throw new Error('La serie ya está finalizada');
  if ((leg1.home_goals != null) || (leg1.away_goals != null)) throw new Error('Ya hay goles cargados en leg 1');
  if (leg2 && ((leg2.home_goals != null) || (leg2.away_goals != null))) throw new Error('Ya hay goles cargados en leg 2');

  const leg1SlotCol = (slot === 'home') ? 'home_id' : 'away_id';
  if (leg1[leg1SlotCol] != null) throw new Error('El slot ya tiene equipo asignado');

  await pool.execute(
    `UPDATE elim_matches SET ${leg1SlotCol} = :tid WHERE id = :id1`,
    { tid: Number(team_id), id1: Number(leg1.id) }
  );

  if (leg2) {
    const leg2SlotCol = (slot === 'home') ? 'away_id' : 'home_id';
    await pool.execute(
      `UPDATE elim_matches SET ${leg2SlotCol} = :tid WHERE id = :id2`,
      { tid: Number(team_id), id2: Number(leg2.id) }
    );
  }

  return { ok: true };
};

/* === EVENTOS (eliminatoria) === */
exports.getElimEventsByMatch = async (match_id) => {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `
    SELECT id, match_id, jugador_id, tipo, minuto
    FROM elim_partido_detalle
    WHERE match_id = :mid
    ORDER BY id ASC
    `,
    { mid: Number(match_id) }
  );
  return rows;
};

exports.deleteElimEventsByMatch = async (match_id) => {
  const pool = await getPool();
  await pool.execute(
    `DELETE FROM elim_partido_detalle WHERE match_id = :mid`,
    { mid: Number(match_id) }
  );
  return { ok: true };
};

exports.insertElimEvent = async ({ match_id, jugador_id, tipo, minuto }) => {
  const pool = await getPool();
  const [r] = await pool.execute(
    `
    INSERT INTO elim_partido_detalle (match_id, jugador_id, tipo, minuto)
    VALUES (:mid, :jid, :t, :min)
    `,
    {
      mid: Number(match_id),
      jid: Number(jugador_id),
      t: String(tipo).trim(), // ENUM('gol','amarilla','roja')
      min: (minuto == null || minuto === '') ? null : Number(minuto),
    }
  );
  return Number(r.insertId);
};
