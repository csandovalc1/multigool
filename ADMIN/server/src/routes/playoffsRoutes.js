const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/playoffsController');

// INIT / CLOSE
router.post('/:torneoId/init', ctrl.initPlayoffs);
router.post('/:torneoId/close-series', ctrl.closeSeries);

// READ
router.get('/:torneoId/summary', ctrl.getSummary);
router.get('/:torneoId/bracket', ctrl.getBracket);
router.get('/:torneoId/round/:round_key', ctrl.getRound);

// WRITE
router.patch('/:torneoId/match', ctrl.updateMatch);       // fecha/hora/cancha y/o goles
router.post('/:torneoId/assign-slot', ctrl.assignSlot);   // asignar equipo a un slot (bye → equipo)
router.post('/:torneoId/undo-series', ctrl.undoSeries);   // revertir ganador y limpiar next

// ADMIN
router.delete('/:torneoId', ctrl.deleteEliminatoria);
router.get('/:torneoId/state', ctrl.getState);

// --- EVENTOS (eliminatoria) ---
router.get('/:torneoId/events/:matchId', ctrl.getElimEvents);           // listar eventos
router.delete('/:torneoId/events/by-match/:matchId', ctrl.delElimEvents); // borrar todos los eventos del match
router.post('/:torneoId/events', ctrl.createElimEvent);                 // crear 1 evento


module.exports = router;
