// server/src/controllers/authController.js
const argon2 = require('argon2');
const { v4: uuidv4 } = require('uuid');
const {
  signAccess, signRefresh,
  findUserByUsername, resetFailures, bumpFailure,
  createSession, revokeSession, validateRefresh
} = require('../services/authService');

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  domain: process.env.COOKIE_DOMAIN || undefined
};

function minutesLeft(dt) {
  const ms = new Date(dt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 60000));
}

exports.login = async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username y password son requeridos' });

  const user = await findUserByUsername(username);
  if (!user || !user.is_active) return res.status(401).json({ error: 'Credenciales inválidas' });

  if (user.lock_until && new Date(user.lock_until) > new Date()) {
    return res.status(423).json({ error: `Cuenta bloqueada. Intenta en ${minutesLeft(user.lock_until)} min.` });
  }

  const ok = await argon2.verify(user.pass_hash, password).catch(() => false);
  if (!ok) {
    const count = await bumpFailure(user.id);
    if (count >= 5) return res.status(423).json({ error: 'Cuenta bloqueada por 15 minutos.' });
    return res.status(401).json({ error: `Credenciales inválidas. Intentos fallidos: ${count}/5` });
  }

  await resetFailures(user.id);

  // ===== un único refresh coherente =====
  const access = signAccess(user);
  const tokenId = uuidv4(); // solo aquí
  const refresh = signRefresh({ sub: user.id, tid: tokenId });

  await createSession(user.id, refresh, req.get('user-agent'), req.ip, tokenId);

  res.cookie('refresh_token', refresh, { ...cookieOpts, maxAge: 1000 * 60 * 60 * 24 * 30 });
  return res.json({ access_token: access, user: { id: user.id, username: user.username, role: user.role } });
};

exports.refresh = async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  let tid;
  try {
    tid = (require('jsonwebtoken').verify(token, process.env.JWT_REFRESH_SECRET)).tid;
  } catch {
    return res.status(401).json({ error: 'Refresh inválido' });
  }

  const out = await validateRefresh(tid, token);
  if (!out) return res.status(401).json({ error: 'Sesión inválida o expirada' });

  const access = signAccess(out.user);
  return res.json({
    access_token: access,
    user: { id: out.user.id, username: out.user.username, role: out.user.role }
  });
};

exports.logout = async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) {
    try {
      const { tid } = require('jsonwebtoken').verify(token, process.env.JWT_REFRESH_SECRET);
      if (tid) await revokeSession(tid);
    } catch {}
  }
  res.clearCookie('refresh_token', { ...cookieOpts, maxAge: 0 });
  return res.json({ ok: true });
};
