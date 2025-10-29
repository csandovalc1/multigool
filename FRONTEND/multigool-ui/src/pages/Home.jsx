// Home.jsx
import { Link } from 'react-router-dom';
import { CalendarDays, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import Modal from '../components/Modal.jsx';
import { api } from '../lib/api';
import { absUrl } from '../lib/constants';

/** Fecha "YYYY-MM-DD HH:mm:ss" (GT) a bonito es-GT */
function fmtGT(yyyyMMddHHmmss) {
  if (!yyyyMMddHHmmss) return '-';
  try {
    const iso = yyyyMMddHHmmss.replace(' ', 'T');
    const d = new Date(iso);
    return d.toLocaleString('es-GT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return yyyyMMddHHmmss;
  }
}

function AnnouncementBanner({ item, onOpen }) {
  const open = () => onOpen(item);

  return (
    <div className="mb-6 rounded-xl overflow-hidden border bg-yellow-50">
      <div className="flex flex-col sm:flex-row">
        <div className="flex-1 p-4">
          <div className="text-xs font-semibold uppercase text-yellow-800">Anuncio importante</div>
          <h3 className="text-xl sm:text-2xl font-bold text-yellow-900 mt-1">{item.titulo}</h3>
          {item.resumen && <p className="mt-2 text-yellow-900/80">{item.resumen}</p>}
          <div className="mt-3">
            <button onClick={open} className="px-4 py-2 rounded-full bg-yellow-900 text-white hover:bg-yellow-800">
              Ver más
            </button>
          </div>
        </div>
        {item.portada_url && (
          <div className="sm:w-[360px] md:w-[420px] aspect-[16/9] bg-neutral-100">
            <img
              src={absUrl(item.portada_url)}
              alt={item.titulo}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [banner, setBanner] = useState(null);

  // modal detalle
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/noticias/announcements/active');
        const arr = Array.isArray(data) ? data : [];
        setBanner(arr[0] || null); // si hay varios, toma la más reciente
      } catch {
        setBanner(null);
      }
    })();
  }, []);

  const openDetailFromBanner = async (item) => {
    setOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      if (item?.slug) {
        try {
          const r1 = await api.get(`/noticias/public/${encodeURIComponent(item.slug)}`);
          setDetail(normalizeDetail(r1.data));
          return;
        } catch {
          // fallback a id
        }
      }
      if (item?.id) {
        const r2 = await api.get(`/noticias/${item.id}`);
        setDetail(normalizeDetail(r2.data));
        return;
      }
      // si no hay slug ni id, mostramos algo mínimo
      setDetail({
        titulo: item?.titulo || 'Noticia',
        publish_at: item?.publish_at || null,
        cuerpo_md: '<em>Sin contenido disponible.</em>',
        imagenes: item?.portada_url ? [absUrl(item.portada_url)] : [],
        portada_url: absUrl(item?.portada_url),
      });
    } catch (e) {
      console.error(e);
      setDetail({
        titulo: 'Noticia',
        publish_at: null,
        cuerpo_md: '<em>No se pudo cargar el contenido.</em>',
        imagenes: [],
        portada_url: null,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setOpen(false);
    setDetail(null);
  };

  return (
    <PageShell>
      {/* Banner con modal inline */}
      {banner && <AnnouncementBanner item={banner} onOpen={openDetailFromBanner} />}

      <section className="grid md:grid-cols-2 gap-10 items-center text-white py-2">
        <div>
          <h1
            className="
              text-4xl sm:text-5xl md:text-7xl lg:text-8xl
              text-red-500 font-extrabold uppercase
              leading-tight drop-shadow-lg 
            "
          >
            Multigool <br /> El Sauce
          </h1>

          <p className="mt-6 text-xl md:text-2xl text-white/90 max-w-2xl leading-relaxed">
            Reserva tu cancha, inscríbete a torneos y mira estadísticas en tiempo real.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/reservas"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-lg"
            >
              <CalendarDays className="h-6 w-6" /> Reserva tu cancha
            </Link>
            <a
              href="https://wa.me/50212345678"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-green-600 hover:bg-green-500 text-white font-bold text-lg shadow-lg"
            >
              <MessageCircle className="h-6 w-6" /> WhatsApp
            </a>
          </div>
        </div>

        <div /> {/* espacio para futura imagen */}
      </section>

      {/* Modal de detalle en Home */}
      <Modal
        open={open}
        onClose={closeModal}
        title={detail?.titulo || 'Noticia'}
        panelClass="max-w-[1300px]"
        bodyClass="max-h-[85vh] pr-1"
      >
        {detailLoading ? (
          <div className="p-3 rounded-md border bg-neutral-50 text-neutral-600 text-sm">Cargando…</div>
        ) : !detail ? (
          <div className="text-sm text-neutral-600">Sin datos</div>
        ) : (
          <DetalleNoticia data={detail} />
        )}
      </Modal>
    </PageShell>
  );
}

/* -------- helpers de detalle (idénticos a Noticias.jsx) -------- */

function normalizeDetail(d) {
  const rawImgs = Array.isArray(d?.imagenes)
    ? d.imagenes
    : Array.isArray(d?.imagenes_json)
    ? d.imagenes_json
    : [];
  const imgsAbs = rawImgs.map(absUrl);
  const portadaAbs = absUrl(d?.portada_url);
  const gallery = imgsAbs.length > 0 ? imgsAbs : portadaAbs ? [portadaAbs] : [];
  return {
    ...d,
    imagenes: gallery,
    portada_url: portadaAbs,
    publish_at: d?.publish_at_gt || d?.publish_at || null,
  };
}

/** Galería simple: caja fija (alto) + imagen contenida */
function DetalleNoticia({ data }) {
  const [idx, setIdx] = useState(0);
  const imgs = Array.isArray(data.imagenes) ? data.imagenes : [];
  const fechaTxt = data.publish_at || '-';

  const hasMany = imgs.length > 1;
  const goPrev = () => setIdx((i) => (i - 1 + imgs.length) % imgs.length);
  const goNext = () => setIdx((i) => (i + 1) % imgs.length);

  return (
    <div className="space-y-4 text-sm">
      <div className="text-xs text-neutral-500">{fmtGT(fechaTxt)}</div>

      {imgs.length > 0 && (
        <div
          className="relative w-full rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center
                      h-[260px] sm:h-[300px] md:h-[340px] lg:h-[380px]"
        >
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
            __html: data.cuerpo_html || data.cuerpo_md || '',
          }}
        />
      </div>
    </div>
  );
}
