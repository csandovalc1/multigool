// WeeklyAgenda.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { api } from "../lib/api";

/**
 * WeeklyAgenda con bloqueo:
 * - Día CERRADO: deshabilita columna completa y muestra overlay "CERRADO".
 * - Bloqueo cruzado F5/F7.
 * - Academia: bloque visible como "ENTRENO ACADEMIA", no clickeable.
 */
export default function WeeklyAgenda({
  start,
  tipo = "",
  visibleDays = 3,
  onNewSlot,
  onClickReserva,
  onDayChange,
}) {
  const [anchorDate, setAnchorDate] = useState(start);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState({
    dias: [],
    canchas: [],
    bloques: [],
    config: { open: "07:00", close: "22:00", step: 60 },
  });

  const reqIdRef = useRef(0);
  const [stepPx, setStepPx] = useState(40);

  // Helpers tiempo
  const pad2 = (n) => String(n).padStart(2, "0");
  const toMin = (hhmm) => {
    const [h, m] = String(hhmm).slice(0, 5).split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const fromMin = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
  const addDaysYMD = (ymd, delta) => {
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  };
  const startOfWeekSunday = (ymd) => {
    const d = new Date(`${ymd}T00:00:00Z`);
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - dow);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  };
  const ymKey = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;

  // Horas visibles
  const times = useMemo(() => {
    const out = [];
    const s = toMin(data.config?.open || "07:00");
    const e = toMin(data.config?.close || "22:00");
    const step = Number(data.config?.step || 60);
    if (s == null || e == null || step <= 0) return out;
    for (let m = s; m <= e; m += step) out.push(fromMin(m));
    return out;
  }, [data.config]);

  // Map cancha
  const canchaById = useMemo(() => {
    const map = new Map();
    for (const c of data.canchas || []) map.set(c.id, c);
    return map;
  }, [data.canchas]);

  // Fetch semana
  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      setLoading(true);
      const myReq = ++reqIdRef.current;
      try {
        const weekStart = startOfWeekSunday(anchorDate);
        const params = { start: weekStart };
        if (tipo) params.tipo_futbol = tipo;
        const resp = await api.get("/reservas/semana", { params });
        if (cancelled || myReq !== reqIdRef.current) return;
        setData(
          resp.data || {
            dias: [],
            canchas: [],
            bloques: [],
            config: { open: "07:00", close: "22:00", step: 60 },
          }
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doFetch();
    return () => {
      cancelled = true;
    };
  }, [anchorDate, tipo]);

  // Notificar cambio de día ancla
  useEffect(() => {
    onDayChange?.(anchorDate);
  }, [anchorDate]);

  // Ventana de N días
  const win = Math.max(3, Number(visibleDays) || 3);
  const visible = Array.from({ length: win }, (_, i) => addDaysYMD(anchorDate, i));

  // ======= Cierres por mes =======
  const [closedSet, setClosedSet] = useState(() => new Set()); // YYYY-MM-DD
  const fetchedMonths = useRef(new Set()); // YYYY-MM

  const pullClosedForMonth = async (year, month) => {
    const k = `${year}-${String(month).padStart(2, "0")}`;
    if (fetchedMonths.current.has(k)) return;
    fetchedMonths.current.add(k);
    try {
      const { data } = await api.get("/public/calendario/mes", { params: { year, month } });
      const summary = data?.summary || {};
      const toAdd = [];
      for (const [ymd, v] of Object.entries(summary)) {
        const isClosed =
          v?.type === "CLOSED" ||
          String(v?.label || "").trim().toUpperCase() === "CERRADO";
        if (isClosed) toAdd.push(ymd);
      }
      if (toAdd.length) {
        setClosedSet((prev) => {
          const s = new Set(prev);
          toAdd.forEach((d) => s.add(d));
          return s;
        });
      }
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    if (!visible.length) return;
    const months = new Set();
    for (const ymd of visible) {
      const d = new Date(`${ymd}T00:00:00Z`);
      months.add(ymKey(d));
    }
    months.forEach((k) => {
      const [y, m] = k.split("-").map(Number);
      pullClosedForMonth(y, m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.join("|")]);

  const isDayClosed = (ymd) => closedSet.has(ymd);

  const headerFrom = new Date(`${visible[0]}T00:00:00`).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });
  const headerTo = new Date(`${visible[visible.length - 1]}T00:00:00`).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });

  const goPrevDay = () => setAnchorDate((x) => addDaysYMD(x, -1));
  const goNextDay = () => setAnchorDate((x) => addDaysYMD(x, 1));

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 p-3 border-b relative">
        <div className="flex items-center gap-2">
          <button onClick={goPrevDay} className="px-2 py-1 rounded border hover:bg-neutral-50" title="Día anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="font-semibold text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="font-mono">{visible[0]}</span>
            <span className="text-neutral-600">({headerFrom})</span>
            <span className="mx-1">→</span>
            <span className="font-mono">{visible[visible.length - 1]}</span>
            <span className="text-neutral-600">({headerTo})</span>
          </div>
          <button onClick={goNextDay} className="px-2 py-1 rounded border hover:bg-neutral-50" title="Día siguiente">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-emerald-500"></span> pagada/completada
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-amber-500"></span> pendiente
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-rose-400"></span> cancelado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-slate-400"></span> torneo
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-sky-500"></span> academia
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-neutral-400"></span> cerrado
          </span>
        </div>

        {loading && (
          <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-slate-200">
            <div className="h-0.5 w-1/3 bg-slate-900 animate-pulse" />
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Días */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `100px repeat(${visible.length * (data.canchas.length || 1)}, minmax(160px, 1fr))` }}
          >
            <div className="border-b border-r bg-neutral-50"></div>
            {visible.map((d) => {
              const closed = isDayClosed(d);
              return (
                <div
                  key={`day-${d}`}
                  className={`border-b font-bold text-center text-sm py-2 ${closed ? "bg-neutral-200 text-neutral-500" : "bg-neutral-50"}`}
                  style={{ gridColumn: `span ${Math.max(1, data.canchas.length)} / span ${Math.max(1, data.canchas.length)}` }}
                  title={new Date(`${d}T00:00:00`).toLocaleDateString("es-CL", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                >
                  {new Date(`${d}T00:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" })}
                  {closed && (
                    <span className="ml-2 inline-block text-[10px] px-2 py-0.5 rounded bg-neutral-400 text-white">CERRADO</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Canchas por día */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `100px repeat(${visible.length * (data.canchas.length || 1)}, minmax(160px, 1fr))` }}
          >
            <div className="border-b border-r bg-neutral-50 text-xs px-2 py-1 text-neutral-500">Hora</div>
            {visible.flatMap((d) =>
              (data.canchas.length ? data.canchas : [{ id: -1, nombre: "Cancha", tipo_futbol: tipo || "" }]).map((c) => (
                <div
                  key={`head-${d}-${c.id}`}
                  className={`border-b text-xs text-center py-1 ${isDayClosed(d) ? "bg-neutral-200 text-neutral-500" : "bg-neutral-50"}`}
                >
                  {c.nombre} {c.tipo_futbol ? `(${c.tipo_futbol})` : ""}
                </div>
              ))
            )}
          </div>

          {/* Grilla tiempo × (días × canchas) */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `100px repeat(${visible.length * (data.canchas.length || 1)}, minmax(160px, 1fr))` }}
          >
            {/* Columna de horas */}
            <div className="border-r bg-white">
              {times.map((t, idx) => (
                <div key={`t-${t}-${idx}`} className="text-xs text-right pr-2 border-b" style={{ height: stepPx, lineHeight: `${stepPx}px` }}>
                  {t}
                </div>
              ))}
            </div>

            {/* Celdas día×cancha */}
            {visible.flatMap((d) =>
              (data.canchas.length ? data.canchas : [{ id: -1 }]).map((c) => {
                const k = `${d}#${c.id}`;
                const dayClosed = isDayClosed(d);

                // Bloques de esta columna (excluye cancelados)
                const blocks = (data.bloques || []).filter(
                  (b) => `${b.fecha}#${b.cancha_id}` === k && String(b.estado || "").toLowerCase() !== "cancelado"
                );

                const sMin = toMin(data.config?.open || "07:00");
                const eMin = toMin(data.config?.close || "22:00");
                const step = Number(data.config?.step || 60);
                const totalSteps = Math.max(0, Math.round((eMin - sMin) / step));
                const columnHeight = totalSteps * stepPx;

                // ====== Bloqueo cruzado por otro tipo (mismo día) ======
                const dayBlocks = (data.bloques || []).filter(
                  (b) => b.fecha === d && String(b.estado || "").toLowerCase() !== "cancelado"
                );
                const normDayBlocks = dayBlocks.map((b) => {
                  const tf = b.tipo_futbol || canchaById.get(b.cancha_id)?.tipo_futbol || "";
                  const st = String(b.estado || "").toLowerCase();
                  return { ...b, _tf: tf, _isTournament: st === "torneo", _isAcademia: st === "academia" };
                });

                let otherType = null;
                if (c.tipo_futbol === "F5") otherType = "F7";
                else if (c.tipo_futbol === "F7") otherType = "F5";

                const extraBlocksAll = otherType ? normDayBlocks.filter((b) => b._tf === otherType) : [];
                // para overlay de "BLOQUEADO" solo considerar reservas normales del otro tipo (no torneo, no academia)
                const extraOthers = extraBlocksAll.filter((b) => !b._isTournament && !b._isAcademia);

                const handleCellClick = (evt) => {
                  if (dayClosed) return; // ⛔ día cerrado
                  const bounds = evt.currentTarget.getBoundingClientRect();
                  const y = evt.clientY - bounds.top;
                  const stepsDown = Math.floor(y / stepPx);
                  const m = sMin + stepsDown * step;
                  const time = fromMin(m);

                  // No permitir crear si el punto cae en algún bloque local o cruce F5/F7 (torneo/academia/reserva)
                  const overlaps = (arr) =>
                    arr.some((b) => {
                      const hi = toMin(b.hi);
                      const hf = toMin(b.hf);
                      return m >= hi && m < hf;
                    });

                  if (overlaps(blocks)) return;

                  onNewSlot?.({ date: d, cancha_id: c.id, time, tipo_futbol: c.tipo_futbol });
                };

                return (
                  <div
                    key={`col-${d}-${c.id}`}
                    className={`relative border-b border-r ${
                      dayClosed ? "bg-neutral-100 cursor-not-allowed pointer-events-none" : "hover:bg-neutral-50/40 cursor-crosshair"
                    }`}
                    style={{ height: columnHeight }}
                    onClick={handleCellClick}
                    title={dayClosed ? "Día cerrado" : "Click para crear una reserva en este hueco"}
                  >
                    {/* guías */}
                    {times.slice(0, -1).map((_, i) => (
                      <div
                        key={`g-${i}`}
                        className="absolute left-0 right-0 border-b border-dashed border-neutral-200"
                        style={{ top: (i + 1) * stepPx }}
                      />
                    ))}

                    {/* Overlay de día cerrado */}
                    {dayClosed && (
                      <div className="absolute inset-1 rounded-md bg-neutral-300/60 text-white text-sm grid place-items-center">CERRADO</div>
                    )}

                    {/* bloques propios (reserva/torneo/academia) */}
                    {!dayClosed &&
                      blocks
                        .sort((a, b) => toMin(a.hi) - toMin(b.hi))
                        .map((b, idx) => {
                          const bi = Math.max(0, Math.round((toMin(b.hi) - sMin) / step));
                          const bj = Math.max(1, Math.round((toMin(b.hf) - toMin(b.hi)) / step));
                          const top = bi * stepPx;
                          const height = Math.max(stepPx, bj * stepPx);

                          const state = String(b.estado || "").toLowerCase();
                          const isTournament = state === "torneo";
                          const isAcademia = state === "academia";
                          const isPend = state === "pendiente";
                          const isPaid = state === "pagada" || state === "completada";

                          // estilo por tipo/estado
                          let bg = "bg-emerald-500";
                          if (isTournament) bg = "bg-slate-400";
                          else if (isAcademia) bg = "bg-sky-500";
                          else if (isPend) bg = "bg-amber-500";

                          const text = isTournament
                            ? `TORNEO · ${b.hi}–${b.hf}`
                            : isAcademia
                            ? `ENTRENO ACADEMIA · ${b.hi}–${b.hf}`
                            : `RESERVA · ${b.hi}–${b.hf}`;

                          // Bloques no clickeables: torneo + academia
                          const canClick = !isTournament && !isAcademia;

                          const handleClickBlock = (e) => {
                            e.stopPropagation();
                            if (canClick) onClickReserva?.(b);
                          };

                          return (
                            <div
                              key={`b-${b.id ?? `${d}-${c.id}-${idx}`}`}
                              className={`${bg} text-white text-xs rounded-md shadow-sm px-2 py-1 absolute left-1 right-1 overflow-hidden ${
                                canClick ? "cursor-pointer" : "cursor-default pointer-events-none"
                              }`}
                              style={{ top, height, minHeight: stepPx - 6 }}
                              onClick={handleClickBlock}
                              title={
                                isTournament
                                  ? "Torneo · bloqueado"
                                  : isAcademia
                                  ? "Entrenamiento de academia · bloqueado"
                                  : "Click para ver detalle"
                              }
                            >
                              <div className="truncate font-semibold">{text}</div>
                            </div>
                          );
                        })}

                    {/* overlays de BLOQUEADO por cruce otro tipo (solo reservas normales del otro tipo) */}
                    {!dayClosed &&
                      extraOthers.map((b, idx) => {
                        const bi = Math.max(0, Math.round((toMin(b.hi) - sMin) / step));
                        const bj = Math.max(1, Math.round((toMin(b.hf) - toMin(b.hi)) / step));
                        const top = bi * stepPx;
                        const height = Math.max(stepPx, bj * stepPx);
                        return (
                          <div
                            key={`x-blk-${b.id ?? `${d}-${c.id}-blk-${idx}`}`}
                            className="bg-slate-300/60 text-[10px] text-white rounded-md absolute left-1 right-1 flex items-center justify-center pointer-events-none"
                            style={{ top, height, minHeight: stepPx - 6 }}
                            title={`Bloqueado por ${b._tf}`}
                          >
                            BLOQUEADO
                          </div>
                        );
                      })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t flex items-center gap-3 text-sm">
        Alto por bloque:
        <input type="range" min={28} max={64} step={2} value={stepPx} onChange={(e) => setStepPx(Number(e.target.value))} />
        <span className="tabular-nums">{stepPx}px</span>
      </div>
    </div>
  );
}
