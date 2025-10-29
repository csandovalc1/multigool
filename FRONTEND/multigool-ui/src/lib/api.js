import axios from 'axios';
export const api = axios.create({ baseURL: 'http://localhost:3001/api' });

export const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:3001';