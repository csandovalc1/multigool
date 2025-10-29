import { useEffect, useState } from "react";
import Modal from "../components/Modal";

export default function GroupFormModal({ open, initial, onClose, onSubmit }) {
  const [form, setForm] = useState({ nombre: "", tipo_futbol: "F7", activa: true });

  useEffect(() => {
    if (!open) return;
    setForm(initial ? {
      nombre: initial.nombre || "",
      tipo_futbol: initial.tipo_futbol || "F7",
      activa: !!initial.activa
    } : { nombre: "", tipo_futbol: "F7", activa: true });
  }, [open, initial]);

  const handleSave = async () => {
    await onSubmit({ nombre: form.nombre, tipo_futbol: form.tipo_futbol, activa: form.activa });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Editar grupo" : "Nuevo grupo"} panelClass="max-w-md">
      <div className="grid gap-3">
        <label className="text-sm">
          <div className="text-slate-600 mb-1">Nombre del grupo</div>
          <input
            className="border p-2 rounded w-full"
            value={form.nombre}
            onChange={(e)=>setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: F7-A"
          />
        </label>

        <label className="text-sm">
          <div className="text-slate-600 mb-1">Tipo de fútbol</div>
          <select
            className="border p-2 rounded w-full"
            value={form.tipo_futbol}
            onChange={(e)=>setForm({ ...form, tipo_futbol: e.target.value })}
          >
            <option value="F5">F5</option>
            <option value="F6">F6</option>
            <option value="F7">F7</option>
            <option value="F8">F8</option>
            <option value="F9">F9</option>
            <option value="F11">F11</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.activa} onChange={(e)=>setForm({ ...form, activa: e.target.checked })} />
          <span>Activo</span>
        </label>

        <div className="text-xs text-slate-500 border-t pt-2">
          <b>Tip:</b> Para que este grupo se ofrezca en reservas de {form.tipo_futbol}, crea en <b>Canchas</b> una cancha con el <b>mismo nombre y tipo</b>. Esa será la “cancha virtual” donde se guardará la reserva.
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="px-3 py-2 rounded border" onClick={onClose}>Cancelar</button>
          <button
            className="px-3 py-2 rounded bg-slate-900 text-white"
            onClick={handleSave}
            disabled={!form.nombre || !form.tipo_futbol}
          >
            {initial ? "Guardar cambios" : "Crear grupo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
