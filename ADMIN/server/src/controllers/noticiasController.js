// controllers/noticiasController.js
const path = require('path');
const fs   = require('fs'); 
const model = require('../models/noticiasModel');
const { relFromMulter, absUrl } = require('../utils/urls');

function toGTString(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  const gt = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${gt.getFullYear()}-${pad(gt.getMonth() + 1)}-${pad(gt.getDate())} ${pad(gt.getHours())}:${pad(gt.getMinutes())}:${pad(gt.getSeconds())}`;
}

function parseImgs(row) {
  try { return JSON.parse(row.imagenes_json || '[]'); } catch { return []; }
}

function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '').slice(0, 200);
}

// helpers de normalización
const toBool = (v) => {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};
const toDateOrNull = (s) => {
  if (!s) return null;
  const t = String(s).trim();
  // Esperamos 'YYYY-MM-DD'
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
};

exports.list = async (req, res) => {
  try {
    const data = await model.list();
    const mapped = (data || []).map(n => ({
      ...n,
      portada_url: (req.query.abs === '1') ? absUrl(req, n.portada_url) : n.portada_url,
      publish_at: toGTString(n.publish_at)
    }));
    res.json(mapped);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// detalle por id
exports.getOne = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    const row = await model.getById(id);
    if (!row) return res.status(404).json({ error: 'no existe' });

    let imagenes = parseImgs(row);
    if (req.query.abs === '1') imagenes = imagenes.map(u => absUrl(req, u));

    res.json({
      id: row.id,
      titulo: row.titulo,
      slug: row.slug,
      resumen: row.resumen,
      portada_url: (req.query.abs === '1') ? absUrl(req, row.portada_url) : row.portada_url,
      imagenes,
      estado: row.estado,
      publish_at: toGTString(row.publish_at),
      cuerpo_md: row.cuerpo_md,
      cuerpo_html: row.cuerpo_html || null,
      is_important: !!row.is_important,
      banner_start: row.banner_start ? String(row.banner_start).slice(0,10) : null,
      banner_end:   row.banner_end   ? String(row.banner_end).slice(0,10)   : null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// detalle público por slug (solo publicadas)
exports.getPublicBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) return res.status(400).json({ error: 'slug inválido' });
    const row = await model.getBySlug(slug);
    if (!row || String(row.estado).toLowerCase() !== 'publicada') return res.status(404).json({ error: 'no existe' });

    let imagenes = parseImgs(row);
    if (req.query.abs === '1') imagenes = imagenes.map(u => absUrl(req, u));

    res.json({
      id: row.id,
      titulo: row.titulo,
      slug: row.slug,
      resumen: row.resumen,
      portada_url: (req.query.abs === '1') ? absUrl(req, row.portada_url) : row.portada_url,
      imagenes,
      estado: row.estado,
      publish_at: toGTString(row.publish_at),
      cuerpo_md: row.cuerpo_md,
      cuerpo_html: row.cuerpo_html || null,
      is_important: !!row.is_important,
      banner_start: row.banner_start ? String(row.banner_start).slice(0,10) : null,
      banner_end:   row.banner_end   ? String(row.banner_end).slice(0,10)   : null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const { titulo, resumen, cuerpo_md, is_important, banner_start, banner_end } = req.body;
    if (!titulo || !cuerpo_md) return res.status(400).json({ error: 'titulo y cuerpo_md son requeridos' });

    const slug = slugify(titulo);
    const imgs = (req.files || []).slice(0, 3).map(f => relFromMulter(f, 'news'));
    const portada = imgs[0] || null;

    const r = await model.create({
      titulo, slug, resumen, cuerpo_md,
portada_url: portada, imagenes: imgs,
      is_important: toBool(is_important),
      banner_start: toDateOrNull(banner_start),
      banner_end:   toDateOrNull(banner_end),
    });
    res.json({ id: r.id });
  } catch (e) {
    if (e && (e.code === 'E_DUP_SLUG' || e.code === 'ER_DUP_ENTRY')) {
      return res.status(409).json({ error: 'slug ya existe' });
    }
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const prev = await model.getById(id);
    if (!prev) return res.status(404).json({ error: 'no existe' });

    const { titulo, resumen, cuerpo_md, keep_images, is_important, banner_start, banner_end } = req.body;
    if (!titulo || !cuerpo_md) return res.status(400).json({ error: 'titulo y cuerpo_md son requeridos' });

    let imgs = [];
    if (keep_images === 'true') {
      try { imgs = JSON.parse(prev.imagenes_json || '[]'); } catch { imgs = []; }
    }
    const newUploads = (req.files || []).slice(0, Math.max(0, 3 - imgs.length))
      .map(f => relFromMulter(f, 'news'));
    imgs = [...imgs, ...newUploads].slice(0, 3);
    const portada = imgs[0] || null;

    await model.update(id, {
      titulo, resumen, cuerpo_md,
      portada_url: portada, imagenes: imgs,
      is_important: toBool(is_important),
      banner_start: toDateOrNull(banner_start),
      banner_end:   toDateOrNull(banner_end),
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.publish = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    await model.publish(id); // guarda publish_at en UTC
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.unpublish = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    await model.unpublish(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const row = await model.getById(id);
    if (row) {
      // borra portada
      if (row.portada_url) {
        const abs = path.join(__dirname, '..', row.portada_url.replace(/^\//, ''));
        fs.promises.unlink(abs).catch(() => {});
      }
      // borra todas las imágenes del JSON
      let imgs = [];
      try { imgs = JSON.parse(row.imagenes_json || '[]'); } catch {}
      for (const u of imgs) {
        const abs = path.join(__dirname, '..', String(u).replace(/^\//, ''));
        fs.promises.unlink(abs).catch(() => {});
      }
    }
    await model.remove(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// anuncios activos (hoy GT ∈ [start,end])
exports.listActiveAnnouncements = async (_req, res) => {
  try {
    const rows = await model.listActiveAnnouncements();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
};
