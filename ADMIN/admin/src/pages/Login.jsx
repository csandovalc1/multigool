// admin/src/pages/Login.jsx
import { useState } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '../lib/auth';
import { login } from '../lib/apis/auth';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Login(){
  const [, setUser] = useAtom(userAtom);
  const [form, setForm] = useState({ username:'', password:'' });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();
  const to = loc.state?.from || '/';

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e){
    e.preventDefault();
    setErr(null);

    // Validaciones front simples
    const u = form.username.trim();
    const p = form.password;
    if (u.length < 3) return setErr('Usuario inválido');
    if (p.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres');

    setLoading(true);
    try{
      const user = await login(u, p);
      setUser(user);
      // redirige
      navigate(to, { replace: true }); // listo
    }catch(ex){
      setErr(ex?.response?.data?.error || 'Error al iniciar sesión');
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white shadow p-6 rounded-2xl">
        <h1 className="text-xl font-semibold mb-4">Iniciar sesión</h1>
        <label className="block text-sm mb-1">Usuario</label>
        <input
          name="username"
          value={form.username}
          onChange={onChange}
          autoComplete="username"
          className="w-full border rounded-lg p-2 mb-3"
          placeholder="tu_usuario"
          required
        />
        <label className="block text-sm mb-1">Contraseña</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={onChange}
          autoComplete="current-password"
          className="w-full border rounded-lg p-2 mb-3"
          placeholder="********"
          required
        />
        {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
        <button disabled={loading} className="w-full rounded-xl p-2 border hover:bg-gray-100 disabled:opacity-50">
          {loading ? 'Ingresando…' : 'Entrar'}
        </button>
        <p className="text-xs text-gray-500 mt-3">
          Se bloqueará el acceso por 15 min tras 5 intentos fallidos.
        </p>
      </form>
    </div>
  );
}
