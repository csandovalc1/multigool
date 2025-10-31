// src/pages/AcademiaAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import Modal from "../components/Modal.jsx";

function Line({ children }) {
  return (
    <div className="group grid grid-cols-12 gap-3 items-center py-3 border-b hover:bg-neutral-50 transition-colors">
      {children}
    </div>
  );
}

const btnBase = "cursor-pointer rounded border transition-colors duration-150";
const btn = `${btnBase} px-3 py-1.5 hover:bg-slate-50 hover:border-slate-300`;
const btnSm = `${btnBase} px-2 py-1 hover:bg-slate-50 hover:border-slate-300`;
const btnDanger = `${btnBase} px-2 py-1 text-rose-600 hover:bg-rose-50 hover:border-rose-300`;

// ===== Helpers de exportación =====
function to2(n){ return String(n).padStart(2, "0"); }
function parseYMD(ymd){
  if(!ymd) return null;
  const [y,m,d] = ymd.split("-").map(Number);
  return { y, m, d };
}
function calcEdadFromYMD(ymd){
  const p = parseYMD(ymd);
  if(!p) return null;
  const hoy = new Date();
  let e = hoy.getFullYear() - p.y;
  const before = (hoy.getMonth()+1 < p.m) || ((hoy.getMonth()+1===p.m) && (hoy.getDate() < p.d));
  if(before) e--;
  return e;
}
function alumnosToRows(list){
  return list.map(a => ({
    "Nombre": `${a.nombres || ""} ${a.apellidos || ""}`.trim(),
    "Nacimiento": a.fecha_nacimiento || "-",
    "Edad": calcEdadFromYMD(a.fecha_nacimiento) ?? "-",
    "Categoría": a.categoria_nombre || "—",
    "Teléfono": a.telefono || "—",
  }));
}
function downloadBlob(filename, mime, content){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
async function exportExcel(rows){
  // 1) Intento XLSX real
  try{
    const XLSX = await import(/* webpackChunkName: "xlsx" */ "xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alumnos");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(`alumnos_${Date.now()}.xlsx`, 
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out);
    return;
  }catch(e){
    // 2) Fallback CSV (abre perfecto en Excel)
    const headers = Object.keys(rows[0] || {Nombre:"",Nacimiento:"",Edad:"",Categoría:"",Teléfono:""});
    const csv = [headers.join(",")]
      .concat(rows.map(r => headers.map(h => {
        const v = String(r[h] ?? "");
        // escapa comas y comillas
        const need = v.includes(",") || v.includes('"') || v.includes("\n");
        return need ? `"${v.replace(/"/g,'""')}"` : v;
      }).join(",")))
      .join("\n");
    downloadBlob(`alumnos_${Date.now()}.csv`, "text/csv;charset=utf-8", csv);
  }
}
async function exportPDF(rows){
  // 1) Intento jsPDF + autoTable
  try{
    const jsPDFmod = await import(/* webpackChunkName: "jspdf" */ "jspdf");
    const { default: jsPDF } = jsPDFmod;
    const autoTable = (await import(/* webpackChunkName: "jspdf-autotable" */ "jspdf-autotable")).default;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Listado de Alumnos", 14, 18);
    const body = rows.map(r => [r["Nombre"], r["Nacimiento"], r["Edad"], r["Categoría"], r["Teléfono"]]);
    autoTable(doc, {
      head: [["Nombre","Nacimiento","Edad","Categoría","Teléfono"]],
      body,
      startY: 24,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [15,23,42] } // slate-900
    });
    doc.save(`alumnos_${Date.now()}.pdf`);
    return;
  }catch(e){
    // 2) Fallback: ventana imprimible (usuario guarda como PDF)
    const html = `
      <html>
      <head>
        <title>Alumnos</title>
        <style>
          body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding:16px; }
          h1{ font-size:18px; margin:0 0 12px; }
          table{ width:100%; border-collapse: collapse; font-size:12px; }
          th, td{ border:1px solid #ddd; padding:6px 8px; }
          th{ background:#111827; color:#fff; text-align:left; }
          tr:nth-child(even){ background:#f9fafb; }
        </style>
      </head>
      <body>
        <h1>Listado de Alumnos</h1>
        <table>
          <thead>
            <tr><th>Nombre</th><th>Nacimiento</th><th>Edad</th><th>Categoría</th><th>Teléfono</th></tr>
          </thead>
          <tbody>
            ${rows.map(r=>`<tr>
              <td>${r["Nombre"]}</td>
              <td>${r["Nacimiento"]}</td>
              <td>${r["Edad"]}</td>
              <td>${r["Categoría"]}</td>
              <td>${r["Teléfono"]}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <script>window.print();</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if(w){ w.document.open(); w.document.write(html); w.document.close(); }
  }
}


export default function AcademiaAdmin() {
  const [tab, setTab] = useState("categorias");
  const [cats, setCats] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [canchas, setCanchas] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros/listado alumnos
  const [q, setQ] = useState("");
  const [filterCatId, setFilterCatId] = useState(null);

  const DOW = useMemo(() => [
    { v: 1, t: "Lun" }, { v: 2, t: "Mar" }, { v: 3, t: "Mié" },
    { v: 4, t: "Jue" }, { v: 5, t: "Vie" }, { v: 6, t: "Sáb" }, { v: 7, t: "Dom" }
  ], []);
  const dayName = (v) => (DOW.find(d=>d.v===v)?.t ?? v);
  const diasTexto = (arr=[]) => [...arr].sort((a,b)=>a-b).map(dayName).join(" · ");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, a, k] = await Promise.all([
        api.get("/academia/categorias"),
        api.get("/academia/alumnos"),
        api.get("/canchas")
      ]);
      setCats(c.data || []);
      setAlumnos(a.data || []);
      setCanchas(k.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { loadAll(); }, []);

  // ===== CATEGORÍA =====
  const [openCat, setOpenCat] = useState(false);
  const [catForm, setCatForm] = useState({
    id: null,
    nombre: "",
    edad_min: 4,
    edad_max: 18,
    cupo: 20,
    mensualidad_q: 175,
    dias: [2,4],
    hora_inicio: "18:00",
    hora_fin: "19:00",
    cancha_id: null,
  });

  const saveCat = async () => {
    if (!catForm.nombre.trim()) return;
    const payload = {
      nombre: catForm.nombre,
      edad_min: Number(catForm.edad_min),
      edad_max: Number(catForm.edad_max),
      cupo: catForm.cupo === "" || catForm.cupo == null ? null : Number(catForm.cupo),
      mensualidad_q: Number(catForm.mensualidad_q),
      dias: Array.isArray(catForm.dias) ? catForm.dias : [],
      hora_inicio: catForm.hora_inicio || null,
      hora_fin: catForm.hora_fin || null,
      cancha_id: catForm.cancha_id == null || catForm.cancha_id === "" ? null : Number(catForm.cancha_id),
    };
    if (catForm.id) await api.put(`/academia/categorias/${catForm.id}`, payload);
    else await api.post(`/academia/categorias`, payload);
    setOpenCat(false); await loadAll();
  };

  // ===== ALUMNO =====
  const [openAl, setOpenAl] = useState(false);
  const [alMode, setAlMode] = useState("create"); // 'create' | 'edit'
  const years = useMemo(() => Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - i), []);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const daysFor = (y, m) => new Date(y || 2000, (m || 1), 0).getDate();
  const [alForm, setAlForm] = useState({
    id: null,
    nombres: "", apellidos: "", y: null, m: null, d: null, telefono: "",
  });

  function computeEdad(y, m, d) {
    if (!y || !m || !d) return null;
    const hoy = new Date();
    let e = hoy.getFullYear() - y;
    const before = hoy.getMonth()+1 < m || (hoy.getMonth()+1===m && hoy.getDate() < d);
    if (before) e--;
    return e;
  }

  const [alDerived, setAlDerived] = useState({ edad: null, categoria_id: null, categoria_nombre: null });
  useEffect(() => {
    const y = alForm.y ? Number(alForm.y) : null;
    const m = alForm.m ? Number(alForm.m) : null;
    const d = alForm.d ? Number(alForm.d) : null;

    if (y && m && d) {
      const edad = computeEdad(y, m, d);
      const cat = cats.find(k => edad >= k.edad_min && edad <= k.edad_max);
      setAlDerived({
        edad,
        categoria_id: cat?.id ?? null,
        categoria_nombre: cat?.nombre ?? null
      });
    } else {
      setAlDerived({ edad: null, categoria_id: null, categoria_nombre: null });
    }
  }, [alForm.y, alForm.m, alForm.d, cats]);

  const openAlumnoCreate = () => {
    setAlMode('create');
    setAlForm({ id:null, nombres:"", apellidos:"", y:null, m:null, d:null, telefono:"" });
    setOpenAl(true);
  };

  const openAlumnoEdit = (a) => {
    let y=null,m=null,d=null;
    if (a.fecha_nacimiento) {
      const [yy,mm,dd] = a.fecha_nacimiento.split('-').map(Number);
      y=yy; m=mm; d=dd;
    }
    setAlMode('edit');
    setAlForm({
      id: a.id,
      nombres: a.nombres || "",
      apellidos: a.apellidos || "",
      y, m, d,
      telefono: a.telefono || ""
    });
    setOpenAl(true);
  };

  const saveAl = async () => {
    if (!alForm.nombres.trim()) return;

    const y = alForm.y ? Number(alForm.y) : null;
    const m = alForm.m ? Number(alForm.m) : null;
    const d = alForm.d ? Number(alForm.d) : null;

    const fecha_nacimiento = (y && m && d)
      ? `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`
      : null;

    let categoria_id = null;
    if (fecha_nacimiento) {
      const edad = computeEdad(y, m, d);
      const cat = cats.find(k => edad >= k.edad_min && edad <= k.edad_max);
      categoria_id = cat?.id ?? null;
    }

    const payload = {
      nombres: alForm.nombres,
      apellidos: alForm.apellidos || null,
      telefono: alForm.telefono || null,
      fecha_nacimiento,
      categoria_id,
    };

    if (alMode === 'edit' && alForm.id) {
      await api.put(`/academia/alumnos/${alForm.id}`, payload);
    } else {
      await api.post("/academia/alumnos", payload);
    }

    setOpenAl(false);
    await loadAll();
  };

  // alumnos filtrados
  const alumnosFiltrados = useMemo(() => {
    const qnorm = q.trim().toLowerCase();
    return alumnos
      .filter(a => (filterCatId ? a.categoria_id === filterCatId : true))
      .filter(a => {
        if (!qnorm) return true;
        const full = `${a.nombres || ""} ${a.apellidos || ""}`.toLowerCase();
        return full.includes(qnorm);
      });
  }, [alumnos, q, filterCatId]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex gap-2">
          {["categorias", "alumnos"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded border text-sm ${btnBase} hover:bg-neutral-50 ${tab === t ? "bg-blue-50 border-blue-300" : "bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CATEGORÍAS ===== */}
      {tab === "categorias" && (
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Categorías</h3>
            <button
              className={btn}
              onClick={() => {
                setCatForm({ id:null, nombre:"", edad_min:4, edad_max:18, cupo:20, mensualidad_q:175, dias:[2,4], hora_inicio:"18:00", hora_fin:"19:00", cancha_id:null });
                setOpenCat(true);
              }}
            >
              Nueva categoría
            </button>
          </div>

          {/* Encabezados — amplié “Horario” a 3 columnas */}
          <div className="grid grid-cols-12 text-xs uppercase tracking-wide text-neutral-500 border-b px-2 py-2">
            <div className="col-span-3">Nombre</div>
            <div className="col-span-2">Edades</div>
            <div className="col-span-1">Cupo</div>
            <div className="col-span-2">Mensualidad</div>
            <div className="col-span-3">Horario</div>
            <div className="col-span-1 text-right">Acciones</div>
          </div>

          {cats.map((c) => (
            <Line key={c.id}>
              <div className="col-span-3">
                <div className="font-medium">{c.nombre}</div>
              </div>

              <div className="col-span-2">{c.edad_min}–{c.edad_max}</div>

              <div className="col-span-1">{c.cupo ?? "-"}</div>

              <div className="col-span-2">Q {Number(c.mensualidad_q || 0).toFixed(2)}</div>

              {/* Horario en DOS líneas dentro de la misma celda */}
              <div className="col-span-3 leading-tight">
                {c.dias?.length ? (
                  <>
                    <div className="text-sm">{diasTexto(c.dias)}</div>
                    <div className="text-xs text-neutral-500">
                      {(c.hora_inicio ?? "—")}–{(c.hora_fin ?? "—")}
                      {c.cancha_nombre ? ` · ${c.cancha_nombre}` : ""}
                    </div>
                  </>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </div>

              <div className="col-span-1 text-right flex justify-end gap-2">
                <button
                  className={btnSm}
                  onClick={() => {
                    setCatForm({
                      id: c.id, nombre: c.nombre, edad_min: c.edad_min, edad_max: c.edad_max, cupo: c.cupo,
                      mensualidad_q: c.mensualidad_q, dias: c.dias || [], hora_inicio: c.hora_inicio || "18:00",
                      hora_fin: c.hora_fin || "19:00", cancha_id: c.cancha_id ?? null
                    });
                    setOpenCat(true);
                  }}
                >
                  Editar
                </button>
                <button
                  className={btnSm}
                  onClick={()=>{
                    setFilterCatId(c.id);
                    setTab('alumnos');
                  }}
                >
                  Ver alumnos
                </button>
                <button
                  className={btnDanger}
                  onClick={async ()=>{
                    if (confirm("¿Eliminar categoría?")) { await api.delete(`/academia/categorias/${c.id}`); await loadAll(); }
                  }}
                >
                  Eliminar
                </button>
              </div>
            </Line>
          ))}
        </div>
      )}

      {/* ===== ALUMNOS ===== */}
      {tab === "alumnos" && (
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Alumnos</h3>
            <div className="flex flex-wrap gap-2">
  <select
    className="border rounded px-2 py-1 text-sm hover:border-slate-400 transition-colors"
    value={filterCatId ?? ""}
    onChange={(e)=> setFilterCatId(e.target.value === "" ? null : Number(e.target.value))}
  >
    <option value="">Todas las categorías</option>
    {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
  </select>

  <input
    className="border rounded px-3 py-1.5 text-sm hover:border-slate-400 transition-colors"
    placeholder="Buscar por nombre/apellido"
    value={q}
    onChange={(e)=> setQ(e.target.value)}
  />

  <button className={btn} onClick={() => { setQ(""); setFilterCatId(null); }} title="Limpiar filtros">
    Limpiar
  </button>

  <button className={btn} onClick={openAlumnoCreate}>
    Nuevo alumno
  </button>

  {/* === Exportar === */}
  <button
    className={btn}
    onClick={async ()=>{
      const rows = alumnosToRows(alumnosFiltrados);
      if(rows.length === 0){ alert("No hay alumnos para exportar."); return; }
      await exportExcel(rows);
    }}
    title="Exportar a Excel"
  >
    Exportar Excel
  </button>

  <button
    className={btn}
    onClick={async ()=>{
      const rows = alumnosToRows(alumnosFiltrados);
      if(rows.length === 0){ alert("No hay alumnos para exportar."); return; }
      await exportPDF(rows);
    }}
    title="Exportar a PDF"
  >
    Exportar PDF
  </button>
</div>

          </div>

          <div className="grid grid-cols-12 text-xs uppercase tracking-wide text-neutral-500 border-b px-2 py-2">
            <div className="col-span-4">Nombre</div>
            <div className="col-span-3">Nacimiento</div>
            <div className="col-span-3">Categoría</div>
            <div className="col-span-2 text-right">Acciones</div>
          </div>

          {alumnosFiltrados.map((a) => (
            <Line key={a.id}>
              <div className="col-span-4">{a.nombres} {a.apellidos}</div>
              <div className="col-span-3">{a.fecha_nacimiento || "-"}</div>
              <div className="col-span-3">{a.categoria_nombre || "—"}</div>
              <div className="col-span-2 text-right flex justify-end gap-2">
                <button className={btnSm} onClick={() => openAlumnoEdit(a)}>Editar</button>
                <button
                  className={btnDanger}
                  onClick={async ()=>{
                    if (confirm("¿Eliminar alumno?")) { await api.delete(`/academia/alumnos/${a.id}`); await loadAll(); }
                  }}
                >
                  Eliminar
                </button>
              </div>
            </Line>
          ))}
        </div>
      )}

      {/* ===== Modal Categoría ===== */}
      <Modal open={openCat} onClose={() => setOpenCat(false)} title="Guardar categoría" panelClass="max-w-md">
        <div className="grid gap-3 text-sm">
          <label>
            <div className="text-xs text-neutral-600 mb-1">Nombre</div>
            <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" value={catForm.nombre}
              onChange={(e)=>setCatForm({...catForm, nombre:e.target.value})}/>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label><div className="text-xs text-neutral-600 mb-1">Edad mínima</div>
              <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" type="number" value={catForm.edad_min}
                onChange={(e)=>setCatForm({...catForm, edad_min:Number(e.target.value)})}/>
            </label>
            <label><div className="text-xs text-neutral-600 mb-1">Edad máxima</div>
              <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" type="number" value={catForm.edad_max}
                onChange={(e)=>setCatForm({...catForm, edad_max:Number(e.target.value)})}/>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label><div className="text-xs text-neutral-600 mb-1">Cupo</div>
              <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" type="number" placeholder="(opcional)" value={catForm.cupo ?? ""}
                onChange={(e)=>setCatForm({...catForm, cupo: e.target.value===""?null:Number(e.target.value)})}/>
            </label>
            <label><div className="text-xs text-neutral-600 mb-1">Mensualidad (Q)</div>
              <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" type="number" step="0.01" value={catForm.mensualidad_q}
                onChange={(e)=>setCatForm({...catForm, mensualidad_q:Number(e.target.value)})}/>
            </label>
          </div>

          <div>
            <div className="text-xs text-neutral-600 mb-1">Días de entreno</div>
            <div className="flex flex-wrap gap-2">
              {DOW.map(d=>(
                <label key={d.v} className={`px-3 py-1.5 rounded border ${catForm.dias.includes(d.v) ? "bg-blue-50 border-blue-300" : "hover:bg-slate-50 hover:border-slate-300"} cursor-pointer transition-colors`}>
                  <input type="checkbox" className="mr-2" checked={catForm.dias.includes(d.v)}
                    onChange={(e)=>{
                      const on = e.target.checked;
                      setCatForm(s=>{
                        const set = new Set(s.dias);
                        on? set.add(d.v) : set.delete(d.v);
                        return {...s, dias:[...set].sort()};
                      });
                    }}/>
                  {d.t}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label><div className="text-xs text-neutral-600 mb-1">Hora inicio</div>
              <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" type="time" value={catForm.hora_inicio}
                onChange={(e)=>setCatForm({...catForm, hora_inicio:e.target.value})}/>
            </label>
            <label><div className="text-xs text-neutral-600 mb-1">Hora fin</div>
              <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" type="time" value={catForm.hora_fin}
                onChange={(e)=>setCatForm({...catForm, hora_fin:e.target.value})}/>
            </label>
          </div>

          <label>
            <div className="text-xs text-neutral-600 mb-1">Cancha</div>
            <select className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" value={catForm.cancha_id ?? ""}
              onChange={(e)=>setCatForm({...catForm, cancha_id: e.target.value===""?null:Number(e.target.value)})}>
              <option value="">(Sin asignar)</option>
              {canchas.map(k=> <option key={k.id} value={k.id}>{k.nombre}</option>)}
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button className={btn} onClick={()=>setOpenCat(false)}>Cancelar</button>
            <button className="cursor-pointer px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99] transition-colors" onClick={saveCat}>
              Guardar
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== Modal Alumno ===== */}
      <Modal
        open={openAl}
        onClose={()=>setOpenAl(false)}
        title={alMode === 'edit' ? "Editar alumno" : "Nuevo alumno"}
        panelClass="max-w-md"
      >
        <div className="grid gap-3 text-sm">
          <label>
            <div className="text-xs text-neutral-600 mb-1">Nombres *</div>
            <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" value={alForm.nombres}
              onChange={(e)=>setAlForm({...alForm, nombres:e.target.value})}/>
          </label>
          <label>
            <div className="text-xs text-neutral-600 mb-1">Apellidos</div>
            <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" value={alForm.apellidos || ""}
              onChange={(e)=>setAlForm({...alForm, apellidos:e.target.value})}/>
          </label>

          <div>
            <div className="text-xs text-neutral-600 mb-1">Fecha de nacimiento</div>
            <div className="grid grid-cols-3 gap-2">
              <select
                className="border rounded px-2 py-2 hover:border-slate-400 transition-colors"
                value={alForm.d || ""}
                onChange={(e)=> setAlForm(s => ({ ...s, d: Number(e.target.value) || null }))}
              >
                <option value="">Día</option>
                {Array.from({ length: daysFor(alForm.y, alForm.m) }, (_, i) => i + 1).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <select
                className="border rounded px-2 py-2 hover:border-slate-400 transition-colors"
                value={alForm.m || ""}
                onChange={(e)=>{
                  const newM = Number(e.target.value) || null;
                  setAlForm(s => {
                    let newD = s.d;
                    const max = daysFor(s.y, newM);
                    if (newD && newD > max) newD = max;
                    return { ...s, m: newM, d: newD };
                  });
                }}
              >
                <option value="">Mes</option>
                {months.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select
                className="border rounded px-2 py-2 hover:border-slate-400 transition-colors"
                value={alForm.y || ""}
                onChange={(e)=>{
                  const newY = Number(e.target.value) || null;
                  setAlForm(s => {
                    let newD = s.d;
                    const max = daysFor(newY, s.m);
                    if (newD && newD > max) newD = max;
                    return { ...s, y: newY, d: newD };
                  });
                }}
              >
                <option value="">Año</option>
                {years.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="mt-2 text-xs text-neutral-600">
              {alDerived.edad == null
                ? "Edad: —   Categoría: —"
                : `Edad: ${alDerived.edad}   Categoría: ${alDerived.categoria_nombre || "(sin categoría)"}`
              }
            </div>
          </div>

          <label>
            <div className="text-xs text-neutral-600 mb-1">Teléfono</div>
            <input className="border rounded px-3 py-2 w-full hover:border-slate-400 transition-colors" value={alForm.telefono || ""}
              onChange={(e)=>setAlForm({...alForm, telefono:e.target.value})}/>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button className={btn} onClick={()=>setOpenAl(false)}>Cancelar</button>
            <button className="cursor-pointer px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99] transition-colors" onClick={saveAl}>
              {alMode === 'edit' ? "Guardar cambios" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
