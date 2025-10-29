// src/components/TablaPosicionesPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { api, API_ORIGIN } from "../lib/api";

const imgUrl = (p) => {
  if (!p) return "/defaults/defaultteam.png";
  if (/^https?:\/\//i.test(p)) return p;
  return `${API_ORIGIN}${p}`;
};
function TeamAvatar({ src, alt }) {
  return (
    <img
      src={imgUrl(src)}
      alt={alt || "logo"}
      className="h-6 w-6 rounded object-cover ring-1 ring-slate-200"
      loading="lazy"
      onError={(ev) => (ev.currentTarget.src = "/defaults/defaultteam.png")}
    />
  );
}

export default function TablaPosicionesPanel({ torneoId }) {
  const [rows, setRows] = useState([]);
  const [logos, setLogos] = useState(new Map()); // id -> logo

  useEffect(() => {
    if (!torneoId) return;
    (async () => {
      const [{ data: tabla }, { data: equipos }] = await Promise.all([
        api.get(`/tabla/${torneoId}`),
        api.get(`/equipos/${torneoId}`),
      ]);
      setRows(tabla || []);
      const m = new Map();
      (equipos || []).forEach((e) => m.set(Number(e.id), e.logo_path || null));
      setLogos(m);
    })();
  }, [torneoId]);

  const rowsNorm = useMemo(() => {
    return (rows || []).map((r, i) => ({
      id: r.team_id ?? r.equipo_id ?? i,
      equipo: r.equipo ?? r.equipo_nombre ?? "",
      PJ: r.PJ ?? r.pj ?? 0,
      G: r.G ?? r.g ?? 0,
      E: r.E ?? r.e ?? 0,
      P: r.P ?? r.p ?? 0,
      GF: r.GF ?? r.gf ?? 0,
      GC: r.GC ?? r.gc ?? 0,
      DG: (r.DG ?? r.dg ?? (Number(r.GF ?? r.gf ?? 0) - Number(r.GC ?? r.gc ?? 0))),
      Pts: r.Pts ?? r.pts ?? 0,
    }));
  }, [rows]);

  if (!torneoId) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white/95 backdrop-blur z-10">
          <tr className="text-left text-slate-500 border-b">
            <th className="py-2 pl-3 pr-2 w-12">Pos</th>
            <th className="py-2 pr-2 min-w-[12rem]">Equipo</th>
            <th className="py-2 text-center">PJ</th>
            <th className="py-2 text-center">G</th>
            <th className="py-2 text-center">E</th>
            <th className="py-2 text-center">P</th>
            <th className="py-2 text-center">GF</th>
            <th className="py-2 text-center">GC</th>
            <th className="py-2 text-center">DG</th>
            <th className="py-2 pr-3 text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rowsNorm.map((r, i) => {
            const logo = logos.get(Number(r.id)) || null;
            const pos = i + 1;
            const posPill =
              pos <= 1
                ? "bg-amber-500/90 text-white"
                : pos <= 4
                ? "bg-emerald-600/90 text-white"
                : "bg-slate-200 text-slate-700";

            return (
              <tr
                key={r.id}
                className={`border-t ${i % 2 === 0 ? "bg-slate-50/40" : "bg-white"}`}
              >
                <td className="py-2 pl-3 pr-2">
                  <span className={`inline-flex items-center justify-center w-9 px-2 py-0.5 rounded-full text-xs font-bold ${posPill}`}>
                    {pos}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamAvatar src={logo} alt={r.equipo} />
                    <span className="font-medium leading-tight truncate md:whitespace-normal md:break-words">
                      {r.equipo}
                    </span>
                  </div>
                </td>
                <td className="py-2 text-center">{r.PJ}</td>
                <td className="py-2 text-center">{r.G}</td>
                <td className="py-2 text-center">{r.E}</td>
                <td className="py-2 text-center">{r.P}</td>
                <td className="py-2 text-center">{r.GF}</td>
                <td className="py-2 text-center">{r.GC}</td>
                <td className="py-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.DG > 0 ? "bg-emerald-50 text-emerald-700" : r.DG < 0 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                    {r.DG}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right font-semibold">{r.Pts}</td>
              </tr>
            );
          })}

          {!rowsNorm.length && (
            <tr>
              <td colSpan={10} className="py-6 text-center text-slate-500">
                Sin datos aún (jueguen unos partiditos po’ 😉).
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
