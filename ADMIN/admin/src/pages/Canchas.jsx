import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import CanchaFormModal from "../widgets/CanchaFormModal";
import GroupFormModal from "../widgets/GroupFormModal";
import GroupMembersModal from "../widgets/GroupMembersModal";

export default function Canchas() {
  const [tab, setTab] = useState("canchas"); // canchas | grupos

  // ---- Canchas ----
  const [rows, setRows] = useState([]);
  const [loadingC, setLoadingC] = useState(true);
  const [showFormC, setShowFormC] = useState(false);
  const [editingC, setEditingC] = useState(null);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");

  // ---- Grupos ----
  const [groups, setGroups] = useState([]);
  const [loadingG, setLoadingG] = useState(true);
  const [showFormG, setShowFormG] = useState(false);
  const [editingG, setEditingG] = useState(null);

  const [showMembers, setShowMembers] = useState(false);
  const [groupForMembers, setGroupForMembers] = useState(null);

  const loadCanchas = async () => {
    setLoadingC(true);
    try {
      const { data } = await api.get("/canchas");
      setRows(data);
    } catch (e) {
      alert(e?.response?.data?.error || "Error al cargar canchas");
    } finally {
      setLoadingC(false);
    }
  };

  const loadGrupos = async () => {
    setLoadingG(true);
    try {
      const { data } = await api.get("/grupos");
      setGroups(data || []);
    } catch (e) {
      alert(e?.response?.data?.error || "Error al cargar grupos");
    } finally {
      setLoadingG(false);
    }
  };

  useEffect(() => { loadCanchas(); loadGrupos(); }, []);

  const filteredC = useMemo(() => {
    return rows.filter(r => {
      const byTxt = !search || r.nombre.toLowerCase().includes(search.toLowerCase());
      const byTipo = !tipo || r.tipo_futbol === tipo;
      return byTxt && byTipo;
    });
  }, [rows, search, tipo]);

  const openNewC = () => { setEditingC(null); setShowFormC(true); };
  const openEditC = (row) => { setEditingC(row); setShowFormC(true); };

  const handleSubmitC = async (form) => {
    try {
      if (editingC) {
        await api.put(`/canchas/${editingC.id}`, form);
      } else {
        await api.post(`/canchas`, form);
      }
      setShowFormC(false);
      setEditingC(null);
      loadCanchas();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo guardar");
    }
  };

  const toggleActivaC = async (row) => {
    try {
      await api.patch(`/canchas/${row.id}/activar`, { activa: !row.activa });
      loadCanchas();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo cambiar estado");
    }
  };

  const removeRowC = async (row) => {
    if (!confirm(`¿Eliminar "${row.nombre}"?`)) return;
    try {
      await api.delete(`/canchas/${row.id}`);
      loadCanchas();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo eliminar");
    }
  };

  // ---- Grupos handlers ----
  const openNewG = () => { setEditingG(null); setShowFormG(true); };
  const openEditG = (row) => { setEditingG(row); setShowFormG(true); };

  const handleSubmitG = async (form) => {
    try {
      if (editingG) {
        await api.put(`/grupos/${editingG.id}`, form);
      } else {
        await api.post(`/grupos`, form);
      }
      setShowFormG(false);
      setEditingG(null);
      loadGrupos();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo guardar");
    }
  };

  const toggleActivaG = async (row) => {
    try {
      await api.patch(`/grupos/${row.id}/activar`, { activa: !row.activa });
      loadGrupos();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo cambiar estado");
    }
  };

  const removeRowG = async (row) => {
    if (!confirm(`¿Eliminar grupo "${row.nombre}"?`)) return;
    try {
      await api.delete(`/grupos/${row.id}`);
      loadGrupos();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo eliminar");
    }
  };

  const manageMembers = (row) => {
    setGroupForMembers(row);
    setShowMembers(true);
  };

  return (
    <div className="space-y-4">
      {/* Header + tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Canchas & Grupos</h1>
          <p className="text-sm text-slate-500">Administra canchas físicas y grupos (p.ej. F7 que combinan varias F5).</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={`px-3 py-2 rounded ${tab==='canchas'?'bg-slate-900 text-white':'bg-slate-200'}`} onClick={()=>setTab('canchas')}>Canchas</button>
          <button className={`px-3 py-2 rounded ${tab==='grupos'?'bg-slate-900 text-white':'bg-slate-200'}`} onClick={()=>setTab('grupos')}>Grupos</button>
        </div>
      </div>

      {tab === 'canchas' && (
        <>
          {/* Filtros canchas */}
          <div className="bg-white rounded-xl shadow border p-3 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm text-slate-600">Buscar</label>
              <input
                className="border p-2 rounded w-full"
                placeholder="Nombre…"
                value={search}
                onChange={(e)=>setSearch(e.target.value)}
              />
            </div>
            <div className="w-[220px]">
              <label className="text-sm text-slate-600">Tipo de fútbol</label>
              <select
                className="border p-2 rounded w-full"
                value={tipo}
                onChange={(e)=>setTipo(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="F5">F5</option>
                <option value="F6">F6</option>
                <option value="F7">F7</option>
                <option value="F8">F8</option>
                <option value="F9">F9</option>
                <option value="F11">F11</option>
              </select>
            </div>
            <div className="ms-auto">
              <button onClick={openNewC} className="px-3 py-2 rounded bg-slate-900 text-white">
                Nueva cancha
              </button>
            </div>
          </div>

          {/* Tabla canchas */}
          <div className="bg-white rounded-xl shadow border">
            {loadingC ? (
              <div className="p-6 text-center text-slate-500">Cargando…</div>
            ) : filteredC.length === 0 ? (
              <div className="p-6 text-center text-slate-500">Sin resultados</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredC.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-2">{r.nombre}</td>
                      <td className="p-2">{r.tipo_futbol}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${r.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                          {r.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEditC(r)} className="px-2 py-1 rounded bg-slate-200">Editar</button>
                          <button onClick={() => toggleActivaC(r)} className="px-2 py-1 rounded bg-indigo-600 text-white">
                            {r.activa ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => removeRowC(r)} className="px-2 py-1 rounded bg-rose-600 text-white">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal canchas */}
          <CanchaFormModal
            open={showFormC}
            initial={editingC}
            onClose={()=>{ setShowFormC(false); setEditingC(null); }}
            onSubmit={handleSubmitC}
          />
        </>
      )}

      {tab === 'grupos' && (
        <>
          <div className="bg-white rounded-xl shadow border p-3 flex items-center justify-between">
            <div className="text-slate-600 text-sm">
              Crea grupos lógicos (p. ej. <b>F7-A</b>) y asígnales las canchas físicas que bloquean.
              <br/>Para que se puedan reservar en F7, crea una <b>cancha</b> con el <b>mismo nombre y tipo</b> (homónima) en la pestaña Canchas.
            </div>
            <button onClick={openNewG} className="px-3 py-2 rounded bg-slate-900 text-white">
              Nuevo grupo
            </button>
          </div>

          <div className="bg-white rounded-xl shadow border">
            {loadingG ? (
              <div className="p-6 text-center text-slate-500">Cargando…</div>
            ) : groups.length === 0 ? (
              <div className="p-6 text-center text-slate-500">Sin resultados</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id} className="border-b">
                      <td className="p-2">{g.nombre}</td>
                      <td className="p-2">{g.tipo_futbol}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${g.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                          {g.activa ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => manageMembers(g)} className="px-2 py-1 rounded bg-slate-200">Miembros</button>
                          <button onClick={() => openEditG(g)} className="px-2 py-1 rounded bg-slate-200">Editar</button>
                          <button onClick={() => toggleActivaG(g)} className="px-2 py-1 rounded bg-indigo-600 text-white">
                            {g.activa ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => removeRowG(g)} className="px-2 py-1 rounded bg-rose-600 text-white">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <GroupFormModal
            open={showFormG}
            initial={editingG}
            onClose={()=>{ setShowFormG(false); setEditingG(null); }}
            onSubmit={handleSubmitG}
          />

          <GroupMembersModal
            open={showMembers}
            group={groupForMembers}
            onClose={()=>{ setShowMembers(false); setGroupForMembers(null); }}
            onSaved={loadGrupos}
          />
        </>
      )}
    </div>
  );
}
