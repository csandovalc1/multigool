const express = require('express');
const router = express.Router();
const c = require('../controllers/reservasController');
router.get('/', c.list);
router.post('/', c.create);
router.patch('/:id', c.update);
module.exports = router;