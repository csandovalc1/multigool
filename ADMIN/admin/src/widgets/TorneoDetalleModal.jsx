// src/pages/TorneoDetalleModal.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_ORIGIN } from '../lib/api';
import PlayoffsConfigModal from '../widgets/PlayoffsConfigModal';
import PlantillaEquipoModal from '../widgets/PlantillaEquipoModal';
import UploadLogoField from '../components/UploadLogoField.jsx';
const DEFAULT_TEAM_URL = `${API_ORIGIN}/public/defaults/defaultteam.png`;

export default function TorneoDetalleModal({ torneo, onClose }) {
  const [equipos, setEquipos] = useState([]);
  const [nombreEquipo, setNombreEquipo] = useState('');
  const [jornadas, setJornadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [showPOConfig, setShowPOConfig] = useState(false);
  const [startingPO, setStartingPO] = useState(false);
  const [equipoPlantilla, setEquipoPlantilla] = useState(null);

  // estados para el escudo al crear equipo
  const [quiereLogo, setQuiereLogo] = useState(false);
  const [logoBlob, setLogoBlob] = useState(null);
  const [logoError, setLogoError] = useState('');

  // edición de escudos existentes
  const [editingLogoId, setEditingLogoId] = useState(null);
  const [upLogoBlob, setUpLogoBlob] = useState(null);
  const [upLogoError, setUpLogoError] = useState('');
  const [savingLogoId, setSavingLogoId] = useState(null);

  const navigate = useNavigate();

  // helper: compone URL absoluta del logo
const imgUrl = (p) => {
  if (!p) return DEFAULT_TEAM_URL;              
  if (/^https?:\/\//i.test(p)) return p;        
  return `${API_ORIGIN}${p}`;                   
};


  const Q = (n) =>
    new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ',
      minimumFractionDigits: 2,
    }).format(Number(n || 0));

  const puedeEditar = useMemo(() => {
    if (torneo.tipo_torneo === 'liguilla') return jornadas.length === 0;
    if (torneo.tipo_torneo === 'eliminacion') return torneo.fase !== 'playoffs';
    return false;
  }, [torneo.tipo_torneo, torneo.fase, jornadas.length]);

  const cargarTodo = async () => {
    setCargando(true);
    try {
      const [{ data: eqs }, { data: jors }] = await Promise.all([
        api.get(`/equipos/${torneo.id}`),
        api.get(`/fixture/jornadas/${torneo.id}`),
      ]);
      setEquipos(eqs || []);
      setJornadas(jors || []);
    } catch (e) {
      console.error(e);
      alert('Error al cargar detalle del torneo');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (torneo?.id) cargarTodo();
  }, [torneo?.id]);

  const resetForm = () => {
    setNombreEquipo('');
    setQuiereLogo(false);
    setLogoBlob(null);
    setLogoError('');
  };

  const agregarEquipo = async () => {
    if (!puedeEditar) return;
    if (!nombreEquipo.trim()) {
      alert('Escribe un nombre de equipo');
      return;
    }

    if (quiereLogo && logoBlob) {
      if (logoBlob.type !== 'image/png') {
        setLogoError('El archivo debe ser PNG');
        return;
      }
      if (logoBlob.size > 1.5 * 1024 * 1024) {
        setLogoError('Tamaño máximo 1.5 MB');
        return;
      }
    }
    setLogoError('');

    setGuardando(true);
    try {
      const fd = new FormData();
      fd.append('nombre', nombreEquipo.trim());
      fd.append('torneo_id', torneo.id);
      if (quiereLogo && logoBlob) fd.append('logo', logoBlob, 'logo.png');

      await api.post('/equipos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      resetForm();
      await cargarTodo();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'No se pudo agregar el equipo');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarEquipo = async (id) => {
    if (!puedeEditar) return;
    if (!confirm('¿Eliminar este equipo?')) return;
    setGuardando(true);
    try {
      await api.delete(`/equipos/${id}`);
      await cargarTodo();
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar el equipo');
    } finally {
      setGuardando(false);
    }
  };

  const iniciarTorneo = async () => {
    if (!puedeEditar) return;
    if (equipos.length < 2) {
      alert('Se necesitan al menos 2 equipos para iniciar el torneo');
      return;
    }
    if (!confirm('Esto generará el fixture y ya no podrás modificar equipos. ¿Continuar?')) return;

    setGuardando(true);
    try {
      await api.post(`/torneos/${torneo.id}/iniciar`);
      await cargarTodo();
      alert('Fixture generado correctamente 👌');
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'Error al generar el fixture');
    } finally {
      setGuardando(false);
    }
  };

  const irADetalles = () => {
    navigate(`/jornadas?t=${torneo.id}`);
    onClose();
  };

  // Editor de escudos existentes
  const abrirEditorLogo = (team) => {
    setEditingLogoId(team.id);
    setUpLogoBlob(null);
    setUpLogoError('');
  };

  const cancelarEditorLogo = () => {
    setEditingLogoId(null);
    setUpLogoBlob(null);
    setUpLogoError('');
  };

  const guardarNuevoLogo = async (teamId) => {
    if (!upLogoBlob) {
      setUpLogoError('Sube un PNG primero');
      return;
    }
    if (upLogoBlob.type !== 'image/png') {
      setUpLogoError('El archivo debe ser PNG');
      return;
    }
    if (upLogoBlob.size > 1.5 * 1024 * 1024) {
      setUpLogoError('Tamaño máximo 1.5 MB');
      return;
    }
    setUpLogoError('');
    setSavingLogoId(teamId);
    try {
      const fd = new FormData();
      fd.append('logo', upLogoBlob, 'logo.png');
      const { data } = await api.patch(`/equipos/${teamId}/logo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEquipos((prev) =>
        prev.map((e) => (e.id === teamId ? { ...e, logo_path: data.logo_path } : e))
      );
      cancelarEditorLogo();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'No se pudo actualizar el escudo');
    } finally {
      setSavingLogoId(null);
    }
  };

  const resetearLogoPorDefecto = async (teamId) => {
    if (!confirm('¿Restablecer al escudo por defecto?')) return;
    setSavingLogoId(teamId);
    try {
      const { data } = await api.patch(`/equipos/${teamId}/logo`, { useDefault: true });
      setEquipos((prev) =>
        prev.map((e) => (e.id === teamId ? { ...e, logo_path: data.logo_path } : e))
      );
      cancelarEditorLogo();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.error || 'No se pudo restablecer el escudo');
    } finally {
      setSavingLogoId(null);
    }
  };

  const isLiguilla = torneo.tipo_torneo === 'liguilla';
  const isEliminacion = torneo.tipo_torneo === 'eliminacion';
  const enPlayoffs = torneo.fase === 'playoffs';
  const canVerDetalles = (isLiguilla && jornadas.length > 0) || enPlayoffs;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{torneo.nombre}</h3>
            <div className="text-sm text-slate-500">
              Tipo: Fútbol {torneo.tipo_futbol} — {torneo.tipo_torneo}
            </div>
          </div>
          <div className="text-sm text-slate-500">
            Tipo: Fútbol {torneo.tipo_futbol} — {torneo.tipo_torneo}
            {typeof torneo.costo_inscripcion_q !== 'undefined' && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Inscripción: {Q(torneo.costo_inscripcion_q)}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-sm cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {cargando ? (
            <div className="text-center py-8 text-slate-500">Cargando…</div>
          ) : (
            <>
              {!puedeEditar && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  Este torneo ya tiene <b>{jornadas.length}</b> jornada(s) generada(s).
                  No se pueden agregar o eliminar equipos y el botón <i>Iniciar torneo</i> no está disponible.
                </div>
              )}

              {/* Agregar equipo + logo opcional */}
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="text-slate-600 mb-1">Nombre del equipo</div>
                    <input
                      className="border p-2 rounded w-full"
                      placeholder="Nombre del equipo"
                      value={nombreEquipo}
                      onChange={(e) => setNombreEquipo(e.target.value)}
                      disabled={!puedeEditar || guardando}
                    />
                  </label>

                  <label className="text-sm flex items-center gap-2 mt-1 md:mt-0 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer"
                      checked={quiereLogo}
                      onChange={(e) => {
                        setQuiereLogo(e.target.checked);
                        if (!e.target.checked) {
                          setLogoBlob(null);
                          setLogoError('');
                        }
                      }}
                      disabled={!puedeEditar || guardando}
                    />
                    ¿Añadir escudo?
                    <span className="text-xs text-neutral-500">(opcional; si no, se usa el default)</span>
                  </label>
                </div>

                {quiereLogo && (
                  <div
                    className="mt-3 bg-white rounded border p-3 transition hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                    role="button"
                    title="Subir logo"
                  >
                    <UploadLogoField
                      onBlobReady={(blob) => {
                        setLogoBlob(blob);
                        setLogoError('');
                      }}
                      recommended="512×512"
                      maxSizeMB={1.5}
                    />
                    {logoError && <div className="text-sm text-rose-600 mt-1">{logoError}</div>}
                    <div className="text-xs text-neutral-500 mt-2">
                      Formato: PNG · Máximo 1.5 MB · Mínimo 128×128 · Se normaliza a 512×512 en el servidor.
                    </div>
                </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    className={`px-4 py-2 rounded text-white ${
                      puedeEditar ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-slate-400 cursor-not-allowed'
                    }`}
                    onClick={agregarEquipo}
                    disabled={!puedeEditar || guardando}
                  >
                    Agregar
                  </button>
                  <button
                    className={`px-4 py-2 rounded border ${
                      guardando ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-100 cursor-pointer'
                    }`}
                    onClick={resetForm}
                    disabled={guardando}
                  >
                    Limpiar
                  </button>
                </div>

                {/* Listado de equipos con logo y edición inline */}
                <ul className="divide-y mt-3 max-h-[40vh] overflow-auto bg-white rounded-lg border">
                  {equipos.map((e) => (
                    <li key={e.id} className="py-2 px-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={imgUrl(e.logo_path)}
                            alt="escudo"
                            className="h-8 w-8 rounded object-cover"
                            loading="lazy"
onError={(ev) => {
  ev.currentTarget.onerror = null;               // evita loop
  ev.currentTarget.src = DEFAULT_TEAM_URL;       // usa el default del backend
}}
                          />
                          <span className="truncate">{e.nombre}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 text-xs rounded bg-slate-700 text-white hover:bg-slate-600 cursor-pointer"
                            onClick={() => setEquipoPlantilla(e)}
                          >
                            Plantilla
                          </button>

                          <button
                            className="px-2 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                            onClick={() => abrirEditorLogo(e)}
                            disabled={savingLogoId === e.id}
                            title="Cambiar escudo"
                          >
                            Cambiar escudo
                          </button>

                          <button
                            className={`px-2 py-1 text-xs rounded ${
                              puedeEditar
                                ? 'bg-rose-600 text-white hover:bg-rose-700 cursor-pointer'
                                : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                            }`}
                            onClick={() => eliminarEquipo(e.id)}
                            disabled={!puedeEditar || guardando}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>

                      {editingLogoId === e.id && (
                        <div className="mt-3 bg-slate-50 rounded border p-3">
                          <div className="text-sm text-slate-700 font-semibold mb-2">Actualizar escudo</div>

                          <div
                            className="bg-white rounded border p-3 transition hover:bg-slate-50 hover:border-slate-300"
                            role="button"
                            title="Subir nuevo escudo"
                          >
                            <UploadLogoField
                              onBlobReady={(blob) => {
                                setUpLogoBlob(blob);
                                setUpLogoError('');
                              }}
                              recommended="512×512"
                              maxSizeMB={1.5}
                            />
                            {upLogoError && <div className="text-sm text-rose-600 mt-1">{upLogoError}</div>}
                            <div className="text-xs text-neutral-500 mt-2">
                              Formato: PNG · Máx 1.5 MB · Mín 128×128 · Se normaliza a 512×512 en el servidor.
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              className={`px-3 py-1.5 rounded text-white ${
                                savingLogoId === e.id
                                  ? 'bg-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                              }`}
                              onClick={() => guardarNuevoLogo(e.id)}
                              disabled={savingLogoId === e.id}
                            >
                              Guardar escudo
                            </button>

                            <button
                              className={`px-3 py-1.5 rounded border ${
                                savingLogoId === e.id ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-100 cursor-pointer'
                              }`}
                              onClick={cancelarEditorLogo}
                              disabled={savingLogoId === e.id}
                            >
                              Cancelar
                            </button>

                            <button
                              className={`px-3 py-1.5 rounded ${
                                savingLogoId === e.id
                                  ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 cursor-pointer'
                              }`}
                              onClick={() => resetearLogoPorDefecto(e.id)}
                              disabled={savingLogoId === e.id}
                              title="Restablecer al escudo por defecto"
                            >
                              Restablecer a default
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                  {equipos.length === 0 && (
                    <li className="py-6 text-center text-sm text-slate-500">Sin equipos aún</li>
                  )}
                </ul>
              </div>

              {/* Calendario (info) */}
              {torneo.tipo_torneo === 'liguilla' && (
                <div className="bg-white rounded-xl border p-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Calendario</h4>
                    <p className="text-sm text-slate-600">
                      {jornadas.length === 0
                        ? 'Aún no se generan jornadas para este torneo.'
                        : `Este torneo tiene ${jornadas.length} jornada(s) generada(s).`}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {enPlayoffs
              ? 'Eliminatorias en curso.'
              : puedeEditar
              ? 'Puedes agregar equipos y luego iniciar el torneo.'
              : 'Fixture bloqueado: equipos y “Iniciar” deshabilitados.'}
          </div>

          <div className="flex items-center gap-2">
            {torneo.tipo_torneo === 'liguilla' && torneo.fase === 'liga' && puedeEditar && (
              <button
                onClick={iniciarTorneo}
                disabled={guardando || equipos.length < 2}
                className={`px-4 py-2 rounded text-white ${
                  equipos.length >= 2
                    ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
                    : 'bg-slate-400 cursor-not-allowed'
                }`}
                title={equipos.length < 2 ? 'Se requieren al menos 2 equipos' : 'Generar fixture'}
              >
                Iniciar torneo
              </button>
            )}

            {isEliminacion && !enPlayoffs && !startingPO && (
              <button
                onClick={() => setShowPOConfig(true)}
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              >
                Iniciar eliminatorias
              </button>
            )}
            {isEliminacion && !enPlayoffs && startingPO && (
              <button className="px-4 py-2 rounded bg-slate-400 text-white cursor-not-allowed" disabled>
                Iniciando…
              </button>
            )}

            {canVerDetalles && (
              <button
                onClick={irADetalles}
                className="px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Ver Jornadas
              </button>
            )}
          </div>
        </div>

        {showPOConfig && (
          <PlayoffsConfigModal
            torneo={torneo}
            onClose={() => setShowPOConfig(false)}
            onStartLoading={() => setStartingPO(true)}
            onStarted={() => {
              setStartingPO(false);
              setShowPOConfig(false);
              torneo.fase = 'playoffs';
              cargarTodo();
            }}
            onStartError={() => setStartingPO(false)}
          />
        )}

        {equipoPlantilla && (
          <PlantillaEquipoModal equipo={equipoPlantilla} onClose={() => setEquipoPlantilla(null)} />
        )}
      </div>
    </div>
  );
}
