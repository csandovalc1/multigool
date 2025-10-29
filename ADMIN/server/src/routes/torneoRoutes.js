const express = require('express');
const router = express.Router();
const torneoController = require('../controllers/torneoController');
router.post('/', torneoController.crearTorneo);
router.get('/', torneoController.obtenerTorneos);
router.post('/:id/iniciar', torneoController.iniciarTorneo);
router.delete('/:id', torneoController.eliminarTorneo);
router.post('/slots', torneoController.slotsDiaSemana);
module.exports = router;