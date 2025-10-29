// routes/equipoRoutes.js
const express = require('express');
const multer = require('multer');
const equipoController = require('../controllers/equipoController');

const router = express.Router();

// Multer en memoria, valida sólo PNG y 1.5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1.5 * 1024 * 1024 }, // 1.5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'image/png') return cb(new Error('Formato no permitido. Solo PNG.'));
    cb(null, true);
  },
});

// Crear equipo (logo opcional)
router.post('/', upload.single('logo'), equipoController.agregarEquipo);

// Actualizar/añadir logo luego (o volver a default con useDefault=true)
router.patch('/:id/logo', upload.single('logo'), equipoController.actualizarLogo);

// Listar por torneo
router.get('/:torneo_id', equipoController.obtenerPorTorneo);

// Eliminar
router.delete('/:id', equipoController.eliminarEquipo);

module.exports = router;
