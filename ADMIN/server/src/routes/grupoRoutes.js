// routes/grupoRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/grupoController');

// /api/grupos
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/activar', ctrl.toggle);
router.delete('/:id', ctrl.remove);

// miembros (canchas físicas)
router.get('/:id/miembros', ctrl.getMiembros);
router.post('/:id/miembros', ctrl.setMiembros);

module.exports = router;
