const { sql, getPool } = require('../config/db');


async function getTablaByTorneo(torneoId) {
const pool = await getPool();
const res = await pool.request().input('tid', sql.Int, torneoId).query(`
WITH datos AS (
SELECT e.id AS team_id, e.nombre AS equipo,
p.goles_local, p.goles_visita,
CASE WHEN p.equipo_local_id = e.id THEN 1 WHEN p.equipo_visita_id = e.id THEN 1 ELSE 0 END AS jugo,
CASE WHEN p.equipo_local_id = e.id THEN p.goles_local
WHEN p.equipo_visita_id = e.id THEN p.goles_visita END AS gf,
CASE WHEN p.equipo_local_id = e.id THEN p.goles_visita
WHEN p.equipo_visita_id = e.id THEN p.goles_local END AS gc
FROM equipos e
LEFT JOIN jornadas j ON j.torneo_id = e.torneo_id
LEFT JOIN partidos p ON p.jornada_id = j.id
AND p.goles_local IS NOT NULL AND p.goles_visita IS NOT NULL
AND (p.equipo_local_id = e.id OR p.equipo_visita_id = e.id)
WHERE e.torneo_id = @tid
)
SELECT team_id, MAX(equipo) AS equipo,
SUM(CASE WHEN jugo=1 THEN 1 ELSE 0 END) AS PJ,
SUM(CASE WHEN jugo=1 AND gf>gc THEN 1 ELSE 0 END) AS G,
SUM(CASE WHEN jugo=1 AND gf=gc THEN 1 ELSE 0 END) AS E,
SUM(CASE WHEN jugo=1 AND gf<gc THEN 1 ELSE 0 END) AS P,
SUM(COALESCE(gf,0)) AS GF,
SUM(COALESCE(gc,0)) AS GC
FROM datos
GROUP BY team_id
`);


const tabla = res.recordset.map(r => ({
team_id: r.team_id,
equipo: r.equipo,
PJ: r.PJ|0, G: r.G|0, E: r.E|0, P: r.P|0,
GF: r.GF|0, GC: r.GC|0,
DG: (r.GF|0) - (r.GC|0),
Pts: (r.G*3) + (r.E*1)
})).sort((a,b)=> b.Pts - a.Pts || b.DG - a.DG || b.GF - a.GF || a.equipo.localeCompare(b.equipo));


return tabla;
}


module.exports = { getTablaByTorneo };