// src/components/CanceledList.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

function ymdNice(ymd) {
  try {
    return new Date(ymd + "T00:00:00").toLocaleDateString("es-CL", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return ymd;
  }
}

export default function CanceledList({ tipo = "", rev, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState("");     // YYYY-MM-DD
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { estado: "cancelado" };
      if (from) params.from = from;
      if (to) params.to = to;
      if (tipo) params.tipo_futbol = tipo;
      const { data } = await api.get("/reservas", { params });
      setItems(data || []);
    } catch (e) {
      setError(e?.response?.data?.error || "No se pudieron cargar las canceladas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // carga inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]); // recarga si cambias el filtro de tipo desde arriba

  useEffect(() => {
    if (rev === undefined) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  const grouped = useMemo(() => {
    const g = new Map(); // fecha -> array
    for (const r of items) {
      const f = (r.fecha || "").slice(0, 10);
      if (!g.has(f)) g.set(f, []);
      g.get(f).push(r);
    }
    // ordenar por fecha desc y cada grupo por hora asc
    return Array.from(g.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([fecha, arr]) => [
        fecha,
        arr.sort((x, y) => (x.hi_txt || "").localeCompare(y.hi_txt || "")),
      ]);
  }, [items]);

  const setEstado = async (id, estado) => {
    setSavingId(id);
    try {
      await api.patch(`/reservas/${id}/estado`, { estado });
      // refresca solo client-side: quita del listado si ya no es cancelado
      if (estado !== "cancelado") {
        setItems((prev) => prev.filter((r) => r.id !== id));
        onChanged?.({ type: "estado-cambiado", id, to: estado, affectsAgenda: true });
      } else {
        await load();
      }
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo cambiar el estado");
    } finally {
      setSavingId(null);
    }
  };

  const restore = (id) => setEstado(id, "pendiente");

  return (
    <div className="rounded-xl border bg-white shadow p-4">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="text-sm font-semibold">Papelera (canceladas)</div>
        <div className="ml-auto flex items-end gap-2">
          <label className="text-xs">
            <div className="text-neutral-500 mb-1">Desde</div>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-xs">
            <div className="text-neutral-500 mb-1">Hasta</div>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            onClick={load}
            className="px-3 py-1.5 border rounded text-sm hover:bg-neutral-50"
          >
            Buscar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-600">Cargando…</div>
      ) : grouped.length === 0 ? (
        <div className="text-sm text-neutral-500">Sin reservas canceladas.</div>
      ) : (
        grouped.map(([fecha, arr]) => (
          <div key={fecha} className="mb-6">
            <div className="font-semibold text-sm text-neutral-700 mb-2">
              {ymdNice(fecha)}
            </div>

            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr className="text-left">
                    <th className="px-2 py-2 border-b">Hora</th>
                    <th className="px-2 py-2 border-b">Cancha</th>
                    <th className="px-2 py-2 border-b">Modalidad</th>
                    <th className="px-2 py-2 border-b">Cliente</th>
                    <th className="px-2 py-2 border-b">Teléfono</th>
                    <th className="px-2 py-2 border-b">Acciones</th>
                    <th className="px-2 py-2 border-b">Cambiar estado</th>
                  </tr>
                </thead>
                <tbody>
                  {arr.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {(r.hi_txt || "").slice(0, 5)} — {(r.hf_txt || "").slice(0, 5)}
                      </td>
                      <td className="px-2 py-2">{r.cancha_nombre || r.cancha_id}</td>
                      <td className="px-2 py-2">{r.tipo_futbol || "—"}</td>
                      <td className="px-2 py-2">
                        {`${r.cliente_nombres || ""}${r.cliente_apellidos ? " " + r.cliente_apellidos : ""}`.trim() || "—"}
                      </td>
                      <td className="px-2 py-2">{r.cliente_telefono || "—"}</td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => restore(r.id)}
                          disabled={savingId === r.id}
                          className={`px-3 py-1 rounded text-white text-xs ${
                            savingId === r.id ? "bg-green-300" : "bg-green-600 hover:bg-green-500"
                          }`}
                          title="Restaurar a pendiente"
                        >
                          Restaurar
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-2">
                          <select
   className="border rounded px-2 py-1 text-xs"
   value={r.estado || "cancelado"}          // <- Muestra 'cancelado' por defecto
   onChange={(e) => setEstado(r.id, e.target.value)}
   disabled={savingId === r.id}
   title="Cambiar directamente a otro estado"
 >
                            <option value="pendiente">pendiente</option>
                            <option value="pagada">pagada</option>
                            <option value="completada">completada</option>
                            <option value="cancelado">cancelado</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        ))
      )}
    </div>
  );
}
