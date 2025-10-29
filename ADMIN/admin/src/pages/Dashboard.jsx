import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  format,
  startOfMonth, endOfMonth,
  parseISO, startOfWeek, subDays, subWeeks, subMonths
} from "date-fns";

/** UI helpers */
function Labeled({label, children}) {
  return (
    <label className="text-sm">
      <div className="text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

// 1) Helpers para rango del mes actual (arriba del componente o donde prefieras)
function currentMonthRange() {
  const now = new Date();
  const d = format(startOfMonth(now), "yyyy-MM-dd");
  const h = format(endOfMonth(now), "yyyy-MM-dd");
  return { d, h };
}

function Section({ title, controls, onExport, children }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button
          className="px-3 py-1.5 rounded border hover:bg-slate-50 text-sm cursor-pointer"
          onClick={onExport}
        >
          Exportar PDF
        </button>
      </div>
      {controls}
      {children}
    </div>
  );
}

/** PDF helper */
function exportPDF({ title, head, rows, subtitle, footerNote }) {
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  if (subtitle) { doc.setFontSize(10); doc.text(subtitle, 40, 58); }
  autoTable(doc, { head:[head], body:rows, startY: subtitle?74:60, styles:{fontSize:10, cellPadding:6}, headStyles:{fillColor:[15,23,42]} });
  if (footerNote) { const y = doc.lastAutoTable?.finalY || 80; doc.setFontSize(9); doc.text(footerNote, 40, y+24); }
  const safe = title.replace(/[^\w\s-]/g,'').replace(/\s+/g,'_');
  doc.save(`${safe}.pdf`);
}

/** Calcula rango (desde/hasta) alineado a la granularidad */
function calcRango({ hastaISO, gran, periods }) {
  const hastaDate = parseISO(hastaISO);

  if (gran === "day") {
    const desde = subDays(hastaDate, Math.max(0, periods - 1));
    return {
      desde: format(desde, "yyyy-MM-dd"),
      hasta: format(hastaDate, "yyyy-MM-dd")
    };
  }

  if (gran === "week") {
    // Alineamos HASTA al inicio de semana (lunes) para tomar semanas completas
    const endThisWeek = startOfWeek(hastaDate, { weekStartsOn: 1 });
    const desde = subWeeks(endThisWeek, Math.max(0, periods - 1));
    return {
      desde: format(desde, "yyyy-MM-dd"),
      hasta: format(endThisWeek, "yyyy-MM-dd")
    };
  }

  // month (default): HASTA = fin de mes, DESDE = (periods-1) meses atrás al inicio de mes
  const endThisMonth = endOfMonth(hastaDate);
  const startThisMonth = startOfMonth(hastaDate);
  const desde = subMonths(startThisMonth, Math.max(0, periods - 1));
  return {
    desde: format(desde, "yyyy-MM-dd"),
    hasta: format(endThisMonth, "yyyy-MM-dd")
  };
}

export default function Dashboard() {
  /** KPIs (MES ACTUAL) */
  const [kpiResMes, setKpiResMes] = useState(0);
  const [kpiTorMes, setKpiTorMes] = useState(0);
  const [kpiBalMes, setKpiBalMes] = useState(0);

  /** ======================
   * 1) Ingresos por reservas (por periodo)
   * ====================== */
  const [ingRes, setIngRes] = useState([]);
  const [resCtrl, setResCtrl] = useState(()=>{
    // HASTA alineado al fin de mes para 'month'
    const hasta = format(endOfMonth(new Date()), "yyyy-MM-dd");
    return {
      gran: "month",       // day|week|month
      periods: 2,          // empieza con 2 periodos
      tipo: "" ,           // "", "F5", "F7" (opcional)
      hasta
    };
  });

  const loadIngRes = async () => {
    const { desde, hasta } = calcRango({ hastaISO: resCtrl.hasta, gran: resCtrl.gran, periods: resCtrl.periods });
    const qp = new URLSearchParams();
    qp.set("gran", resCtrl.gran);
    qp.set("hasta", hasta);
    qp.set("desde", desde);
    if (resCtrl.tipo) qp.set("tipo", resCtrl.tipo);
    const { data } = await api.get(`/reportes/reservas/ingresos?${qp.toString()}`);
    setIngRes(data || []);
  };

  // recarga automática al cambiar gran/periods/tipo/hasta
  useEffect(()=>{ loadIngRes(); /* eslint-disable-next-line */ }, [resCtrl.gran, resCtrl.periods, resCtrl.tipo, resCtrl.hasta]);

  /** ======================
   * 2) Ingresos por torneos (por periodo)
   * ====================== */
  const [ingTorPeriodo, setIngTorPeriodo] = useState([]);
  const [torCtrl, setTorCtrl] = useState(()=>{
    const hasta = format(endOfMonth(new Date()), "yyyy-MM-dd");
    return {
      gran: "month",   // day|week|month
      periods: 2,      // empieza con 2
      tipo: "",        // "", "F5", "F7" (mapea a '5'|'7' en el backend)
      hasta
    };
  });

const loadIngTorneosPeriodo = async () => {
  const { desde, hasta } = calcRango({ hastaISO: torCtrl.hasta, gran: torCtrl.gran, periods: torCtrl.periods });
  const qp = new URLSearchParams();
  qp.set("gran", torCtrl.gran);
  qp.set("hasta", hasta);
  qp.set("desde", desde);
  if (torCtrl.tipo) qp.set("tipo", torCtrl.tipo);
  qp.set("criterio", "registro"); // 👈 explícito

  const { data } = await api.get(`/reportes/torneos/ingresos-periodo?${qp.toString()}`);
  setIngTorPeriodo(data || []);
};


  useEffect(()=>{ loadIngTorneosPeriodo(); /* eslint-disable-next-line */ }, [torCtrl.gran, torCtrl.periods, torCtrl.tipo, torCtrl.hasta]);

  /** ======================
   * 3) Heatmap de horarios (único con rango de fechas manual)
   * ====================== */
  const [heat, setHeat] = useState([]);
  const [heatCtrl, setHeatCtrl] = useState(()=>{
    const h = new Date();
    const desde = format(startOfMonth(h), "yyyy-MM-dd");
    const hasta = format(endOfMonth(h), "yyyy-MM-dd");
    return { desde, hasta };
  });

  const loadHeat = async () => {
    const qp = new URLSearchParams();
    qp.set("desde", heatCtrl.desde);
    qp.set("hasta", heatCtrl.hasta);
    const { data } = await api.get(`/reportes/reservas/heatmap?${qp.toString()}`);
    setHeat(data || []);
  };

  useEffect(()=>{ loadHeat(); /* eslint-disable-next-line */ }, [heatCtrl.desde, heatCtrl.hasta]);

  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const heatGrid = useMemo(()=>{
    const g = Array.from({length:7}, (_,d)=>({
      day: dias[d],
      hours: Array.from({length:24}, (_,h)=>({ h, cnt: 0 }))
    }));
    (heat||[]).forEach(r=>{
      const d = Math.max(0, Math.min(6, Number(r.weekday)));
      const h = Math.max(0, Math.min(23, Number(r.hour)));
      g[d].hours[h].cnt = Number(r.cnt||0);
    });
    return g;
  }, [heat]);

  /** ======================
   * 4) Proyección del mes actual
   * ====================== */
  const [proj, setProj] = useState({ mes:'', actual_q:0, proyeccion_q:0 });
  const loadProj = async () => {
    const { data } = await api.get(`/reportes/finanzas/proyeccion`);
    setProj(data || { mes:'', actual_q:0, proyeccion_q:0 });
  };

  /** Cargas iniciales + KPIs */
  useEffect(() => {
    (async () => {
      await Promise.all([loadIngRes(), loadIngTorneosPeriodo(), loadHeat(), loadProj()]);

      // ==== KPIs del mes actual ====
      const { d, h } = currentMonthRange();

      // Reservas del mes (usa el endpoint de ingresos por periodo)
      const { data: resMes } = await api.get(`/reportes/reservas/ingresos?gran=month&desde=${d}&hasta=${h}`);
      const reservasMesQ = (resMes || []).reduce((s, r) => s + Number(r.q_total || 0), 0);
      setKpiResMes(reservasMesQ);

// Torneos del mes (usa el endpoint por periodo con criterio=registro)
const { data: torMes } = await api.get(
  `/reportes/torneos/ingresos-periodo?gran=month&desde=${d}&hasta=${h}&criterio=registro`
);
const torneosMesQ = (torMes || []).reduce((s, r) => s + Number(r.q_total || 0), 0);
setKpiTorMes(torneosMesQ);


      // Balance del mes = reservasMes + torneosMes
      setKpiBalMes(reservasMesQ + torneosMesQ);
    })();
  }, []); // eslint-disable-line

  return (
    <div className="space-y-6">
      {/* KPIs (MES ACTUAL) */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-slate-500 text-sm">Ingresos reservas (mes actual)</div>
          <div className="text-2xl font-semibold">Q {kpiResMes.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-slate-500 text-sm">Ingresos torneos (mes actual)</div>
          <div className="text-2xl font-semibold">Q {kpiTorMes.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-slate-500 text-sm">Balance (mes actual)</div>
          <div className="text-2xl font-semibold">Q {(kpiBalMes).toFixed(2)}</div>
        </div>
      </div>

      {/* 1) Ingresos por periodo (Reservas) */}
      <Section
        title="Ingresos por periodo (Reservas)"
        controls={
          <div className="flex flex-wrap gap-3 items-end">
            <Labeled label="Tipo de fútbol">
              <select className="border p-2 rounded"
                value={resCtrl.tipo}
                onChange={e=>setResCtrl(s=>({ ...s, tipo: e.target.value }))}>
                <option value="">Todos</option>
                <option value="F5">F5</option>
                <option value="F7">F7</option>
              </select>
            </Labeled>
            <button
              className="px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
              onClick={()=>setResCtrl(s=>({ ...s, periods: s.periods + 1 }))}>
              Mostrar +1 {resCtrl.gran === 'day' ? 'día' : resCtrl.gran === 'week' ? 'semana' : 'mes'}
            </button>
            <button
              className="px-3 py-2 rounded border hover:bg-slate-50"
              onClick={()=>setResCtrl(s=>({ ...s, periods: 2 }))}>
              Reset a 2
            </button>
          </div>
        }
        onExport={()=>exportPDF({
          title: 'Ingresos por periodo (Reservas)',
          head: ['Periodo','Q Total'],
          rows: (ingRes||[]).map(r=>[r.periodo, Number(r.q_total||0).toFixed(2)]),
          subtitle: `Granularidad: ${resCtrl.gran} · Periodos: ${resCtrl.periods} · Hasta: ${resCtrl.hasta}${resCtrl.tipo ? ` · Tipo: ${resCtrl.tipo}` : ''}`,
          footerNote: 'Incluye estados: pagada y completada.'
        })}
      >
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={ingRes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="q_total" name="Q" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* 2) Ingresos por torneos (por periodo) */}
      <Section
        title="Ingresos por torneos (por periodo)"
        controls={
          <div className="flex flex-wrap gap-3 items-end">
            <Labeled label="Tipo de fútbol">
              <select className="border p-2 rounded"
                value={torCtrl.tipo}
                onChange={e=>setTorCtrl(s=>({ ...s, tipo: e.target.value }))}>
                <option value="">Todos</option>
                <option value="F5">F5</option>
                <option value="F7">F7</option>
              </select>
            </Labeled>
            <button
              className="px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
              onClick={()=>setTorCtrl(s=>({ ...s, periods: s.periods + 1 }))}>
              Mostrar +1 {torCtrl.gran === 'day' ? 'día' : torCtrl.gran === 'week' ? 'semana' : 'mes'}
            </button>
            <button
              className="px-3 py-2 rounded border hover:bg-slate-50"
              onClick={()=>setTorCtrl(s=>({ ...s, periods: 2 }))}>
              Reset a 2
            </button>
          </div>
        }
        onExport={()=>exportPDF({
          title: 'Ingresos por torneos (por periodo)',
          head: ['Periodo','Q Total'],
          rows: (ingTorPeriodo||[]).map(r=>[r.periodo, Number(r.q_total||0).toFixed(2)]),
          subtitle: `Granularidad: ${torCtrl.gran} · Periodos: ${torCtrl.periods} · Hasta: ${torCtrl.hasta}${torCtrl.tipo ? ` · Tipo: ${torCtrl.tipo}` : ''}`,
          footerNote: 'Q total = suma (costo_inscripción × equipos) de torneos del periodo.'
        })}
      >
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={ingTorPeriodo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="q_total" name="Q" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* 3) Uso de horarios (solo rango de fechas) */}
      <Section
        title="Uso de horarios (heatmap)"
        controls={
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <Labeled label="Desde">
              <input type="date" className="border p-2 rounded w-full"
                value={heatCtrl.desde} onChange={e=>setHeatCtrl(s=>({...s, desde:e.target.value}))}/>
            </Labeled>
            <Labeled label="Hasta">
              <input type="date" className="border p-2 rounded w-full"
                value={heatCtrl.hasta} onChange={e=>setHeatCtrl(s=>({...s, hasta:e.target.value}))}/>
            </Labeled>
            <div />
          </div>
        }
        onExport={()=>exportPDF({
          title: 'Uso de horarios',
          head: ['Día','Hora','Reservas'],
          rows: heat.flatMap(r=>[[String(r.weekday), String(r.hour), String(r.cnt)]]),
          subtitle: `Desde: ${heatCtrl.desde} · Hasta: ${heatCtrl.hasta}`,
          footerNote: 'Incluye estados: pendiente, pagada y completada.'
        })}
      >
        <div className="overflow-auto">
          <div className="min-w-[800px]">
            <div className="grid" style={{ gridTemplateColumns: `80px repeat(24, 1fr)` }}>
              <div></div>
              {Array.from({length:24},(_,h)=><div key={h} className="text-xs text-center">{h}:00</div>)}
              {heatGrid.map((row, i)=>(
                <div key={`row-${i}`} className="contents">
                  <div className="text-sm font-medium flex items-center">{row.day}</div>
                  {row.hours.map((h)=>
                    <div key={`${i}-${h.h}`} className="h-6"
                         style={{ background: `rgba(37,99,235, ${Math.min(1, h.cnt/6)})` }}
                         title={`${row.day} ${h.h}:00 — ${h.cnt} reservas`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* 4) Proyección (sin filtros) */}
      <Section
        title="Proyección de ingresos (mes actual)"
        onExport={()=>exportPDF({
          title: 'Proyección mes actual',
          head: ['Mes','Actual Q','Proyección Q'],
          rows: [[proj.mes, Number(proj.actual_q||0).toFixed(2), Number(proj.proyeccion_q||0).toFixed(2)]],
          subtitle: `Mes: ${proj.mes || '(actual)'}`,
          footerNote: 'Actual = pagada+completada. Proyección = pace con pendiente+pagada+completada.'
        })}
      >
        <div className="h-60">
          <ResponsiveContainer>
            <BarChart data={[{ label: 'Actual', q: proj.actual_q }, { label: 'Proyección', q: proj.proyeccion_q }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="q" name="Q" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}
