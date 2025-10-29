export const STATUS_COLORS = {
  AVAILABLE: 'bg-green-500 text-white',
  RESERVED: 'bg-red-600 text-white',
  TOURNAMENT: 'bg-yellow-500 text-white',
  CLOSED: 'bg-neutral-700 text-white',
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
  'https://lionfish-app-wkapu.ondigitalocean.app';

// Normaliza a URL absoluta para /uploads, /public, etc.
export function absUrl(p) {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;      // ya es absoluta
  if (p.startsWith('/')) return API_BASE + p; // relativo al backend
  return `${API_BASE}/${p.replace(/^\.?\//, '')}`;
}