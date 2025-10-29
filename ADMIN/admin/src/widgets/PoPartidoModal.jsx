import { useEffect, useState } from "react";
import { api } from "../lib/api";
import MiniModalJugador from "./MiniModalJugador";

// Helpers
function toDateInput(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  try { const d = new Date(v); if (!isNaN(d)) return d.toISOString().slice(0,10); } catch {}
  return "";
}
function toTimeInput(v) {
  if (!v) return "";
  if (typeof v === "object" && v !== null) {
    const hh = typeof v.hours === "number" ? String(v.hours).padStart(2, "0")
      : (v.getHours ? String(v.getHours()).padStart(2, "0") : null);
    const mm = typeof v.minutes === "number" ? String(v.minutes).padStart(2, "0")
      : (v.getMinutes ? String(v.getMinutes()).padStart(2, "0") : null);
    if (hh != null && mm != null) return `${hh}:${mm}`;
  }
  if (v instanceof Date && !isNaN(v)) {
    const hh = String(v.getHours()).padStart(2, "0");
    const mm = String(v.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  const s = String(v);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) { const hh = m[1].padStart(2, "0"); const mm = m[2]; return `${hh}:${mm}`; }
  return "";
}
function toSqlTime(v) {
  if (!v) return null;
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0"); const mm = m[2];
  return `${hh}:${mm}:00`;
}

export default function PoPartidoModal({ leg, open, teamName, onClose, onSaved }) {
  const [jugL, setJugL] = useState([]);
  const [jugV, setJugV] = useState([]);
  const [modalJugador, setModalJugador] = useState(null);

  const [gL, setGL] = useState([]);
  const [gV, setGV] = useState([]);
  const [ams, setAms] = useState([]);
  const [ros, setRos] = useState([]);

  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [cancha, setCancha] = useState("");
  const [saving, setSaving] = useState(false);

  const [canchas, setCanchas] = useState([]);

useEffect(() => {
  (async () => {
    try {
      const { data } = await api.get("/canchas/activas");
      setCanchas(Array.isArray(data) ? data : []);
    } catch {
      setCanchas([]);
    }
  })();
}, []);

  

  useEffect(() => {
    if (!open || !leg) return;

    const load = async () => {
      // Jugadores de ambos equipos (si hay IDs)
      const reqs = [];
      if (leg.home_id) reqs.push(api.get(`/jugadores/${leg.home_id}`));
      else reqs.push(Promise.resolve({ data: [] }));
      if (leg.away_id) reqs.push(api.get(`/jugadores/${leg.away_id}`));
      else reqs.push(Promise.resolve({ data: [] }));
      const [rL, rV] = await Promise.all(reqs);
      setJugL(rL.data || []);
      setJugV(rV.data || []);

      // Eventos del match de eliminatoria
      const rE = await api.get(`/playoffs/${leg.torneoId}/events/${leg.id}`);
      const JL = rL.data || [];
      const golesL = [], golesV = [], amar = [], roj = [];
      for (const ev of (rE.data || [])) {
        const id = parseInt(ev.jugador_id);
        const isL = JL.some(j => j.id === id);
        if (ev.tipo === "gol") (isL ? golesL : golesV).push({ jugador_id: id, tipo: "gol" });
        if (ev.tipo === "amarilla") amar.push({ jugador_id: id, tipo: "amarilla" });
        if (ev.tipo === "roja") roj.push({ jugador_id: id, tipo: "roja" });
      }
      setGL(golesL);
      setGV(golesV);
      setAms(amar);
      setRos(roj);

      // Programación actual
      setFecha(toDateInput(leg.fecha));
      setHora(toTimeInput(leg.hora));
      setCancha(leg.cancha || "");
    };

    load();
  }, [open, leg?.id]);

  if (!open || !leg) return null;

  const nombre = (id) =>
    [...jugL, ...jugV].find((j) => j.id === id)?.nombre || "Jugador";

  const guardar = async () => {
    try {
      setSaving(true);

      // 1) actualiza programación + marcador (usamos PATCH del endpoint de eliminatoria)
      await api.patch(`/playoffs/${leg.torneoId}/match`, {
        match_id: leg.id,
        fecha: fecha || null,
        hora: toSqlTime(hora),
        cancha: cancha || null,
        home_goals: gL.length,
        away_goals: gV.length,
      });

      // 2) reescribe eventos del match de eliminatoria
      await api.delete(`/playoffs/${leg.torneoId}/events/by-match/${leg.id}`);
      const eventos = [
        ...gL.map((e) => ({ ...e, match_id: leg.id })),
        ...gV.map((e) => ({ ...e, match_id: leg.id })),
        ...ams.map((e) => ({ ...e, match_id: leg.id })),
        ...ros.map((e) => ({ ...e, match_id: leg.id })),
      ];
      for (const ev of eventos) {
        await api.post(`/playoffs/${leg.torneoId}/events`, { ...ev, minuto: 0 });
      }

      alert("Partido guardado");
      await onSaved?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 z-50">
      <div className="bg-white w-full max-w-3xl p-4 rounded-xl shadow">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            {teamName(leg.home_id) || "TBD"} vs {teamName(leg.away_id) || "TBD"} — Leg {leg.leg}
          </h3>
        </div>

        {/* Programación */}
        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Fecha</label>
            <input type="date" className="w-full border rounded px-2 py-1"
              value={fecha} onChange={(e)=>setFecha(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Hora</label>
            <input type="time" step="60" className="w-full border rounded px-2 py-1"
              value={hora} onChange={(e)=>setHora(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Cancha</label>
<select
  className="w-full border rounded px-2 py-1"
  value={cancha || ""}
  onChange={(e)=>setCancha(e.target.value)}
>
  <option value="">(Sin asignar)</option>

  {canchas.some(c => c.tipo_futbol === 'F5') && (
    <optgroup label="F5">
      {canchas.filter(c => c.tipo_futbol === 'F5').map(c => (
        <option key={c.id} value={c.nombre}>{c.nombre}</option>
      ))}
    </optgroup>
  )}
  {canchas.some(c => c.tipo_futbol === 'F7') && (
    <optgroup label="F7">
      {canchas.filter(c => c.tipo_futbol === 'F7').map(c => (
        <option key={c.id} value={c.nombre}>{c.nombre}</option>
      ))}
    </optgroup>
  )}

  {cancha && !canchas.some(c => c.nombre === cancha) && (
    <option value={cancha}>{cancha} (no listada)</option>
  )}
</select>

          </div>
        </div>

        {/* Goles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-1">
              Goles {teamName(leg.home_id) || "Local"} ({gL.length})
            </h4>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setModalJugador({ tipo: "gol", equipo: "local" })}
                className="px-2 py-1 bg-slate-800 text-white rounded text-sm"
              >
                Añadir
              </button>
              <button
                onClick={() => setGL(gL.slice(0, -1))}
                className="px-2 py-1 bg-slate-200 rounded text-sm"
              >
                Quitar último
              </button>
            </div>
            <ul className="list-disc ml-4 text-sm">
              {gL.map((e, i) => <li key={i}>{nombre(e.jugador_id)}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-1">
              Goles {teamName(leg.away_id) || "Visita"} ({gV.length})
            </h4>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setModalJugador({ tipo: "gol", equipo: "visita" })}
                className="px-2 py-1 bg-slate-800 text-white rounded text-sm"
              >
                Añadir
              </button>
              <button
                onClick={() => setGV(gV.slice(0, -1))}
                className="px-2 py-1 bg-slate-200 rounded text-sm"
              >
                Quitar último
              </button>
            </div>
            <ul className="list-disc ml-4 text-sm">
              {gV.map((e, i) => <li key={i}>{nombre(e.jugador_id)}</li>)}
            </ul>
          </div>
        </div>

        {/* Tarjetas */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <h4 className="font-semibold mb-1">Tarjetas amarillas ({ams.length})</h4>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setModalJugador({ tipo: "amarilla", equipo: null })}
                className="px-2 py-1 bg-slate-800 text-white rounded text-sm"
              >
                Añadir
              </button>
              <button
                onClick={() => setAms(ams.slice(0, -1))}
                className="px-2 py-1 bg-slate-200 rounded text-sm"
              >
                Quitar último
              </button>
            </div>
            <ul className="list-disc ml-4 text-sm">
              {ams.map((e, i) => <li key={i}>{nombre(e.jugador_id)}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Tarjetas rojas ({ros.length})</h4>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setModalJugador({ tipo: "roja", equipo: null })}
                className="px-2 py-1 bg-slate-800 text-white rounded text-sm"
              >
                Añadir
              </button>
              <button
                onClick={() => setRos(ros.slice(0, -1))}
                className="px-2 py-1 bg-slate-200 rounded text-sm"
              >
                Quitar último
              </button>
            </div>
            <ul className="list-disc ml-4 text-sm">
              {ros.map((e, i) => <li key={i}>{nombre(e.jugador_id)}</li>)}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={guardar}
            disabled={saving}
            className={`px-4 py-2 text-white rounded ${saving ? "bg-slate-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded">Cancelar</button>
        </div>
      </div>

      {modalJugador && (
        <MiniModalJugador
          titulo={`Selecciona jugador para ${modalJugador.tipo} ${modalJugador.equipo ? `(${modalJugador.equipo})` : ""}`}
          jugadores={
            modalJugador.equipo === "local" ? jugL
              : modalJugador.equipo === "visita" ? jugV
              : [...jugL, ...jugV]
          }
          onGuardar={(jugador_id) => {
            const evento = { jugador_id: Number(jugador_id), tipo: modalJugador.tipo };
            if (modalJugador.tipo === "gol") {
              if (modalJugador.equipo === "local") setGL([...gL, evento]);
              else setGV([...gV, evento]);
            } else if (modalJugador.tipo === "amarilla") setAms([...ams, evento]);
            else if (modalJugador.tipo === "roja") setRos([...ros, evento]);
            setModalJugador(null);
          }}
          onCancelar={() => setModalJugador(null)}
        />
      )}
    </div>
  );
}
