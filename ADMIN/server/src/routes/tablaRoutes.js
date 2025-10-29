const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tablaController');
router.get('/:torneo_id', ctrl.getTabla);
module.exports = router;