const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/jugadoresController');

// listar / crear por equipo
router.get('/equipos/:equipoId/jugadores', ctrl.listByEquipo);
router.post('/equipos/:equipoId/jugadores', ctrl.createForEquipo);

// editar / eliminar por id del jugador
router.patch('/jugadores/:id', ctrl.updateById);
router.delete('/jugadores/:id', ctrl.deleteById);

module.exports = router;
