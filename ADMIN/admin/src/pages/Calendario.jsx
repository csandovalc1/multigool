// admin/src/pages/Calendario.jsx
import { useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { api } from '../lib/api';
import PartidoModal from '../widgets/PartidoModal';

export default function Calendario(){
  const calRef = useRef(null);
  const [torneoId, setTorneoId] = useState('');
  const [torneos, setTorneos] = useState([]);
  const [pSel, setPSel] = useState(null); // partido seleccionado (abre modal)

  // carga torneos una vez
  useState(()=>{ api.get('/torneos').then(r=>setTorneos(r.data)); },[]);

  const fetchEvents = async (info, successCallback, failureCallback) => {
    try {
      const desde = info.startStr.slice(0,10);
      const hasta = info.endStr.slice(0,10);

      // partidos por rango (opcionalmente filtra por torneoId)
      const partidosReq = api.get('/partidos/rango', { params: { desde, hasta, torneo_id: torneoId || undefined } });
      // reservas por rango
      const reservasReq = api.get('/reservas', { params: { desde, hasta } });

      const [partidosRes, reservasRes] = await Promise.all([partidosReq, reservasReq]);

      const partidosEvents = partidosRes.data.map(p => ({
        id: `match-${p.id}`,
        title: `${p.equipo_local} vs ${p.equipo_visita}`,
        start: p.fecha ? `${p.fecha}T${p.hora ?? '00:00:00'}` : undefined,
        end: p.fecha ? `${p.fecha}T${p.hora ?? '00:00:00'}` : undefined,
        extendedProps: { tipo: 'partido', partido: p }
      }));

      const reservasEvents = reservasRes.data.map(r => ({
        id: `res-${r.id}`,
        title: `Reserva: ${r.nombre_contacto} (${r.cancha})`,
        start: r.start_time,
        end: r.end_time,
        extendedProps: { tipo: 'reserva', reserva: r }
      }));

      successCallback([...partidosEvents, ...reservasEvents]);
    } catch (e){
      console.error(e);
      failureCallback(e);
    }
  };

  const onEventClick = (clickInfo)=>{
    const { tipo } = clickInfo.event.extendedProps || {};
    if (tipo === 'partido') {
      setPSel(clickInfo.event.extendedProps.partido);
    } else if (tipo === 'reserva') {
      const r = clickInfo.event.extendedProps.reserva;
      alert(`Reserva\nCancha: ${r.sede} / ${r.cancha}\nContacto: ${r.nombre_contacto} (${r.telefono_contacto ?? '-'})\n${r.start_time} - ${r.end_time}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-sm text-slate-600">Filtrar por torneo</label>
          <select className="border p-2 rounded w-64" value={torneoId} onChange={e=>setTorneoId(e.target.value)}>
            <option value="">Todos</option>
            {torneos.map(t=> <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <button className="px-3 py-2 bg-slate-900 text-white rounded" onClick={()=>calRef.current?.getApi().refetchEvents()}>Refrescar</button>
      </div>

      <div className="bg-white p-3 rounded-xl shadow">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          height="auto"
          events={fetchEvents}
          eventClick={onEventClick}
        />
      </div>

      {pSel && (
        <PartidoModal
          partido={pSel}
          onClose={()=>{
            setPSel(null);
            calRef.current?.getApi().refetchEvents(); // refresca tras guardar goles
          }}
        />
      )}
    </div>
  );
}
