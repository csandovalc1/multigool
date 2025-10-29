// src/pages/CalendarioMes.jsx  (USUARIO)
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import PageShell from '../../components/PageShell.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { monthMatrix } from './monthMatrix.js'
import { api } from '../../lib/api'

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

  // seguimos trayendo cierres porque el calendario los necesita
  const [closingDate, setClosingDate] = useState('')
  const [closingMotivo, setClosingMotivo] = useState('')
  const [cierres, setCierres] = useState([])

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

  // util para el render: fechas cerradas del mes visible
  const closedSet = useMemo(() => new Set((cierres || []).map(c => c.fecha)), [cierres])

  return (
    <PageShell bgUrl="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=2000&auto=format&fit=crop">
      <div className="space-y-6 rounded-2xl border bg-white/95 shadow-sm p-4 md:p-6 overflow-hidden">
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
          {error &&   <div className="mt-3 text-sm text-rose-600">{error}</div>}

          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 text-center text-xs uppercase text-neutral-500">
                {'lun mar mié jue vie sáb dom'.split(' ').map((d) => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {grid.flat().map((date, idx) => {
                  const inMonth    = date.getMonth() === ym.m
                  const key        = date.toISOString().slice(0, 10)
                  const keyGT      = ymdGT(date)
                  const isPastInGT = keyGT < todayGT

                  const entry = inMonth ? summary[key] : null
                  const isClosed = closedSet.has(key)

                  // Compat: si el backend viejo enviara {label,type}, lo mapeamos a availability
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
    </PageShell>
  )
}
