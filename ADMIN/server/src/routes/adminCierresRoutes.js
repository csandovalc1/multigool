const express = require('express');
const router = express.Router();
const cierres = require('../controllers/cierresController');

// ✅ solo paths, SIN querystrings
router.get('/', cierres.listByMonth);   
router.post('/', cierres.create);       // opcional ?force=1
router.delete('/:fecha', cierres.remove);

module.exports = router;
