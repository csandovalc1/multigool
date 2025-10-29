import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import PageShell from '../components/PageShell.jsx';
import { api, API_ORIGIN } from '../lib/api';

const imgUrl = (p) => {
  if (!p) return '/defaults/defaultteam.png';
  if (/^https?:\/\//i.test(p)) return p;
  return `${API_ORIGIN}${p}`;
};

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


const normName = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

function TeamAvatar({ src, alt }) {
  return (
    <img
      src={imgUrl(src)}
      alt={alt || 'logo'}
      className="h-6 w-6 rounded object-cover"
      loading="lazy"
      onError={(ev) => (ev.currentTarget.src = '/defaults/defaultteam.png')}
    />
  );
}

export default function Torneos() {
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [top5, setTop5] = useState([]);
  const [topLoading, setTopLoading] = useState(false);
  const [previewList, setPreviewList] = useState([]);
  const [topSource, setTopSource] = useState(null);
  const [previewSource, setPreviewSource] = useState(null);
  const [previewPhase, setPreviewPhase] = useState('');

  // Map<torneoId, Map<key, logo_path>>
  const [logosByTorneo, setLogosByTorneo] = useState(new Map());

  // ——— clave: SIEMPRE actualización funcional para evitar carreras ———
  const upsertLogosFunctional = (torneoId, equipos) => {
    setLogosByTorneo((prev) => {
      const base = new Map(prev);
      const map = new Map(base.get(torneoId) || []);
      (equipos || []).forEach((e) => {
        const idNum = Number(e.id);
        const idStr = String(e.id);
        const nameK = normName(e.nombre);
        const path = e.logo_path || null;
        map.set(idNum, path);
        map.set(idStr, path);
        map.set(nameK, path);
      });
      base.set(torneoId, map);
      return base;
    });
  };

  function TeamTwoLine({ name = '', align = 'left' }) {
  return (
    <span
      title={name}
      className={`font-semibold leading-tight break-words ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
      }}
    >
      {name || '—'}
    </span>
  );
}


  // carga logos una sola vez por torneoId (idempotente)
  const ensureLogosMap = async (torneoId) => {
    if (!torneoId) return;
    // si ya existen, no vuelvas a pedir
    if (logosByTorneo.has(torneoId)) return;
    try {
      const { data } = await api.get(`/equipos/${torneoId}`);
      upsertLogosFunctional(torneoId, data || []);
    } catch {
      // noop
    }
  };

  function ScoreBox({ value }) {
    return (
      <span className="inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded border bg-white text-xs font-bold">
        {value ?? '—'}
      </span>
    );
  }

  // Torneos
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const direct = await api.get('/public/torneos', {
          params: { limit: 9999, per_page: 9999, page_size: 9999, all: 1 },
        });

        let list = Array.isArray(direct.data)
          ? direct.data
          : Array.isArray(direct.data?.items)
          ? direct.data.items
          : [];

        let next =
          direct.data?.next ||
          direct.data?.next_page ||
          direct.data?.nextPageToken ||
          direct.data?.meta?.next_page;
        let page = (direct.data?.meta?.current_page ?? 1) + 1;
        let pages = direct.data?.meta?.total_pages ?? null;

        let guard = 0;
        while (next || (pages && page <= pages)) {
          guard++;
          if (guard > 20) break;
          const resp = await api.get('/public/torneos', {
            params: next ? { cursor: next } : { page, per_page: 9999 },
          });
          const chunk = Array.isArray(resp.data)
            ? resp.data
            : Array.isArray(resp.data?.items)
            ? resp.data.items
            : [];
          list = list.concat(chunk || []);
          next =
            resp.data?.next ||
            resp.data?.next_page ||
            resp.data?.nextPageToken ||
            resp.data?.meta?.next_page;
          page = (resp.data?.meta?.current_page ?? page) + 1;
          pages = resp.data?.meta?.total_pages ?? pages;
        }

        setTorneos(list || []);
      } catch (e) {
        setError(e?.response?.data?.error || 'No se pudieron cargar los torneos');
        setTorneos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Elegir torneo para tabla
  useEffect(() => {
    if (!torneos?.length) {
      setTopSource(null);
      return;
    }
    const ligaReciente = torneos.find((t) => t.tipo_torneo === 'liguilla') || null;
    setTopSource(ligaReciente);
  }, [torneos]);

  // Preview
  useEffect(() => {
    const destacado = torneos?.[0];
    if (!destacado) {
      setPreview(null);
      setPreviewList([]);
      setPreviewSource(null);
      setPreviewPhase('');
      return;
    }

    let alive = true;

    (async () => {
      try {
        const pool = torneos.slice();
        const prefer = (t) => (topSource && topSource.id ? t.id !== topSource.id : true);
        const chosen =
          pool.find((t) => (t.fase === 'playoffs' || t.tipo_torneo === 'eliminatoria') && prefer(t)) ||
          pool.find((t) => t.fase === 'playoffs' || t.tipo_torneo === 'eliminatoria') ||
          destacado;

        await api.get(`/public/torneos/${chosen.id}/summary`);

        let list = [];
        let phase = '';

        try {
  const { data: po } = await api.get(`/public/torneos/${chosen.id}/playoffs`);
  const rounds = po?.rounds || [];

  // Aplana manteniendo serie y leg
  const allLegs = rounds.flatMap((r) =>
    (r.series || []).flatMap((s) =>
      (s.legs || []).map((lg) => ({
        ...lg,
        round_key: r.round_key,
        match_no: s.match_no,
        isVuelta: Number(lg.leg) > 1, // leg 2 = vuelta
      }))
    )
  );

  // Agrupar por serie
  const bySeries = new Map();
  for (const lg of allLegs) {
    const k = String(lg.match_no);
    if (!bySeries.has(k)) bySeries.set(k, []);
    bySeries.get(k).push(lg);
  }

  // Helper: parse fecha segura
  const toDate = (v) => (v ? new Date(v) : null);
  const isPast = (v) => {
    const d = toDate(v);
    return d ? d.getTime() < Date.now() : false;
  };
  const hasScore = (lg) =>
    (lg.goles_local ?? null) != null || (lg.goles_visita ?? null) != null;

  // Para cada serie, elegir 1 leg:
  // - si hay vuelta jugada (score o ya pasó), tomar esa vuelta más reciente
  // - si no, tomar la ida
  const picks = [];
  for (const [seriesKey, legs] of bySeries) {
    const vueltasJugadas = legs
      .filter((l) => l.isVuelta && (hasScore(l) || isPast(l.fecha)))
      .sort((a, b) => (toDate(b.fecha) || 0) - (toDate(a.fecha) || 0));

    let chosen;
    if (vueltasJugadas.length) {
      chosen = vueltasJugadas[0];
    } else {
      // ida (o único leg) preferentemente con score; si no, por fecha
      const idas = legs.filter((l) => !l.isVuelta);
      const cand = (idas.length ? idas : legs).slice();
      cand.sort((a, b) => {
        const aScore = hasScore(a) ? 1 : 0;
        const bScore = hasScore(b) ? 1 : 0;
        if (aScore !== bScore) return bScore - aScore; // con marcador primero
        return (toDate(b.fecha) || 0) - (toDate(a.fecha) || 0); // más reciente
      });
      chosen = cand[0];
    }

    if (chosen) {
      picks.push({
        chosen,
        series: seriesKey,
        when: toDate(chosen.fecha) || new Date(0),
        scored: hasScore(chosen),
      });
    }
  }

  // Ordenar series por: con marcador primero, luego más reciente
  picks.sort((a, b) => {
    if (a.scored !== b.scored) return b.scored - a.scored;
    return b.when - a.when;
  });

  // Tomar las 2 mejores series (máx. 2 partidos y siempre de series distintas)
  const two = picks.slice(0, 2).map((p) => p.chosen);

  // Construir previewList
  const list = two.map((lg) => ({
    home: lg.local_name || '—',
    away: lg.visita_name || '—',
    gl: lg.goles_local ?? null,
    gv: lg.goles_visita ?? null,
  }));

  // Fase para el título del preview (si ambas son de la misma, usa esa)
  const phase =
    two.length && two.every((x) => x.round_key === two[0].round_key)
      ? two[0].round_key
      : (two[0]?.round_key || '');

  setPreview(list[0] || null);
  setPreviewList(list);
  setPreviewSource(chosen);
  setPreviewPhase(roundToEs(phase));


  await ensureLogosMap(chosen.id);
} catch {
  setPreview(null);
  setPreviewList([]);
  setPreviewSource(null);
  setPreviewPhase('');
}


        // logos del torneo elegido (idempotente, con set funcional)
        await ensureLogosMap(chosen.id);
      } catch {
        if (!alive) return;
        setPreview(null);
        setPreviewList([]);
        setPreviewSource(null);
        setPreviewPhase('');
      }
    })();

    return () => {
      alive = false;
    };
  }, [torneos, topSource]); // eslint-disable-line

  // Tabla (top 5) + logos
  useEffect(() => {
    const destacado = torneos?.[0];
    const src = topSource || (destacado?.tipo_torneo === 'liguilla' ? destacado : null);
    if (!src) {
      setTop5([]);
      return;
    }
    (async () => {
      try {
        setTopLoading(true);
        const { data: tabla } = await api.get(`/public/torneos/${src.id}/tabla`);
        setTop5((tabla || []).slice(0, 5));
        await ensureLogosMap(src.id); // carga (si hiciera falta) con set funcional
      } catch {
        setTop5([]);
      } finally {
        setTopLoading(false);
      }
    })();
  }, [torneos, topSource]); // eslint-disable-line

  const destacado = torneos[0];
  const previewLogos = useMemo(
    () => (previewSource ? logosByTorneo.get(previewSource.id) || new Map() : new Map()),
    [previewSource, logosByTorneo]
  );
  const topLogos = useMemo(
    () => (topSource ? logosByTorneo.get(topSource.id) || new Map() : new Map()),
    [topSource, logosByTorneo]
  );

  const resolveLogo = (logosMap, id, name) => {
    const idNum = Number(id);
    const idStr = String(id);
    const nName = normName(name);
    return logosMap.get(idNum) || logosMap.get(idStr) || logosMap.get(nName) || null;
  };

  return (
    <PageShell bgUrl="url(https://images.unsplash.com/photo-1434648957308-5e6a859697e8?q=80&w=2000&auto=format&fit=crop)">
      <section className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <div className="uppercase text-4xl md:text-5xl font-extrabold leading-none text-white">
            Cupos disponibles <br /> inscribe a tu equipo
          </div>
          <a
            href="https://wa.me/50255555555?text=Hola%20Multigool,%20quiero%20inscribir%20a%20mi%20equipo"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-green-500 hover:bg-green-400 font-semibold text-white cursor-pointer"
          >
            <MessageCircle className="h-6 w-6 text-white" /> WhatsApp
          </a>

          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {/* PREVIEW */}
            <div className="rounded-2xl border bg-white/95 shadow-sm p-4">
              <div className="text-sm text-neutral-600">
                {previewSource ? previewSource.nombre : destacado ? destacado.nombre : 'Torneo'}
              </div>
              <div className="font-bold">
                {previewPhase ? previewPhase : previewSource?.fase === 'playoffs' ? 'Playoffs' : 'Fase de liga'}
              </div>

              <div className="mt-3 grid gap-2">
                {(previewList.length ? previewList : preview ? [preview] : []).map((m, i) => {
                  const homeLogo = resolveLogo(previewLogos, null, m.home);
                  const awayLogo = resolveLogo(previewLogos, null, m.away);
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-1 items-center gap-2 rounded-md border bg-neutral-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-center gap-2">
<div className="flex items-center justify-center gap-2 md:gap-3">
  {/* Local: elástico, con 2 líneas máximo */}
  <div className="min-w-0 grow flex items-center gap-2 justify-start">
    <TeamAvatar src={homeLogo} alt={m.home} />
    <TeamTwoLine name={m.home} align="left" />
  </div>

  {/* Marcador: no se encoge */}
  <div className="shrink-0 flex items-center gap-2">
    <ScoreBox value={m.gl} />
    <span className="text-neutral-500 font-semibold">vs</span>
    <ScoreBox value={m.gv} />
  </div>

  {/* Visita: elástico, con 2 líneas máximo */}
  <div className="min-w-0 grow flex items-center gap-2 justify-end">
    <TeamTwoLine name={m.away} align="right" />
    <TeamAvatar src={awayLogo} alt={m.away} />
  </div>
</div>

                      </div>
                    </div>
                  );
                })}
                {!preview && !previewList.length && <div className="text-xs text-neutral-500">—</div>}
              </div>

              <Link
                to={
                  previewSource
                    ? `/torneos/${previewSource.id}`
                    : destacado
                    ? `/torneos/${destacado.id}`
                    : '/torneos'
                }
                className="mt-4 block text-center px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer"
              >
                Ver torneo completo
              </Link>
            </div>

            {/* TORNEOS ACTIVOS */}
            <div className="rounded-2xl border bg-white/95 shadow-sm p-4">
              <div className="font-semibold mb-2">Torneos activos</div>

              {loading && <div className="text-sm text-neutral-500">Cargando…</div>}
              {error && <div className="text-sm text-rose-600">{error}</div>}

              <div className="grid gap-2 text-sm">
                {!loading && !error && torneos.length === 0 && (
                  <div className="text-neutral-500">No hay torneos activos.</div>
                )}
                {torneos.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between bg-neutral-50 rounded-md border px-3 py-2"
                  >
                    <span className="truncate">{t.nombre}</span>
                    <Link
                      to={`/torneos/${t.id}`}
                      className="px-2 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-500 cursor-pointer"
                    >
                      VER
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TABLA */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border bg-white/95 shadow-sm p-4">
            <div className="font-semibold mb-2">
              {topSource ? topSource.nombre : 'Tabla del torneo'}
            </div>

            {topLoading && <div className="text-sm text-neutral-500">Cargando…</div>}

            {!topLoading && !topSource && (
              <div className="text-sm text-neutral-500">
                Este torneo es eliminatoria — no hay tabla de liga.
              </div>
            )}

            {!topLoading && topSource && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-1">Equipo</th>
                    <th className="py-1 text-center">G</th>
                    <th className="py-1 text-center">E</th>
                    <th className="py-1 text-center">P</th>
                    <th className="py-1 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.map((r, i) => {
                    const id = r.equipo_id ?? r.team_id ?? i;
                    const name = r.equipo_nombre ?? r.equipo;
                    const logo = (() => {
                      const map = topLogos;
                      const idNum = Number(id);
                      const idStr = String(id);
                      const nName = normName(name);
                      return map.get(idNum) || map.get(idStr) || map.get(nName) || null;
                    })();
                    return (
                      <tr key={id} className="border-t">
                        <td className="py-1">
                          <div className="flex items-center gap-2">
                            <TeamAvatar src={logo} alt={name} />
                            <span className="truncate">{name}</span>
                          </div>
                        </td>
                        <td className="py-1 text-center">{r.g ?? r.G}</td>
                        <td className="py-1 text-center">{r.e ?? r.E}</td>
                        <td className="py-1 text-center">{r.p ?? r.P}</td>
                        <td className="py-1 text-right font-semibold">{r.pts ?? r.Pts}</td>
                      </tr>
                    );
                  })}
                  {!top5.length && (
                    <tr>
                      <td colSpan={5} className="py-2 text-center text-neutral-500">
                        Sin datos aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            <Link
              to={
                topSource
                  ? `/torneos/${topSource.id}?tab=tabla`
                  : destacado
                  ? `/torneos/${destacado.id}`
                  : '/torneos'
              }
              className="mt-3 block text-center px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer"
            >
              Ver tabla de posiciones completa
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
