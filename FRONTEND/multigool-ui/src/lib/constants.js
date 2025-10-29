export const STATUS_COLORS = {
  AVAILABLE: 'bg-green-500 text-white',
  RESERVED: 'bg-red-600 text-white',
  TOURNAMENT: 'bg-yellow-500 text-white',
}

export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

export function absUrl(p) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  return `${API_ORIGIN}${p.startsWith('/') ? p : `/${p}`}`;
}

export const MONTH_LABELS = {
  '2025-06-02': 'DIA OCUPADO',
  '2025-06-03': 'DIA OCUPADO',
  '2025-06-04': 'DIA OCUPADO',
  '2025-06-05': 'CANCHAS DISPONIBLES',
  '2025-06-06': 'CANCHAS DISPONIBLES',
  '2025-06-07': 'CANCHAS DISPONIBLES',
  '2025-06-11': 'CANCHAS DISPONIBLES',
  '2025-06-12': 'TORNEO',
  '2025-06-18': 'CANCHAS DISPONIBLES',
  '2025-06-19': 'CANCHAS DISPONIBLES',
  '2025-06-20': 'TORNEO',
  '2025-06-26': 'CANCHAS DISPONIBLES',
  '2025-06-27': 'TORNEO',
  '2025-06-30': 'CANCHAS DISPONIBLES',
}

export function labelToType(label) {
  if (!label) return null
  if (label.includes('OCUPADO')) return 'RESERVED'
  if (label.includes('TORNEO')) return 'TOURNAMENT'
  return 'AVAILABLE'
}

/* ====== NUEVO: datos de "Nosotros" ====== */

// URL pública de la página de Facebook del complejo:
export const FACEBOOK_PAGE_URL = "https://www.facebook.com/multigool10"; 


// Texto mostrado arriba del feed
export const FACEBOOK_SECTION_TITLE = "Síguenos en Facebook";

// Consulta de lugar para Google Maps Embed (nombre + ciudad + país)
export const MAPS_PLACE_QUERY = encodeURIComponent("14.610834, -90.663239");
// Si prefieres coordenadas exactas, puedes usar: "14.6279,-90.5170" (lat,lng)

// Nivel de zoom (1-20 aprox, 15 suele ser bueno para un lugar)
export const MAPS_ZOOM = 15;

// Si tienes un Google Maps Embed API key (opcional), puedes ponerlo aquí.
// Si lo dejas vacío, usaremos un embed libre (sin key) con place search.
export const MAPS_EMBED_KEY = ""; 


// Vista día (mock según tu imagen)
export const DAY_2025_06_12 = {
  date: '2025-06-12',
  fields: [
    { id: 1, name: 'Cancha 1' },
    { id: 2, name: 'Cancha 2' },
  ],
  slots: [
    { time: '14:00', status: { 1: 'RESERVED', 2: 'AVAILABLE' } },
    { time: '15:00', status: { 1: 'RESERVED', 2: 'RESERVED' } },
    { time: '16:00', status: { 1: 'RESERVED', 2: 'RESERVED' } },
    { time: '17:00', status: { 1: 'AVAILABLE', 2: 'AVAILABLE' } },
    { time: '18:00', status: { 1: 'AVAILABLE', 2: 'AVAILABLE' } },
    { time: '19:00', status: { 1: 'TOURNAMENT', 2: 'TOURNAMENT' } },
    { time: '20:00', status: { 1: 'TOURNAMENT', 2: 'TOURNAMENT' } },
    { time: '21:00', status: { 1: 'TOURNAMENT', 2: 'TOURNAMENT' } },
    { time: '22:00', status: { 1: 'AVAILABLE', 2: 'AVAILABLE' } },
  ],
}

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  'http://localhost:3001';

