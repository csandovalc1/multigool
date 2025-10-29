const { sql, getPool } = require('../config/db');


async function obtenerJugadoresPorEquipo(equipo_id) {
const pool = await getPool();
const res = await pool.request().input('eid', sql.Int, equipo_id)
.query('SELECT * FROM jugadores WHERE equipo_id=@eid ORDER BY dorsal ASC, nombre ASC');
return res.recordset;
}


async function agregarJugador({ nombre, dorsal, posicion, equipo_id }) {
const pool = await getPool();
await pool.request()
.input('nombre', sql.NVarChar(100), nombre)
.input('dorsal', sql.Int, dorsal || null)
.input('posicion', sql.NVarChar(50), posicion || null)
.input('equipo_id', sql.Int, equipo_id)
.query('INSERT INTO jugadores (nombre, dorsal, posicion, equipo_id) VALUES (@nombre, @dorsal, @posicion, @equipo_id)');
}


async function eliminarJugador(id) {
const pool = await getPool();
await pool.request().input('id', sql.Int, id).query('DELETE FROM jugadores WHERE id=@id');
}


module.exports = { obtenerJugadoresPorEquipo, agregarJugador, eliminarJugador };