const express = require('express');
const router = express.Router();
const controller = require('../controllers/canchaController');

// GET /api/canchas
router.get('/', controller.list);
// GET /api/canchas/activas
router.get('/activas', controller.listActive);
// POST /api/canchas
router.post('/', controller.create);
// PUT /api/canchas/:id
router.put('/:id', controller.update);
// PATCH /api/canchas/:id/activar
router.patch('/:id/activar', controller.toggle);
// DELETE /api/canchas/:id
router.delete('/:id', controller.remove);

module.exports = router;
