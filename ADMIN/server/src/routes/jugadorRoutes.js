const express = require('express');
const router = express.Router();
const jugadorController = require('../controllers/jugadorController');
router.get('/:equipo_id', jugadorController.getJugadoresPorEquipo);
router.post('/', jugadorController.agregarJugador);
router.delete('/:id', jugadorController.eliminarJugador);
module.exports = router;