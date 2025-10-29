import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import PartidoModal from "../widgets/PartidoModal";
import JornadaPartidosModal from "../widgets/JornadaPartidosModal";
import TablaPosicionesPanel from "../widgets/TablaPosicionesPanel";
import PlayoffsConfigModal from "../widgets/PlayoffsConfigModal";
import BracketPanel from "../widgets/BracketPanel";
import TorneoDetalleModal from "../widgets/TorneoDetalleModal";


export default function Jornadas() {
  const [torneos, setTorneos] = useState([]);
  const [tid, setTid] = useState("");
  const [torneoSel, setTorneoSel] = useState(null);
  const [jornadas, setJornadas] = useState([]);
  const [jSel, setJSel] = useState(null);
  const [pSel, setPSel] = useState(null);
  const [showJornadaModal, setShowJornadaModal] = useState(false);
  const [showPOConfig, setShowPOConfig] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showTorneoModal, setShowTorneoModal] = useState(false);


  // eliminatorias + vista actual
  const [hasElim, setHasElim] = useState(false);
  const [viewMode, setViewMode] = useState("tabla"); // 'tabla' | 'bracket'

  const location = useLocation();
  const navigate = useNavigate();

  const handleAnySave = async () => {
  await loadFor(tid);          // recarga jornadas, estado y torneos
  setRefreshTick(t => t + 1);  // fuerza remount de la tabla
};

  // Carga listado de torneos una sola vez
  useEffect(() => {
    api.get("/torneos").then((r) => setTorneos(r.data));
  }, []);

  // Toma ?t=... al entrar/si cambia la URL (deep-link)
  useEffect(() => {
    const tParam = new URLSearchParams(location.search).get("t") || "";
    setTid(tParam);
  }, [location.search]);

  // Función de carga para un torneo específico
  const loadFor = async (id) => {
    if (!id) {
      // limpiar si no hay selección
      setTorneoSel(null);
      setJornadas([]);
      setHasElim(false);
      setViewMode("tabla");
      return;
    }

    const [torneosRes, jornadasRes, stateRes] = await Promise.all([
      api.get("/torneos"),
      api.get(`/fixture/jornadas/${id}`),
      api.get(`/playoffs/${id}/state`).catch(() => ({ data: { eliminatoria_id: null } })),
    ]);

    const tObj = torneosRes.data.find((x) => String(x.id) === String(id)) || null;
    setTorneoSel(tObj);
    setJornadas(jornadasRes.data);

    const elimId = stateRes?.data?.eliminatoria_id || null;
    const _hasElim = !!elimId;
    setHasElim(_hasElim);

    // Vista por defecto según reglas
    const defaultView = _hasElim || tObj?.tipo_torneo === "eliminacion" ? "bracket" : "tabla";
    setViewMode(defaultView);

    setJSel(null);
  };

  // Cuando cambia 'tid', carga automáticamente
  useEffect(() => {
    loadFor(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);

  const onChangeTorneo = (e) => {
    const id = e.target.value;
    setTid(id);
    navigate(id ? `?t=${id}` : ""); // actualiza la URL para poder compartir
  };

  const abrirPartidosDeJornada = (j) => {
    setJSel(j);
    setShowJornadaModal(true);
  };

  // === LÓGICA DE VISIBILIDAD ===
  const showJornadasList =
    !!torneoSel &&
    !(hasElim && viewMode === "bracket") &&
    torneoSel.tipo_torneo !== "eliminacion";

  const canShowToggle = hasElim;
  const canShowPosicionesBtn = hasElim && torneoSel?.tipo_torneo !== "eliminacion";

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
  <select
    className="border p-2 rounded"
    value={tid}
    onChange={onChangeTorneo}
  >
    <option value="">Seleccione torneo</option>
    {torneos.map((t) => (
      <option key={t.id} value={t.id}>
        {t.nombre}
      </option>
    ))}
  </select>

  {torneoSel && (
    <button
      onClick={() => setShowTorneoModal(true)}
      className="px-3 py-2 rounded bg-slate-900 text-white text-sm hover:bg-slate-800"
      title="Ver detalle del torneo"
    >
      Ver detalle torneo
    </button>
  )}
</div>


      {/* GRID: 2 columnas sólo si se muestra la lista de jornadas */}
      <div className={`grid gap-4 ${showJornadasList ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {/* Lista de jornadas (condicional) */}
        {showJornadasList && (
          <div className="bg-white p-4 rounded-xl shadow">
            <h3 className="font-semibold mb-2">Jornadas</h3>
            <ul className="space-y-1">
              {jornadas.map((j) => (
                <li
                  key={j.id}
                  className="flex items-center justify-between border p-2 rounded"
                >
                  <span>Jornada {j.numero}</span>
                  <button
                    onClick={() => abrirPartidosDeJornada(j)}
                    className="text-sm px-2 py-1 bg-slate-800 text-white rounded"
                  >
                    Ver partidos
                  </button>
                </li>
              ))}
              {!jornadas.length && (
                <li className="text-sm text-slate-500">No hay jornadas aún.</li>
              )}
            </ul>
          </div>
        )}

        {/* Panel derecho */}
        <div className="bg-white p-4 rounded-xl shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">
              {hasElim
                ? viewMode === "bracket" ? "Eliminatorias" : "Tabla de posiciones"
                : (torneoSel?.tipo_torneo === "liguilla" ? "Tabla de posiciones" : "Eliminatorias")}
            </h3>

            {/* Iniciar eliminatorias (liguilla en fase liga, sin elim) */}
            {torneoSel?.fase === 'liga' && torneoSel?.tipo_torneo === 'liguilla' && !hasElim && (
              <button
                onClick={()=>setShowPOConfig(true)}
                className="text-xs px-2 py-1 rounded bg-indigo-600 text-white"
                title="Iniciar eliminatorias para este torneo"
              >
                Iniciar eliminatorias
              </button>
            )}

            {/* Toggle Bracket/Tabla (sin posiciones si es eliminación pura) */}
            {canShowToggle && (
              <div className="flex gap-1">
                <button
                  className={`px-2 py-1 text-xs rounded ${viewMode==='bracket' ? 'bg-slate-900 text-white' : 'bg-slate-200'}`}
                  onClick={()=>setViewMode('bracket')}
                  title="Ver Eliminatorias"
                >
                  Bracket
                </button>

                {canShowPosicionesBtn && (
                  <button
                    className={`px-2 py-1 text-xs rounded ${viewMode==='tabla' ? 'bg-slate-900 text-white' : 'bg-slate-200'}`}
                    onClick={()=>setViewMode('tabla')}
                    title="Ver Tabla de posiciones"
                  >
                    Posiciones
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Contenido según estado */}
{hasElim ? (
  viewMode === 'bracket'
    ? (tid ? <BracketPanel key={`b-${tid}-${refreshTick}`} torneoId={Number(tid)} /> : <p className="text-sm text-slate-500">Seleccione un torneo.</p>)
    : (tid ? <TablaPosicionesPanel key={`t-${tid}-${refreshTick}`} torneoId={Number(tid)} /> : <p className="text-sm text-slate-500">Seleccione un torneo.</p>)
) : (
  torneoSel?.tipo_torneo === "liguilla"
    ? (tid ? <TablaPosicionesPanel key={`t-${tid}-${refreshTick}`} torneoId={Number(tid)} /> : <p className="text-sm text-slate-500">Seleccione un torneo.</p>)
    : <p className="text-sm text-slate-500">Este torneo es de eliminación directa…</p>
)}

        </div>
      </div>

      {/* Modales */}

      {showTorneoModal && torneoSel && (
  <TorneoDetalleModal
    torneo={torneoSel}
    onClose={() => setShowTorneoModal(false)}
  />
)}

{pSel && (
  <PartidoModal
    partido={pSel}
    onClose={() => setPSel(null)}
    onSaved={handleAnySave}     // 👈 nuevo
  />
)}

{showJornadaModal && jSel && (
  <JornadaPartidosModal
    jornada={jSel}
    onClose={() => setShowJornadaModal(false)}
    onOpenPartido={(p) => setPSel(p)}
    onSaved={handleAnySave}     // 👈 nuevo
  />
)}


      {showPOConfig && torneoSel && (
        <PlayoffsConfigModal
          torneo={torneoSel}
          onClose={()=>setShowPOConfig(false)}
          onStarted={()=>{ setShowPOConfig(false); loadFor(tid); }}
        />
      )}
    </div>
  );
}
