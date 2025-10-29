// routes/academiaRoutes.js
const express = require('express');
const ctl = require('../controllers/academiaController');
const router = express.Router();


router.get('/public/info', ctl.publicInfo);

// Categorías
router.get('/categorias', ctl.listCategorias);
router.post('/categorias', ctl.createCategoria);
router.put('/categorias/:id', ctl.updateCategoria);
router.delete('/categorias/:id', ctl.deleteCategoria);

// Alumnos
router.get('/alumnos', ctl.listAlumnos);
router.post('/alumnos', ctl.createAlumno);
router.put('/alumnos/:id', ctl.updateAlumno);      // 👈 EDITAR ALUMNO
router.delete('/alumnos/:id', ctl.deleteAlumno);

module.exports = router;
