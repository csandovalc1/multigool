// src/pages/Torneos.jsx
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import TorneoDetalleModal from '../widgets/TorneoDetalleModal';

const DIAS = [
  { v: 0, n: 'Domingo' },
  { v: 1, n: 'Lunes' },
  { v: 2, n: 'Martes' },
  { v: 3, n: 'Miércoles' },
  { v: 4, n: 'Jueves' },
  { v: 5, n: 'Viernes' },
  { v: 6, n: 'Sábado' },
];

function genSlots(open="07:00", close="22:00", step=60) {
  // devuelve [{inicio:"HH:MM", fin:"HH:MM"}] en pasos fijos
  const pad = (n) => String(n).padStart(2, "0");
  const toMin = (hhmm) => {
    const [h,m] = String(hhmm).split(":").map(Number);
    return h*60 + m;
  };
  const fromMin = (min) => `${pad(Math.floor(min/60))}:${pad(min%60)}`;
  const o = toMin(open), c = toMin(close);
  const out = [];
  for (let cur=o; cur+step<=c; cur+=step) {
    out.push({ inicio: fromMin(cur), fin: fromMin(cur+step) });
  }
  return out;
}

export default function Torneos() {
  const [torneos, setTorneos] = useState([]);
  const [canchas, setCanchas] = useState([]);

const [form, setForm] = useState({
  nombre: '',
  tipo_futbol: '5',
  tipo_torneo: 'liguilla',
  ida_vuelta: false,
  clasificados: 4,
  dia_semana: '',
  apertura: '07:00',
  cierre: '22:00',
  bloque_min: 60,
  franjas: [],
  canchas: [],
  start_date: '',
  costo_inscripcion_q: '' 
});



  const slotsDisponibles = useMemo(() => {
    const step = Number(form.bloque_min) > 0 ? Number(form.bloque_min) : 60;
    return genSlots(form.apertura, form.cierre, step);
  }, [form.apertura, form.cierre, form.bloque_min]);

  const [openNew, setOpenNew] = useState(false);

  const [sel, setSel] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    const [{ data: tor }, { data: ch }] = await Promise.all([
      api.get('/torneos'),
      api.get('/canchas/activas')
    ]);
    setTorneos(tor);
    setCanchas(ch);
  };

  useEffect(() => { cargar(); }, []);

  // helper: set toggle de franja
  const toggleFranja = (inicio, fin) => {
    setForm(f => {
      const key = `${inicio}-${fin}`;
      const selected = new Set(f.franjas.map(x => `${x.inicio}-${x.fin}`));
      if (selected.has(key)) {
        const next = f.franjas.filter(x => `${x.inicio}-${x.fin}` !== key);
        return { ...f, franjas: next };
      } else {
        const next = [...f.franjas, { inicio, fin }];
        next.sort((a,b)=>a.inicio.localeCompare(b.inicio));
        return { ...f, franjas: next };
      }
    });
  };


  const canchasFiltradas = useMemo(() => {
    const tipo = form.tipo_futbol === '5' ? 'F5' : 'F7';
    return (canchas || []).filter(c => c.tipo_futbol === tipo);
  }, [canchas, form.tipo_futbol]);

  const toggleCancha = (id) => {
    setForm(f => {
      const set = new Set(f.canchas);
      set.has(id) ? set.delete(id) : set.add(id);
      return { ...f, canchas: Array.from(set) };
    });
  };

  // 0..6 (Dom..Sáb) igual que tu select
function getWeekday(ymd) {
  if (!ymd) return null;
  const d = new Date(ymd + 'T00:00:00');
  return d.getDay();
}
function snapToWeekday(ymd, wanted) {
  if (!ymd || wanted === '' || wanted === null || wanted === undefined) return ymd;
  const d = new Date(ymd + 'T00:00:00');
  const diff = (Number(wanted) - d.getDay() + 7) % 7;
  if (diff === 0) return ymd;
  d.setDate(d.getDate() + diff);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

const [snapMsg, setSnapMsg] = useState('');


  const crear = async () => {
  const nombre = form.nombre.trim();
  if (!nombre) { alert('Por favor ingresa un nombre de torneo.'); return; }
  if (form.dia_semana === '' || form.dia_semana === null) { alert('Selecciona el día de la semana.'); return; }

  // ⬇️ exigir fecha solo si es liguilla
  if (form.tipo_torneo === 'liguilla' && !form.start_date) {
    alert('Selecciona la fecha de inicio.');
    return;
  }

  if (!form.franjas.length) { alert('Selecciona al menos una franja (apachando chips).'); return; }
  if (!form.canchas.length) { alert('Selecciona al menos una cancha.'); return; }

  try {
    setGuardando(true);
await api.post('/torneos', {
  nombre,
  tipo_futbol: form.tipo_futbol,
  tipo_torneo: form.tipo_torneo,
  ida_vuelta: form.ida_vuelta,
  clasificados: form.tipo_torneo === 'liguilla' ? form.clasificados : 0,
  dia_semana: form.dia_semana,
  start_date: form.tipo_torneo === 'liguilla' ? form.start_date : null,
  franjas: form.franjas,
  canchas: form.canchas,
  dur_minutos_partido: Number(form.bloque_min || 60),
  costo_inscripcion_q: Number(form.costo_inscripcion_q || 0) 
});

setForm({
  nombre: '',
  tipo_futbol: '5',
  tipo_torneo: 'liguilla',
  ida_vuelta: false,
  clasificados: 4,
  dia_semana: '',
  apertura: '07:00',
  cierre: '22:00',
  bloque_min: 60,
  franjas: [],
  canchas: [],
  start_date: '',
  costo_inscripcion_q: ''  
});
    setSnapMsg('');
    await cargar();
    setOpenNew(false);
  } catch (e) {
    alert(e?.response?.data?.error || 'No se pudo crear el torneo');
  } finally {
    setGuardando(false);
  }
};



  const nombreVacio = form.nombre.trim().length === 0;

  const eliminarTorneo = async (id, nombre) => {
    if (!confirm(`¿Eliminar el torneo "${nombre}"? Esta acción es permanente.`)) return;
    try {
      await api.delete(`/torneos/${id}`);
      await cargar();
    } catch (e) {
      alert(e?.response?.data?.error || 'No se pudo eliminar el torneo');
    }
  };

  return (
    <div className="space-y-6">
      {/* Crear (acordeón) */}
      <div className="bg-white p-4 rounded-xl shadow">
        <button
          onClick={() => setOpenNew((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded border hover:bg-slate-50"
          title={openNew ? "Ocultar" : "Nuevo torneo"}
        >
          <span className="font-semibold">Nuevo torneo</span>
          <span className="text-sm text-slate-500">{openNew ? "▲" : "▼"}</span>
        </button>

        {/* Contenido colapsable */}
        <div className={`${openNew ? "mt-4" : "hidden"}`}>
          <div className="grid md:grid-cols-5 gap-2 items-center">
            <input
              className="border p-2 rounded"
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <select
              className="border p-2 rounded"
              value={form.tipo_futbol}
              onChange={(e) => setForm({ ...form, tipo_futbol: e.target.value, canchas: [] })}
            >
              <option value="5">Fútbol 5</option>
              <option value="7">Fútbol 7</option>
            </select>
            <select
  className="border p-2 rounded"
  value={form.tipo_torneo}
  onChange={(e) => {
    const v = e.target.value;
    setForm((f) => ({
      ...f,
      tipo_torneo: v,
      ida_vuelta: v === 'liguilla' ? f.ida_vuelta : false,
      // ⬇️ si cambias a eliminación, escondemos/limpiamos la fecha
      start_date: v === 'eliminacion' ? '' : f.start_date
    }));
    // opcional: limpiar mensaje de snap al cambiar tipo
    setSnapMsg('');
  }}
>
  <option value="liguilla">Liguilla</option>
  <option value="eliminacion">Eliminación</option>
</select>


{form.tipo_torneo === 'liguilla' && (
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={form.ida_vuelta}
      onChange={(e) => setForm({ ...form, ida_vuelta: e.target.checked })}
    />
    Ida/Vuelta
  </label>
)}
            {form.tipo_torneo === 'liguilla' && (
              <label className="flex flex-col text-sm text-slate-600">
                Clasificados a eliminatoria
                <input
                  type="number"
                  className="border p-2 rounded mt-1"
                  value={form.clasificados}
                  onChange={(e) => setForm({ ...form, clasificados: Number(e.target.value) })}
                />
              </label>
            )}
          </div>

          <label className="flex flex-col text-sm text-slate-600">
  Costo de inscripción por equipo (Q)
  <input
    type="number"
    className="border p-2 rounded mt-1"
    min="0"
    step="0.01"
    placeholder="0.00"
    value={form.costo_inscripcion_q}
    onChange={(e) => setForm({ ...form, costo_inscripcion_q: e.target.value })}
  />
</label>


          {/* Día de semana */}
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            <label className="text-sm">
              <div className="text-slate-600 mb-1">Día de la semana</div>
              <select
                className="border p-2 rounded w-full"
                value={form.dia_semana}
                onChange={(e) => {
  const v = e.target.value === '' ? '' : Number(e.target.value);
  setForm(f => {
    if (!f.start_date || v === '' || v === null) return { ...f, dia_semana: v };
    const wDate = getWeekday(f.start_date);
    if (wDate === v) return { ...f, dia_semana: v }; // ya coincide
    const snapped = snapToWeekday(f.start_date, v);
    setSnapMsg(`Ajustado automáticamente al ${DIAS[v].n} (${snapped}).`);
    return { ...f, dia_semana: v, start_date: snapped };
  });
}}

              >
                <option value="">(Selecciona)</option>
                {DIAS.map(d => <option key={d.v} value={d.v}>{d.n}</option>)}
              </select>
            </label>
          </div>

    {form.tipo_torneo === 'liguilla' && (
  <div className="mt-4 grid md:grid-cols-3 gap-3">
    <label className="text-sm">
      <div className="text-slate-600 mb-1">Fecha de inicio</div>
      <input
        type="date"
        className="border p-2 rounded w-full"
        value={form.start_date}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) {
            setForm(f => ({ ...f, start_date: '' }));
            setSnapMsg('');
            return;
          }
          if (form.dia_semana === '' || form.dia_semana === null) {
            setForm(f => ({ ...f, start_date: raw }));
            setSnapMsg('');
            return;
          }
          const wSel = Number(form.dia_semana);
          const wRaw = getWeekday(raw);
          if (wRaw !== wSel) {
            const snapped = snapToWeekday(raw, wSel);
            setForm(f => ({ ...f, start_date: snapped }));
            setSnapMsg(`Ajustado automáticamente al ${DIAS[wSel].n} (${snapped}).`);
          } else {
            setForm(f => ({ ...f, start_date: raw }));
            setSnapMsg('');
          }
        }}
        disabled={form.dia_semana === '' || form.dia_semana === null}
        title={form.dia_semana === '' ? 'Primero selecciona el día de la semana' : 'Elige la fecha de inicio'}
      />
      {snapMsg && <div className="text-xs text-amber-700 mt-1">{snapMsg}</div>}
      {form.dia_semana === '' && (
        <div className="text-xs text-slate-500 mt-1">Selecciona primero el día de la semana.</div>
      )}
    </label>
  </div>
)}



                    {/* Canchas */}
          <div className="mt-4">
            <h4 className="font-semibold mb-1">Canchas disponibles para el torneo</h4>
            <p className="text-xs text-slate-500 mb-2">
              Mostrando canchas de tipo {form.tipo_futbol === '5' ? 'F5' : 'F7'}.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {canchasFiltradas.map(c => (
                <label key={c.id} className="flex items-center gap-2 border rounded p-2">
                  <input
                    type="checkbox"
                    checked={form.canchas.includes(c.id)}
                    onChange={() => toggleCancha(c.id)}
                  />
                  <span>{c.nombre}</span>
                </label>
              ))}
              {canchasFiltradas.length === 0 && (
                <div className="text-sm text-slate-500">No hay canchas activas para este tipo.</div>
              )}
            </div>
          </div>

          {/* Horario base y bloque */}
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            <label className="text-sm">
              <div className="text-slate-600 mb-1">Apertura</div>
              <input
                type="time"
                className="border p-2 rounded w-full"
                value={form.apertura}
                onChange={(e)=>setForm({...form, apertura: e.target.value})}
              />
            </label>
            <label className="text-sm">
              <div className="text-slate-600 mb-1">Cierre</div>
              <input
                type="time"
                className="border p-2 rounded w-full"
                value={form.cierre}
                onChange={(e)=>setForm({...form, cierre: e.target.value})}
              />
            </label>
            <label className="text-sm">
              <div className="text-slate-600 mb-1">Bloque (min)</div>
              <input
                type="number"
                className="border p-2 rounded w-full"
                min={15}
                step={15}
                value={form.bloque_min}
                onChange={(e)=>{
                  const v = Number(e.target.value || 60);
                  // 2) si cambia el bloque, limpiamos las franjas seleccionadas
                  setForm(f => ({ ...f, bloque_min: v, franjas: [] }));
                }}
              />
            </label>
          </div>

{/* Franjas (chips) */}
<div className="mt-4">
  <div className="flex items-center justify-between mb-2">
    <h4 className="font-semibold">Franjas horarias del torneo</h4>
    <span className="text-xs text-slate-500">
      {form.dia_semana === '' ? 'Selecciona el día' : 'Click para marcar/desmarcar'}
    </span>
  </div>

  {form.dia_semana === '' ? (
    <div className="p-3 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
      Primero selecciona el día de la semana.
    </div>
  ) : slotsDisponibles.length === 0 ? (
    <div className="p-3 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
      No hay horarios en el rango seleccionado (apertura/cierre).
    </div>
  ) : (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="p-3 pt-2">
        <div className="mt-2 flex flex-wrap gap-2">
          {slotsDisponibles.map((s) => {
            const active = form.franjas.some(f => f.inicio===s.inicio && f.fin===s.fin);
            return (
              <button
                key={`${s.inicio}-${s.fin}`}
                onClick={()=>toggleFranja(s.inicio, s.fin)}
                className={`px-3 py-1 rounded-full border text-sm font-medium
                  ${active ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-neutral-50'}`}
                title={`${s.inicio} — ${s.fin}`}
              >
                {s.inicio} — {s.fin}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-600">
          Seleccionadas: {form.franjas.length
            ? form.franjas.map(f=>`${f.inicio}-${f.fin}`).join(', ')
            : 'ninguna'}
        </div>
      </div>
    </div>
  )}
</div>





          {/* Acciones */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={crear}
              disabled={guardando || nombreVacio}
              className={`px-4 py-2 rounded text-white ${(!guardando && !nombreVacio) ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-400 cursor-not-allowed'}`}
              title={nombreVacio ? 'Ingresa un nombre' : 'Crear torneo'}
            >
              Crear
            </button>
            {nombreVacio && (
              <span className="text-xs text-rose-600">* El nombre es obligatorio</span>
            )}
          </div>
        </div>
      </div>

      {/* listado */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Torneos</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th>Nombre</th>
              <th>Tipo</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {torneos.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2">{t.nombre}</td>
                <td>
                  F{t.tipo_futbol} - {t.tipo_torneo}
                </td>
                <td className="text-right space-x-2 py-2">
                  <button
                    onClick={() => setSel(t)}
                    className="px-3 py-1 bg-slate-700 text-white rounded"
                  >
                    Ver detalle
                  </button>
                  <button
                    onClick={() => eliminarTorneo(t.id, t.nombre)}
                    className="px-3 py-1 bg-rose-600 text-white rounded"
                    title="Eliminar torneo"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {torneos.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-slate-500">
                  No hay torneos aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sel && (
        <TorneoDetalleModal
          torneo={sel}
          onClose={() => {
            setSel(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}
