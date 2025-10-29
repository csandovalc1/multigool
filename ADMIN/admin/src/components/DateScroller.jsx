// DateScroller.jsx
import { useEffect, useMemo, useState } from 'react'

// YYYY-MM-DD en zona local (sin UTC shift)
const fmt = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// genera N días desde start (incluido)
const buildDays = (startDate, count) => {
  const arr = []
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    arr.push(d)
  }
  return arr
}

export default function DateScroller({ value, setValue }) {
  const today = useMemo(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()) // 00:00 local
  }, [])
  const todayYMD = fmt(today)

  // horizonte dinámico: empezamos con ~35 días y vamos extendiendo al avanzar
  const [horizon, setHorizon] = useState(35)

  // COUNT responsivo
  const getCount = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1024
    if (w < 480) return 3
    if (w < 768) return 5
    return 7
  }
  const [COUNT, setCOUNT] = useState(getCount())
  useEffect(() => {
    const onResize = () => setCOUNT(getCount())
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // lista de días (desde hoy)
  const days = useMemo(() => buildDays(today, horizon), [today, horizon])

  // valor inicial → hoy si no coincide
  useEffect(() => {
    if (!days.some((d) => fmt(d) === value)) setValue(fmt(days[0]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length])

  // ventana visible con offset
  const [offset, setOffset] = useState(0)

  const canPrev = offset > 0
  const visible = days.slice(offset, offset + COUNT)

  const goPrev = () => setOffset((o) => Math.max(0, o - COUNT))
  const goNext = () =>
    setOffset((o) => {
      const next = o + COUNT
      // si estamos a punto de “alcanzar” el final, extendemos horizonte
      if (next + COUNT > days.length) {
        setHorizon((h) => h + COUNT) // extiende otros COUNT días
      }
      return next
    })

  return (
    <div className="w-full">
      {/* Controles */}
      <div className="mb-2 flex justify-end gap-2">
        <button
          onClick={goPrev}
          disabled={!canPrev}
          className={`h-8 w-8 rounded-md border grid place-items-center transition
            ${canPrev ? 'bg-white hover:bg-neutral-50 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
          aria-label="Anterior"
          title="Anterior"
        >
          ‹
        </button>
        <button
          onClick={goNext}
          // nunca deshabilitado: ilimitado hacia adelante
          className="h-8 w-8 rounded-md border grid place-items-center bg-white hover:bg-neutral-50 cursor-pointer transition"
          aria-label="Siguiente"
          title="Siguiente"
        >
          ›
        </button>
      </div>

      {/* Grilla que refleja COUNT */}
      <div
        className={
          COUNT >= 7
            ? 'grid grid-cols-7 gap-3'
            : COUNT >= 5
            ? 'grid grid-cols-5 gap-3'
            : 'grid grid-cols-3 gap-3'
        }
      >
        {visible.map((d) => {
          const top = d.toLocaleDateString('es-GT', { weekday: 'short' })
          const bottom = d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })
          const ymd = fmt(d)
          const active = value === ymd
          const isToday = ymd === todayYMD

          return (
            <button
              key={ymd}
              onClick={() => setValue(ymd)}
              className={`w-full text-left px-3 py-2 rounded-md border transition
                ${active ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-neutral-50 cursor-pointer'}`}
            >
              <div className="flex items-center justify-between">
                <div className="uppercase text-[11px] text-neutral-500">{top}</div>
                {isToday && (
                  <span className="ml-2 rounded-full bg-blue-600 text-white px-2 py-0.5 text-[10px] leading-4">
                    Hoy
                  </span>
                )}
              </div>
              <div className="font-semibold">{bottom}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
