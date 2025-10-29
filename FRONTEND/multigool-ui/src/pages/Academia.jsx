// src/pages/Academia.jsx
import PageShell from "../components/PageShell.jsx";
import { Phone, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

// Helper para resolver rutas de /public que funcione con Vite o CRA
const BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.BASE_URL) ||
  process.env.PUBLIC_URL ||
  "/";

const publicUrl = (p) =>
  `${String(BASE).replace(/\/+$/, "")}/${String(p).replace(/^\/+/, "")}`;

const WA_NUMBER = "50255555555"; // <-- REEMPLAZA por el número real (solo dígitos)
const WA_MSG = encodeURIComponent("¡Hola! Quiero info de la Academia Multigool 😊");

// RUTAS LOCALES (carpeta public/academy)
// OJO: en /public NO se antepone /public en la URL. Es /academy/...
const HERO_IMG = publicUrl("academy/hero.jpg");

// Si más adelante agregas cat_1.jpg ... cat_4.jpg, se usarán.
// Mientras tanto, si faltan, caerán en logo.png gracias al onError.
const CAT_IMAGES = [
  publicUrl("academy/cat_1.jpg"),
  publicUrl("academy/cat_2.jpg"),
  publicUrl("academy/cat_3.jpg"),
  publicUrl("academy/cat_4.jpg"),
];

// Fallback genérico
const FALLBACK_IMG = publicUrl("academy/logo.png");

function pickCatImage(index) {
  if (!CAT_IMAGES.length) return FALLBACK_IMG;
  return CAT_IMAGES[index % CAT_IMAGES.length] || FALLBACK_IMG;
}

export default function Academia() {
  const [cats, setCats] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/academia/public/info");
        setCats(Array.isArray(data.categorias) ? data.categorias : []);
      } catch {
        setCats([]);
      }
    })();
  }, []);

  return (
    // ⚠️ No tocamos el bgUrl (pedido explícito)
    <PageShell bgUrl="url(https://images.unsplash.com/photo-1603297632812-7c7c1cd4b2d5?q=80&w=2000&auto=format&fit=crop)">
      <div className="rounded-2xl border bg-white/95 shadow-sm overflow-hidden">
        {/* Hero - SOLO imagen local */}
        <div className="relative">
          <img
            src={HERO_IMG}
            alt="Academia Multigool"
            className="w-full h-[220px] sm:h-[300px] md:h-[360px] object-cover"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_IMG;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-white text-3xl md:text-4xl font-extrabold drop-shadow">
              Academia Multigool
            </h1>
            <p className="text-white/90 mt-1 text-sm md:text-base drop-shadow">
              Formación de fútbol para niños y jóvenes — de 4 a 18 años.
            </p>
          </div>
        </div>

        {/* Info fija */}
        <div className="p-5 md:p-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-bold text-lg">Edades</h3>
            <p className="text-neutral-700 mt-1">
              Niños de <b>4 a 18 años</b>.
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-bold text-lg">Costos</h3>
            <ul className="text-neutral-700 mt-1 space-y-1">
              <li>
                Inscripción: <b>Q 225</b>
              </li>
              <li>
                Mensualidad: <b>Q 175</b>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-bold text-lg">Días de entreno</h3>
            <p className="text-neutral-700 mt-1">
              <b>Martes y Jueves</b> — horarios por categoría.
            </p>
          </div>
        </div>

        {/* Categorías (con horario adentro) */}
        <div className="px-5 md:px-8 pb-8">
          <h2 className="font-extrabold tracking-wide uppercase text-xl mb-3">
            Categorías
          </h2>
          {cats.length === 0 ? (
            <div className="p-4 rounded-md border bg-neutral-50 text-neutral-600 text-sm">
              Pronto anunciaremos las categorías.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cats.map((c, idx) => (
                <div
                  key={c.id ?? idx}
                  className="rounded-xl border bg-white shadow-sm overflow-hidden"
                >
                  <div className="aspect-[16/9] bg-neutral-100">
                    <img
                      src={pickCatImage(idx)}
                      alt={c.nombre}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMG;
                      }}
                    />
                  </div>
                  <div className="p-4 text-sm space-y-1">
                    <div className="font-semibold text-base">{c.nombre}</div>
                    <div className="text-neutral-600">
                      Edad: <b>{c.edad_min}–{c.edad_max}</b> años
                    </div>
                    {typeof c.cupo === "number" && (
                      <div className="text-neutral-600">
                        Cupo: <b>{c.cupo}</b>
                      </div>
                    )}

                    {Array.isArray(c.recurrencias) && c.recurrencias.length > 0 && (
                      <div className="mt-2 rounded-md border bg-neutral-50 p-2">
                        <div className="text-xs uppercase text-neutral-500 mb-1">
                          Horario
                        </div>
                        <ul className="space-y-1">
                          {c.recurrencias.map((r, i) => (
                            <li key={i} className="flex items-center justify-between">
                              <span>{r.dias_texto}</span>
                              <span className="font-medium">
                                {r.hora_inicio} – {r.hora_fin}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {c.recurrencias[0]?.cancha_nombre && (
                          <div className="text-xs text-neutral-600 mt-1">
                            Cancha: <b>{c.recurrencias[0].cancha_nombre}</b>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA WhatsApp */}
        <div className="px-5 md:px-8 pb-8">
          <div className="rounded-2xl border bg-gradient-to-r from-emerald-500 to-lime-500 text-white p-5 md:p-7 flex flex-col sm:flex-row items-center gap-3">
            <div className="text-center sm:text-left">
              <div className="text-xl font-extrabold">
                ¿Quieres más información?
              </div>
              <div className="text-white/90">
                Escríbenos por WhatsApp y te ayudamos a inscribirte.
              </div>
            </div>
            <a
              href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-2 px-5 py-3 rounded-full bg-black/20 hover:bg-black/30 font-semibold"
            >
              <MessageCircle className="h-5 w-5" />
              WhatsApp
            </a>
          </div>
          <div className="mt-2 text-xs text-neutral-500 flex items-center gap-1">
            <Phone className="h-3 w-3" /> También puedes llamarnos al <b>+{WA_NUMBER}</b>.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
