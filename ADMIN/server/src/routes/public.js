const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicController');

// Torneos visibles al público
router.get('/torneos', ctrl.listTorneosActivos);
router.get('/torneos/:id/summary', ctrl.getTorneoSummary);
router.get('/torneos/:id/tabla', ctrl.getTabla);
router.get('/torneos/:id/fixture', ctrl.getFixture);
router.get('/torneos/:id/goleadores', ctrl.getGoleadores);

// Playoffs (solo lectura)
router.get('/torneos/:id/playoffs', ctrl.getPlayoffsBracket);
router.get('/torneos/:id/playoffs/:round_key', ctrl.getPlayoffsRound);

// Calendario
router.get('/fields', ctrl.listFields);
router.get('/calendario/dia', ctrl.getCalendarDay);
router.get('/calendario/mes', ctrl.getCalendarMonth);

router.get('/reservas/lookup', ctrl.lookupReservation);

router.get('/galeria', ctrl.getGaleriaPublic);



module.exports = router;
