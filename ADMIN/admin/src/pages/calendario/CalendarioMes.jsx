// src/pages/admin/CalendarioMes.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { monthMatrix } from './monthMatrix.js'
import { api } from '../../lib/api'

// map directo del backend → StatusBadge
const typeFor = (entry) => entry?.type || null

// Hoy en zona "America/Guatemala"
const fmtGT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Guatemala',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const ymdGT = (d) => fmtGT.format(d)
const todayYMD_GT = () => ymdGT(new Date())

const todayYM = () => {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth() }
}

export default function CalendarioMes() {
  const navigate = useNavigate()
  const [ym, setYm] = useState(todayYM())
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // cierres admin (del mes visible)
  const [closingDate, setClosingDate] = useState('')
  const [closingMotivo, setClosingMotivo] = useState('')
  const [cierres, setCierres] = useState([]) // [{fecha, motivo}]

  const grid = useMemo(() => monthMatrix(ym.y, ym.m), [ym])
  const monthLabel = useMemo(
    () => new Date(ym.y, ym.m).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' }),
    [ym]
  )

  const fetchMonth = async (y, m0) => {
    setLoading(true); setError('')
    try {
      const [{ data: pub }, { data: adm }] = await Promise.all([
        api.get('/public/calendario/mes', { params: { year: y, month: m0 + 1 } }),
        api.get('/admin/cierres',        { params: { year: y, month: m0 + 1 } }),
      ])
      setSummary(pub.summary || {})
      setCierres(adm?.dates || [])
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo cargar el resumen del mes')
      setSummary({})
      setCierres([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMonth(ym.y, ym.m) }, [ym.y, ym.m])

  const shift = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }

  const todayGT = todayYMD_GT()

  const addCierre = async () => {
    const fecha = closingDate?.trim()
    if (!fecha) { alert('Selecciona la fecha a cerrar.'); return }
    try {
      await api.post('/admin/cierres', { fecha, motivo: closingMotivo || null })
      setClosingDate('')
      setClosingMotivo('')
      await fetchMonth(ym.y, ym.m)
    } catch (e) {
      if (e?.response?.status === 409) {
        const detail = e?.response?.data
        const reservas = detail?.reservas?.length || 0
        const go = confirm(
          `Hay reservas en esa fecha.\n` +
          `Reservas: ${reservas}\n\n` +
          `¿Forzar cierre? (se CANCELARÁN las reservas)`
        )
        if (go) {
          await api.post('/admin/cierres?force=1', { fecha, motivo: closingMotivo || null })
          setClosingDate('')
          setClosingMotivo('')
          await fetchMonth(ym.y, ym.m)
        }
      } else {
        alert(e?.response?.data?.error || 'No se pudo crear el cierre')
      }
    }
  }

  const deleteCierre = async (fecha) => {
    if (!confirm(`¿Eliminar cierre del ${fecha}?`)) return
    try {
      await api.delete(`/admin/cierres/${fecha}`)
      await fetchMonth(ym.y, ym.m)
    } catch (e) {
      alert(e?.response?.data?.error || 'No se pudo eliminar el cierre')
    }
  }

  // Set con las fechas cerradas del mes visible, formato "YYYY-MM-DD"
  const closedSet = useMemo(() => new Set((cierres || []).map(c => c.fecha)), [cierres])

  return (
    <div className="space-y-6">
      {/* Bloque: Cerrar fecha */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-2">Cerrar un día</h3>
        <div className="grid md:grid-cols-4 gap-2 items-end">
          <label className="text-sm">
            <div className="mb-1">Fecha</div>
            <input type="date" className="border p-2 rounded w-full" value={closingDate} onChange={e=>setClosingDate(e.target.value)} />
          </label>
          <label className="text-sm md:col-span-2">
            <div className="mb-1">Motivo (opcional)</div>
            <input type="text" className="border p-2 rounded w-full" value={closingMotivo} onChange={e=>setClosingMotivo(e.target.value)} placeholder="Mantenimiento, feriado, etc." />
          </label>
          <button onClick={addCierre} className="px-4 py-2 rounded text-white bg-slate-900 hover:bg-slate-800">
            Cerrar día
          </button>
        </div>

        {/* Lista de cierres del mes visible */}
        <div className="mt-3">
          <h4 className="font-semibold mb-2 text-sm">Cierres de este mes</h4>
          {cierres.length === 0 ? (
            <div className="text-xs text-neutral-500">No hay cierres para este mes.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cierres.map(c => (
                <span key={c.fecha} className="inline-flex items-center gap-2 border rounded px-2 py-1 text-xs">
                  <strong>{c.fecha}</strong>{c.motivo ? ` — ${c.motivo}` : ''}
                  <button onClick={()=>deleteCierre(c.fecha)} className="text-rose-600 hover:underline">x</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendario mes */}
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-bold uppercase">{monthLabel}</h2>
          <div className="flex gap-2">
            <button onClick={() => shift(-1)} className="p-2 rounded-md border hover:bg-neutral-50 cursor-pointer">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => shift(+1)} className="p-2 rounded-md border hover:bg-neutral-50 cursor-pointer">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading && <div className="mt-3 text-sm text-neutral-500">Cargando mes…</div>}
        {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 text-center text-xs uppercase text-neutral-500">
              {'lun mar mié jue vie sáb dom'.split(' ').map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {grid.flat().map((date, idx) => {
                const inMonth = date.getMonth() === ym.m
                const key = date.toISOString().slice(0, 10)
                const keyGT = ymdGT(date)
                const isPastInGT = keyGT < todayGT
                const entry = inMonth ? summary[key] : null

                const isClosed = closedSet.has(key)

                // Backward-compat por si viene el formato viejo {label,type}
                const availability = entry?.availability || (entry?.label ? { label: entry.label, type: entry.type } : null)
                const tag = entry?.tag || null

                const disabled = !inMonth || isPastInGT || isClosed

                return (
                  <button
                    key={idx}
                    disabled={disabled}
                    onClick={() => !disabled && navigate(`/calendario/${key}`)}
                    className={`relative min-h-[100px] md:min-h-[110px] rounded-lg border p-2 text-left transition
                               ${disabled
                                  ? 'bg-neutral-50 text-neutral-400 opacity-60 cursor-not-allowed'
                                  : 'bg-white hover:shadow-sm cursor-pointer'}`}
                    title={
                      disabled
                        ? (isClosed ? 'Día cerrado' : (isPastInGT ? 'Fecha pasada' : 'Fuera del mes'))
                        : 'Ver disponibilidad del día'
                    }
                  >
                    <div className="text-xs font-semibold">{date.getDate()}</div>

                    {(availability || tag) && (
                      <div className="absolute left-2 right-2 bottom-2 space-y-1">
                        {availability && (
                          <StatusBadge type={typeFor(availability)}>
                            {availability.label.toUpperCase()}
                          </StatusBadge>
                        )}
                        {tag && (
                          <StatusBadge type="TOURNAMENT">
                            {String(tag.label || '').toUpperCase()}
                          </StatusBadge>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
