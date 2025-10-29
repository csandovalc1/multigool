// admin/src/lib/auth.js
import axios from 'axios';
import { atom } from 'jotai';

export const userAtom = atom(null);
export const isAuthedAtom = atom((get) => !!get(userAtom));
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});
