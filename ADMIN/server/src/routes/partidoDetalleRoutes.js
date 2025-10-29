const express = require('express');
const router = express.Router();
const controller = require('../controllers/partidoDetalleController');
router.get('/:partido_id', controller.getEventos);
router.post('/', controller.postEvento);
router.delete('/:id', controller.deleteEvento);
router.delete('/por-partido/:partido_id', controller.deleteEventosDePartido);
module.exports = router;