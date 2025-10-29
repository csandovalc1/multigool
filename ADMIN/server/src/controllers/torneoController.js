const torneoModel = require('../models/torneoModel');
const { generarCalendario } = require('../services/fixtureGenerator');

exports.crearTorneo = async (req, res) => {
  try {
    const body = req.body || {};
    const dia = body.dia_semana;
    const start = body.start_date ? new Date(body.start_date + 'T00:00:00') : null;

    // validar costo
    const costo = Number(body.costo_inscripcion_q ?? 0);
    if (Number.isNaN(costo) || costo < 0) {
      return res.status(400).json({ error: 'costo_inscripcion_q inválido' });
    }

    if (start && (dia !== '' && dia !== null && dia !== undefined)) {
      const wd = start.getDay();
      if (wd !== Number(dia)) {
        return res.status(400).json({ error: 'start_date no coincide con el día seleccionado' });
      }
    }

    const r = await torneoModel.crearTorneo({
      ...body,
      costo_inscripcion_q: costo, // 👈 pasa al modelo
    });
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};



exports.obtenerTorneos = async (_req, res) => {
  try {
    res.json(await torneoModel.obtenerTorneos());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.iniciarTorneo = async (req, res) => {
  try {
    const torneo_id = parseInt(req.params.id);

    // 1) Torneo existente
    const [torneo] = await torneoModel.obtenerConfiguracionTorneo(torneo_id);
    if (!torneo) return res.status(404).json({ error: 'Torneo no existe' });

    // 2) Solo liguilla genera jornadas
    if (torneo.tipo_torneo !== 'liguilla') {
      return res.status(400).json({ error: 'Este torneo es de eliminación: no genera jornadas de liguilla' });
    }

    // 3) Fase válida
    if (torneo.fase && torneo.fase !== 'liga') {
      return res.status(400).json({ error: `No puedes iniciar de nuevo. Fase actual: ${torneo.fase}` });
    }

    // 4) Equipos suficientes
    const equipos = await torneoModel.obtenerEquiposPorTorneo(torneo_id);
    if (!equipos || equipos.length < 2) {
      return res.status(400).json({ error: 'Se necesitan al menos 2 equipos' });
    }

    // 5) Ya había jornadas?
    const yaHayJornadas = await torneoModel.contarJornadas(torneo_id);
    if (yaHayJornadas > 0) {
      return res.status(400).json({ error: 'Este torneo ya tiene jornadas generadas' });
    }

    // 6) Validar configuración de agenda (día, franjas, canchas)
    //    OJO: dia_semana puede ser 0 (domingo) → checar null/undefined, no falsy.
    const cfg = await torneoModel.getTorneoSchedulingConfig(torneo_id);
    const diaNoSet = (cfg.dia_semana === null || cfg.dia_semana === undefined);
    if (diaNoSet) {
      return res.status(400).json({ error: 'Configura el día de la semana del torneo.' });
    }
    if (!Array.isArray(cfg.franjas) || cfg.franjas.length === 0) {
      return res.status(400).json({ error: 'Configura al menos una franja horaria.' });
    }
    if (!Array.isArray(cfg.canchas) || cfg.canchas.length === 0) {
      return res.status(400).json({ error: 'Configura al menos una cancha.' });
    }

    // NUEVO: exigir start_date
if (!cfg.start_date) {
  return res.status(400).json({ error: 'Configura la fecha de inicio (start_date) del torneo.' });
}

    // 7) Generar calendario de enfrentamientos y crear fixture + agenda
    const calendario = generarCalendario(equipos, !!torneo.ida_vuelta);
    await torneoModel.crearFixture(torneo_id, calendario);

    // 8) Marcar fase liga
    await torneoModel.setFase(torneo_id, 'liga');

    res.json({ mensaje: 'Fixture generado exitosamente' });
  } catch (e) {
    // Si algo sale mal más abajo, lo exponemos como 500
    res.status(500).json({ error: e.message });
  }
};

exports.eliminarTorneo = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await torneoModel.eliminarTorneo(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.slotsDiaSemana = async (req, res) => {
  try {
    const {
      dia_semana,          // 0..6
      tipo_futbol,         // '5' | '7' (solo para fallback cuando no envían canchas)
      apertura = '07:00',
      cierre   = '22:00',
      bloque_min = 60,
      canchas = []
    } = req.body || {};

    if (dia_semana === '' || dia_semana === null || dia_semana === undefined) {
      return res.json({ slots: [] });
    }

    const step = Math.max(15, Number(bloque_min || 60));

    // 1) canchas base seleccionadas (o fallback a todas activas del tipo solicitado)
    const canchaIds = Array.isArray(canchas) && canchas.length
      ? canchas.map(Number).filter(Boolean)
      : (await torneoModel.listCanchaIdsByTipo(tipo_futbol));

    if (!canchaIds.length) return res.json({ slots: [] });

    // 2) generar chips [apertura, cierre) con step
    const pad = (n)=>String(n).padStart(2,'0');
    const toMin = (hhmm) => {
      const [h,m] = String(hhmm).slice(0,5).split(':').map(Number);
      return h*60 + m;
    };
    const fromMin = (min) => `${pad(Math.floor(min/60))}:${pad(min%60)}`;

    const o = toMin(apertura), c = toMin(cierre);
    const todos = [];
    for (let cur=o; cur+step<=c; cur+=step) {
      todos.push({ inicio: fromMin(cur), fin: fromMin(cur+step) }); // 'HH:MM'
    }

    // 3) MISMA REGLA QUE RESERVAS:
    //    Para cada cancha base, preguntamos si hay solape con algo en su grupo (PEERS).
    //    Y el slot solo es válido si está libre en TODAS las canchas seleccionadas.
    const disponibles = [];
    for (const s of todos) {
      const hi = s.inicio; // 'HH:MM'
      const hf = s.fin;    // 'HH:MM'

      // chequea TODAS las canchas seleccionadas
      let libreEnTodas = true;
      for (const cid of canchaIds) {
        const haySolape = await torneoModel.hasTorneoOverlapForBase({
          cancha_id: cid,
          weekday: Number(dia_semana),
          desde: hi,
          hasta: hf,
        });
        if (haySolape) { libreEnTodas = false; break; }
      }

      if (libreEnTodas) disponibles.push(s);
    }

    res.json({ slots: disponibles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
