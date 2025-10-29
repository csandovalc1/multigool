// routes/reservaRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reservaController');

// /api/reservas ...
router.get('/', ctrl.listByDate);
router.get('/slots', ctrl.getSlots);
router.get('/semana', ctrl.listSemana);        // ⬅️ NUEVO

router.post('/', ctrl.create);

router.patch('/:id/cancel', ctrl.cancel);
router.patch('/:id', ctrl.update);
router.patch('/:id/estado', ctrl.setEstado);

router.post('/autocompletar', ctrl.autoComplete);

module.exports = router;
