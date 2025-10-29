const express = require('express');
const router = express.Router();
const fixtureController = require('../controllers/fixtureController');
router.get('/jornadas/:torneo_id', fixtureController.getJornadasPorTorneo);
router.get('/partidos/:jornada_id', fixtureController.getPartidosPorJornada);
module.exports = router;