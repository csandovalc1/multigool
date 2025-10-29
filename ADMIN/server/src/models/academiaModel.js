// models/academiaModel.js  (MySQL)
const { getPool } = require('../config/db');

// helpers
const diasToMask = (arr = []) => {
  let m = 0;
  for (const d of arr) {
    const v = Number(d);
    if (v >= 1 && v <= 7) m |= (1 << (v - 1));
  }
  return m;
};
const maskToDias = (mask = 0) => {
  const out = [];
  for (let i = 1; i <= 7; i++) if (mask & (1 << (i - 1))) out.push(i);
  return out;
};
const diasToTexto = (arr = []) => {
  const map = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };
  return [...arr].sort((a, b) => a - b).map(v => map[v] || v).join(' · ');
};

// ====== PÚBLICO ======
exports.listCategoriasPublic = async () => {
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT
      c.id, c.nombre, c.edad_min, c.edad_max, c.cupo, c.mensualidad_q,
      c.dias_mask,
      DATE_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio_hhmm,
      DATE_FORMAT(c.hora_fin,    '%H:%i') AS hora_fin_hhmm,
      c.cancha_id, k.nombre AS cancha_nombre
    FROM ac_categorias c
    LEFT JOIN canchas k ON k.id = c.cancha_id
    ORDER BY c.id DESC
  `);

  return rows.map(row => {
    const diasArr = maskToDias(row.dias_mask || 0);
    const rec = {
      dias: diasArr,
      dias_texto: diasToTexto(diasArr),
      hora_inicio: row.hora_inicio_hhmm || null,
      hora_fin: row.hora_fin_hhmm || null,
      cancha_id: row.cancha_id ?? null,
      cancha_nombre: row.cancha_nombre ?? null
    };
    return {
      id: row.id,
      nombre: row.nombre,
      edad_min: row.edad_min,
      edad_max: row.edad_max,
      cupo: row.cupo,
      mensualidad_q: Number(row.mensualidad_q),
      portada_url: null,
      recurrencias: diasArr.length ? [rec] : []
    };
  });
};

// ====== ADMIN ======
exports.listCategorias = async () => {
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT
      c.id, c.nombre, c.edad_min, c.edad_max, c.cupo, c.mensualidad_q,
      c.dias_mask,
      DATE_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio_hhmm,
      DATE_FORMAT(c.hora_fin,    '%H:%i') AS hora_fin_hhmm,
      c.cancha_id, k.nombre AS cancha_nombre
    FROM ac_categorias c
    LEFT JOIN canchas k ON k.id = c.cancha_id
    ORDER BY c.id DESC
  `);

  return rows.map(row => ({
    id: row.id,
    nombre: row.nombre,
    edad_min: row.edad_min,
    edad_max: row.edad_max,
    cupo: row.cupo,
    mensualidad_q: Number(row.mensualidad_q),
    dias: maskToDias(row.dias_mask || 0),
    hora_inicio: row.hora_inicio_hhmm || null,
    hora_fin: row.hora_fin_hhmm || null,
    cancha_id: row.cancha_id ?? null,
    cancha_nombre: row.cancha_nombre ?? null,
  }));
};

exports.createCategoria = async (payload) => {
  const pool = await getPool();
  const { nombre, edad_min, edad_max, cupo, mensualidad_q, dias, hora_inicio, hora_fin, cancha_id } = payload;

  const mask = diasToMask(Array.isArray(dias) ? dias : []);
  const hi = hora_inicio ? `${hora_inicio}:00`.slice(0, 8) : null; // 'HH:MM:SS'
  const hf = hora_fin ? `${hora_fin}:00`.slice(0, 8) : null;

  const [r] = await pool.execute(
    `
    INSERT INTO ac_categorias
      (nombre, edad_min, edad_max, cupo, mensualidad_q, dias_mask, hora_inicio, hora_fin, cancha_id)
    VALUES
      (:n, :emin, :emax, :cupo, :mens, :mask, :hi, :hf, :can)
    `,
    {
      n: String(nombre).trim(),
      emin: Number(edad_min),
      emax: Number(edad_max),
      cupo: cupo == null || cupo === '' ? null : Number(cupo),
      mens: Number(mensualidad_q || 0),
      mask,
      hi,
      hf,
      can: cancha_id == null || cancha_id === '' ? null : Number(cancha_id),
    }
  );

  return { id: Number(r.insertId) };
};

exports.updateCategoria = async (id, payload) => {
  const pool = await getPool();
  const { nombre, edad_min, edad_max, cupo, mensualidad_q, dias, hora_inicio, hora_fin, cancha_id } = payload;

  const mask = diasToMask(Array.isArray(dias) ? dias : []);
  const hi = hora_inicio ? `${hora_inicio}:00`.slice(0, 8) : null;
  const hf = hora_fin ? `${hora_fin}:00`.slice(0, 8) : null;

  await pool.execute(
    `
    UPDATE ac_categorias
    SET nombre = :n,
        edad_min = :emin,
        edad_max = :emax,
        cupo = :cupo,
        mensualidad_q = :mens,
        dias_mask = :mask,
        hora_inicio = :hi,
        hora_fin = :hf,
        cancha_id = :can
    WHERE id = :id
    `,
    {
      id: Number(id),
      n: String(nombre).trim(),
      emin: Number(edad_min),
      emax: Number(edad_max),
      cupo: cupo == null || cupo === '' ? null : Number(cupo),
      mens: Number(mensualidad_q || 0),
      mask,
      hi,
      hf,
      can: cancha_id == null || cancha_id === '' ? null : Number(cancha_id),
    }
  );

  return { ok: true };
};

exports.deleteCategoria = async (id) => {
  const pool = await getPool();
  await pool.execute(`DELETE FROM ac_categorias WHERE id = :id`, { id: Number(id) });
  return { ok: true };
};

// ===== Alumnos =====
exports.listAlumnos = async () => {
  const pool = await getPool();
  const [rows] = await pool.execute(`
    SELECT
      a.id, a.nombres, a.apellidos,
      DATE_FORMAT(a.fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
      a.telefono,
      a.categoria_id, c.nombre AS categoria_nombre
    FROM ac_alumnos a
    LEFT JOIN ac_categorias c ON c.id = a.categoria_id
    ORDER BY a.id DESC
  `);

  return rows.map(x => ({
    id: x.id,
    nombres: x.nombres,
    apellidos: x.apellidos,
    fecha_nacimiento: x.fecha_nacimiento || null,
    telefono: x.telefono,
    categoria_id: x.categoria_id,
    categoria_nombre: x.categoria_nombre || null
  }));
};

exports.createAlumno = async ({ nombres, apellidos = null, fecha_nacimiento = null, telefono = null, categoria_id = null }) => {
  const pool = await getPool();

  // Normalizamos fecha a 'YYYY-MM-DD' (o null)
  const fnStr = fecha_nacimiento ? String(fecha_nacimiento).slice(0, 10) : null;

  // Autoclasificar categoría si no viene
  if (!categoria_id && fnStr) {
    const cats = await exports.listCategorias();
    const [y, m, d] = fnStr.split('-').map(Number);
    const hoy = new Date();
    let edad = hoy.getFullYear() - y;
    const before = (hoy.getMonth() + 1 < m) || ((hoy.getMonth() + 1 === m) && (hoy.getDate() < d));
    if (before) edad--;
    const found = cats.find(c => edad >= c.edad_min && edad <= c.edad_max);
    categoria_id = found?.id ?? null;
  }

  const [r] = await pool.execute(
    `
    INSERT INTO ac_alumnos
      (nombres, apellidos, fecha_nacimiento, telefono, categoria_id)
    VALUES
      (:n, :a, :fn, :t, :c)
    `,
    {
      n: String(nombres).trim(),
      a: apellidos ? String(apellidos).trim() : null,
      fn: fnStr,                     // MySQL DATE acepta 'YYYY-MM-DD'
      t: telefono || null,
      c: categoria_id ?? null
    }
  );

  return { id: Number(r.insertId) };
};

exports.updateAlumno = async (id, { nombres, apellidos = null, fecha_nacimiento = null, telefono = null, categoria_id = null }) => {
  const pool = await getPool();

  const fnStr = fecha_nacimiento ? String(fecha_nacimiento).slice(0, 10) : null;

  // Recalcular categoría si no viene y hay fecha
  if (!categoria_id && fnStr) {
    const cats = await exports.listCategorias();
    const [y, m, d] = fnStr.split('-').map(Number);
    const hoy = new Date();
    let edad = hoy.getFullYear() - y;
    const before = (hoy.getMonth() + 1 < m) || ((hoy.getMonth() + 1 === m) && (hoy.getDate() < d));
    if (before) edad--;
    const found = cats.find(c => edad >= c.edad_min && edad <= c.edad_max);
    categoria_id = found?.id ?? null;
  }

  await pool.execute(
    `
    UPDATE ac_alumnos
    SET nombres = :n,
        apellidos = :a,
        fecha_nacimiento = :fn,
        telefono = :t,
        categoria_id = :c
    WHERE id = :id
    `,
    {
      id: Number(id),
      n: String(nombres).trim(),
      a: apellidos ? String(apellidos).trim() : null,
      fn: fnStr,
      t: telefono || null,
      c: categoria_id ?? null
    }
  );

  return { ok: true };
};

exports.deleteAlumno = async (id) => {
  const pool = await getPool();
  await pool.execute(`DELETE FROM ac_alumnos WHERE id = :id`, { id: Number(id) });
  return { ok: true };
};
