// src/widgets/GroupMembersModal.jsx
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import { api } from "../lib/api";

export default function GroupMembersModal({ open, group, onClose, onSaved }) {
  const [allCanchas, setAllCanchas] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const tipo = group?.tipo_futbol;

  useEffect(() => {
    if (!open || !group) return;
    (async () => {
      setLoading(true);
      try {
        const [{ data: canchas }, { data: miembros }] = await Promise.all([
          api.get('/canchas/activas'),
          api.get(`/grupos/${group.id}/miembros`)
        ]);
        const fisicas = (canchas || []).filter(c => c.tipo_futbol === 'F5' || c.tipo_futbol === 'F6' || c.tipo_futbol === 'F7' || c.tipo_futbol === 'F11'); // puedes ajustar criterio
        // Si quieres restringir por tipo, deja solo F5 cuando el grupo es F7, etc.
        // Para el caso clásico: F7 se arma con F5 -> filtra a F5 si group.tipo_futbol==='F7'
        const filtered = group?.tipo_futbol === 'F7' ? fisicas.filter(c=>c.tipo_futbol==='F5') : fisicas;
        setAllCanchas(filtered);

        const ids = new Set((miembros || []).map(m => m.id));
        setSelected(ids);
      } catch (e) {
        alert(e?.response?.data?.error || "No se pudieron cargar miembros");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, group]);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    try {
      await api.post(`/grupos/${group.id}/miembros`, {
        cancha_ids: Array.from(selected)
      });
      onSaved?.();
      onClose();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo guardar los miembros");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={group ? `Miembros de ${group.nombre}` : "Miembros"}
      panelClass="max-w-lg"
    >
      {!group ? null : (
        <div className="grid gap-3">
          <div className="text-sm text-slate-500">
            Asigna las <b>canchas físicas</b> que este grupo debe bloquear al reservar.
            {tipo ? <> (Tipo del grupo: <b>{tipo}</b>)</> : null}
          </div>

          {loading ? (
            <div className="p-3 border rounded bg-neutral-50 text-sm">Cargando…</div>
          ) : (
            <div className="max-h-64 overflow-auto border rounded p-2 space-y-1">
              {allCanchas.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span>{c.nombre} ({c.tipo_futbol})</span>
                </label>
              ))}
              {allCanchas.length === 0 && (
                <div className="text-sm text-slate-500">No hay canchas físicas disponibles.</div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="px-3 py-2 rounded border" onClick={onClose}>Cerrar</button>
            <button className="px-3 py-2 rounded bg-slate-900 text-white" onClick={save}>Guardar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
