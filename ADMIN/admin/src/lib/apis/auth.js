// admin/src/lib/apis/auth.js
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api', // si usas proxy de Vite
  withCredentials: true, // cookie httpOnly del refresh
});

// --- access token solo en memoria ---
let accessToken = null;
export function setAccess(t){ accessToken = t; }
export function getAccess(){ return accessToken; }

// Adjunta Bearer en cada request
api.interceptors.request.use(cfg => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

// --- Response interceptor con exclusiones para evitar loops ---
let refreshing = null;
api.interceptors.response.use(
  r => r,
  async (err) => {
    const original = err.config || {};
    const url = (original.url || '').toString();

    // NO refrescar si el 401 viene del login o del propio refresh
    if (err?.response?.status === 401) {
      if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
        return Promise.reject(err);
      }
      if (!original._retry) {
        original._retry = true;
        try {
          // Evitar disparos concurrentes
          if (!refreshing) refreshing = api.post('/auth/refresh').finally(() => { refreshing = null; });
          const resp = await refreshing;
          setAccess(resp.data.access_token);
          // Reintenta la original con el nuevo access
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${getAccess()}`;
          return api(original);
        } catch (e) {
          setAccess(null);
        }
      }
    }
    return Promise.reject(err);
  }
);

// --- API helpers ---
export async function login(username, password){
  const r = await api.post('/auth/login', { username, password });
  setAccess(r.data.access_token);
  return r.data.user;
}

export async function logout(){
  try { await api.post('/auth/logout'); } finally { setAccess(null); }
}

// Bootstrap de sesión al cargar la app
export async function initAuth(){
  try{
    const r = await api.post('/auth/refresh'); // usa cookie httpOnly
    setAccess(r.data.access_token);
    return r.data.user; // {id, username, role}
  }catch{
    setAccess(null);
    return null;
  }
}
