// src/pages/Reservas.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Search, Download } from 'lucide-react'
import PageShell from '../components/PageShell.jsx'
import Chip from '../components/Chip.jsx'
import Stepper from '../components/Stepper.jsx'
import DateScroller from '../components/DateScroller.jsx'
import Modal from '../components/Modal.jsx'
import Toast from '../components/Toast.jsx'
import html2canvas from 'html2canvas'
import { api } from '../lib/api'

// Tarifas por modalidad (solo visual; el backend calcula el definitivo)
const RATE_BY_MODE = { F5: 125, F7: 200 };

function hhmmPlus(hhmm, minutes) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const total = h * 60 + m + Number(minutes || 0);
  const hh = String(Math.floor((total % (24 * 60)) / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
function todayYMD() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
const ymKey = (ymd) => ymd.slice(0, 7) // 'YYYY-MM'

// Determina si un entry de summary implica cierre
const isClosedEntry = (v) => {
  const t = String(v?.type || '').toUpperCase()
  const lbl = String(v?.label || '').trim().toUpperCase()
  return t === 'CLOSED' || lbl === 'CERRADO'
}

/* ========= Componente visual del ticket (para exportar a imagen) ========= */
function TicketReserva({ r }) {
  if (!r) return null;
const rate = RATE_BY_MODE[(r.tipo_futbol || '').toUpperCase()] ?? 125;
  const totalQ =
    r.total_q != null
      ? Number(r.total_q).toFixed(2)
      : ((Number(r.dur_minutos || 0) / 60) * rate).toFixed(2);

  return (
    <div
      style={{
        width: 1080,
        padding: 48,
        background: '#ffffff',
        color: '#111827',
        fontFamily: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial`,
        border: '2px solid #e5e7eb',
        borderRadius: 24,
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      }}
    >
      {/* ====== ENCABEZADO (código MUY grande) ====== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 18, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Comprobante de Reserva</div>
          <div style={{ fontSize: 36, fontWeight: 800, marginTop: 4, letterSpacing: 0.5 }}>Multigool El Sauce</div>
        </div>

<div
  style={{
    background: '#111827',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 16,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 56,
    fontWeight: 900,
    lineHeight: 1.05,
    letterSpacing: 1,
    textTransform: 'uppercase',
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    display: 'flex',
    alignItems: 'center',      // ⬅️ centra verticalmente
    justifyContent: 'center',  // ⬅️ centra horizontalmente
    minHeight: 120,            // ⬅️ asegura altura uniforme
  }}
>
  {r.code || r.codigo_reserva || '—'}
</div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 8 }}>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Cancha</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {r.cancha || r.cancha_nombre || '—'}
            {r.tipo_futbol ? <span style={{ fontSize: 16, color: '#6b7280' }}> ({r.tipo_futbol})</span> : null}
          </div>
        </div>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Estado</div>
          <div style={{ fontSize: 24, fontWeight: 700, textTransform: 'capitalize' }}>{r.estado || 'pendiente'}</div>
        </div>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Fecha</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{r.fecha}</div>
        </div>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Horario</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {r.hi} – {r.hf} <span style={{ fontSize: 16, color: '#6b7280' }}>({Math.round((r.dur_minutos || 0) / 60 * 10) / 10} h)</span>
          </div>
        </div>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Cliente</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {[r.cliente?.nombres, r.cliente?.apellidos].filter(Boolean).join(' ') ||
              [r.cliente_nombres, r.cliente_apellidos].filter(Boolean).join(' ') ||
              '—'}
          </div>
        </div>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Total</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Q {totalQ}</div>
        </div>
      </div>

      <div style={{ marginTop: 28, fontSize: 14, color: '#6b7280' }}>
        Guarda esta imagen y preséntala al llegar. Si necesitas reprogramar o cancelar, comunícate con nosotros a tiempo.
      </div>
    </div>
  );
}

/* ========= Utilidad: exportar nodo a PNG (aislando estilos para evitar OKLCH) ========= */
async function exportNodeToPng(node, filename) {
  if (!node) throw new Error('No node to export');

  try {
    if ('fonts' in document && document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch (_) {}

  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    // foreignObjectRendering también puede ayudar, pero no es necesario si aislamos estilos:
    // foreignObjectRendering: true,
  });

  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename || 'reserva.png';
  a.click();
}

/* ========= Nombre de archivo prolijo ========= */
function buildFilename(r) {
  const fecha = String(r.fecha || '').replaceAll('-', ''); // YYYYMMDD
  const hi = String(r.hi || '').replace(':', '').slice(0, 4); // HHmm
  const code = (r.code || r.codigo_reserva || 'RESERVA').replaceAll(' ', '').replaceAll('/', '-');
  return `RSV_${fecha}_${hi}_${code}.png`;
}

export default function Reservas() {
  const params = new URLSearchParams(window.location.search || '')
  const preDate = params.get('date')
  const preTime = params.get('time')

  const [lookupCode, setLookupCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [found, setFound] = useState(null);
  const [openLookup, setOpenLookup] = useState(false);

  const [mode, setMode] = useState('F5')
  const [date, setDate] = useState(preDate || todayYMD())
  const [duration, setDuration] = useState(60)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ==== cache mensual y flag de cierre ====
  const monthCacheRef = useRef(new Map())
  const [isClosed, setIsClosed] = useState(false)

  // Sandbox oculto para render del ticket (aislado con all: initial)
  const ticketRef = useRef(null);
  const [ticketData, setTicketData] = useState(null);

  const ensureMonthLoaded = async (ymd) => {
    const key = ymKey(ymd)
    if (monthCacheRef.current.has(key)) return
    try {
      const [y, m] = key.split('-').map(Number)
      const { data } = await api.get('/public/calendario/mes', { params: { year: y, month: m } })
      const summary = data?.summary || {}
      monthCacheRef.current.set(key, { summary })
    } catch {
      monthCacheRef.current.set(key, { summary: {} })
    }
  }

  const recomputeIsClosed = (ymd) => {
    const key = ymKey(ymd)
    const bucket = monthCacheRef.current.get(key)
    if (!bucket) return false
    const entry = bucket.summary?.[ymd]
    return isClosedEntry(entry)
  }

  const [canchas, setCanchas] = useState([])
  const [slots, setSlots] = useState([])

  const [sel, setSel] = useState({ cancha_id: null, cancha_nombre: '', time: preTime || '' })

  const dateNice = useMemo(
    () => new Date(date + 'T00:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }),
    [date]
  )

const totalQ = useMemo(() => {
    const hours = Math.max(0, Number(duration || 0)) / 60;
    const rate = RATE_BY_MODE[mode] ?? 125;
    return (hours * rate).toFixed(2);
  }, [duration, mode]);

  useEffect(() => {
    (async () => {
      try {
        setError('')
        const { data } = await api.get('/canchas/activas')
        setCanchas((data || []).filter(c => c.tipo_futbol === mode))
      } catch (e) {
        setError(e?.response?.data?.error || 'No se pudieron cargar canchas')
      }
    })()
  }, [mode])

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        setError('')
        setSel((s) => ({ ...s, time: '' }))
        await ensureMonthLoaded(date)
        const closed = recomputeIsClosed(date)
        setIsClosed(closed)

        if (closed) {
          setSlots([])
          setError('Este día está CERRADO. No se admiten reservas.')
          return
        }

        const { data } = await api.get('/reservas/slots', {
          params: { fecha: date, tipo_futbol: mode, dur: duration }
        })
        setSlots(data || [])
      } catch (e) {
        setError(e?.response?.data?.error || 'No se pudieron cargar horarios')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, mode, duration])

  const payload = {
    mode,
    date,
    dateNice,
    time: sel.time,
    duration,
    cancha_id: sel.cancha_id,
    cancha_nombre: sel.cancha_nombre,
    totalQ
  }

  const canConfirm = !!(sel.cancha_id && sel.time)
  const canProceed = canConfirm && !isClosed

  const triggerDownloadTicket = async (r) => {
    try {
      setTicketData(r);
      await new Promise((res) => setTimeout(res, 50));
      if ('fonts' in document && document.fonts?.ready) {
        try { await document.fonts.ready; } catch (_) {}
      }
      const node = ticketRef.current;
      if (!node) throw new Error('Ticket node not ready');
      const filename = buildFilename(r);
      await exportNodeToPng(node, filename);
    } finally {
      setTicketData(null);
    }
  };

  const onConfirm = async (form) => {
    if (!canConfirm) return;

    await ensureMonthLoaded(date)
    const closedNow = recomputeIsClosed(date)
    if (closedNow) {
      setOpen(false)
      setToast('No se puede reservar: ese día está CERRADO.')
      setTimeout(() => setToast(''), 2500)
      return
    }

    try {
      setOpen(false)
      const resp = await api.post('/reservas', {
        cancha_id: sel.cancha_id,
        fecha: date,
        hora: sel.time,
        dur_minutos: duration,
        notas: form.notas || null,
        cliente: {
          nombres:  form.nombres,
          apellidos:form.apellidos || null,
          email:    form.email || null, // opcional
          telefono: form.telefono || null
        }
      });

      setToast('Reserva confirmada ✅')
      setTimeout(() => setToast(''), 2500)

      const { data: slotsData } = await api.get('/reservas/slots', {
        params: { fecha: date, tipo_futbol: mode, dur: duration }
      })
      setSlots(slotsData || [])
      setSel((s) => ({ ...s, time: '' }))

      const code = resp?.data?.code || resp?.data?.codigo_reserva || resp?.data?.codigo || null
      if (code) {
        try {
          const { data } = await api.get('/public/reservas/lookup', { params: { code } })
          setFound(data)
          setOpenLookup(true)
          await triggerDownloadTicket(data)
        } catch {
          const hf = hhmmPlus(sel.time, duration)
          const fallback = {
            code,
            estado: 'pendiente',
            cancha: sel.cancha_nombre,
            tipo_futbol: mode,
            fecha: date,
            hi: sel.time,
            hf,
            dur_minutos: duration,
            notas: form.notas || null,
            cliente: {
              nombres: form.nombres,
              apellidos: form.apellidos || null,
              email: form.email || null,
              telefono: form.telefono || null,
            }
          }
          setFound(fallback)
          setOpenLookup(true)
          await triggerDownloadTicket(fallback)
        }
      } else {
        const hf = hhmmPlus(sel.time, duration)
        const fallback = {
          code: '—',
          estado: 'pendiente',
          cancha: sel.cancha_nombre,
          tipo_futbol: mode,
          fecha: date,
          hi: sel.time,
          hf,
          dur_minutos: duration,
          notas: form.notas || null,
          cliente: {
            nombres: form.nombres,
            apellidos: form.apellidos || null,
            email: form.email || null,
            telefono: form.telefono || null,
          }
        }
        setFound(fallback)
        setOpenLookup(true)
        await triggerDownloadTicket(fallback)
      }
    } catch (e) {
      alert(e?.response?.data?.error || 'No se pudo crear la reserva')
    }
  }

  const buscarReserva = async () => {
    const code = lookupCode.trim().toUpperCase();
    if (!code) { setLookupError('Escribe el código'); return; }
    try {
      setLookupLoading(true);
      setLookupError('');
      const { data } = await api.get('/public/reservas/lookup', { params: { code } });
      setFound(data);
      setOpenLookup(true);
    } catch (e) {
      setFound(null);
      setLookupError(e?.response?.data?.error || 'No se encontró la reserva');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <PageShell bgUrl="url(https://images.unsplash.com/photo-1434648957308-5e6a859697e8?q=80&w=2000&auto=format&fit=crop)">
      {/* Sandbox oculto: aislado con all: initial para evitar heredar OKLCH u otras propiedades */}
      <div style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none', opacity: 0 }}>
        <div ref={ticketRef} style={{ all: 'initial', display: 'inline-block' }}>
          {ticketData ? <TicketReserva r={ticketData} /> : null}
        </div>
      </div>

      <div className="rounded-2xl border bg-white/95 shadow-sm p-5 md:p-8 overflow-hidden">

        {/* Consulta por código */}
        <div className="mt-2">
          <h3 className="text-sm font-black uppercase text-neutral-500 mb-2">Consulta tu reserva</h3>
          <div className="flex gap-2 items-center">
            <input
              className="border rounded px-3 py-2 w-full md:w-72"
              placeholder="Código (ej. RSV-2509-1234)"
              value={lookupCode}
              onChange={(e)=>{ setLookupCode(e.target.value); setLookupError(''); }}
            />
            <button
              onClick={buscarReserva}
              disabled={lookupLoading || !lookupCode.trim()}
              className={`px-4 py-2 rounded text-white inline-flex items-center gap-2 ${lookupLoading ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
              <Search className="h-4 w-4" /> Buscar
            </button>
          </div>
          {lookupError && <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-sm">{lookupError}</div>}
        </div>

        <h1 className="font-extrabold tracking-wide uppercase text-3xl text-center mb-6">Reserva tu cancha</h1>

        <div className="grid gap-6">
          <div>
            <h3 className="text-sm font-black uppercase text-neutral-500 mb-2">Escoge el tipo de fútbol</h3>
            <div className="flex gap-2">
              {['F5', 'F7'].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setSel({ cancha_id: null, cancha_nombre: '', time: '' }) }}
                  className={`px-4 py-3 rounded-md border text-xl font-black ${mode === m ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <h3 className="text-sm font-black uppercase text-neutral-500 mb-2">Escoge la fecha</h3>
              <DateScroller value={date} setValue={(d) => { setDate(d); setSel((s)=>({ ...s, time: '' })) }} />
              {isClosed && (
                <div className="mt-2 p-2 rounded-md bg-neutral-100 border border-neutral-300 text-neutral-700 text-sm">
                  <b>Este día está CERRADO.</b> No se admiten reservas ni horarios.
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-black uppercase text-neutral-500 mb-2">Duración</h3>
              <Stepper value={duration} setValue={(v) => { setDuration(v); setSel((s)=>({ ...s, time: '' })) }} />
              <div className="mt-2 text-sm">
                <span className="text-neutral-500">Total estimado:</span>{' '}
                <b>Q {totalQ}</b>
              </div>
              <div className="text-xs text-neutral-400">(Q {RATE_BY_MODE[mode] ?? 125} / hora)</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase text-neutral-500 mb-2">Elige cancha y hora</h3>

            {error && <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}
            {loading && <div className="p-3 rounded-md border bg-neutral-50 text-neutral-600 text-sm">Cargando horarios...</div>}

            {!loading && !error && (
              <div className="grid gap-4">
                {slots.length === 0 && (
                  <div className="p-3 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
                    {isClosed ? 'Día cerrado.' : 'No hay canchas u horarios disponibles para esos filtros.'}
                  </div>
                )}

                {slots.map((g) => {
                  const isSelectedCancha = sel.cancha_id === g.cancha_id
                  return (
                    <div key={g.cancha_id} className="rounded-xl border bg-white shadow-sm p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{g.cancha_nombre}</div>
                        <button
                          onClick={() =>
                            setSel((s) =>
                              s.cancha_id === g.cancha_id
                                ? { cancha_id: null, cancha_nombre: '', time: '' }
                                : { cancha_id: g.cancha_id, cancha_nombre: g.cancha_nombre, time: '' }
                            )
                          }
                          disabled={isClosed}
                          className={`px-3 py-1 rounded-md text-sm border ${
                            isClosed
                              ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                              : (isSelectedCancha ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-neutral-50')
                          }`}
                          title={isClosed ? 'Día cerrado' : (isSelectedCancha ? 'Quitar selección' : 'Seleccionar cancha')}
                        >
                          {isClosed ? 'CERRADO' : (isSelectedCancha ? 'Seleccionada' : 'Seleccionar cancha')}
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {g.slots.length === 0 && (
                          <div className="text-sm text-neutral-500">Sin horarios disponibles.</div>
                        )}
                        {g.slots.map((s) => (
                          <Chip
                            key={`${g.cancha_id}-${s.hora}`}
                            active={isSelectedCancha && sel.time === s.hora}
                            onClick={() => {
                              if (isClosed) return
                              setSel({ cancha_id: g.cancha_id, cancha_nombre: g.cancha_nombre, time: s.hora })
                            }}
                          >
                            {s.hora} — {s.hasta}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => canProceed && setOpen(true)}
            disabled={!canProceed}
            className={`mt-2 self-start px-8 py-3 rounded-full text-white font-semibold inline-flex items-center gap-2
                        ${canProceed ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-300 cursor-not-allowed'}`}
            title={
              isClosed
                ? 'Día cerrado'
                : (canConfirm ? 'Continuar con la reserva' : 'Elige cancha y hora')
            }
          >
            <Clock className="h-5 w-5" /> Reservar
          </button>
        </div>
      </div>

      <Modal open={openLookup} onClose={() => setOpenLookup(false)} title="Detalle de la reserva">
        {found ? (
          <div className="space-y-3">
            <ReservaInfoCard r={found} />
            <button
              onClick={() => triggerDownloadTicket(found)}
              className="mt-2 w-full px-5 py-3 rounded-md bg-slate-900 text-white font-semibold inline-flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" /> Descargar comprobante
            </button>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Sin datos</div>
        )}
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Confirma tu reserva">
        <ConfirmForm payload={payload} onConfirm={onConfirm} />
      </Modal>

      <Toast text={toast} />
    </PageShell>
  )
}

function ConfirmForm({ payload, onConfirm }) {
  const [form, setForm] = useState({
    nombres: '', apellidos: '', email: '', telefono: '', notas: ''
  })
  const disabled = !form.nombres.trim() // email opcional

  return (
    <>
      <div className="grid md:grid-cols-2 gap-3">
        <input placeholder="Nombres *" className="rounded-md border px-3 py-2"
               value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })}/>
        <input placeholder="Apellidos" className="rounded-md border px-3 py-2"
               value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })}/>
        <input placeholder="Correo electrónico (opcional)" className="rounded-md border px-3 py-2 md:col-span-2"
               value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/>
        <input placeholder="Número telefónico" className="rounded-md border px-3 py-2 md:col-span-2"
               value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}/>
        <textarea placeholder="Notas (opcional)" className="rounded-md border px-3 py-2 md:col-span-2" rows={3}
                  value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}/>
      </div>

      <div className="mt-4 text-sm text-neutral-700 space-y-1">
        <div>Cancha: <b>{payload.cancha_nombre || '—'}</b></div>
        <div>Modalidad: <b>{payload.mode}</b></div>
        <div>Fecha: <b>{payload.dateNice}</b></div>
        <div>Hora: <b>{payload.time || '—'}</b></div>
        <div>Duración: <b>{payload.duration / 60} hora(s)</b></div>
        <div>Total a pagar: <b>Q {payload.totalQ}</b></div>
      </div>

      <button
        onClick={() => onConfirm(form)}
        disabled={disabled}
        className={`mt-6 w-full px-5 py-3 rounded-full text-white font-extrabold tracking-wide uppercase
                    ${disabled ? 'bg-green-300 cursor-not-allowed' : 'bg-green-500 hover:bg-green-400'}`}
      >
        Confirmar
      </button>
    </>
  )
}

function ReservaInfoCard({ r }) {
   const rate = RATE_BY_MODE[(r.tipo_futbol || '').toUpperCase()] ?? 125;
  const totalQ =
    r.total_q != null
      ? Number(r.total_q).toFixed(2)
      : ((Number(r.dur_minutos || 0) / 60) * rate).toFixed(2);

  const isEstimado = r.total_q == null;

  return (
    <div className="space-y-2 text-sm">
      <div className="rounded border p-3 bg-slate-50">
        <div className="font-semibold">
          Código: <span className="font-mono">{r.code}</span>
        </div>
        <div>Estado: <b>{r.estado}</b></div>
      </div>

      <div>Cancha: <b>{r.cancha}</b> {r.tipo_futbol ? <span className="text-xs text-neutral-500">({r.tipo_futbol})</span> : null}</div>
      <div>Fecha: <b>{r.fecha}</b></div>
      <div>Horario: <b>{r.hi}</b> – <b>{r.hf}</b> ({Math.round((r.dur_minutos||0)/60*10)/10} h)</div>

      <div className="mt-1">
        Total a pagar: <b>Q {totalQ}</b>
        {isEstimado && <span className="text-xs text-neutral-500"></span>}
      </div>

      <hr className="my-2" />
      <div className="text-neutral-500">Cliente</div>
      <div>Nombre: <b>{[r.cliente?.nombres, r.cliente?.apellidos].filter(Boolean).join(' ') || '—'}</b></div>
      <div>Correo: <b>{r.cliente?.email || '—'}</b></div>
      <div>Teléfono: <b>{r.cliente?.telefono || '—'}</b></div>
      {r.notas && <div className="pt-2 text-neutral-700"><span className="text-neutral-500">Notas: </span>{r.notas}</div>}
    </div>
  );
}
