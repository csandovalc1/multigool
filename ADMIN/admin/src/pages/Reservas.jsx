// src/pages/Reservas.jsx (ADMIN)
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Search } from "lucide-react";
import { api } from "../lib/api";
import DateScroller from "../components/DateScroller.jsx";
import Stepper from "../components/Stepper.jsx";
import Chip from "../components/Chip.jsx";
import Modal from "../components/Modal.jsx";
import Toast from "../components/Toast.jsx";
import WeeklyAgenda from "../components/WeeklyAgenda.jsx";
import CanceledList from "../components/CanceledList.jsx";

const RATE_BY_MODE = { F5: 125, F7: 200 };

function computeTotalQ(r) {
  const rate = RATE_BY_MODE[(String(r?.tipo_futbol || '')).toUpperCase()] ?? 125;
  const durMin = Number(r?.dur_minutos || 0);
  if (r?.total_q != null) return Number(r.total_q).toFixed(2);
  return ((durMin / 60) * rate).toFixed(2);
}

const LIVE_DEBOUNCE_MS = 300;

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
const ymKey = (ymd) => ymd.slice(0, 7);
const isClosedEntry = (v) => {
  const t = String(v?.type || "").toUpperCase();
  const lbl = String(v?.label || "").trim().toUpperCase();
  return t === "CLOSED" || lbl === "CERRADO";
};

// --- helpers hoisted ---
function mapLookupToEditItem(r) {
  return {
    id: r.id,
    codigo_reserva: r.code || r.codigo_reserva || "-",
    cancha_id: r.cancha_id ?? null,
    cancha_nombre: r.cancha || r.cancha_nombre || "",
    tipo_futbol: r.tipo_futbol || "",
    fecha: (r.fecha || "").slice(0, 10),
    hora_i: (r.hi || r.hi_txt || "").slice(0, 5),
    hora_f: (r.hf || r.hf_txt || "").slice(0, 5),
    dur_minutos: r.dur_minutos || 60,
    cliente:
      ([r?.cliente?.nombres, r?.cliente?.apellidos].filter(Boolean).join(" ") ||
        r.cliente ||
        `${r.cliente_nombres || ""} ${r.cliente_apellidos || ""}`.trim()) || "",
    telefono: r?.cliente?.telefono || r.telefono || r.cliente_telefono || "",
    estado: r.estado || "pendiente",
    total_q_calc: computeTotalQ(r),
  };
}

export default function Reservas() {
  /* ================== ESTADOS PRINCIPALES (declarar primero) ================== */
  // fecha y filtro tipo se usan en búsquedas/efectos más abajo
  const [fecha, setFecha] = useState(todayYMD());
  const [tipo, setTipo] = useState("");

  // listado de agenda del día
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [agendaRev, setAgendaRev] = useState(0);
  const [trashRev, setTrashRev] = useState(0);

  // toasts
  const [toast, setToast] = useState("");

  // modales
  const [openCreate, setOpenCreate] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editItem, setEditItem] = useState(null);

  /* ================== BÚSQUEDA POR CÓDIGO ================== */
  const [lookupCode, setLookupCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [found, setFound] = useState(null);
  const [openLookup, setOpenLookup] = useState(false);

  const buscarReserva = async () => {
    const code = lookupCode.trim().toUpperCase();
    if (!code) {
      setLookupError("Escribe el código");
      return;
    }
    try {
      setLookupLoading(true);
      setLookupError("");
      const { data } = await api.get("/public/reservas/lookup", { params: { code } });
      if (data?.fecha) setFecha(String(data.fecha).slice(0, 10));
      const mapped = mapLookupToEditItem(data);
      setEditItem(mapped);
      setOpenEdit(true);
    } catch (e) {
      setFound(null);
      setLookupError(e?.response?.data?.error || "No se encontró la reserva");
    } finally {
      setLookupLoading(false);
    }
  };

  /* ================== BÚSQUEDA EN VIVO POR TEXTO ================== */
  const [searchQ, setSearchQ] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const liveTimerRef = useRef(null);
  const lastQueryIdRef = useRef(0);

  const buscarPorTexto = async () => {
    const q = searchQ.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    const myId = ++lastQueryIdRef.current;
    try {
      setSearchLoading(true);
      setSearchError("");
      const params = { q };
      if (tipo) params.tipo_futbol = tipo;
      const { data } = await api.get("/reservas", { params });
      if (myId !== lastQueryIdRef.current) return;
      setSearchResults(data || []);
    } catch (e) {
      if (myId !== lastQueryIdRef.current) return;
      setSearchResults([]);
      setSearchError(e?.response?.data?.error || "No se pudo buscar");
    } finally {
      if (myId === lastQueryIdRef.current) setSearchLoading(false);
    }
  };

  // live search con debounce y respeto del filtro `tipo`
  useEffect(() => {
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);

    const q = searchQ.trim();
    if (!q) {
      setSearchLoading(false);
      setSearchResults([]);
      setSearchError("");
      return;
    }

    liveTimerRef.current = setTimeout(async () => {
      const myId = ++lastQueryIdRef.current;
      try {
        setSearchLoading(true);
        const params = { q };
        if (tipo) params.tipo_futbol = tipo;
        const { data } = await api.get("/reservas", { params });
        if (myId !== lastQueryIdRef.current) return;
        setSearchResults(data || []);
        setSearchError("");
      } catch (e) {
        if (myId !== lastQueryIdRef.current) return;
        setSearchResults([]);
        setSearchError(e?.response?.data?.error || "No se pudo buscar");
      } finally {
        if (myId === lastQueryIdRef.current) setSearchLoading(false);
      }
    }, LIVE_DEBOUNCE_MS);

    return () => {
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, [searchQ, tipo]);

  /* ================== MODAL "NUEVA RESERVA" ================== */
  const [mode, setMode] = useState("F5");
  const [date, setDate] = useState(todayYMD());
  const [duration, setDuration] = useState(60);
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [sel, setSel] = useState({ cancha_id: null, cancha_nombre: "", time: "" });
  const [canchaIdx, setCanchaIdx] = useState(0);

  // cache de calendario + cierre
  const monthCacheRef = useRef(new Map());
  const [isClosed, setIsClosed] = useState(false);

  const ensureMonthLoaded = async (ymd) => {
    const key = ymKey(ymd);
    if (monthCacheRef.current.has(key)) return;
    try {
      const [y, m] = key.split("-").map(Number);
      const { data } = await api.get("/public/calendario/mes", { params: { year: y, month: m } });
      monthCacheRef.current.set(key, { summary: data?.summary || {} });
    } catch {
      monthCacheRef.current.set(key, { summary: {} });
    }
  };
  const recomputeIsClosed = (ymd) => {
    const key = ymKey(ymd);
    const bucket = monthCacheRef.current.get(key);
    if (!bucket) return false;
    const entry = bucket.summary?.[ymd];
    return isClosedEntry(entry);
  };

  const dateNice = useMemo(
    () =>
      new Date(date + "T00:00:00").toLocaleDateString("es-GT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [date]
  );
  const totalQ = useMemo(() => {
    const hours = Math.max(0, duration) / 60;
    const rate = RATE_BY_MODE[mode] ?? 125;
    return (hours * rate).toFixed(2);
  }, [duration, mode]);

  const payload = {
    mode,
    date,
    dateNice,
    time: sel.time,
    duration,
    cancha_id: sel.cancha_id,
    cancha_nombre: sel.cancha_nombre,
    totalQ,
  };
  const canConfirm = !!(sel.cancha_id && sel.time);
  const canProceed = canConfirm && !isClosed;

  /* ================== CARGAR AGENDA DEL DÍA ================== */
  const cargar = async (fechaArg = fecha, tipoArg = tipo) => {
    setLoading(true);
    try {
      const params = {};
      if (fechaArg) params.fecha = fechaArg;
      if (tipoArg) params.tipo_futbol = tipoArg;
      const { data } = await api.get("/reservas", { params });
      setLista(data || []);
      return data || [];
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    cargar(fecha, tipo);
  }, [fecha, tipo]);

  const openEditModal = (r) => {
    const total_q_calc = computeTotalQ(r);
    setEditItem({
      id: r.id,
      codigo_reserva: r.codigo_reserva || "-",
      cancha_id: r.cancha_id,
      cancha_nombre: r.cancha_nombre,
      tipo_futbol: r.tipo_futbol,
      fecha: r.fecha?.slice(0, 10) || "",
      hora_i: r.hi_txt?.slice(0, 5) || "",
      hora_f: r.hf_txt?.slice(0, 5) || "",
      dur_minutos: r.dur_minutos || 60,
      cliente: `${r.cliente_nombres || ""}${r.cliente_apellidos ? " " + r.cliente_apellidos : ""}`.trim(),
      telefono: r.cliente_telefono || "",
      estado: r.estado || "pendiente",
      total_q_calc,
    });
    setOpenEdit(true);
  };

  const saveEdit = async () => {
    if (!editItem?.id) return;
    try {
      await api.patch(`/reservas/${editItem.id}/estado`, { estado: editItem.estado });
      setOpenEdit(false);
      setEditItem(null);
      await cargar(fecha, tipo);
      setAgendaRev((v) => v + 1);
      if (String(editItem.estado).toLowerCase() === "cancelado") {
        setTrashRev((v) => v + 1); 
      }
      setToast("Estado actualizado ✅");
      setTimeout(() => setToast(""), 2000);
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo actualizar el estado");
    }
  };

  // Slots del modal (bloquea si el día está cerrado)
  useEffect(() => {
    if (!openCreate) return;
    (async () => {
      try {
        setLoadingSlots(true);
        setError("");
        setSel((s) => ({ ...s, time: "" }));

        await ensureMonthLoaded(date);
        const closed = recomputeIsClosed(date);
        setIsClosed(closed);

        if (closed) {
          setSlots([]);
          setError("Este día está CERRADO. No se admiten reservas.");
          return;
        }

        const { data } = await api.get("/reservas/slots", {
          params: { fecha: date, tipo_futbol: mode, dur: duration },
        });
        setSlots(data || []);
      } catch (e) {
        setError(e?.response?.data?.error || "No se pudieron cargar horarios");
      } finally {
        setLoadingSlots(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreate, date, mode, duration]);

  useEffect(() => {
    setCanchaIdx(0);
  }, [slots]);

  const handleConfirm = async (form) => {
    if (!canConfirm) return;

    // Revalidación final
    await ensureMonthLoaded(date);
    if (recomputeIsClosed(date)) {
      setOpenConfirm(false);
      setOpenCreate(false);
      setToast("No se puede reservar: ese día está CERRADO.");
      setTimeout(() => setToast(""), 2500);
      return;
    }

    try {
      setOpenConfirm(false);
      setOpenCreate(false);
      await api.post("/reservas", {
        cancha_id: sel.cancha_id,
        fecha: date,
        hora: sel.time,
        dur_minutos: duration,
        notas: form.notas || null,
        cliente: {
          nombres: form.nombres,
          apellidos: form.apellidos || null,
          email: form.email || null,
          telefono: form.telefono || null,
        },
      });
      setToast("Reserva creada ✅");
      setTimeout(() => setToast(""), 2500);
      await cargar(fecha, tipo);
      setAgendaRev((v) => v + 1);
      setSel({ cancha_id: null, cancha_nombre: "", time: "" });
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo crear la reserva");
    }
  };

  const cancelar = async (id) => {
    if (!confirm("¿Cancelar esta reserva?")) return;
    try {
      await api.patch(`/reservas/${id}/cancel`);
      await cargar(fecha, tipo);
      setAgendaRev((v) => v + 1);
      setTrashRev((v) => v + 1);
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo cancelar");
    }
  };

  const setEstado = async (id, estado) => {
    try {
      await api.patch(`/reservas/${id}/estado`, { estado });
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo actualizar el estado");
      return;
    }
    await cargar(fecha, tipo);
    setToast(`Estado actualizado a ${estado} ✅`);
    setTimeout(() => setToast(""), 2000);
  };

  const autocompletarVencidas = async () => {
    if (!confirm("¿Marcar como 'completada' todas las reservas ya vencidas?")) return;
    try {
      const { data } = await api.post("/reservas/autocompletar");
      const n = data?.updated ?? 0;
      await cargar(fecha, tipo);
      setToast(`Autocompletadas: ${n} ✅`);
      setTimeout(() => setToast(""), 2500);
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo autocompletar");
    }
  };

  return (
    <div className="space-y-6">
      {/* Acciones */}
      <div className="bg-white p-4 rounded-xl shadow">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="text-sm">
              <div className="text-slate-600 mb-1">Tipo fútbol</div>
              <select
                className="border p-2 rounded w-full"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="">(Todos)</option>
                <option value="F5">F5</option>
                <option value="F7">F7</option>
              </select>
            </label>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={async () => {
                // prepara modal "Nueva reserva"
                setDate(fecha);
                setMode(tipo || "F5");
                setDuration(60);
                setSel({ cancha_id: null, cancha_nombre: "", time: "" });
                setOpenCreate(true);
              }}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer transition-colors"
            >
              Nueva reserva
            </button>
            <button
              onClick={autocompletarVencidas}
              className="px-4 py-2 rounded border text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Autocompletar vencidas
            </button>
          </div>
        </div>
      </div>

      {/* Buscar por código */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Buscar reserva por código</h3>
        <div className="flex gap-2 items-center">
          <input
            className="border rounded px-3 py-2 w-full md:w-72"
            placeholder="Código (ej. RSV-2509-1234)"
            value={lookupCode}
            onChange={(e) => {
              setLookupCode(e.target.value);
              setLookupError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") buscarReserva();
            }}
          />
          <button
            onClick={buscarReserva}
            disabled={lookupLoading || !lookupCode.trim()}
            className={`px-4 py-2 rounded text-white inline-flex items-center gap-2 ${
              lookupLoading ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800"
            }`}
          >
            <Search className="h-4 w-4" /> Buscar
          </button>
        </div>
        {lookupError && (
          <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {lookupError}
          </div>
        )}
      </div>

      {/* Buscar por nombre/teléfono/email/código (LIVE) */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Buscar reservas por nombre / teléfono / email</h3>
        <div className="flex gap-2 items-center">
          <input
            className="border rounded px-3 py-2 w-full md:w-96"
            placeholder="Ej.: Carlos, 555, @correo.com o RSV-"
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value);
              setSearchError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") buscarPorTexto();
            }}
          />
          <button
            onClick={buscarPorTexto}
            disabled={searchLoading || !searchQ.trim()}
            className={`px-4 py-2 rounded text-white inline-flex items-center gap-2 ${
              searchLoading ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800"
            }`}
            title="Busca en nombre, apellido, email, teléfono o código"
          >
            <Search className="h-4 w-4" /> Buscar
          </button>
        </div>

        <div className="mt-2 text-xs text-neutral-500">
          {searchLoading
            ? "Buscando..."
            : searchQ.trim()
              ? `${searchResults.length} resultado(s)`
              : "Escribe para buscar"}
          {tipo ? ` · Filtro: ${tipo}` : ""}
        </div>

        {searchError && (
          <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {searchError}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-3 border rounded-lg overflow-hidden">
            <ul className="divide-y">
              {searchResults.map((r) => (
                <li key={r.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {r.cliente_nombres} {r.cliente_apellidos || ""}{" "}
                      <span className="text-xs text-neutral-500">
                        · {r.codigo_reserva} · {r.fecha?.slice(0, 10)} · {r.hi_txt?.slice(0,5)}–{r.hf_txt?.slice(0,5)}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 truncate">
                      {r.cliente_email || "sin email"} · {r.cliente_telefono || "sin teléfono"} · {r.cancha_nombre} ({r.tipo_futbol})
                    </div>
                    <div className="mt-1 text-xs">
  <span className="inline-block px-2 py-0.5 rounded border bg-amber-50 border-amber-200 text-amber-800">
    Total: Q {computeTotalQ(r)}
  </span>
</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${
                        r.estado === "pagada"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : r.estado === "completada"
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : r.estado === "cancelado"
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}
                    >
                      {r.estado}
                    </span>
                    <button
                      className="px-3 py-1 rounded border text-sm hover:bg-neutral-50"
                      onClick={() => openEditModal(r)}
                      title="Ver / Editar"
                    >
                      Ver
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Agenda diaria */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-3">Agenda del día</h3>
        <WeeklyAgenda
          key={agendaRev}
          start={todayYMD()}
          tipo={tipo}
          onDayChange={(d) => {
            setFecha(d);
          }}
          onNewSlot={({ date: d, cancha_id, time, tipo_futbol }) => {
            setDate(d);
            setMode(tipo_futbol || tipo || "F5");
            setDuration(60);
            const canchaNombre =
              lista.find((x) => x.cancha_id === cancha_id)?.cancha_nombre || "";
            setSel({ cancha_id, cancha_nombre: canchaNombre, time });
            setOpenCreate(true);
          }}
          onClickReserva={async (b) => {
            if (fecha !== b.fecha) setFecha(b.fecha);
            let f = lista.find((r) => r.id === b.id);
            if (!f) {
              const fresh = await cargar(b.fecha, tipo);
              f = fresh.find((r) => r.id === b.id);
            }
            if (f) openEditModal(f);
          }}
        />
      </div>

      {/* Papelera */}
      <div className="bg-white p-4 rounded-xl shadow">
        <CanceledList
   tipo={tipo}
   rev={trashRev}                // <- hará reload cuando cambie
   onChanged={(evt) => {         // <- llamado por el hijo en restore/recambio
     if (evt?.affectsAgenda) {
       cargar(fecha, tipo);
       setAgendaRev((v) => v + 1);
     }
   }}
/>
      </div>

      {/* MODAL A: Nueva reserva */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Nueva reserva"
        panelClass="max-w-lg"
        bodyClass="max-h-[60vh] pr-1"
      >
        <div className="grid gap-6">
          <div>
            <h3 className="text-sm font-black uppercase text-neutral-500 mb-2">
              Escoge el tipo de fútbol
            </h3>
            <div className="flex gap-2">
              {["F5", "F7"].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setSel({ cancha_id: null, cancha_nombre: "", time: "" });
                  }}
                  className={`px-4 py-2 rounded-md border text-sm font-semibold ${
                    mode === m ? "bg-blue-50 border-blue-300" : "bg-white"
                  }`}
                  disabled={isClosed}
                  title={isClosed ? "Día cerrado" : "Cambiar modalidad"}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase text-neutral-500 mb-2">
              Escoge la fecha
            </h3>
            <DateScroller
              value={date}
              setValue={(d) => {
                setDate(d);
                setSel((s) => ({ ...s, time: "" }));
              }}
            />
            {isClosed && (
              <div className="mt-2 p-2 rounded-md bg-neutral-100 border border-neutral-300 text-neutral-700 text-sm">
                <b>Este día está CERRADO.</b> No se admiten reservas ni horarios.
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-black uppercase text-neutral-500 mb-2">
              Duración
            </h3>
            <Stepper
              value={duration}
              setValue={(v) => {
                setDuration(v);
                setSel((s) => ({ ...s, time: "" }));
              }}
            />
<div className="text-xs text-neutral-400">
            (Q {RATE_BY_MODE[mode] ?? 125} / hora)
          </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase text-neutral-500 mb-2">
              Elige cancha y hora
            </h3>

            {error && (
              <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                {error}
              </div>
            )}
            {loadingSlots && (
              <div className="p-3 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
                Cargando horarios...
              </div>
            )}

            {!loadingSlots && !error && (
              <>
                {slots.length === 0 ? (
                  <div className="p-3 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
                    {isClosed ? "Día cerrado." : "No hay canchas u horarios disponibles para esos filtros."}
                  </div>
                ) : (
                  <div className="rounded-xl border bg-white shadow-sm">
                    <div className="flex items-center justify-between p-3 border-b">
                      <button
                        className="px-2 py-1 rounded border text-sm disabled:opacity-40"
                        onClick={() => setCanchaIdx((i) => Math.max(0, i - 1))}
                        disabled={canchaIdx === 0}
                        title="Cancha anterior"
                      >
                        ←
                      </button>

                      <div className="text-sm font-semibold">
                        {slots[canchaIdx].cancha_nombre}{" "}
                        <span className="text-neutral-500">
                          ({canchaIdx + 1}/{slots.length})
                        </span>
                      </div>

                      <button
                        className="px-2 py-1 rounded border text-sm disabled:opacity-40"
                        onClick={() =>
                          setCanchaIdx((i) => Math.min(slots.length - 1, i + 1))
                        }
                        disabled={canchaIdx === slots.length - 1}
                        title="Siguiente cancha"
                      >
                        →
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 pt-2">
                      <div className="text-xs text-neutral-500">
                        Modalidad: {mode} · Fecha: {dateNice}
                      </div>
                      <button
                        onClick={() => {
                          const g = slots[canchaIdx];
                          setSel((s) =>
                            s.cancha_id === g.cancha_id
                              ? { cancha_id: null, cancha_nombre: "", time: "" }
                              : { cancha_id: g.cancha_id, cancha_nombre: g.cancha_nombre, time: "" }
                          );
                        }}
                        disabled={isClosed}
                        className={`px-3 py-1 rounded-md text-sm border ${
                          isClosed
                            ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                            : sel.cancha_id === slots[canchaIdx].cancha_id
                              ? "bg-blue-50 border-blue-300"
                              : "bg-white hover:bg-neutral-50"
                        }`}
                        title={isClosed ? "Día cerrado" : "Seleccionar cancha"}
                      >
                        {isClosed
                          ? "CERRADO"
                          : sel.cancha_id === slots[canchaIdx].cancha_id
                            ? "Seleccionada"
                            : "Seleccionar cancha"}
                      </button>
                    </div>

                    <div className="p-3 pt-0">
                      {slots[canchaIdx].slots.length === 0 ? (
                        <div className="text-sm text-neutral-500">Sin horarios disponibles.</div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {slots[canchaIdx].slots.map((s) => (
                            <Chip
                              key={`${slots[canchaIdx].cancha_id}-${s.hora}`}
                              active={
                                sel.cancha_id === slots[canchaIdx].cancha_id &&
                                sel.time === s.hora
                              }
                              onClick={() => {
                                if (isClosed) return;
                                const g = slots[canchaIdx];
                                setSel({
                                  cancha_id: g.cancha_id,
                                  cancha_nombre: g.cancha_nombre,
                                  time: s.hora,
                                });
                              }}
                            >
                              {s.hora} — {s.hasta}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => canProceed && setOpenConfirm(true)}
            disabled={!canProceed}
            className={`mt-2 self-start px-6 py-2 rounded-md text-white font-semibold inline-flex items-center gap-2
                        ${
                          canProceed
                            ? "bg-blue-600 hover:bg-blue-500"
                            : "bg-blue-300 cursor-not-allowed"
                        }`}
            title={
              isClosed
                ? "Día cerrado"
                : (canConfirm ? "Continuar con la reserva" : "Elige cancha y hora")
            }
          >
            <Clock className="h-5 w-5" /> Reservar
          </button>
        </div>
      </Modal>

      {/* Modal detalle por código */}
      <Modal
        open={openLookup}
        onClose={() => setOpenLookup(false)}
        title="Detalle de la reserva"
        panelClass="max-w-md"
      >
        {found ? <ReservaInfoCard r={found} /> : <div className="text-sm text-slate-500">Sin datos</div>}
      </Modal>

      {/* MODAL B: Confirmación */}
      <Modal
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        title="Confirma la reserva"
        panelClass="max-w-md"
        bodyClass="max-h-[60vh] pr-1"
      >
        <ConfirmForm payload={payload} onConfirm={handleConfirm} />
      </Modal>

      {/* MODAL Editar (solo estado) */}
      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        title="Editar estado de la reserva"
        panelClass="max-w-md"
        bodyClass="max-h-[70vh] pr-1"
      >
        {!editItem ? null : (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-xs text-neutral-500">Código</div>
              <div className="font-mono">{editItem.codigo_reserva}</div>
              <div className="text-xs text-neutral-500">Cancha</div>
              <div>
                {editItem.cancha_nombre} ({editItem.tipo_futbol})
              </div>
              <div className="text-xs text-neutral-500">Fecha</div>
              <div>{editItem.fecha}</div>
              <div className="text-xs text-neutral-500">Hora</div>
              <div>
                {editItem.hora_i} — {editItem.hora_f}
              </div>
              <div className="text-xs text-neutral-500">Duración</div>
              <div>{editItem.dur_minutos} min</div>
              <div className="text-xs text-neutral-500">Total a pagar</div>
              <div>Q {editItem.total_q_calc}</div>
              <div className="text-xs text-neutral-500">Cliente</div>
              <div>{editItem.cliente || "-"}</div>
              <div className="text-xs text-neutral-500">Teléfono</div>
              <div>{editItem.telefono || "-"}</div>
            </div>

            <label className="text-sm mt-2">
              <div className="text-slate-600 mb-1">Estado</div>
              <select
                className="border p-2 rounded w-full"
                value={editItem.estado}
                onChange={(e) => setEditItem({ ...editItem, estado: e.target.value })}
              >
                <option value="pendiente">pendiente</option>
                <option value="pagada">pagada</option>
                <option value="completada">completada</option>
                <option value="cancelado">cancelado</option>
              </select>
            </label>

            <div className="pt-2 flex justify-end gap-2">
              <button className="px-4 py-2 rounded border" onClick={() => setOpenEdit(false)}>
                Cerrar
              </button>
              <button className="px-4 py-2 rounded bg-slate-900 text-white" onClick={saveEdit}>
                Guardar estado
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toast text={toast} />
    </div>
  );
}

function ConfirmForm({ payload, onConfirm }) {
  const [form, setForm] = useState({
    nombres: "",
    apellidos: "",
    email: "",
    telefono: "",
    notas: "",
  });
  const disabled = !form.nombres.trim();

  return (
    <>
      <div className="grid md:grid-cols-2 gap-3">
        <input
          placeholder="Nombres *"
          className="rounded-md border px-3 py-2"
          value={form.nombres}
          onChange={(e) => setForm({ ...form, nombres: e.target.value })}
        />
        <input
          placeholder="Apellidos"
          className="rounded-md border px-3 py-2"
          value={form.apellidos}
          onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
        />
        <input
          placeholder="Correo electrónico"
          className="rounded-md border px-3 py-2 md:col-span-2"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          placeholder="Número telefónico"
          className="rounded-md border px-3 py-2 md:col-span-2"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />
        <textarea
          placeholder="Notas (opcional)"
          className="rounded-md border px-3 py-2 md:col-span-2"
          rows={3}
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
        />
      </div>

      <div className="mt-4 text-sm text-neutral-700 space-y-1">
        <div>Cancha: <b>{payload.cancha_nombre || "—"}</b></div>
        <div>Modalidad: <b>{payload.mode}</b></div>
        <div>Fecha: <b>{payload.dateNice}</b></div>
        <div>Hora: <b>{payload.time || "—"}</b></div>
        <div>Duración: <b>{payload.duration / 60} hora(s)</b></div>
        <div>Total a cobrar: <b>Q {payload.totalQ}</b></div>
      </div>

      <button
        onClick={() => onConfirm(form)}
        disabled={disabled}
        className={`mt-6 w-full px-5 py-3 rounded-full text-white font-extrabold tracking-wide uppercase
                    ${disabled ? "bg-green-300 cursor-not-allowed" : "bg-green-500 hover:bg-green-400"}`}
      >
        Confirmar
      </button>
    </>
  );
}

function ReservaInfoCard({ r }) {
  const rate = RATE_BY_MODE[(r.tipo_futbol || "").toUpperCase()] ?? 125;
  const totalQ =
    r.total_q != null
      ? Number(r.total_q).toFixed(2)
      : ((Number(r.dur_minutos || 0) / 60) * rate).toFixed(2);

  return (
    <div className="space-y-2 text-sm">
      <div className="rounded border p-3 bg-slate-50">
        <div className="font-semibold">
          Código: <span className="font-mono">{r.code || r.codigo_reserva}</span>
        </div>
        <div>Estado: <b>{r.estado}</b></div>
      </div>

      <div>Cancha: <b>{r.cancha}</b> {r.tipo_futbol && <span className="text-xs text-neutral-500">({r.tipo_futbol})</span>}</div>
      <div>Fecha: <b>{r.fecha}</b></div>
      <div>Horario: <b>{r.hi}</b> – <b>{r.hf}</b> ({Math.round((r.dur_minutos||0)/60*10)/10} h)</div>
      <div>Total: <b>Q {totalQ}</b></div>

      <hr className="my-2" />
      <div className="text-neutral-500">Cliente</div>
      <div>Nombre: <b>{[r.cliente?.nombres, r.cliente?.apellidos].filter(Boolean).join(" ") || "—"}</b></div>
      <div>Correo: <b>{r.cliente?.email || "—"}</b></div>
      <div>Teléfono: <b>{r.cliente?.telefono || "—"}</b></div>
      {r.notas && <div className="pt-2 text-neutral-700"><span className="text-neutral-500">Notas: </span>{r.notas}</div>}
    </div>
  );
}
