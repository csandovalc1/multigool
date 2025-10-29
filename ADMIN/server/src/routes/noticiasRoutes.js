// routes/noticiasRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const controller = require('../controllers/noticiasController');
const { sanitizeBase } = require('../utils/urls');

const DIR = path.join(__dirname, '..', 'uploads', 'news');
fs.mkdirSync(DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname || '').toLowerCase();
    const base = sanitizeBase(path.basename(file.originalname || 'img', ext));
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});;

const upload = multer({
  storage,
  limits: { files: 3, fileSize: 10 * 1024 * 1024 },
});

// LIST
router.get('/', controller.list);

// PUBLIC (slug)
router.get('/public/:slug', controller.getPublicBySlug);

// ANNOUNCEMENTS activos
router.get('/announcements/active', controller.listActiveAnnouncements);

// DETAIL by id
router.get('/:id', controller.getOne);

// CREATE / UPDATE
router.post('/', upload.array('imagenes', 3), controller.create);
router.put('/:id', upload.array('imagenes', 3), controller.update);

// PUBLISH / UNPUBLISH
router.post('/:id/publish', controller.publish);
router.post('/:id/unpublish', controller.unpublish);

// DELETE
router.delete('/:id', controller.remove);

module.exports = router;
