const express = require('express');
const r = express.Router();
const c = require('../controllers/reportesController');

// Reservas
r.get('/reservas/ingresos', c.ingresosReservas);
r.get('/reservas/por-cancha', c.reservasPorCancha);
r.get('/reservas/heatmap', c.heatmapHoras);

// Torneos
r.get('/torneos/ingresos', c.ingresosTorneos); // histórico por torneo
r.get('/torneos/ingresos-periodo', c.ingresosTorneosPeriodo); // 👈 agregado por periodo

// Finanzas
r.get('/finanzas/balance', c.balanceGeneral);
r.get('/finanzas/proyeccion', c.proyeccionMesActual);

module.exports = r;
