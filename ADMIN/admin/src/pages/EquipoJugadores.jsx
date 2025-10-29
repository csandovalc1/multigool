import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function EquipoJugadores() {
  const [torneos, setTorneos] = useState([]);
  const [tid, setTid] = useState("");
  const [equipos, setEquipos] = useState([]);
  const [nuevoEquipo, setNuevoEquipo] = useState("");
  const [equipoSel, setEquipoSel] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [nuevoJugador, setNuevoJugador] = useState({ nombre: "", dorsal: "", posicion: "" });
  

  useEffect(() => {
    api.get("/torneos").then((r) => setTorneos(r.data));
  }, []);

  const cargarEquipos = async () => {
    if (!tid) return;
    const { data } = await api.get(`/equipos/${tid}`);
    setEquipos(data);
    setEquipoSel(null);
    setJugadores([]);
  };

  const agregarEquipo = async () => {
    if (!nuevoEquipo.trim() || !tid) return;
    await api.post("/equipos", { nombre: nuevoEquipo, torneo_id: Number(tid) });
    setNuevoEquipo("");
    cargarEquipos();
  };

  const eliminarEquipo = async (id) => {
    await api.delete(`/equipos/${id}`);
    if (equipoSel?.id === id) {
      setEquipoSel(null);
      setJugadores([]);
    }
    cargarEquipos();
  };

  const seleccionarEquipo = async (e) => {
    setEquipoSel(e);
    const { data } = await api.get(`/jugadores/${e.id}`);
    setJugadores(data);
  };

  const agregarJugador = async () => {
    if (!equipoSel) return;
    const payload = {
      nombre: nuevoJugador.nombre,
      dorsal: Number(nuevoJugador.dorsal) || null,
      posicion: nuevoJugador.posicion,
      equipo_id: equipoSel.id,
    };
    await api.post("/jugadores", payload);
    setNuevoJugador({ nombre: "", dorsal: "", posicion: "" });
    const { data } = await api.get(`/jugadores/${equipoSel.id}`);
    setJugadores(data);
  };

  const eliminarJugador = async (id) => {
    await api.delete(`/jugadores/${id}`);
    const { data } = await api.get(`/jugadores/${equipoSel.id}`);
    setJugadores(data);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Torneo</h3>
        <div className="flex gap-2 items-center">
          <select className="border p-2 rounded" value={tid} onChange={(e) => setTid(e.target.value)}>
            <option value="">Selecciona torneo</option>
            {torneos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <button onClick={cargarEquipos} className="px-3 py-2 bg-slate-900 text-white rounded">
            Cargar equipos
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Equipos */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-semibold mb-3">Equipos</h3>

          <div className="flex gap-2 items-center mb-3">
            <input
              className="border p-2 rounded flex-1"
              placeholder="Nombre del equipo"
              value={nuevoEquipo}
              onChange={(e) => setNuevoEquipo(e.target.value)}
            />
            <button onClick={agregarEquipo} className="px-3 py-2 bg-emerald-600 text-white rounded">
              Agregar
            </button>
          </div>

          <ul className="divide-y">
            {equipos.map((e) => (
              <li key={e.id} className="py-2 flex items-center justify-between">
                <button
                  className={`text-left flex-1 ${equipoSel?.id === e.id ? "font-semibold" : ""}`}
                  onClick={() => seleccionarEquipo(e)}
                >
                  {e.nombre}
                </button>
                <button
                  onClick={() => eliminarEquipo(e.id)}
                  className="text-xs px-2 py-1 bg-rose-600 text-white rounded"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Jugadores del equipo seleccionado */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h3 className="font-semibold mb-3">
            Jugadores {equipoSel ? `— ${equipoSel.nombre}` : ""}
          </h3>

          {equipoSel ? (
            <>
              <div className="grid md:grid-cols-3 gap-2 mb-3">
                <input
                  className="border p-2 rounded"
                  placeholder="Nombre"
                  value={nuevoJugador.nombre}
                  onChange={(e) => setNuevoJugador({ ...nuevoJugador, nombre: e.target.value })}
                />
                <input
                  className="border p-2 rounded"
                  placeholder="Dorsal"
                  type="number"
                  value={nuevoJugador.dorsal}
                  onChange={(e) => setNuevoJugador({ ...nuevoJugador, dorsal: e.target.value })}
                />
                <input
                  className="border p-2 rounded"
                  placeholder="Posición"
                  value={nuevoJugador.posicion}
                  onChange={(e) => setNuevoJugador({ ...nuevoJugador, posicion: e.target.value })}
                />
              </div>
              <button onClick={agregarJugador} className="px-3 py-2 bg-emerald-600 text-white rounded">
                Agregar jugador
              </button>

              <ul className="divide-y mt-3">
                {jugadores.map((j) => (
                  <li key={j.id} className="py-2 flex items-center justify-between">
                    <span>
                      #{j.dorsal ?? "-"} {j.nombre} {j.posicion ? `(${j.posicion})` : ""}
                    </span>
                    <button
                      onClick={() => eliminarJugador(j.id)}
                      className="text-xs px-2 py-1 bg-rose-600 text-white rounded"
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-sm text-slate-500">Selecciona un equipo para ver sus jugadores.</div>
          )}
        </div>
      </div>
    </div>
  );
}
