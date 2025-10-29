// src/pages/Galeria.jsx
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { Image as ImageIcon, X, Upload, Pencil, Check } from "lucide-react";
import { absUrl } from "../lib/constants";

function fmtGT(yyyyMMddHHmmss) {
  if (!yyyyMMddHHmmss) return "-";
  try {
    const iso = yyyyMMddHHmmss.replace(" ", "T");
    const d = new Date(iso);
    return d.toLocaleString("es-GT", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return yyyyMMddHHmmss;
  }
}

export default function Galeria() {
  const [lista, setLista] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // subida por tandas
  const [items, setItems] = useState([]); // [{file, url, descripcion}]
  const inputRef = useRef(null);

  const cargar = async () => {
    const { data } = await api.get("/galeria");
    // absolutiza url
    const arr = (data || []).map(f => ({ ...f, url: absUrl(f.url) }));
    setLista(arr);
  };
  useEffect(() => { cargar(); }, []);

  const openPicker = () => inputRef.current?.click();

  const handleFiles = (files) => {
    const arr = Array.from(files || []);
    const remaining = Math.max(0, 20 - items.length);
    const toAdd = arr.slice(0, remaining).map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      descripcion: ""
    }));
    setItems(prev => [...prev, ...toAdd]);
  };

  const onDrop = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };
  const onDragOver = (e) => e.preventDefault();
  const onInputChange = (e) => handleFiles(e.target.files);

  const removeLocal = (idx) => {
    setItems(prev => {
      const cp = [...prev];
      const [rm] = cp.splice(idx, 1);
      if (rm?.url) URL.revokeObjectURL(rm.url);
      return cp;
    });
  };

  const setDesc = (idx, val) => {
    setItems(prev => {
      const cp = [...prev];
      cp[idx] = { ...cp[idx], descripcion: val };
      return cp;
    });
  };

  const subir = async () => {
    if (items.length === 0) return;
    const fd = new FormData();
    for (const it of items) fd.append("fotos", it.file);
    for (const it of items) fd.append("descriptions", it.descripcion || "");
    try {
      setSubmitting(true);
      await api.post("/galeria", fd, { headers: { "Content-Type": "multipart/form-data" } });
      // libera urls
      items.forEach(i => i.url && URL.revokeObjectURL(i.url));
      setItems([]);
      await cargar();
    } finally { setSubmitting(false); }
  };

  const publicar = async (id) => { await api.post(`/galeria/${id}/publish`); cargar(); };
  const ocultar   = async (id) => { await api.post(`/galeria/${id}/unpublish`); cargar(); };
  const eliminar  = async (id) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    await api.delete(`/galeria/${id}`);
    cargar();
  };

  // edición inline de descripción
  const [editId, setEditId] = useState(null);
  const [editDesc, setEditDesc] = useState("");

  const startEdit = (f) => { setEditId(f.id); setEditDesc(f.descripcion || ""); };
  const saveEdit = async () => {
    if (!editId) return;
    await api.put(`/galeria/${editId}`, { descripcion: editDesc });
    setEditId(null); setEditDesc("");
    cargar();
  };

  return (
    <div className="space-y-6">
      {/* Creador */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Subir fotos a la galería</h3>

        <div
          onClick={openPicker}
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="rounded-xl border-2 border-dashed p-5 text-center cursor-pointer hover:bg-slate-50 transition border-slate-300"
          title="Haz clic o arrastra imágenes (máx 20)"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full p-3 bg-slate-100">
              <Upload className="w-6 h-6 text-slate-600" />
            </div>
            <div className="text-sm">
              <span className="font-semibold">Subir imágenes</span>{" "}
              <span className="text-slate-500">(máx 20)</span>
            </div>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm"
            >
              <ImageIcon className="w-4 h-4" />
              Seleccionar archivos
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onInputChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Previews + descripción por foto */}
        {items.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it, idx) => (
              <div key={idx} className="rounded-lg border overflow-hidden">
                <div className="relative">
                  <img src={it.url} alt={`preview-${idx}`} className="w-full h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => removeLocal(idx)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white"
                    title="Quitar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3">
                  <input
                    className="w-full border rounded px-2 py-1 text-sm"
                    maxLength={400}
                    placeholder="Descripción (opcional)…"
                    value={it.descripcion}
                    onChange={(e) => setDesc(idx, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 text-xs text-slate-500">
          Formatos comunes (JPG/PNG/WebP). Tamaño sugerido &lt; 5MB c/u.
        </div>

        <button
          onClick={subir}
          disabled={submitting || items.length === 0}
          className="mt-3 px-5 py-2 rounded-md text-white font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
        >
          {submitting ? "Subiendo…" : `Subir ${items.length || ""} foto(s)`}
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Fotos subidas</h3>
        {lista.length === 0 ? (
          <div className="p-3 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
            Aún no hay fotos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Foto</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th>F. publicación (GT)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id} className="border-b align-top">
                    <td className="py-2">
                      <img src={f.url} alt={`f-${f.id}`} className="w-28 h-20 object-cover rounded" />
                    </td>
                    <td className="pr-3">
                      {editId === f.id ? (
                        <div className="flex items-start gap-2">
                          <textarea
                            className="border rounded w-full p-2"
                            rows={3}
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                          />
                          <button
                            onClick={saveEdit}
                            className="h-9 px-3 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                            title="Guardar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="text-neutral-800 whitespace-pre-wrap">
                            {f.descripcion || <span className="text-neutral-400">—</span>}
                          </div>
                          <button
                            onClick={() => startEdit(f)}
                            className="px-2 py-1 rounded border hover:bg-neutral-50"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      {f.estado === "publicada" ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">publicada</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">borrador</span>
                      )}
                    </td>
                    <td>{f.publish_at ? fmtGT(f.publish_at) : "-"}</td>
                    <td className="text-right space-x-2 py-2">
                      {f.estado === "publicada" ? (
                        <button onClick={() => ocultar(f.id)} className="px-3 py-1 rounded bg-amber-600 text-white">
                          Ocultar
                        </button>
                      ) : (
                        <button onClick={() => publicar(f.id)} className="px-3 py-1 rounded bg-emerald-600 text-white">
                          Publicar
                        </button>
                      )}
                      <button onClick={() => eliminar(f.id)} className="px-3 py-1 rounded bg-rose-600 text-white">
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
