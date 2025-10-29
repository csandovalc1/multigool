const express = require('express');
const router = express.Router();
const controller = require('../controllers/partidoController');
router.post('/actualizar-goles', controller.actualizarGoles);
router.post('/finalizar', controller.finalizarPartido);
router.get('/rango', controller.listarPorRango);
router.post('/editar-datos', controller.editarDatos);
module.exports = router;