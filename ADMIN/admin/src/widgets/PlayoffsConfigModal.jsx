import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const SUPPORTED = [2, 4, 8, 16, 32];

function shuffle(a){ const x=[...a]; for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]];} return x; }
function nextPow2(n){ if (n <= 1) return 2; let p = 1; while (p < n) p <<= 1; return p; }

function pairsFromSlots(slots){
  const pairs = [];
  for (let i = 0; i < slots.length; i += 2) {
    pairs.push([slots[i] ?? null, slots[i+1] ?? null]);
  }
  return pairs;
}

function pairsToSeedOrder(pairs){
  const M = pairs.length * 2;
  const slots = new Array(M).fill(null);
  for (let i = 0; i < pairs.length; i++) {
    const [h, a] = pairs[i];
    slots[2*i]   = h ?? null;
    slots[2*i+1] = a ?? null;
  }
  return slots;
}

// helpers de fecha (igual que en Torneos.jsx)
function getWeekday(ymd) {
  if (!ymd) return null;
  const d = new Date(ymd + 'T00:00:00');
  return d.getDay();
}
function snapToWeekday(ymd, wanted) {
  if (!ymd || wanted === '' || wanted === null || wanted === undefined) return ymd;
  const d = new Date(ymd + 'T00:00:00');
  const diff = (Number(wanted) - d.getDay() + 7) % 7;
  if (diff === 0) return ymd;
  d.setDate(d.getDate() + diff);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

export default function PlayoffsConfigModal({
  torneo,
  onClose,
  onStartLoading,
  onStarted,
  onStartError,
}) {
  const [equipos, setEquipos] = useState([]);
  const [tab, setTab] = useState('tabla'); // 'tabla' | 'auto' | 'manual'
  const [idaVuelta, setIdaVuelta] = useState(false);
  const [awayGoals, setAwayGoals] = useState(false);
  const [saving, setSaving] = useState(false);

  // === TABLA (posiciones) ===
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(false);

  // Tamaño de bracket objetivo
  const [bracketSize, setBracketSize] = useState(2);

  // AUTO
  const [autoSlots, setAutoSlots] = useState([]);

  // MANUAL
  const [slots, setSlots] = useState([]);
  const [dragTeam, setDragTeam] = useState(null);

  // ---- NUEVO: fecha de inicio de eliminatorias + mensajito de autoajuste
  const [startPODate, setStartPODate] = useState('');
  const [snapMsg, setSnapMsg] = useState('');

  // === CARGAS ===
  useEffect(()=>{ (async()=>{
    const { data } = await api.get(`/equipos/${torneo.id}`);
    setEquipos(data||[]);
  })(); },[torneo.id]);

  useEffect(()=>{ (async()=>{
    setLoadingStandings(true);
    try {
      const r = await api.get(`/tabla/${torneo.id}`);
      setStandings(Array.isArray(r.data) ? r.data : (r.data?.rows || []));
    } catch {
      setStandings([]);
    } finally {
      setLoadingStandings(false);
    }
  })(); },[torneo.id]);

  // Tamaño base desde equipos (para auto/manual)
  useEffect(()=>{
    const N = (equipos?.length || 0);
    let M = nextPow2(Math.max(2, N));
    const maxSupported = SUPPORTED[SUPPORTED.length-1];
    if (M > maxSupported) M = SUPPORTED.find(s => s >= N) ?? maxSupported;
    setBracketSize(M);
  },[equipos]);

  // Nombres por id
  const nameById = useMemo(()=>{
    const m = new Map();
    equipos.forEach(e=>m.set(e.id, e.nombre));
    standings.forEach(s=>{
      if (s.team_id && s.equipo && !m.has(s.team_id)) m.set(s.team_id, s.equipo);
    });
    return m;
  },[equipos, standings]);

  // ====== AUTO ======
  useEffect(()=>{
    if (tab !== 'auto') return;
    const N = (equipos?.length||0);
    const M = bracketSize;
    const ids = shuffle(equipos.map(e=>e.id));
    const slots = new Array(M).fill(null);
    ids.forEach((id, idx)=>{ slots[idx] = id; });
    setAutoSlots(slots);
  },[tab, equipos, bracketSize]);

  // ====== MANUAL ======
  useEffect(()=>{
    if (tab !== 'manual') return;
    const M = bracketSize;
    setSlots(Array.from({length: M}, (_,i)=>({i, teamId:null})));
  },[tab, bracketSize]);

  const assignedIds = useMemo(()=> slots.filter(s=>s.teamId).map(s=>s.teamId), [slots]);
  const poolTeams = useMemo(()=> (equipos||[]).filter(e=>!assignedIds.includes(e.id)), [equipos, assignedIds]);

  const manualPairs = useMemo(()=>{
    const ps = [];
    for (let i=0;i<slots.length;i+=2){
      ps.push([slots[i]?.teamId || null, slots[i+1]?.teamId || null]);
    }
    return ps;
  },[slots]);

  const manualReady = useMemo(()=>{
    const N = (equipos?.length||0);
    const countAssigned = assignedIds.filter(Boolean).length;
    const setUnique = new Set(assignedIds.filter(Boolean));
    return countAssigned === N && setUnique.size === N;
  },[assignedIds, equipos]);

  const onDragStart = (teamId)=> setDragTeam(teamId);
  const onDropSlot = (slotIndex)=>{
    if (!dragTeam) return;
    setSlots(prev=>{
      const cleared = prev.map(s => s.teamId===dragTeam ? {...s, teamId:null} : s);
      return cleared.map(s => s.i===slotIndex ? {...s, teamId:dragTeam} : s);
    });
    setDragTeam(null);
  };
  const clearSlot = (slotIndex)=> setSlots(prev => prev.map(s => s.i===slotIndex ? {...s, teamId:null} : s));

  // ====== TABLA → preview emparejamientos ======
  const tablePreview = useMemo(()=>{
    const total = standings.length;
    const K = Number(torneo?.clasificados || 0) > 0 ? Math.min(Number(torneo.clasificados), total) : total;
    const top = standings.slice(0, K);
    const N = top.length;
    if (N < 2) return { pairs: [], slots: [], M: 0, N: 0, K: 0 };

    let M = nextPow2(N);
    if (!SUPPORTED.includes(M)) M = SUPPORTED.find(s=>s>=N) || SUPPORTED.at(-1);

    const slots = new Array(M).fill(null);
    top.forEach((row, idx)=>{ slots[idx] = row.team_id; });
    const pairs = pairsFromSlots(slots);
    return { pairs, slots, M, N, K };
  },[standings, torneo]);

  // ====== CONFIRM ======
  const confirmStart = async ()=>{
    try{
      if (!startPODate) {
        alert('Selecciona la fecha de inicio de eliminatorias.');
        return;
      }

      onStartLoading?.();
      setSaving(true);

      const payloadBase = {
        nombre: null,
        ida_vuelta: !!idaVuelta,
        away_goals: !!awayGoals,
        start_date: startPODate,     // ⬅️ NUEVO
      };

      if (tab === 'tabla') {
        await api.post(`/playoffs/${torneo.id}/init`, {
          ...payloadBase,
          seed_from_table: true
        });
      } else {
        const M = bracketSize;
        if (!SUPPORTED.includes(M)) {
          alert('Tamaño de bracket no soportado.');
          setSaving(false);
          return;
        }
        const N = (equipos?.length||0);
        if (N < 2) {
          alert('Se necesitan al menos 2 equipos.');
          setSaving(false);
          return;
        }
        let seed_team_ids = new Array(M).fill(null);
        if (tab === 'auto') {
          seed_team_ids = [...autoSlots];
        } else {
          if (!manualReady) throw new Error('Completa la asignación de todos los equipos (los huecos restantes pueden quedar byes).');
          const pairs = manualPairs;
          seed_team_ids = pairsToSeedOrder(pairs);
        }
        await api.post(`/playoffs/${torneo.id}/init`, {
          ...payloadBase,
          seed_from_table: false,
          seed_count: M,
          seed_team_ids
        });
      }

      setSaving(false);
      onStarted?.();
    }catch(e){
      setSaving(false);
      onStartError?.();
      alert(e?.response?.data?.error || e.message || 'No se pudo iniciar eliminatorias');
    }
  };

  const renderAutoPreview = ()=>{
    const M = bracketSize;
    const slots = autoSlots;
    return (
      <ul className="text-sm space-y-2">
        {Array.from({length: M/2}, (_,i)=>{
          const A = slots[2*i] ?? null;
          const B = slots[2*i+1] ?? null;
          return (
            <li key={i} className="border rounded p-2">
              <div className="font-medium">Serie {i+1}</div>
              <div>{nameById.get(A) || '— bye —'} vs {nameById.get(B) || '— bye —'}</div>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderTablePreview = ()=>{
    if (loadingStandings) return <div className="text-sm text-slate-500">Cargando posiciones…</div>;
    const { pairs, N, M, K } = tablePreview;
    if (!pairs.length) return <div className="text-sm text-slate-500">Sin suficientes equipos.</div>;

    return (
      <div className="space-y-3">
        <div className="text-sm px-3 py-2 rounded border bg-slate-50">
          Clasificados: <b>{K ?? N}</b> — Bracket: <b>{M}</b> — Byes: <b>{Math.max(0, M - (N ?? 0))}</b>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 border">
            <div className="font-semibold mb-2">Tabla (top {K ?? N})</div>
            <ol className="text-sm space-y-1">
              {(standings.slice(0, K ?? N)).map((r, idx)=>(
                <li key={r.team_id} className="flex items-center gap-2">
                  <span className="w-6 text-right">{idx+1}.</span>
                  <span className="truncate">{nameById.get(r.team_id) ?? r.equipo ?? `Equipo ${r.team_id}`}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-white rounded-xl p-3 border">
            <div className="font-semibold mb-2">Emparejamientos 1ª ronda</div>
            <ul className="text-sm space-y-2">
              {pairs.map(([A,B], i)=>(
                <li key={i} className="border rounded p-2">
                  <div className="font-medium">Serie {i+1}</div>
                  <div>{nameById.get(A) || '— bye —'} vs {nameById.get(B) || '— bye —'}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const canCreate = (tab==='tabla'
    ? (!saving && (standings?.length||0) >= 2)
    : (!saving && SUPPORTED.includes(bracketSize) && (tab!=='manual' || (tab==='manual' && manualReady)) && (equipos?.length||0) >= 2)
  ) && !!startPODate; // ⬅️ exige fecha

  const weekday = torneo?.dia_semana; // 0..6 esperado

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Configurar eliminatorias</h3>
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-sm">Cerrar</button>
        </div>

        {/* NUEVO: fecha de inicio */}
        <div className="p-4 border-b">
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <label className="text-sm">
              <div className="text-slate-600 mb-1">Fecha de inicio (eliminatorias)</div>
              <input
                type="date"
                className="border p-2 rounded w-full"
                value={startPODate}
                onChange={(e)=>{
                  const raw = e.target.value;
                  if (!raw) { setStartPODate(''); setSnapMsg(''); return; }
                  if (weekday === null || weekday === undefined || weekday === '') {
                    setStartPODate(raw);
                    setSnapMsg('');
                    return;
                  }
                  const wWanted = Number(weekday);
                  const wRaw = getWeekday(raw);
                  if (wRaw !== wWanted) {
                    const snapped = snapToWeekday(raw, wWanted);
                    setStartPODate(snapped);
                    setSnapMsg(`Ajustado automáticamente al día configurado del torneo (weekday ${wWanted}).`);
                  } else {
                    setStartPODate(raw);
                    setSnapMsg('');
                  }
                }}
                disabled={weekday === '' || weekday === null || weekday === undefined}
                title={weekday === '' || weekday === null || weekday === undefined
                  ? 'Configura primero el día de la semana del torneo'
                  : 'Elige la fecha de inicio para los playoffs'}
              />
              {snapMsg && <div className="text-xs text-amber-700 mt-1">{snapMsg}</div>}
              {(weekday === '' || weekday === null || weekday === undefined) && (
                <div className="text-xs text-slate-500 mt-1">
                  Este torneo no tiene <b>día de la semana</b> configurado.
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Top controls */}
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <div className="inline-flex rounded-lg overflow-hidden border">
            <button className={`px-4 py-2 text-sm ${tab==='tabla'?'bg-slate-900 text-white':'bg-white'}`} onClick={()=>setTab('tabla')} title="Usar posiciones (1° vs último, etc.)">Por posiciones</button>
            <button className={`px-4 py-2 text-sm ${tab==='auto'?'bg-slate-900 text-white':'bg-white'}`} onClick={()=>setTab('auto')}>Automática</button>
            <button className={`px-4 py-2 text-sm ${tab==='manual'?'bg-slate-900 text-white':'bg-white'}`} onClick={()=>setTab('manual')}>Manual (drag & drop)</button>
          </div>

          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={idaVuelta} onChange={e=>setIdaVuelta(e.target.checked)} />
            Ida/Vuelta
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={awayGoals} onChange={e=>setAwayGoals(e.target.checked)} />
            Gol de visita desempata
          </label>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {tab==='tabla' && renderTablePreview()}

          {tab==='auto' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="font-semibold mb-2">Equipos ({equipos.length})</div>
                <ul className="text-sm divide-y bg-white border rounded">
                  {equipos.map(e=> <li key={e.id} className="px-3 py-2">{e.nombre}</li>)}
                  {!equipos.length && <li className="px-3 py-4 text-slate-500 text-center">Sin equipos</li>}
                </ul>
                <button
                  className="mt-3 px-3 py-2 text-sm rounded bg-slate-800 text-white"
                  onClick={()=>{
                    const N = (equipos?.length||0);
                    const M = bracketSize;
                    const ids = shuffle(equipos.map(e=>e.id));
                    const ns = new Array(M).fill(null);
                    ids.forEach((id, idx)=>{ ns[idx] = id; });
                    setAutoSlots(ns);
                  }}
                >
                  Re-generar aleatorio
                </button>
              </div>

              <div className="bg-white rounded-xl p-3 border">
                <div className="font-semibold mb-2">Preview primera ronda</div>
                {renderAutoPreview()}
              </div>
            </div>
          )}

          {tab==='manual' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="font-semibold mb-2">Arrastra equipos</div>
                <ul className="flex flex-wrap gap-2">
                  {poolTeams.map(e=>(
                    <li
                      key={e.id}
                      draggable
                      onDragStart={()=>onDragStart(e.id)}
                      className="px-3 py-1 rounded-xl bg-white border shadow-sm cursor-grab text-sm"
                      title="Arrastra al slot del bracket"
                    >
                      {e.nombre}
                    </li>
                  ))}
                  {!poolTeams.length && (
                    <li className="px-3 py-4 text-slate-500 text-sm w-full text-center">
                      No hay equipos disponibles — todos asignados (los huecos restantes serán byes).
                    </li>
                  )}
                </ul>
                <div className="text-xs text-slate-500 mt-2">
                  Debes asignar exactamente {equipos.length} equipo(s). Los espacios vacíos se consideran <b>bye</b>.
                </div>
              </div>

              <div className="bg-white rounded-xl p-3 border">
                <div className="font-semibold mb-2">Primera ronda</div>
                <div className="grid grid-cols-2 gap-3">
                  {slots.map((s, idx)=>(
                    <div key={s.i} className="space-y-1">
                      {idx%2===0 && <div className="text-xs text-slate-500">Serie {Math.floor(idx/2)+1}</div>}
                      <div
                        onDragOver={e=>e.preventDefault()}
                        onDrop={()=>onDropSlot(s.i)}
                        className="h-10 flex items-center justify-between rounded border-dashed border-2 text-sm px-2"
                        title="Suelta aquí"
                      >
                        <span className="truncate">
                          {s.teamId ? (equipos.find(e=>e.id===s.teamId)?.nombre || `Equipo ${s.teamId}`) : '— bye —'}
                        </span>
                        {s.teamId && (
                          <button
                            className="text-xs px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300"
                            onClick={()=>clearSlot(s.i)}
                            title="Quitar del slot"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {tab==='tabla'
              ? 'Se generará el bracket con base en las posiciones actuales.'
              : <>Bracket de <b>{bracketSize}</b> equipos.</>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded bg-slate-200">Cancelar</button>
            <button
              onClick={confirmStart}
              disabled={!canCreate}
              className={`px-4 py-2 rounded text-white ${!canCreate ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              title={!startPODate ? 'Selecciona la fecha de inicio' : 'Crear eliminatorias'}
            >
              {saving ? 'Creando…' : 'Crear eliminatorias'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
