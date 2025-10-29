// src/pages/public/CalendarioDia.jsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import PageShell from '../../components/PageShell.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { api } from '../../lib/api'

// === Helpers zona Guatemala ===
const TZ = 'America/Guatemala'

// YYYY-MM-DD en la zona GT
function todayYMD_GT() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// HH:MM en la zona GT
function nowHHMM_GT() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date()).replace(/[^\d:]/g, '').slice(0, 5)
}

// compara "HH:MM" (ambos con cero-padding)
function isHHMMAfterOrEqual(a, b) {
  return a.localeCompare(b) >= 0
}

// fallback local
const todayYMD_local = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function CalendarioDia() {
  const { ymd: ymdParam } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const ymd = useMemo(
    () => (ymdParam && /^\d{4}-\d{2}-\d{2}$/.test(ymdParam)) ? ymdParam : todayYMD_local(),
    [ymdParam]
  )

  const isTodayGT = useMemo(() => ymd === todayYMD_GT(), [ymd])

  const [nowGT, setNowGT] = useState(() => nowHHMM_GT())
  useEffect(() => {
    if (!isTodayGT) return
    setNowGT(nowHHMM_GT())
    const id = setInterval(() => setNowGT(nowHHMM_GT()), 30_000)
    return () => clearInterval(id)
  }, [isTodayGT])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const { data } = await api.get('/public/calendario/dia', { params: { date: ymd } })
        if (!alive) return
        setData(data)
      } catch (e) {
        if (!alive) return
        setError(e?.response?.data?.error || 'No se pudo cargar el calendario del día')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [ymd])

  const nice = useMemo(() => {
    const d = new Date(`${ymd}T00:00:00`)
    return d.toLocaleDateString('es-GT', { weekday: 'long', day: '2-digit', month: '2-digit' }).toUpperCase()
  }, [ymd])

  return (
    <PageShell bgUrl="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=2000&auto=format&fit=crop">
      <div className="rounded-2xl border bg-white/95 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between bg-neutral-100 px-4 py-3 border-b">
          <button className="p-2 rounded-full hover:bg-neutral-200 cursor-pointer" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="font-extrabold tracking-wide uppercase text-base md:text-2xl">{nice}</div>
          <div className="w-9" />
        </div>

        {loading && <div className="p-4 text-sm text-neutral-500">Cargando disponibilidad…</div>}
        {error && <div className="p-4 text-sm text-rose-600">{error}</div>}

        {!loading && !error && data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-white">
                  <th className="px-4 py-2 text-left w-24">HORA</th>
                  {data.fields.map((f) => (
                    <th key={f.id} className="px-4 py-2 text-left">{f.nombre}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slots.map((row, i) => {
                  const isPast = isTodayGT && isHHMMAfterOrEqual(nowGT, row.time)
                  return (
                    <tr key={i} className="odd:bg-neutral-50">
                      <td className="px-4 py-3 font-semibold text-neutral-700">{row.time}</td>
                      {data.fields.map((f) => {
                        const fid = String(f.id)
                        const st = row.status[fid]
                        const meta = row.meta?.[fid] || null

                        if (isPast) {
                          return (
                            <td key={f.id} className="px-4 py-2">
                              <div className="flex items-center">
                                <StatusBadge type="RESERVED">NO DISPONIBLE</StatusBadge>
                              </div>
                            </td>
                          )
                        }

                        return (
                          <td key={f.id} className="px-4 py-2">
                            <div className="flex items-center">
                              {st === 'AVAILABLE' ? (
                                <Link
                                  to={`/reservas?fecha=${data.date}&hora=${row.time}&cancha_id=${f.id}`}
                                  className="inline-flex"
                                >
                                  <StatusBadge type="AVAILABLE">DISPONIBLE</StatusBadge>
                                </Link>
                              ) : st === 'RESERVED' ? (
                                <StatusBadge type="RESERVED">RESERVADA</StatusBadge>
                              ) : meta?.academia ? (
                                // 👇 ACADEMIA (mismo color que torneo)
                                <StatusBadge type="TOURNAMENT">ACADEMIA</StatusBadge>
                              ) : meta?.torneo_id ? (
                                <Link to={`/torneos/${meta.torneo_id}`} className="inline-flex">
                                  <StatusBadge type="TOURNAMENT">TORNEO</StatusBadge>
                                </Link>
                              ) : (
                                <StatusBadge type="TOURNAMENT">TORNEO</StatusBadge>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  )
}
