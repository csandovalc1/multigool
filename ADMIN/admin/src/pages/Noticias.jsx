import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { Image as ImageIcon, X, Upload } from "lucide-react";

export default function Noticias() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({
    titulo: "", resumen: "", cuerpo_md: "",
    is_important: false,
    banner_start: "", // 'YYYY-MM-DD'
    banner_end: ""
  });
  const [imagenes, setImagenes] = useState([]); // [{file, url}]
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  const cargar = async () => {
    const { data } = await api.get("/noticias?abs=1");
    setLista(data || []);
  };
  useEffect(() => { cargar(); }, []);

  // Upload con previews
  const openPicker = () => inputRef.current?.click();

  const handleFiles = (files) => {
    const arr = Array.from(files || []);
    const remaining = Math.max(0, 3 - imagenes.length);
    const toAdd = arr.slice(0, remaining).map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
    }));
    setImagenes((prev) => [...prev, ...toAdd]);
  };

  const onInputChange = (e) => handleFiles(e.target.files);
  const onDrop = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };
  const onDragOver = (e) => e.preventDefault();

  const removeImg = (idx) => {
    setImagenes((prev) => {
      const copy = [...prev];
      const [rm] = copy.splice(idx, 1);
      if (rm?.url) URL.revokeObjectURL(rm.url);
      return copy;
    });
  };

  const crear = async () => {
    if (!form.titulo.trim() || !form.cuerpo_md.trim()) {
      alert("Título y Contenido son requeridos");
      return;
    }
    const fd = new FormData();
    fd.append("titulo", form.titulo);
    fd.append("resumen", form.resumen || "");
    fd.append("cuerpo_md", form.cuerpo_md);
    fd.append("is_important", form.is_important ? "true" : "false");
    if (form.banner_start) fd.append("banner_start", form.banner_start);
    if (form.banner_end)   fd.append("banner_end", form.banner_end);
    imagenes.forEach(({ file }) => fd.append("imagenes", file));

    try {
      setSubmitting(true);
      await api.post("/noticias", fd, { headers: { "Content-Type": "multipart/form-data" } });
      // liberar objectURLs
      imagenes.forEach(i => i.url && URL.revokeObjectURL(i.url));
      setImagenes([]);
      // reset manteniendo los campos del banner en blanco y el flag apagado
      setForm({ titulo: "", resumen: "", cuerpo_md: "", is_important: false, banner_start: "", banner_end: "" });
      await cargar();
    } finally { setSubmitting(false); }
  };

  const publicar = async (id) => { await api.post(`/noticias/${id}/publish`); cargar(); };
  const despublicar = async (id) => { await api.post(`/noticias/${id}/unpublish`); cargar(); };
  const eliminar = async (id) => {
    if (!confirm("¿Eliminar esta noticia?")) return;
    await api.delete(`/noticias/${id}`);
    cargar();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Crear noticia</h3>
        <div className="grid gap-3">
          <input
            className="border p-2 rounded"
            placeholder="Título"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          />
          <input
            className="border p-2 rounded"
            placeholder="Resumen (opcional)"
            value={form.resumen}
            onChange={(e) => setForm({ ...form, resumen: e.target.value })}
          />
          <textarea
            className="border p-2 rounded"
            placeholder="Contenido (Markdown o HTML)"
            rows={6}
            value={form.cuerpo_md}
            onChange={(e) => setForm({ ...form, cuerpo_md: e.target.value })}
          />

          {/* Anuncio Importante */}
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <label className="inline-flex items-center gap-2 sm:col-span-1">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={form.is_important}
                onChange={(e) => setForm(f => ({ ...f, is_important: e.target.checked }))}
              />
              <span>Anuncio importante (banner en Home)</span>
            </label>

            <div className="sm:col-span-1">
              <label className="block text-xs text-neutral-600 mb-1">Desde (YYYY-MM-DD)</label>
              <input
                type="date"
                className="border p-2 rounded w-full"
                value={form.banner_start}
                onChange={(e)=> setForm(f => ({ ...f, banner_start: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs text-neutral-600 mb-1">Hasta (YYYY-MM-DD)</label>
              <input
                type="date"
                className="border p-2 rounded w-full"
                value={form.banner_end}
                onChange={(e)=> setForm(f => ({ ...f, banner_end: e.target.value }))}
              />
            </div>
          </div>

          {/* Uploader */}
          <div>
            <div
              onClick={openPicker}
              onDrop={onDrop}
              onDragOver={onDragOver}
              className="rounded-xl border-2 border-dashed p-5 text-center cursor-pointer hover:bg-slate-50 transition border-slate-300"
              title="Haz clic o arrastra imágenes (máx 3)"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-full p-3 bg-slate-100">
                  <Upload className="w-6 h-6 text-slate-600" />
                </div>
                <div className="text-sm">
                  <span className="font-semibold">Subir imágenes</span>{" "}
                  <span className="text-slate-500">(máx 3)</span>
                </div>
                <button type="button" className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm">
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

            {imagenes.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imagenes.map((img, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border">
                    <img src={img.url} alt={`preview-${idx}`} className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImg(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                      title="Quitar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-500">
              Formatos comunes (JPG/PNG/WebP). Tamaño sugerido &lt; 2MB c/u.
            </div>
          </div>

          <button
            onClick={crear}
            disabled={submitting}
            className="mt-1 px-5 py-2 rounded-md text-white font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? "Guardando..." : "Guardar como borrador"}
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Noticias</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Título</th>
              <th>Anuncio</th>
              <th>Rango</th>
              <th>Estado</th>
              <th>F. publicación (GT)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((n) => (
              <tr key={n.id} className="border-b">
                <td className="py-2">{n.titulo}</td>
                <td>{n.is_important ? <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700">IMPORTANTE</span> : "-"}</td>
                <td>{n.is_important ? `${n.banner_start || '—'} → ${n.banner_end || '—'}` : "-"}</td>
                <td>{n.estado}</td>
                <td>{n.publish_at || "-"}</td>
                <td className="text-right space-x-2 py-2">
                  {n.estado === "publicada" ? (
                    <button onClick={() => despublicar(n.id)} className="px-3 py-1 rounded bg-amber-600 text-white">Ocultar</button>
                  ) : (
                    <button onClick={() => publicar(n.id)} className="px-3 py-1 rounded bg-emerald-600 text-white">Publicar</button>
                  )}
                  <button onClick={() => eliminar(n.id)} className="px-3 py-1 rounded bg-rose-600 text-white">Eliminar</button>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-slate-500">Sin noticias</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
