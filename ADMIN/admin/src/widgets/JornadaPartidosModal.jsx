import { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";

// === Helpers robustos para mostrar fecha y hora ===
function fmtFecha(v) {
  if (!v) return "-";

  // String "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ss..."
  if (typeof v === "string") {
    const ymd = v.slice(0, 10); // toma solo la parte de fecha
    try {
      const d = new Date(`${ymd}T00:00:00`);
      if (!isNaN(d)) return d.toLocaleDateString("es-CL");
    } catch {}
    return ymd;
  }

  // Objeto Date
  if (v instanceof Date && !isNaN(v)) {
    return v.toLocaleDateString("es-CL");
  }

  return "-";
}

function fmtHora(v) {
  if (!v) return "-";

  // Algunos drivers de SQL Server retornan objetos { hours, minutes, seconds, ... }
  if (typeof v === "object" && v !== null) {
    const hh =
      typeof v.hours === "number"
        ? String(v.hours).padStart(2, "0")
        : v.getHours
        ? String(v.getHours()).padStart(2, "0")
        : null;
    const mm =
      typeof v.minutes === "number"
        ? String(v.minutes).padStart(2, "0")
        : v.getMinutes
        ? String(v.getMinutes()).padStart(2, "0")
        : null;
    if (hh != null && mm != null) return `${hh}:${mm}`;
  }

  if (v instanceof Date && !isNaN(v)) {
    const hh = String(v.getHours()).padStart(2, "0");
    const mm = String(v.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const s = String(v);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const hh = m[1].padStart(2, "0");
    const mm = m[2];
    return `${hh}:${mm}`;
  }

  return "-";
}

export default function JornadaPartidosModal({ jornada, onClose, onOpenPartido }) {
  const [partidos, setPartidos] = useState([]);
  const [equipos, setEquipos] = useState([]);

  useEffect(() => {
    const load = async () => {
      // Partidos de la jornada
      const { data } = await api.get(`/fixture/partidos/${jornada.id}`);
      setPartidos(Array.isArray(data) ? data : []);

      // Equipos del torneo (para detectar descanso)
      if (jornada?.torneo_id) {
        const eq = await api.get(`/equipos/${jornada.torneo_id}`);
        setEquipos(Array.isArray(eq.data) ? eq.data : []);
      } else {
        setEquipos([]);
      }
    };
    load();
  }, [jornada]);

  // Detecta "descansa": equipo del torneo que NO aparece ni como local ni como visita en esta jornada.
  const equipoDescansa = useMemo(() => {
    if (!equipos.length || !partidos.length) return null;

    // Usamos IDs si vienen; si no, caemos a nombre (menos robusto, pero útil)
    const idsEnPartidos = new Set();
    const nombresEnPartidos = new Set();

    for (const p of partidos) {
      if (p.equipo_local_id != null) idsEnPartidos.add(Number(p.equipo_local_id));
      if (p.equipo_visita_id != null) idsEnPartidos.add(Number(p.equipo_visita_id));
      if (p.equipo_local) nombresEnPartidos.add(String(p.equipo_local).trim());
      if (p.equipo_visita) nombresEnPartidos.add(String(p.equipo_visita).trim());
    }

    // Primero por id
    let rest = equipos.find((e) => !idsEnPartidos.has(Number(e.id)));
    if (rest) return rest;

    // Fallback por nombre
    rest = equipos.find((e) => !nombresEnPartidos.has(String(e.nombre).trim()));
    return rest || null;
  }, [equipos, partidos]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl p-4 rounded-xl shadow">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Partidos — Jornada {jornada.numero}</h3>
        </div>

        {/* Banner de descanso (solo si aplica) */}
        {equipoDescansa && (
          <div className="mb-3 p-2 rounded border bg-slate-50 text-sm">
            <b>Descansa:</b> {equipoDescansa.nombre}
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th>Local</th>
              <th>GL</th>
              <th>Visita</th>
              <th>GV</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Cancha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {partidos.map((p) => (
              <tr key={p.id} className="border-b">
                <td>{p.equipo_local}</td>
                <td>{p.goles_local ?? "-"}</td>
                <td>{p.equipo_visita}</td>
                <td>{p.goles_visita ?? "-"}</td>
                <td>{fmtFecha(p.fecha)}</td>
                <td>{fmtHora(p.hora)}</td>
                <td>{p.cancha ?? "-"}</td>
                <td>
                  <button
                    onClick={() => {
                      onOpenPartido(p); // abrir modal de partido
                      onClose(); // cerrar este modal
                    }}
                    className="text-xs px-2 py-1 bg-indigo-600 text-white rounded"
                  >
                    Detalles
                  </button>
                </td>
              </tr>
            ))}
            {!partidos.length && (
              <tr>
                <td colSpan={8} className="py-3 text-center text-slate-500">
                  No hay partidos en esta jornada.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-3 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
