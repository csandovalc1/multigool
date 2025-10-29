// src/pages/Noticias.jsx
import { useEffect, useMemo, useState } from "react";
import PageShell from "../components/PageShell.jsx";
import Modal from "../components/Modal.jsx";
import { api } from "../lib/api";
import { Search } from "lucide-react";
import { absUrl } from "../lib/constants";

/** Formatea "YYYY-MM-DD HH:mm:ss" (ya en GT) a bonito es-GT */
function fmtGT(yyyyMMddHHmmss) {
  if (!yyyyMMddHHmmss) return "-";
  try {
    const iso = yyyyMMddHHmmss.replace(" ", "T"); // ya viene en GT
    const d = new Date(iso);
    return d.toLocaleString("es-GT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return yyyyMMddHHmmss;
  }
}

function NewsCard({ n, onOpen }) {
  const handleOpen = () => onOpen(n);

  return (
    <div
      onClick={handleOpen}
      className="group rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleOpen();
      }}
    >
      {n.portada_url ? (
        <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
          <img
            src={n.portada_url}
            alt={n.titulo}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-neutral-100" />
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="text-xs text-neutral-500">{fmtGT(n.publish_at)}</div>
        <h3 className="font-semibold mt-1 mb-1 leading-snug">{n.titulo}</h3>
        {n.resumen && (
          <p className="text-sm text-neutral-700 line-clamp-3">{n.resumen}</p>
        )}
        <div className="mt-auto pt-3">
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(n); }}
            className="px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-sm cursor-pointer"
          >
            Leer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Noticias() {
  const [lista, setLista] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // modal detalle
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // paginación simple
  const [page, setPage] = useState(1);
  const pageSize = 9;

  const cargar = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/noticias");
      // Solo publicadas + absolutiza portada aquí
      const pub = (data || [])
        .filter((n) => String(n.estado).toLowerCase() === "publicada")
        .map((n) => ({ ...n, portada_url: absUrl(n.portada_url) }));

      // Pinned primero, luego por fecha
      pub.sort((a, b) => {
        const pa = a.pinned ? 0 : 1;
        const pb = b.pinned ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (b.publish_at || "").localeCompare(a.publish_at || "");
      });
      setLista(pub);
    } catch (e) {
      console.error(e);
      setLista([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return lista;
    return lista.filter(
      (n) =>
        String(n.titulo || "").toLowerCase().includes(term) ||
        String(n.resumen || "").toLowerCase().includes(term)
    );
  }, [lista, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const items = useMemo(() => {
    const from = (pageSafe - 1) * pageSize;
    return filtered.slice(from, from + pageSize);
  }, [filtered, pageSafe]);

  const openDetail = async (n) => {
    setOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      // 1) intenta por slug (público)
      if (n.slug) {
        try {
          const r1 = await api.get(`/noticias/public/${encodeURIComponent(n.slug)}`);
          setDetail(normalizeDetail(r1.data));
          return;
        } catch {
          // sigue a id
        }
      }
      // 2) fallback por id
      const r2 = await api.get(`/noticias/${n.id}`);
      setDetail(normalizeDetail(r2.data));
    } catch (e) {
      console.error(e);
      setDetail(normalizeDetail({
        titulo: n.titulo,
        publish_at_gt: n.publish_at,
        cuerpo_md: "<em>No se pudo cargar el contenido.</em>",
        imagenes: n.imagenes || (n.portada_url ? [n.portada_url] : []),
        portada_url: n.portada_url,
      }));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <PageShell bgUrl="url(https://images.unsplash.com/photo-1500043357865-c6b8827edf64?q=80&w=2000&auto=format&fit=crop)">
      <div className="rounded-2xl border bg-white/95 shadow-sm p-5 md:p-8 overflow-hidden">
        <h1 className="font-extrabold tracking-wide uppercase text-3xl text-center mb-6">
          Noticias & Anuncios
        </h1>

        {/* Buscar */}
        <div className="mb-4 flex items-center gap-2">
          <div className="relative w-full md:w-96">
            <input
              className="border rounded-full pl-10 pr-3 py-2 w-full"
              placeholder="Buscar noticias…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          </div>
          <button
            className="px-3 py-2 rounded-full border text-sm hover:bg-neutral-50 cursor-pointer"
            onClick={() => setQ("")}
          >
            Limpiar
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="p-4 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
            Cargando noticias…
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
            {q ? "Sin resultados." : "Aún no hay noticias publicadas."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((n) => (
              <NewsCard key={n.id} n={n} onOpen={openDetail} />
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              className="px-3 py-1 rounded-full border text-sm disabled:opacity-40 hover:bg-neutral-50 cursor-pointer disabled:cursor-not-allowed"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Anteriores
            </button>
            <div className="text-sm text-neutral-600">
              Página <b>{pageSafe}</b> de <b>{totalPages}</b>
            </div>
            <button
              className="px-3 py-1 rounded-full border text-sm disabled:opacity-40 hover:bg-neutral-50 cursor-pointer disabled:cursor-not-allowed"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguientes →
            </button>
          </div>
        )}
      </div>

      {/* Modal detalle — más ancho/alto, sin previews, imagen contenida */}
{/* Modal detalle — ancho grande, alto cómodo */}
<Modal
  open={open}
  onClose={() => setOpen(false)}
  title={detail?.titulo || "Noticia"}
  panelClass="max-w-[1300px]"     // 👈 ancho fijo deseado
  bodyClass="max-h-[85vh] pr-1"   // área útil de contenido
>
  {detailLoading ? (
    <div className="p-3 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
      Cargando…
    </div>
  ) : !detail ? (
    <div className="text-sm text-neutral-600">Sin datos</div>
  ) : (
    <DetalleNoticia data={detail} />
  )}
</Modal>

    </PageShell>
  );
}

function normalizeDetail(d) {
  const rawImgs = Array.isArray(d?.imagenes)
    ? d.imagenes
    : Array.isArray(d?.imagenes_json)
    ? d.imagenes_json
    : [];
  const imgsAbs = rawImgs.map(absUrl);
  const portadaAbs = absUrl(d?.portada_url);
  const gallery = imgsAbs.length > 0 ? imgsAbs : (portadaAbs ? [portadaAbs] : []);
  return {
    ...d,
    imagenes: gallery,
    portada_url: portadaAbs,
    publish_at: d?.publish_at_gt || d?.publish_at || null,
  };
}

/** Galería simple: caja fija (alto) + imagen contenida */
function DetalleNoticia({ data }) {
  const imgs = Array.isArray(data.imagenes) ? data.imagenes : [];
  const fechaTxt = data.publish_at || "-";
  const [idx, setIdx] = useState(0);

  const hasMany = imgs.length > 1;
  const goPrev = () => setIdx((i) => (i - 1 + imgs.length) % imgs.length);
  const goNext = () => setIdx((i) => (i + 1) % imgs.length);

  return (
    <div className="space-y-4 text-sm">
      <div className="text-xs text-neutral-500">{fmtGT(fechaTxt)}</div>

      {imgs.length > 0 && (
        // ⬇️ Caja FIJA de imagen: alto tipo 500px (responsive), full width
        <div className="relative w-full rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center
                h-[260px] sm:h-[300px] md:h-[340px] lg:h-[380px]">
  <img
    key={imgs[idx]}
    src={imgs[idx]}
    alt={`img-${idx}`}
    className="block object-contain max-h-full max-w-full w-auto h-auto"
    loading="lazy"
  />

  {hasMany && (
    <>
      <button
        className="absolute left-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-black/50 text-white text-sm hover:bg-black/60 cursor-pointer"
        onClick={goPrev}
        aria-label="Anterior"
      >
        ‹
      </button>
      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-black/50 text-white text-sm hover:bg-black/60 cursor-pointer"
        onClick={goNext}
        aria-label="Siguiente"
      >
        ›
      </button>
    </>
  )}
</div>
      )}

      <div className="prose prose-sm max-w-none">
        <div
          dangerouslySetInnerHTML={{
            __html: data.cuerpo_html || data.cuerpo_md || "",
          }}
        />
      </div>
    </div>
  );
}
