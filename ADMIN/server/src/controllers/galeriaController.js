// controllers/galeriaController.js
const path = require('path');
const fs = require('fs');
const model = require('../models/galeriaModel');
const { relFromMulter, absUrl } = require('../utils/urls');


function toGTString(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  const gt = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${gt.getFullYear()}-${pad(gt.getMonth()+1)}-${pad(gt.getDate())} ${pad(gt.getHours())}:${pad(gt.getMinutes())}:${pad(gt.getSeconds())}`;
}

exports.list = async (req, res) => {
  try {
    const rows = await model.list();
    const mapped = rows.map(r => ({
      ...r,
      url: (req.query.abs === '1') ? absUrl(req, r.url) : r.url,
      publish_at: toGTString(r.publish_at),
      created_at: toGTString(r.created_at)
    }));
    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// Subida múltiple: files + descriptions[] (alineadas por índice)

exports.create = async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: 'Sin archivos' });

    let descriptions = [];
    const raw = req.body.descriptions;
    if (Array.isArray(raw)) descriptions = raw;
    else if (typeof raw === 'string') descriptions = [raw];

    const items = files.map((f, i) => ({
      url: relFromMulter(f, 'gallery'),
      descripcion: descriptions[i] || null
    }));

    await model.bulkInsert(items);
    res.json({ ok: true, count: items.length });
  } catch (e) {
     console.error('[GALERIA/create]', e);
    res.status(500).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    const { descripcion } = req.body;
    await model.update(id, { descripcion });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.publish = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    await model.publish(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.unpublish = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });
    await model.unpublish(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const row = await model.getById(id);
    if (row?.url) {
      const abs = path.join(__dirname, '..', row.url.replace(/^\//, ''));
      fs.promises.unlink(abs).catch(() => {});
    }
    await model.remove(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
