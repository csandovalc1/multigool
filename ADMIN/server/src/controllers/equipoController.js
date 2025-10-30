// controllers/equipoController.js
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const equipoModel = require('../models/equipoModel');

const DEFAULT_LOGO = null;       
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'team-logos');

async function processAndSavePNG(buffer, outPath) {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w < 128 || h < 128) {
    const err = new Error('La imagen es demasiado pequeña. Mínimo 128×128 px.');
    err.status = 400;
    throw err;
  }
  await sharp(buffer)
    .resize(512, 512, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 8 })
    .toFile(outPath);
}

exports.agregarEquipo = async (req, res) => {
  try {
    const { nombre, torneo_id, fecha_registro } = req.body;
    if (!nombre || !torneo_id) {
      return res.status(400).json({ error: 'Nombre y torneo_id requeridos' });
    }

    // Validación suave de fecha si viene (ISO)
    let fechaReg = null;
    if (fecha_registro) {
      const d = new Date(fecha_registro);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'fecha_registro inválida (usa ISO 8601: YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss)' });
      }
      fechaReg = d.toISOString(); // lo convertimos para el modelo
    }

    // 1) Creamos con logo por defecto (o archivo si vino)
    let logoPath = DEFAULT_LOGO;

const r = await equipoModel.agregarEquipo(nombre, parseInt(torneo_id), logoPath, fechaReg);
  const id = r.insertId;

    if (req.file) {
      const filename = `team-${id}.png`;
      const absPath = path.join(UPLOAD_DIR, filename);
      await processAndSavePNG(req.file.buffer, absPath);
      logoPath = `/uploads/team-logos/${filename}`;
      await equipoModel.updateLogo(id, logoPath);
    }

    res.status(201).json({
      id,
      nombre,
      torneo_id: Number(torneo_id),
      logo_path: logoPath,
      // devolvemos la fecha que se usaría: si no vino, será la del DEFAULT en DB (no la conocemos aquí)
      // el cliente puede re-consultar el equipo si necesita verla exacta
      fecha_registro: fechaReg || null
    });
  } catch (e) {
    const code = e.status || 500;
    res.status(code).json({ error: e.message });
  }
};

exports.actualizarLogo = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.body?.useDefault === 'true' || req.body?.useDefault === true) {
      await equipoModel.updateLogo(id, DEFAULT_LOGO);
      return res.json({ id, logo_path: DEFAULT_LOGO });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Falta archivo PNG (campo "logo")' });
    }

    const filename = `team-${id}.png`;
    const absPath = path.join(UPLOAD_DIR, filename);
    await processAndSavePNG(req.file.buffer, absPath);
    const logoPath = `/uploads/team-logos/${filename}`;
    await equipoModel.updateLogo(id, logoPath);
    res.json({ id, logo_path: logoPath });
  } catch (e) {
    const code = e.status || 500;
    res.status(code).json({ error: e.message });
  }
};

exports.obtenerPorTorneo = async (req, res) => {
  try {
    const out = await equipoModel.obtenerEquiposPorTorneo(parseInt(req.params.torneo_id));
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.eliminarEquipo = async (req, res) => {
  try {
    await equipoModel.eliminarEquipo(parseInt(req.params.id));
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
