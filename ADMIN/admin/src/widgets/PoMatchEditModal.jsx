import { useEffect, useState } from "react";
import { api } from "../lib/api";

function toDateInput(v) {
  if (!v) return "";
  if (typeof v === "string") {
    // "2025-09-10" o "2025-09-10T00:00:00.000Z"
    return v.slice(0, 10);
  }
  // Date u otro objeto: intenta convertir
  try {
    const d = new Date(v);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  } catch {}
  return "";
}

function toTimeInput(v) {
  if (!v) return "";
  // Si es un objeto tipo { hours, minutes } (algunos drivers)
  if (typeof v === "object" && v !== null) {
    const hh =
      typeof v.hours === "number"
        ? String(v.hours).padStart(2, "0")
        : (v.getHours ? String(v.getHours()).padStart(2, "0") : null);
    const mm =
      typeof v.minutes === "number"
        ? String(v.minutes).padStart(2, "0")
        : (v.getMinutes ? String(v.getMinutes()).padStart(2, "0") : null);
    if (hh != null && mm != null) return `${hh}:${mm}`;
  }

  // Si es Date
  if (v instanceof Date && !isNaN(v)) {
    const hh = String(v.getHours()).padStart(2, "0");
    const mm = String(v.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // Si es string: agarra el primer HH:MM que aparezca en cualquier parte
  const s = String(v);
  const m = s.match(/(\d{1,2}):(\d{2})/); // tolera "7:05", "23:30:00.0000000", etc.
  if (m) {
    const hh = m[1].padStart(2, "0");
    const mm = m[2];
    return `${hh}:${mm}`;
  }
  return "";
}

function toSqlTime(v) {
  if (!v) return null; // limpia en backend
  // Normaliza "H:MM" → "HH:MM:00"
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mm = m[2];
  return `${hh}:${mm}:00`;
}


export default function PoMatchEditModal({ open, leg, teamName, onClose, onSaved }) {
  const [form, setForm] = useState({
    fecha: "",
    hora: "",
    cancha: "",
    home_goals: "0",
    away_goals: "0",
  });

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

    setForm({
      fecha: toDateInput(leg.fecha),
      hora: toTimeInput(leg.hora),
      cancha: leg.cancha || "",
      // Si no hay goles guardados, 0–0
      home_goals: (leg.home_goals != null ? String(leg.home_goals) : "0"),
      away_goals: (leg.away_goals != null ? String(leg.away_goals) : "0"),
    });
  }, [open, leg?.id, leg?.hora]); // depende de leg.id para rehidratar al cambiar de partido

  if (!open || !leg) return null;

  const save = async () => {
    try {
      const toInt = (v) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      };

      await api.patch(`/playoffs/${leg.torneoId}/match`, {
        match_id: leg.id,
        fecha: form.fecha || null,
        hora: toSqlTime(form.hora),
        cancha: form.cancha || null,
        home_goals: toInt(form.home_goals),
        away_goals: toInt(form.away_goals),
      });
      onSaved?.();
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Error al guardar';
      alert(msg);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Editar partido — Leg {leg.leg}</h3>
        </div>

        <div className="space-y-3 text-sm">
          <div className="p-2 rounded border bg-slate-50">
            <div className="font-medium">
              {teamName(leg.home_id) || "TBD"} vs {teamName(leg.away_id) || "TBD"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col">
              <span className="text-slate-600">Fecha</span>
              <input
                type="date"
                className="border p-2 rounded"
                value={form.fecha}
                onChange={(e)=>setForm(f=>({ ...f, fecha: e.target.value }))}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-slate-600">Hora</span>
              <input
                type="time"
                step="60"
                className="border p-2 rounded"
                value={form.hora}
                onChange={(e)=>setForm(f=>({ ...f, hora: e.target.value }))}
              />
            </label>
          </div>

          <label className="flex flex-col">
  <span className="text-slate-600">Cancha</span>
  <select
    className="border p-2 rounded"
    value={form.cancha || ""}
    onChange={(e)=>setForm(f=>({ ...f, cancha: e.target.value }))}
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

    {form.cancha && !canchas.some(c => c.nombre === form.cancha) && (
      <option value={form.cancha}>{form.cancha} (no listada)</option>
    )}
  </select>
</label>


          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col">
              <span className="text-slate-600">Goles {teamName(leg.home_id) || "Local"}</span>
              <input
                type="number" min={0} step={1}
                className="border p-2 rounded"
                value={form.home_goals}
                onChange={(e)=>setForm(f=>({ ...f, home_goals: e.target.value }))}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-slate-600">Goles {teamName(leg.away_id) || "Visita"}</span>
              <input
                type="number" min={0} step={1}
                className="border p-2 rounded"
                value={form.away_goals}
                onChange={(e)=>setForm(f=>({ ...f, away_goals: e.target.value }))}
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={save} className="px-4 py-2 rounded bg-emerald-600 text-white">
            Guardar
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded bg-slate-200">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
