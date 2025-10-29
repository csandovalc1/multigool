import { useEffect, useState } from "react";

export default function CanchaFormModal({ open, initial, onClose, onSubmit }) {
  const [form, setForm] = useState({
    nombre: "",
    tipo_futbol: "F7",
    activa: true,
  });

  useEffect(() => {
    if (open) {
      setForm({
        nombre: initial?.nombre || "",
        tipo_futbol: initial?.tipo_futbol || "F7",
        activa: initial?.activa ?? true,
      });
    }
  }, [open, initial]);

  if (!open) return null;

  const save = () => {
    if (!form.nombre.trim()) { alert("Nombre requerido"); return; }
    if (!form.tipo_futbol.trim()) { alert("Tipo de fútbol requerido"); return; }
    onSubmit?.(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{initial ? "Editar cancha" : "Nueva cancha"}</h3>
        </div>

        <div className="space-y-3 text-sm">
          <label className="flex flex-col">
            <span className="text-slate-600">Nombre</span>
            <input
              className="border p-2 rounded"
              value={form.nombre}
              onChange={e=>setForm(f=>({ ...f, nombre: e.target.value }))}
              placeholder="Cancha 1"
            />
          </label>

          <label className="flex flex-col">
            <span className="text-slate-600">Tipo de fútbol</span>
            <select
              className="border p-2 rounded"
              value={form.tipo_futbol}
              onChange={e=>setForm(f=>({ ...f, tipo_futbol: e.target.value }))}
            >
              <option value="F5">F5</option>
              <option value="F6">F6</option>
              <option value="F7">F7</option>
              <option value="F8">F8</option>
              <option value="F9">F9</option>
              <option value="F11">F11</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.activa}
              onChange={e=>setForm(f=>({ ...f, activa: e.target.checked }))}
            />
            <span>Activa</span>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-slate-200">Cancelar</button>
          <button onClick={save} className="px-4 py-2 rounded bg-emerald-600 text-white">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
