// src/pages/Nosotros.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import PageShell from "../components/PageShell.jsx";
import Modal from "../components/Modal.jsx";
import { api } from "../lib/api";
import { absUrl, FACEBOOK_PAGE_URL, FACEBOOK_SECTION_TITLE, MAPS_PLACE_QUERY, MAPS_ZOOM, MAPS_EMBED_KEY } from "../lib/constants";

/* ========== Helpers ========== */
function useTabSync(defaultTab = "info") {
  const getInitial = () => {
    const u = new URL(window.location.href);
    const t = (u.searchParams.get("tab") || "").toLowerCase();
    return t === "galeria" ? "galeria" : "info";
  };
  const [tab, setTab] = useState(getInitial);

  useEffect(() => {
    const u = new URL(window.location.href);
    if ((u.searchParams.get("tab") || "") !== tab) {
      if (tab === "info") u.searchParams.delete("tab");
      else u.searchParams.set("tab", tab);
      window.history.replaceState({}, "", u.toString());
    }
  }, [tab]);

  return [tab, setTab];
}

/** Facebook Page Plugin (centrado y ancho fijo del plugin) */
function FacebookPageEmbed({ pageUrl }) {
  const height = 600;
  const width = 500;
  const src = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(
    pageUrl
  )}&tabs=timeline&width=${width}&height=${height}&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`;
  return (
    <div className="mx-auto w-full" style={{ maxWidth: width }}>
      <div className="rounded-xl overflow-hidden border bg-white shadow-sm">
        <iframe
          title="Facebook Page"
          src={src}
          style={{ border: "none", overflow: "hidden", width: "100%", height }}
          scrolling="no"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
}

/** Google Maps Embed (card compacta, centrada) */
function GoogleMapEmbed({ query, zoom = 15, apiKey = "" }) {
  const width = 500;
  const height = 420;
  const src = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}&zoom=${zoom}`
    : `https://maps.google.com/maps?q=${query}&t=&z=${zoom}&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: width }}>
      <div className="rounded-xl overflow-hidden border bg-white shadow-sm">
        <iframe
          title="Ubicación en Google Maps"
          src={src}
          width="100%"
          height={height}
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

/* ========== Galería (público) ========== */
function GalleryGrid() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);

  // paginación simple en cliente
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // lightbox
  const [open, setOpen] = useState(false);
  const [currIdx, setCurrIdx] = useState(0); // índice global sobre 'all'

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/galeria");
        const onlyPublished = (data || [])
          .filter((f) => String(f.estado).toLowerCase() === "publicada")
          .map((f) => ({ ...f, url: absUrl(f.url) }));
        // orden por id desc/fecha si la tuvieses; aquí lo dejamos tal como viene
        setAll(onlyPublished);
      } catch {
        setAll([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const items = useMemo(() => {
    const from = (pageSafe - 1) * pageSize;
    return all.slice(from, from + pageSize);
  }, [all, pageSafe]);

  // abrir lightbox posicionando el índice global correcto
  const openLightbox = useCallback(
    (imgId) => {
      const idx = all.findIndex((x) => x.id === imgId);
      setCurrIdx(idx >= 0 ? idx : 0);
      setOpen(true);
    },
    [all]
  );

  const goPrev = useCallback(() => {
    setCurrIdx((i) => (i - 1 + all.length) % all.length);
  }, [all.length]);

  const goNext = useCallback(() => {
    setCurrIdx((i) => (i + 1) % all.length);
  }, [all.length]);

  // navegación por teclado cuando el modal esté abierto
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext]);

  if (loading) {
    return (
      <div className="p-4 rounded-md border bg-neutral-50 text-neutral-600 text-sm text-center">
        Cargando galería…
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <div className="p-4 rounded-md border bg-neutral-50 text-neutral-600 text-sm text-center">
        Aún no hay fotos publicadas.
      </div>
    );
  }

  const current = all[currIdx] || null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
        {items.map((f) => (
          <figure
            key={f.id}
            className="group rounded-lg overflow-hidden border bg-white cursor-pointer"
            onClick={() => openLightbox(f.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openLightbox(f.id);
            }}
            title="Ver grande"
          >
            <div className="relative h-44 overflow-hidden bg-neutral-100">
              <img
                src={f.url}
                alt={f.descripcion || `foto-${f.id}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 ring-0 group-hover:ring-4 group-hover:ring-black/10 transition-all" />
            </div>
            {f.descripcion && (
              <figcaption className="p-2 text-xs text-neutral-700 line-clamp-2">
                {f.descripcion}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <button
            className="px-3 py-1 rounded-full border text-sm disabled:opacity-40 hover:bg-neutral-50 disabled:cursor-not-allowed"
            disabled={pageSafe <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Anteriores
          </button>
          <div className="text-sm text-neutral-600">
            Página <b>{pageSafe}</b> de <b>{totalPages}</b>
          </div>
          <button
            className="px-3 py-1 rounded-full border text-sm disabled:opacity-40 hover:bg-neutral-50 disabled:cursor-not-allowed"
            disabled={pageSafe >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguientes →
          </button>
        </div>
      )}

      {/* Lightbox estilo Noticias (grande, con flechas y cerrar) */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={current?.descripcion || "Foto"}
        panelClass="max-w-[1200px]"
        bodyClass="max-h-[85vh] p-0"
      >
        {!current ? (
          <div className="p-3 text-sm text-neutral-600">Sin datos</div>
        ) : (
          <div className="relative flex items-center justify-center bg-black">
            <img
              src={current.url}
              alt={current.descripcion || `foto-${current.id}`}
              className="max-h-[85vh] w-auto h-auto object-contain"
            />
            {all.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-white/20 text-white text-lg hover:bg-white/30 cursor-pointer"
                  onClick={goPrev}
                  aria-label="Anterior"
                >
                  ‹
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-white/20 text-white text-lg hover:bg-white/30 cursor-pointer"
                  onClick={goNext}
                  aria-label="Siguiente"
                >
                  ›
                </button>
              </>
            )}
            {/* contador */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-white/20 text-white text-xs">
              {currIdx + 1} / {all.length}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ========== Página Nosotros con Tabs ========== */
export default function Nosotros() {
  const [tab, setTab] = useTabSync("info");

  return (
    <PageShell bgUrl="url(https://images.unsplash.com/photo-1521417531039-94e33f60d4d0?q=80&w=2000&auto=format&fit=crop)">
      <section className="rounded-2xl border bg-white/95 shadow-sm p-5 md:p-8">
        <h1 className="font-extrabold tracking-wide uppercase text-3xl text-center mb-6">
          Nosotros
        </h1>

        {/* Tabs */}
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex rounded-full border bg-white p-1 shadow-sm mx-auto">
            <button
              className={[
                "px-4 py-1.5 text-sm rounded-full transition",
                tab === "info" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
              onClick={() => setTab("info")}
            >
              Información
            </button>
            <button
              className={[
                "px-4 py-1.5 text-sm rounded-full transition",
                tab === "galeria" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
              ].join(" ")}
              onClick={() => setTab("galeria")}
            >
              Galería
            </button>
          </div>
        </div>

        {/* Panels */}
        <div className="mt-8">
          {tab === "info" ? (
            <div className="space-y-10">
              {/* Facebook */}
              <div>
                <h2 className="text-xl font-bold mb-3 text-center">
                  {FACEBOOK_SECTION_TITLE}
                </h2>
                <FacebookPageEmbed pageUrl={FACEBOOK_PAGE_URL} />
              </div>

              {/* Mapa */}
              <div>
                <h2 className="text-xl font-bold mb-3 text-center">¿Dónde estamos?</h2>
                <GoogleMapEmbed
                  query={MAPS_PLACE_QUERY}
                  zoom={MAPS_ZOOM}
                  apiKey={MAPS_EMBED_KEY}
                />
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold mb-4 text-center">Galería</h2>
              <GalleryGrid />
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
