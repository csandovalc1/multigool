import axios from 'axios';
export const api = axios.create({ baseURL: 'https://lionfish-app-wkapu.ondigitalocean.app:8080/api' });

export const API_ORIGIN = import.meta.env.VITE_API_URL || 'https://lionfish-app-wkapu.ondigitalocean.app:8080';