// server/src/services/authService.js
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');

const ACCESS_TTL_MIN = parseInt(process.env.ACCESS_TTL_MIN || '15', 10);
const REFRESH_TTL_DAYS = parseInt(process.env.REFRESH_TTL_DAYS || '30', 10);

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, uname: user.username, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: `${ACCESS_TTL_MIN}m` }
  );
}

function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
}

async function findUserByUsername(username) {
  const pool = await getPool();
  const r = await pool.request()
    .input('username', sql.NVarChar(60), username)
    // MySQL: sin dbo., sin TOP 1, usar LIMIT 1
    .query('SELECT * FROM admin_users WHERE username=@username LIMIT 1;');
  return r.recordset[0] || null;
}

async function setLock(userId, minutes = 15) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, userId)
    .input('mins', sql.Int, minutes)
    // MySQL: DATE_ADD + UTC_TIMESTAMP()
    .query(`
      UPDATE admin_users
         SET failed_count = 5,
             lock_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL @mins MINUTE),
             updated_at = UTC_TIMESTAMP()
       WHERE id = @id;
    `);
}

async function resetFailures(userId) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, userId)
    .query(`
      UPDATE admin_users
         SET failed_count = 0,
             lock_until   = NULL,
             updated_at   = UTC_TIMESTAMP()
       WHERE id = @id;
    `);
}

async function bumpFailure(userId) {
  const pool = await getPool();
  // MySQL no tiene OUTPUT inserted..., hacemos UPDATE + SELECT
  await pool.request()
    .input('id', sql.Int, userId)
    .query(`
      UPDATE admin_users
         SET failed_count = failed_count + 1,
             updated_at   = UTC_TIMESTAMP()
       WHERE id = @id;
    `);

  const r2 = await pool.request()
    .input('id', sql.Int, userId)
    .query(`SELECT failed_count FROM admin_users WHERE id=@id LIMIT 1;`);

  const cnt = r2.recordset[0]?.failed_count ?? 0;
  if (cnt >= 5) await setLock(userId, 15);
  return cnt;
}

/**
 * Guarda la sesión con el hash del MISMO refresh JWT que va en cookie.
 */
async function createSession(userId, refreshJwt, ua, ip, tokenId) {
  const pool = await getPool();
  const tokenHash = await argon2.hash(refreshJwt, { type: argon2.argon2id });
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.request()
    .input('user_id', sql.Int, userId)
    .input('token_id', sql.NVarChar(36), tokenId)
    .input('token_hash', sql.NVarChar(200), tokenHash)
    .input('ua', sql.NVarChar(300), ua || null)
    .input('ip', sql.NVarChar(64),  ip || null)
    .input('exp', sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO auth_sessions
        (user_id, token_id, token_hash, user_agent, ip_addr, expires_at, created_at)
      VALUES
        (@user_id, @token_id, @token_hash, @ua, @ip, @exp, UTC_TIMESTAMP());
    `);

  return { tokenId, expiresAt };
}

async function revokeSession(tokenId) {
  const pool = await getPool();
  await pool.request()
    .input('tid', sql.NVarChar(36), tokenId)
    .query(`
      UPDATE auth_sessions
         SET revoked_at = UTC_TIMESTAMP()
       WHERE token_id   = @tid;
    `);
}

async function validateRefresh(tokenId, refreshJwt) {
  let payload;
  try { payload = jwt.verify(refreshJwt, process.env.JWT_REFRESH_SECRET); }
  catch { return null; }

  const pool = await getPool();

  const r = await pool.request()
    .input('tid', sql.NVarChar(36), tokenId)
    .query(`
      SELECT * FROM auth_sessions
       WHERE token_id   = @tid
         AND revoked_at IS NULL
         AND expires_at > UTC_TIMESTAMP()
       LIMIT 1;
    `);
  const sess = r.recordset[0];
  if (!sess) return null;

  const ok = await argon2.verify(sess.token_hash, refreshJwt).catch(() => false);
  if (!ok) return null;

  const u = await pool.request()
    .input('uid', sql.Int, sess.user_id)
    .query(`SELECT * FROM admin_users WHERE id=@uid AND is_active = 1 LIMIT 1;`);

  const user = u.recordset[0] || null;
  if (!user) return null;

  return { user, session: sess, payload };
}

module.exports = {
  signAccess, signRefresh,
  findUserByUsername, resetFailures, bumpFailure, setLock,
  createSession, revokeSession, validateRefresh
};
