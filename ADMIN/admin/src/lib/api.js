
import axios from 'axios';

const ORIGIN = (import.meta.env.VITE_API_URL || 'https://lionfish-app-wkapu.ondigitalocean.app').replace(/\/$/, '');

export const api = axios.create({
  baseURL: `${ORIGIN}/api`,
});

// opcional, si aún estás sin cookies:
api.defaults.withCredentials = false;
