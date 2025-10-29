import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import PoPartidoModal from "./PoPartidoModal";
import PlantillaEquipoModal from "./PlantillaEquipoModal";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/* ====== Helpers de formato ====== */

/** Fecha "mar 15 de oct" (si viene 'YYYY-MM-DD') */
function fmtFecha(fechaStr) {
  if (!fechaStr) return null;
  const d = parseISO(fechaStr);
  if (isNaN(d)) return null;
  return format(d, "dd/MM"); // ej: 05/10
}


/** Hora robusta -> "13:00"
 * Soporta: "HH:mm", "HH:mm:ss", "HH:mm:ss.fffffff",
 *          "1970-01-01T13:00:00.000Z", etc.
 */
function fmtHora(hora) {
  if (hora == null) return null;

 const s = String(hora).trim();

  // 1) ISO completo (con fecha y zona): "2025-10-28T19:00:00.000Z", "2025-10-28T19:00:00+00:00"
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = parseISO(s);
    if (!isNaN(d)) {
      return d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
  }

  // 2) Hora con zona/offset: "19:00Z", "19:00:00Z", "19:00:00.123Z", "19:00+00:00", "19:00:00-06:00"
  if (/^\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?(Z|[+-]\d{2}:\d{2})$/.test(s)) {
    // Construimos un ISO completo para que el offset se aplique
    const iso = `1970-01-01T${s.replace(/\s+/g, "")}`;
    const d = parseISO(iso);
    if (!isNaN(d)) {
      return d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
  }

  // 3) Hora simple local: "HH:mm", "HH:mm:ss", "HH:mm:ss.fffffff"
  const m = s.match(/^\s*(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d{1,7})?)?\s*$/);
  if (m) {
    const hh = m[1].padStart(2, "0");
    const mm = m[2];
    return `${hh}:${mm}`;
  }

  // 4) Cualquier otra cadena que contenga HH:mm en algún lado (fallback)
  const m2 = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (m2) {
    const hh = m2[1].padStart(2, "0");
    const mm = m2[2];
    return `${hh}:${mm}`;
  }
  return null;
}


/** "mar 15 de oct · 13:00 @ Cancha X" (con fallbacks) */
function fmtFechaHoraCancha({ fecha, hora, cancha }) {
  const f = fmtFecha(fecha);
  const h = fmtHora(hora);
  const parts = [];
  if (f) parts.push(f);
  if (h) parts.push(h);
  const main = parts.length ? parts.join(" · ") : "Sin programar";
  return cancha ? `${main} @ ${cancha}` : main;
}

/** Etiqueta bonita para la ronda */
function roundLabel(key) {
  return key === "R16" ? "Octavos"
    : key === "QF"   ? "Cuartos"
    : key === "SF"   ? "Semifinal"
    : key === "F"    ? "Final"
    : key || "";
}

/* ====== UI atoms ====== */
function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-indigo-100 text-indigo-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

function IconLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="inline-block align-[-2px]">
      <path fill="currentColor" d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2m-8-2a3 3 0 1 1 6 0v2H9zm9 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1z"/>
    </svg>
  );
}

/* ====== Tarjeta de una serie ====== */
function SeriesCard({
  serie,
  round_key,
  ida_vuelta,
  teamName,
  onEditLeg,
  onCloseSeries,
  onUndoSeries,
  isFirstRound,
  onAddTeam,
}) {
  const isClosed = !!serie.winner_id;

  const puedeCerrar = () => {
    if (isClosed) return false;
    if (!ida_vuelta) {
      const l1 = serie.legs.find((l) => l.leg === 1);
      return l1 && l1.home_goals != null && l1.away_goals != null;
    }
    const l1 = serie.legs.find((l) => l.leg === 1);
    const l2 = serie.legs.find((l) => l.leg === 2);
    return (
      l1 && l2 &&
      l1.home_goals != null && l1.away_goals != null &&
      l2.home_goals != null && l2.away_goals != null
    );
  };

  return (
    <div className="bg-white rounded-xl border p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Serie #{serie.match_no}</span>
          {/* ❌ ya NO mostramos "Ida/Vuelta" aquí (solo en el encabezado de la ronda) */}
          {isClosed && (
            <Pill tone="emerald">
              Ganador: {teamName(serie.winner_id) || "—"}
            </Pill>
          )}
        </div>
        {isClosed && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <IconLock /> Serie cerrada
          </span>
        )}
      </div>

      <div className="space-y-2 text-sm">
        {serie.legs.map((leg) => {
          const showAddHome = isFirstRound && !isClosed && leg.leg === 1 && leg.home_id == null;
          const showAddAway = isFirstRound && !isClosed && leg.leg === 1 && leg.away_id == null;

          const infoLine = fmtFechaHoraCancha({
            fecha: leg.fecha,
            hora: leg.hora,
            cancha: leg.cancha,
          });

          return (
            <div key={leg.id} className="flex items-center justify-between border rounded-lg p-2 hover:bg-slate-50 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Pill>Leg {leg.leg}</Pill>
                  <span className="text-xs text-slate-500 truncate">{infoLine}</span>
                </div>

                <div className="font-medium flex items-center gap-2 flex-wrap">
                  <span className="truncate max-w-[180px]">{teamName(leg.home_id) || "— BYE —"}</span>

                  {showAddHome && (
                    <button
                      className="px-2 py-0.5 text-xs rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => onAddTeam?.({ leg, slot: "home" })}
                      title="Agregar equipo en Local"
                    >
                      Agregar (Local)
                    </button>
                  )}

                  <span className="px-2 py-0.5 rounded bg-slate-100">{leg.home_goals ?? "-"}</span>
                  <span>—</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100">{leg.away_goals ?? "-"}</span>

                  <span className="truncate max-w-[180px]">{teamName(leg.away_id) || "— BYE —"}</span>

                  {showAddAway && (
                    <button
                      className="px-2 py-0.5 text-xs rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => onAddTeam?.({ leg, slot: "away" })}
                      title="Agregar equipo en Visita"
                    >
                      Agregar (Visita)
                    </button>
                  )}
                </div>
              </div>

              <button
                className={`px-2 py-1 text-xs rounded ${
                  isClosed
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
                onClick={() => !isClosed && onEditLeg(leg)}
                disabled={isClosed}
                title={isClosed ? "Serie cerrada" : "Editar fecha/hora/cancha/resultado"}
              >
                {isClosed ? "Bloqueado" : "Editar"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 mt-3">
        {isClosed ? (
          <button
            className="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-500"
            onClick={() => onUndoSeries(round_key, serie.match_no)}
            title="Reabrir (deshacer ganador y limpiar propagación)"
          >
            Reabrir serie
          </button>
        ) : (
          <button
            disabled={!puedeCerrar()}
            className={`px-3 py-1 rounded text-white ${
              puedeCerrar() ? "bg-indigo-600 hover:bg-indigo-500" : "bg-slate-400 cursor-not-allowed"
            }`}
            onClick={() => onCloseSeries(round_key, serie.match_no)}
            title={!puedeCerrar() ? "Completa los goles de los legs" : "Cerrar serie"}
          >
            Cerrar serie
          </button>
        )}
      </div>
    </div>
  );
}

/* ====== Panel principal ====== */
export default function BracketPanel({ torneoId }) {
  const [data, setData] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [editLeg, setEditLeg] = useState(null); // { ...leg, torneoId }
  const [equipoPlantilla, setEquipoPlantilla] = useState(null); // {id, nombre}

  const teamNameMap = useMemo(() => {
    const m = new Map();
    for (const e of equipos) m.set(Number(e.id), e.nombre);
    return m;
  }, [equipos]);

  const teamName = (id) => (id ? teamNameMap.get(Number(id)) : null);

  const load = async () => {
    const [{ data: bracket }, { data: eqs }] = await Promise.all([
      api.get(`/playoffs/${torneoId}/bracket`),
      api.get(`/equipos/${torneoId}`),
    ]);
    setData(bracket);
    setEquipos(eqs || []);
  };

  useEffect(() => {
    if (torneoId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId]);

  const closeSeries = async (round_key, match_no) => {
    try {
      await api.post(`/playoffs/${torneoId}/close-series`, { round_key, match_no });
      await load();
    } catch (e) {
      const msg = e?.response?.data?.error || "";
      if (/penales/i.test(msg)) {
        const ph = prompt("Penales local:");
        const pa = prompt("Penales visita:");
        await api.post(`/playoffs/${torneoId}/close-series`, {
          round_key, match_no,
          penales_home: Number(ph),
          penales_away: Number(pa),
        });
        await load();
      } else {
        alert(msg || "No se pudo cerrar la serie");
      }
    }
  };

  const undoSeries = async (round_key, match_no) => {
    try {
      await api.post(`/playoffs/${torneoId}/undo-series`, { round_key, match_no });
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo reabrir la serie");
    }
  };

  // Crear equipo y asignarlo al slot (home/away) de un LEG
  const addTeamToSlot = async ({ leg, slot }) => {
    try {
      if (leg.winner_id) {
        alert("La serie ya está cerrada");
        return;
      }
      if (leg.leg !== 1) {
        alert("Asigna siempre sobre el Leg 1");
        return;
      }

      const nombre = prompt("Nombre del nuevo equipo:");
      if (!nombre || !nombre.trim()) return;

      // 1) crear equipo en el torneo
      const createRes = await api.post("/equipos", {
        nombre: nombre.trim(),
        torneo_id: torneoId,
      });
      const newTeamId =
        createRes?.data?.insertId ||
        createRes?.data?.id ||
        createRes?.data?.team_id;
      if (!newTeamId) throw new Error("No se pudo obtener el ID del nuevo equipo");

      // 2) asignarlo al slot del leg (home/away)
      await api.post(`/playoffs/${torneoId}/assign-slot`, {
        match_id: Number(leg.id), // id del leg1
        slot: slot,               // 'home' | 'away'
        team_id: Number(newTeamId),
      });

      // 3) recargar
      await load();

      // 4) abrir modal de plantilla automáticamente
      setEquipoPlantilla({ id: Number(newTeamId), nombre: nombre.trim() });
    } catch (e) {
      alert(
        e?.response?.data?.error ||
        e.message ||
        "No se pudo agregar/asignar el equipo"
      );
    }
  };

  if (!data) return <div className="text-sm text-slate-500">Cargando bracket…</div>;
  if (!data.eliminatoria) return <div className="text-sm text-slate-500">Aún no hay eliminatorias para este torneo.</div>;

  const firstRoundKey = data?.rounds?.[0]?.round_key || null;

  return (
    <>
      {/* ❌ Quitamos el título global "Eliminatorias" para no duplicar */}
      <div className="grid md:grid-cols-4 gap-4">
        {data.rounds.map((r) => (
          <div key={r.round_key}>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold">{roundLabel(r.round_key)}</h4>
              <Pill tone={r.ida_vuelta ? "indigo" : "slate"}>
                {r.ida_vuelta ? "Ida/Vuelta" : "Único"}
              </Pill>
            </div>

            <div className="space-y-3">
              {r.series.map((s) => (
                <SeriesCard
                  key={s.match_no}
                  serie={s}
                  round_key={r.round_key}
                  ida_vuelta={r.ida_vuelta}
                  teamName={teamName}
                  onEditLeg={(leg) => setEditLeg({ ...leg, torneoId })}
                  onCloseSeries={closeSeries}
                  onUndoSeries={undoSeries}
                  isFirstRound={r.round_key === firstRoundKey}
                  onAddTeam={addTeamToSlot}
                />
              ))}
              {!r.series.length && (
                <div className="text-sm text-slate-500">Sin series.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <PoPartidoModal
        open={!!editLeg}
        leg={editLeg}
        teamName={teamName}
        onClose={() => setEditLeg(null)}
        onSaved={async () => { setEditLeg(null); await load(); }}
      />

      {equipoPlantilla && (
        <PlantillaEquipoModal
          equipo={equipoPlantilla}
          onClose={() => setEquipoPlantilla(null)}
        />
      )}
    </>
  );
}
