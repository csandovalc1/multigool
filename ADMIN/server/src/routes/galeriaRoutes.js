// routes/galeriaRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const controller = require('../controllers/galeriaController');
const { sanitizeBase } = require('../utils/urls');

const DIR = path.join(__dirname, '..', 'uploads', 'gallery');
fs.mkdirSync(DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname || '').toLowerCase();
    const base = sanitizeBase(path.basename(file.originalname || 'img', ext));
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { files: 20, fileSize: 6 * 1024 * 1024 },
});


// LIST
router.get('/', controller.list);

// CREATE (múltiple): fotos[] + descriptions[]
router.post('/', upload.array('fotos', 20), controller.create);

// UPDATE descripción
router.put('/:id', controller.update);

// PUBLISH / UNPUBLISH
router.post('/:id/publish', controller.publish);
router.post('/:id/unpublish', controller.unpublish);

// DELETE
router.delete('/:id', controller.remove);

router.post(
  '/',
  (req, res, next) => {
    upload.array('fotos', 20)(req, res, (err) => {
      if (err) {
        // Errores típicos: 'File too large', 'Too many files', 'Unexpected field'
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  controller.create
);


module.exports = router;
