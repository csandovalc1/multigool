import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { isAuthedAtom, userAtom } from '../lib/auth';
import { Navigate, useLocation } from 'react-router-dom';
import { initAuth } from '../lib/apis/auth';

export default function RequireAuth({ children }){
  const [authed] = useAtom(isAuthedAtom);
  const [, setUser] = useAtom(userAtom);
  const [booting, setBooting] = useState(true);
  const loc = useLocation();

  useEffect(() => {
    let done = false;
    (async () => {
      const u = await initAuth(); // intenta rehidratar usando cookie refresh
      if (!done) {
        if (u) setUser(u);
        setBooting(false);
      }
    })();
    return () => { done = true; };
  }, [setUser]);

  if (booting) return <div className="p-6 text-center text-sm text-gray-500">Cargando sesión…</div>;
  if (!authed) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}
