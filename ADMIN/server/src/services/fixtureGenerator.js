function generarCalendario(equipos, idaVuelta = false) {
const cantidad = equipos.length;
if (cantidad < 2) return [];


const esImpar = cantidad % 2 !== 0;
if (esImpar) equipos.push({ id: -1, nombre: 'DESCANSO' }); // bye


const n = equipos.length;
const jornadas = [];
const mitad = Math.floor(n / 2);
const rotativos = equipos.slice(1);


for (let r = 0; r < n - 1; r++) {
const ronda = [];
const local = equipos[0];
const visita = rotativos[r % rotativos.length];
if (local.id !== -1 && visita.id !== -1) {
ronda.push({ local_id: local.id, visita_id: visita.id });
}
for (let i = 1; i < mitad; i++) {
const e1 = rotativos[(r + i) % rotativos.length];
const e2 = rotativos[(r + rotativos.length - i) % rotativos.length];
if (e1.id !== -1 && e2.id !== -1) {
ronda.push({ local_id: e1.id, visita_id: e2.id });
}
}
jornadas.push(ronda);
}


if (idaVuelta) {
const vueltas = jornadas.map(j => j.map(p => ({ local_id: p.visita_id, visita_id: p.local_id })));
return jornadas.concat(vueltas);
}
return jornadas;
}
module.exports = { generarCalendario };