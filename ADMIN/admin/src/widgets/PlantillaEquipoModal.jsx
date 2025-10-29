import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function PlantillaEquipoModal({ equipo, onClose }) {
  const [jugadores, setJugadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: "", dorsal: "", posicion: "" });
  const [editRow, setEditRow] = useState(null); // {id, nombre, dorsal, posicion}
  const POSICIONES = ["POR", "DEF", "MED", "DEL"];


  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/equipos/${equipo.id}/jugadores`);
      setJugadores(data || []);
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo cargar la plantilla");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [equipo?.id]);

  const crear = async () => {
    if (!form.nombre.trim()) return alert("Nombre es obligatorio");
    const dorsalNum = form.dorsal === "" ? null : Number(form.dorsal);
    if (dorsalNum != null && (!Number.isFinite(dorsalNum) || dorsalNum < 0)) {
      return alert("Dorsal inválido");
    }
    setSaving(true);
    try {
      await api.post(`/equipos/${equipo.id}/jugadores`, {
        nombre: form.nombre.trim(),
        dorsal: dorsalNum,
        posicion: form.posicion || null,
      });
      setForm({ nombre: "", dorsal: "", posicion: "" });
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo crear el jugador");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (j) => {
    setEditRow({ id: j.id, nombre: j.nombre, dorsal: j.dorsal ?? "", posicion: j.posicion ?? "" });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    if (!editRow.nombre.trim()) return alert("Nombre es obligatorio");
    const dorsalNum = editRow.dorsal === "" ? null : Number(editRow.dorsal);
    if (dorsalNum != null && (!Number.isFinite(dorsalNum) || dorsalNum < 0)) {
      return alert("Dorsal inválido");
    }
    setSaving(true);
    try {
      await api.patch(`/jugadores/${editRow.id}`, {
        nombre: editRow.nombre.trim(),
        dorsal: dorsalNum,
        posicion: editRow.posicion || null,
      });
      setEditRow(null);
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo actualizar el jugador");
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar jugador?")) return;
    try {
      await api.delete(`/jugadores/${id}`);
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo eliminar");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Plantilla — {equipo?.nombre}</h3>
            <p className="text-xs text-slate-500">Equipo ID: {equipo?.id}</p>
          </div>
          <button onClick={onClose} className="px-3 py-1 rounded bg-slate-200">Cerrar</button>
        </div>

        {/* Alta */}
        <div className="bg-slate-50 rounded p-3 mb-3">
          <div className="grid md:grid-cols-4 gap-2">
            <input
              className="border p-2 rounded"
              placeholder="Nombre*"
              value={form.nombre}
              onChange={(e)=>setForm(f=>({...f, nombre: e.target.value}))}
              disabled={saving}
            />
            <input
              className="border p-2 rounded"
              placeholder="Dorsal"
              type="number"
              value={form.dorsal}
              onChange={(e)=>setForm(f=>({...f, dorsal: e.target.value}))}
              disabled={saving}
            />
<select
  className="border p-2 rounded"
  value={form.posicion}
  onChange={(e)=>setForm(f=>({...f, posicion: e.target.value}))}
  disabled={saving}
>
  <option value="">(Sin posición)</option>
  {POSICIONES.map(p => (
    <option key={p} value={p}>{p}</option>
  ))}
</select>

            <button
              onClick={crear}
              disabled={saving}
              className="px-3 py-2 rounded bg-emerald-600 text-white"
            >
              Agregar
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-2">Dorsal</th>
                <th className="text-left p-2">Nombre</th>
                <th className="text-left p-2">Posición</th>
                <th className="p-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-4 text-center text-slate-500">Cargando…</td></tr>
              ) : jugadores.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-slate-500">Sin jugadores.</td></tr>
              ) : jugadores.map(j => (
                <tr key={j.id} className="border-t">
                  <td className="p-2">
                    {editRow?.id === j.id ? (
                      <input
                        className="border p-1 rounded w-20"
                        type="number"
                        value={editRow.dorsal}
                        onChange={e=>setEditRow(r=>({...r, dorsal: e.target.value}))}
                      />
                    ) : (j.dorsal ?? "—")}
                  </td>
                  <td className="p-2">
                    {editRow?.id === j.id ? (
                      <input
                        className="border p-1 rounded w-full"
                        value={editRow.nombre}
                        onChange={e=>setEditRow(r=>({...r, nombre: e.target.value}))}
                      />
                    ) : j.nombre}
                  </td>
                  <td className="p-2">
                    {editRow?.id === j.id ? (
<select
  className="border p-1 rounded w-36"
  value={editRow.posicion ?? ""}
  onChange={e=>setEditRow(r=>({...r, posicion: e.target.value}))}
>
  <option value="">(Sin posición)</option>
  {POSICIONES.map(p => (
    <option key={p} value={p}>{p}</option>
  ))}
  {/* Si hubiera un valor previo no estándar, lo mostramos para no perderlo */}
  {editRow.posicion &&
    !POSICIONES.includes(String(editRow.posicion).toUpperCase()) && (
      <option value={editRow.posicion}>{editRow.posicion} (no estándar)</option>
  )}
</select>

                    ) : (j.posicion || "—")}
                  </td>
                  <td className="p-2 text-right space-x-2">
                    {editRow?.id === j.id ? (
                      <>
                        <button className="px-2 py-1 text-xs rounded bg-emerald-600 text-white" onClick={saveEdit} disabled={saving}>Guardar</button>
                        <button className="px-2 py-1 text-xs rounded bg-slate-200" onClick={()=>setEditRow(null)} disabled={saving}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button className="px-2 py-1 text-xs rounded bg-slate-700 text-white" onClick={()=>startEdit(j)}>Editar</button>
                        <button className="px-2 py-1 text-xs rounded bg-rose-600 text-white" onClick={()=>eliminar(j.id)}>Eliminar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
