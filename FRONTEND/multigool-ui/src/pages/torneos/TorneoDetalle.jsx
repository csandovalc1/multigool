// src/pages/public/TorneoDetalle.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import PageShell from '../../components/PageShell.jsx';
import { api, API_ORIGIN } from '../../lib/api';

const TABS = {
  tabla: 'Tabla',
  fixture: 'Jornadas',      // 👈 renombrado en la UI
  goleadores: 'Goleadores',
  playoffs: 'Playoffs',
};

const norm = (s) => String(s ?? '').trim().toLowerCase();


// helpers fecha/hora
function pickYMD(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v);
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// 👇 mapea la key de la ronda a español
function roundToEs(key='') {
  const k = String(key).toLowerCase();
  const map = {
    final: 'Final',
    finals: 'Final',
    'grand final': 'Final',
    sf: 'Semifinal',
    semifinal: 'Semifinal',
    semifinals: 'Semifinal',
    qf: 'Cuartos de final',
    quarterfinal: 'Cuartos de final',
    quarterfinals: 'Cuartos de final',
    r2: 'Final',
    r4: 'Semifinal',
    r8: 'Cuartos de final',
    r16: 'Octavos de final',
    r32: 'Dieciseisavos de final',
    octavos: 'Octavos de final',
    cuartos: 'Cuartos de final',
  };
  if (map[k]) return map[k];
  // heurística por si viene "round of 16" o "round 16"
  if (/\b16\b/.test(k)) return 'Octavos de final';
  if (/\b32\b/.test(k)) return 'Dieciseisavos de final';
  return key || 'Playoffs';
}


function LegBadge({ text }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold tracking-wide
                     bg-slate-900 text-white uppercase">
      {text}
    </span>
  );
}


// 👇 dos líneas con clamp, sin cortar el marcador
function TeamTwoLine({ name='', align='left' }) {
  return (
    <span
      title={name}
      className={`font-semibold break-words leading-tight ${align==='right' ? 'text-right' : 'text-left'}`}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,         // <= máx. 2 líneas
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
      }}
    >
      {name || '—'}
    </span>
  );
}

function ymdToLocalDate(v) {
  const ymd = pickYMD(v); if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtFechaGT(v, withWeekday = false) {
  const d = ymdToLocalDate(v); if (!d || isNaN(d)) return '—';
  const opts = withWeekday ? { weekday: 'long', day: '2-digit', month: 'short' } : undefined;
  return d.toLocaleDateString('es-GT', opts);
}
function fmtHora(v) {
  if (!v) return '—';
  const s = typeof v === 'string' ? v : v?.toString?.() ?? '';
  if (typeof s === 'string') {
    const m = s.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
    const hh = typeof v.hours === 'number' ? String(v.hours).padStart(2, '0') : null;
    const mm = typeof v.minutes === 'number' ? String(v.minutes).padStart(2, '0') : null;
    if (hh != null && mm != null) return `${hh}:${mm}`;
  }
  if (v instanceof Date && !isNaN(v)) {
    const isBase = v.getUTCFullYear() <= 1971 && v.getUTCMonth() === 0 && v.getUTCDate() <= 2;
    const hh = String(isBase ? v.getUTCHours() : v.getHours()).padStart(2, '0');
    const mm = String(isBase ? v.getUTCMinutes() : v.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return '—';
}

// logos helper + avatar
const imgUrl = (p) => {
  if (!p) return '/defaults/defaultteam.png';
  if (/^https?:\/\//i.test(p)) return p;
  return `${API_ORIGIN}${p}`;
};
function TeamAvatar({ src, alt }) {
  return (
    <img
      src={imgUrl(src)}
      alt={alt || 'logo'}
      className="h-5 w-5 md:h-6 md:w-6 rounded object-cover"
      loading="lazy"
      onError={(ev) => (ev.currentTarget.src = '/defaults/defaultteam.png')}
    />
  );
}
function ScoreBox({ value }) {
  return (
    <span className="inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded border bg-white text-sm font-bold shrink-0">
      {value ?? '—'}
    </span>
  );
}

// 👇 Nombre “amigable” que permite wrap y muestra tooltip completo
function TeamName({ name, align = 'left', className = '' }) {
  return (
    <span
      title={name || ''}
      className={[
        'whitespace-normal break-words leading-snug',
        'max-w-[10rem] md:max-w-[14rem]',
        align === 'right' ? 'text-right' : 'text-left',
        'font-semibold',
        className,
      ].join(' ')}
    >
      {name || '—'}
    </span>
  );
}

// Suma global por equipo a partir de los legs (dos partidos ida/vuelta).
// Si away2x=true, los goles anotados cuando el equipo fue visitante cuentan por 2.
function computeAggregateBase(legs = []) {
  const t = new Map();
  const add = (k, v) => t.set(k, (t.get(k) || 0) + (Number(v ?? 0) || 0));
  for (const lg of legs) {
    const ln = String(lg.local_name || '—').trim();
    const vn = String(lg.visita_name || '—').trim();
    add(ln, lg.goles_local);
    add(vn, lg.goles_visita);
  }
  return t;
}

function computeAggregateAway2x(legs = []) {
  const t = new Map();
  const add = (k, v) => t.set(k, (t.get(k) || 0) + (Number(v ?? 0) || 0));
  for (const lg of legs) {
    const ln = String(lg.local_name || '—').trim();
    const vn = String(lg.visita_name || '—').trim();
    add(ln, lg.goles_local);           // local normal
    add(vn, (lg.goles_visita ?? 0) * 2); // visitante x2
  }
  return t;
}


function resolveSeriesDecision(legs = [], { away2x = false, winner_id = null } = {}) {
  const base = computeAggregateBase(legs);
  const home0 = String(legs[0]?.local_name || '—').trim();
  const away0 = String(legs[0]?.visita_name || '—').trim();
  const bH = base.get(home0) || 0;
  const bA = base.get(away0) || 0;

  let usedAway2x = false;
let effectiveByName = base;

  if (bH === bA && away2x) {
    effectiveByName = computeAggregateAway2x(legs);
    usedAway2x = true;
  }

  const eH = effectiveByName.get(home0) || 0;
  const eA = effectiveByName.get(away0) || 0;

  // Intentar mapear winner_id → nombre usando ids de los legs
  const idToName = new Map();
  for (const lg of legs) {
    if (lg.equipo_local_id != null) idToName.set(Number(lg.equipo_local_id), String(lg.local_name || home0).trim());
    if (lg.equipo_visita_id != null) idToName.set(Number(lg.equipo_visita_id), String(lg.visita_name || away0).trim());
  }
  const winnerNameFromId = (winner_id != null) ? (idToName.get(Number(winner_id)) || null) : null;

  let decidedBy = null;
  let winnerName = null;

  if (eH !== eA) {
    winnerName = eH > eA ? home0 : away0;
    decidedBy = usedAway2x ? 'away2x' : 'aggregate';
  } else if (winner_id != null) {
    decidedBy = 'penalties';
    winnerName = winnerNameFromId; // ← ahora sí tenemos nombre para resaltar y mostrar
  }

  return {
    effective: { home: eH, away: eA },
    effectiveByName,  
    base: { home: bH, away: bA },
    usedAway2x,
    decidedBy,
    winnerName,
    homeName: home0,
    awayName: away0,
  };
}


export default function TorneoDetalle() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'tabla';

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // data por pestaña
  const [tabla, setTabla] = useState(null);
  const [fixture, setFixture] = useState(null);
  const [gols, setGols] = useState(null);
  const [bracket, setBracket] = useState(null);

  const fase = summary?.torneo?.fase;
  const tipo = summary?.torneo?.tipo_torneo;

  // logos del torneo
  const [logosMap, setLogosMap] = useState(new Map());
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/equipos/${id}`);
        const map = new Map();
        (data || []).forEach((e) => {
          if (e?.nombre) map.set(String(e.nombre).trim(), e.logo_path || null);
          if (e?.id != null) map.set(Number(e.id), e.logo_path || null);
        });
        setLogosMap(map);
      } catch {
        setLogosMap(new Map());
      }
    })();
  }, [id]);
  

  const availableTabs = useMemo(() => {
    if (tipo === 'liguilla') return ['tabla', 'fixture', 'goleadores', 'playoffs'];
    return ['playoffs', 'goleadores'];
  }, [tipo]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/public/torneos/${id}/summary`);
        setSummary(data);
      } catch (e) {
        setErr(e?.response?.data?.error || 'No se pudo cargar el torneo');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!summary) return;
    (async () => {
      try {
        if (tab === 'tabla' && !tabla && tipo === 'liguilla') {
          const { data } = await api.get(`/public/torneos/${id}/tabla`);
          setTabla(data);
        }
        if (tab === 'fixture' && !fixture && tipo === 'liguilla') {
          const { data } = await api.get(`/public/torneos/${id}/fixture`);
          setFixture(data);
        }
        if (tab === 'goleadores' && !gols) {
          const { data } = await api.get(`/public/torneos/${id}/goleadores`, {
            params: { playoffs: 1 },
          });
          setGols(data);
        }
        if (tab === 'playoffs' && !bracket && summary?.eliminatoria) {
          const { data } = await api.get(`/public/torneos/${id}/playoffs`);
          setBracket(data);
        }
      } catch (e) {
        setErr(e?.response?.data?.error || 'Error cargando datos');
      }
    })();
  }, [tab, summary, id, tabla, fixture, gols, bracket, tipo, fase]);

  // tab inicial sugerida
  useEffect(() => {
    if (!summary) return;
    const current = sp.get('tab');
    if (current) return;
    const t = summary.torneo?.tipo_torneo;
    const f = summary.torneo?.fase;
    const want = f === 'playoffs' || t === 'eliminatoria' ? 'playoffs' : 'tabla';
    const tabs = t === 'liguilla' ? ['tabla', 'fixture', 'goleadores', 'playoffs'] : ['playoffs', 'goleadores'];
    if (tabs.includes(want)) {
      setSp((prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', want);
        return p;
      }, { replace: true });
    }
  }, [summary, sp, setSp]);

  const changeTab = (t) =>
    setSp(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', t);
        return p;
      },
      { replace: true }
    );

  return (
    <PageShell bgUrl="url(https://images.unsplash.com/photo-1434648957308-5e6a859697e8?q=80&w=2000&auto=format&fit=crop)">
      <div className="rounded-2xl border bg-white/95 shadow-sm p-4 md:p-6 overflow-hidden">
        {loading && <div className="text-sm text-neutral-500">Cargando torneo…</div>}
        {err && <div className="text-sm text-rose-600">{err}</div>}

        {summary && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="uppercase text-xs text-neutral-500">Torneo</div>
                <h1 className="font-extrabold tracking-wide uppercase text-2xl">{summary.torneo.nombre}</h1>
                <div className="text-sm text-neutral-600">
                  {`Modalidad F${summary.torneo.tipo_futbol} · ${summary.torneo.tipo_torneo} · ${summary.torneo.fase}`}
                </div>
              </div>
              <Link
                to="/torneos"
                className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-sm font-semibold cursor-pointer"
              >
                ← Volver
              </Link>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex flex-wrap gap-2">
              {availableTabs.map((t) => (
                <button
                  key={t}
                  onClick={() => changeTab(t)}
                  className={`px-3 py-1.5 rounded-md border text-sm font-semibold ${
                    tab === t ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-neutral-50'
                  } cursor-pointer`}
                >
                  {TABS[t]}
                </button>
              ))}
            </div>

            {/* Contenido */}
            <div className="mt-6">
              {tab === 'tabla' && tipo === 'liguilla' && (
                <Tabla tabla={tabla} logosMap={logosMap} />
              )}
              {tab === 'fixture' && tipo === 'liguilla' && (
                <Jornadas fixture={fixture} logosMap={logosMap} />  
              )}
              {tab === 'goleadores' && <Goleadores rows={gols} />}
              {tab === 'playoffs' && summary?.eliminatoria && (
  <Playoffs
    bracket={bracket}
    logosMap={logosMap}
    away2x={!!(summary?.eliminatoria?.away_goals)}  // ← correcto
  />
)}



              {tab === 'tabla' && tipo !== 'liguilla' && (
                <Empty text="Este torneo es de eliminación, no tiene tabla de liga." />
              )}
              {tab === 'fixture' && tipo !== 'liguilla' && (
                <Empty text="Este torneo es de eliminación, no tiene fixture de liga." />
              )}
{tab === 'playoffs' && !summary?.eliminatoria && (
   <Empty text="Este torneo aún no tiene eliminatoria configurada." />
 )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

/* ---------- sub-vistas ---------- */

function Empty({ text }) {
  return (
    <div className="p-4 rounded-md border bg-neutral-50 text-neutral-600 text-sm">{text}</div>
  );
}

function Tabla({ tabla, logosMap }) {
  if (!tabla) return <div className="text-sm text-neutral-500">Cargando tabla…</div>;
  if (tabla.length === 0) return <Empty text="Sin datos de tabla aún." />;

  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4 overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-neutral-500 border-b">
            <th className="py-1 w-10 text-center border-r pr-3">Pos.</th>
            <th className="py-1 pl-3">Equipo</th>
            <th className="py-1 text-center">PJ</th>
            <th className="py-1 text-center">G</th>
            <th className="py-1 text-center">E</th>
            <th className="py-1 text-center">P</th>
            <th className="py-1 text-center">GF</th>
            <th className="py-1 text-center">GC</th>
            <th className="py-1 text-center">DG</th>
            <th className="py-1 text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {tabla.map((r, i) => {
            const id   = r.equipo_id ?? r.team_id ?? i;
            const name = r.equipo_nombre ?? r.equipo ?? '';
            const logo = logosMap.get(id) || logosMap.get(String(name).trim()) || null;

            // robustez por si vinieran en mayúsculas
            const pj = r.pj ?? r.PJ ?? 0;
            const g  = r.g  ?? r.G  ?? 0;
            const e  = r.e  ?? r.E  ?? 0;
            const p  = r.p  ?? r.P  ?? 0;
            const gf = r.gf ?? r.GF ?? 0;
            const gc = r.gc ?? r.GC ?? 0;
            const dg = r.dg ?? r.DG ?? (Number(gf) - Number(gc));
            const pts= r.pts ?? r.Pts ?? 0;

            return (
              <tr key={id} className="border-t">
                <td className="py-1 text-center font-semibold border-r pr-3">{i + 1}</td>
                <td className="py-1 pl-3">
                  <div className="flex items-center gap-2">
                    <TeamAvatar src={logo} alt={name} />
                    <span className="whitespace-normal break-words leading-snug max-w-[16rem] md:max-w-none">
                      {name}
                    </span>
                  </div>
                </td>
                <td className="py-1 text-center">{pj}</td>
                <td className="py-1 text-center">{g}</td>
                <td className="py-1 text-center">{e}</td>
                <td className="py-1 text-center">{p}</td>
                <td className="py-1 text-center">{gf}</td>
                <td className="py-1 text-center">{gc}</td>
                <td className="py-1 text-center">{dg}</td>
                <td className="py-1 text-right font-semibold">{pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


// 👇 “Jornadas” (antes Fixture) con nombres largos envueltos + tooltip
function Jornadas({ fixture, logosMap }) {
  if (!fixture) return <div className="text-sm text-neutral-500">Cargando jornadas…</div>;
  const jornadas = fixture?.jornadas || {};
  const descanso = fixture?.descanso || {};
  const keys = Object.keys(jornadas).sort((a, b) => Number(a) - Number(b));
  if (keys.length === 0) return <Empty text="Sin partidos programados." />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {keys.map((jn) => (
        <div key={jn} className="rounded-2xl border bg-white shadow-sm p-4 h-full">
          <div className="font-semibold mb-2">Jornada {jn}</div>

          {descanso[jn] && (
            <div className="mb-2 p-2 rounded border bg-neutral-50 text-xs">
              <b>Descansa:</b> {descanso[jn].nombre}
            </div>
          )}

          <div className="grid gap-2 text-sm">
            {jornadas[jn].map((p) => {
              const lName = p.local_name || '—';
              const vName = p.visita_name || '—';
              const lLogo = logosMap.get(String(lName).trim()) || logosMap.get(p.equipo_local_id) || null;
              const vLogo = logosMap.get(String(vName).trim()) || logosMap.get(p.equipo_visita_id) || null;

              return (
                <div
  key={p.partido_id}
  className="grid md:grid-cols-[1fr_auto_1fr_11rem] grid-cols-1 items-center gap-2 md:gap-4 rounded-md border bg-neutral-50 px-3 py-2"
>
  {/* fila 1: nombres + marcador */}
  <div className="grid md:col-span-3 grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-3">
    {/* Local */}
    <div className="min-w-0 flex items-center gap-2 justify-start">
      <TeamAvatar src={lLogo} alt={lName} />
      <TeamTwoLine name={lName} align="left" />
    </div>

    {/* Marcador centrado (no se encoge) */}
    <div className="shrink-0 flex items-center gap-2">
      <ScoreBox value={p.goles_local} />
      <span className="text-neutral-500 font-semibold">vs</span>
      <ScoreBox value={p.goles_visita} />
    </div>

    {/* Visita */}
    <div className="min-w-0 flex items-center gap-2 justify-end">
      <TeamTwoLine name={vName} align="right" />
      <TeamAvatar src={vLogo} alt={vName} />
    </div>
  </div>

  {/* Info (fecha/hora/cancha): fija en md+, debajo en mobile */}
  <div className="text-center md:text-right text-neutral-600 md:col-auto col-span-full md:w-[11rem] shrink-0">
    <div className="capitalize">{fmtFechaGT(p.fecha)}</div>
    <div className="text-xs">
      {fmtHora(p.hora_txt || p.hora)}{p.cancha ? ` · ${p.cancha}` : ''}
    </div>
  </div>
</div>

              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Goleadores({ rows }) {
  if (!rows) return <div className="text-sm text-neutral-500">Cargando goleadores…</div>;
  if (rows.length === 0) return <Empty text="Sin goles registrados aún." />;
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-1">Jugador</th>
            <th className="py-1">Equipo</th>
            <th className="py-1 text-right">Goles</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.jugador_id} className="border-t">
              <td className="py-1">{r.jugador_nombre}</td>
              <td className="py-1">{r.equipo_nombre}</td>
              <td className="py-1 text-right font-semibold">{r.goles}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Playoffs con el mismo tratamiento para nombres largos
function Playoffs({ bracket, logosMap, away2x = false }) {
  if (!bracket) return <div className="text-sm text-neutral-500">Cargando playoffs…</div>;
  if (!bracket.eliminatoria) return <Empty text="No hay eliminatoria configurada." />;

  const hasMatches =
    Array.isArray(bracket.rounds) &&
    bracket.rounds.some(r => r.series?.some(s => s.legs?.some(lg => lg.local_name || lg.visita_name)));

  if (!hasMatches) return null;

  // Indexar el PRIMER leg de cada match por su id, para leer nombres del siguiente match
const matchIndex = useMemo(() => {
  const map = new Map();
  for (const rd of (bracket.rounds || [])) {
    for (const ser of (rd.series || [])) {
      const l0 = ser.legs?.[0];
      if (l0?.id != null) {
        map.set(Number(l0.id), {
          home: l0.home_name ?? l0.local_name ?? null,
          away: l0.away_name ?? l0.visita_name ?? null,
        });
      }
    }
  }
  return map;
}, [bracket]);


  return (
    <div className="grid gap-4">
      {bracket.rounds.map((r) => (
        <div key={r.round_key} className="rounded-2xl border bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="font-semibold">{roundToEs(r.round_key)}</div>
            {r.ida_vuelta && <span className="text-xs text-neutral-500">(Ida/Vuelta)</span>}
            {away2x && <span className="text-[10px] md:text-xs text-amber-700 font-semibold">(goles de visita x2 si hay empate)</span>}
          </div>

          <div className="grid gap-2 text-sm">
            {r.series.map((s) => {
              const legs = s.legs || [];
              const decision = resolveSeriesDecision(legs, { away2x, winner_id: s.winner_id });

              const serieCerrada =
                (legs.length > 0 && legs.every(l => l.goles_local != null && l.goles_visita != null)) ||
                (s.winner_id != null);

                const lastLeg = legs[legs.length - 1] || {};

// ---- nombre del que avanzó (para mostrar junto a "Ganador por penales") ----

// map id → name usando los legs de ESTA serie
const idToName = new Map();
for (const lg of legs) {
  if (lg?.equipo_local_id != null && lg?.local_name) {
    idToName.set(Number(lg.equipo_local_id), String(lg.local_name));
  }
  if (lg?.equipo_visita_id != null && lg?.visita_name) {
    idToName.set(Number(lg.equipo_visita_id), String(lg.visita_name));
  }
}

// 1) si hay winner_id, mapeamos a nombre con los ids de los legs
let advName = (s.winner_id != null) ? (idToName.get(Number(s.winner_id)) ?? null) : null;

// 2) si NO hay winner_id (o no mapeó), tomamos el siguiente match y el slot
if (!advName) {
  const l0 = legs[0] || {};
  const nextId = l0?.next_match_id != null ? Number(l0.next_match_id) : null;
  const slot   = l0?.next_slot;

  if (nextId != null) {
    const nxt = matchIndex.get(nextId);
    if (nxt) {
      const slotStr = String(slot ?? '').toLowerCase();
      if (slotStr.startsWith('home') || slot === 1) advName = nxt.home ?? null;
      else if (slotStr.startsWith('away') || slot === 2) advName = nxt.away ?? null;
    }
  }
}



              const showWinnerChip = serieCerrada && (decision.winnerName || decision.decidedBy === 'penalties');

              return (
                <div key={s.match_no} className="rounded-md border bg-neutral-50 p-3">
                  <div className="mb-2 text-neutral-700 font-semibold flex items-center gap-2">
                    <span>Serie {s.match_no}</span>
                    {showWinnerChip && (
  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] md:text-xs font-bold">
    {decision.winnerName
      ? `Ganador: ${decision.winnerName}`
      : `Ganador por penales: ${advName || '—'}`}
  </span>
)}


                    {serieCerrada && decision.decidedBy === 'penalties'}
                  </div>

                  <div className="grid gap-2">
                    {legs.map((lg, idx) => {
                      const lName = lg.local_name || '—';
                      const vName = lg.visita_name || '—';
                      const lLogo = logosMap.get(String(lName).trim()) || logosMap.get(lg.equipo_local_id) || null;
                      const vLogo = logosMap.get(String(vName).trim()) || logosMap.get(lg.equipo_visita_id) || null;

                      const isFirst = idx === 0;
                      const isLast  = idx === legs.length - 1;

                      const winnerLeft  = serieCerrada && decision.winnerName === lName;
                      const winnerRight = serieCerrada && decision.winnerName === vName;

                      // global que se muestra SOLO en la vuelta (o último leg)
                      const showGlobal = !isFirst && r.ida_vuelta;
 const nameKeyLeft  = String(lName).trim();
 const nameKeyRight = String(vName).trim();
 const glLeft  = decision.effectiveByName?.get?.(nameKeyLeft);
 const glRight = decision.effectiveByName?.get?.(nameKeyRight);


                      // Si fue por penales, anota “(P)” junto al global mostrado
                      const penMark = serieCerrada && decision.decidedBy === 'penalties' ? '' : '';

                      // Badge solo si la ronda es ida/vuelta
const legText = r.ida_vuelta ? (isFirst ? 'Ida' : 'Vuelta') : null;

                      return (
                        <div key={idx} className="grid md:grid-cols-2 items-center gap-2 md:gap-4">
                          <div className="flex items-center justify-center gap-3 md:gap-4">
                            {/* Local */}
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamAvatar src={lLogo} alt={lName} />
                              <span
                                className={`font-semibold truncate md:whitespace-normal md:break-words ${winnerLeft ? 'text-emerald-700 font-extrabold' : ''}`}
                                title={lName}
                                style={{ maxWidth: '14rem' }}
                              >
                                {lName}
                              </span>
                            </div>

                            {/* Marcador + global (solo vuelta) */}
                            <div className="shrink-0 flex items-center gap-2">
                              <ScoreBox value={lg.goles_local} />
                              {showGlobal && (
                                <span className="text-sm md:text-base text-neutral-600 font-semibold">
                                  ({glLeft}{penMark})
                                </span>
                              )}
                              <span className="text-neutral-500 font-semibold">vs</span>
                              {showGlobal && (
                                <span className="text-sm md:text-base text-neutral-600 font-semibold">
                                  ({glRight}{penMark})
                                </span>
                              )}
                              <ScoreBox value={lg.goles_visita} />
                            </div>

                            {/* Visita */}
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`font-semibold truncate md:whitespace-normal md:break-words text-right ${winnerRight ? 'text-emerald-700 font-extrabold' : ''}`}
                                title={vName}
                                style={{ maxWidth: '14rem' }}
                              >
                                {vName}
                              </span>
                              <TeamAvatar src={vLogo} alt={vName} />
                            </div>
                          </div>

                          <div className="text-center md:text-right text-neutral-600">
                            <div className="flex md:justify-end justify-center items-center gap-2">
  {legText && <LegBadge text={legText} />}
  <div className="capitalize">{fmtFechaGT(lg.fecha, true)}</div>
</div>
                            <div className="text-xs md:text-sm">
                              {fmtHora(lg.hora_txt || lg.hora)}{lg.cancha ? ` · ${lg.cancha}` : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {r.series.length === 0 && <div className="text-neutral-500">Sin emparejamientos.</div>}
          </div>
        </div>
      ))}
    </div>
  );
}



