const path = require('path');

function sanitizeBase(name) {
  return String(name || 'img').replace(/[^a-zA-Z0-9_-]/g, '');
}

function relFromMulter(file, subdir) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const base = sanitizeBase(path.basename(file.originalname || 'img', ext));
  // El filename real ya lo decide multer (timestamp-base.ext). Solo garantizamos subdir y leading slash
  const fname = path.basename(file.filename); // seguro
  return `/uploads/${subdir}/${fname}`;
}

function baseUrl(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host  = req.get('x-forwarded-host')  || req.get('host');
  return `${proto}://${host}`;
}

function absUrl(req, rel) {
  if (!rel) return rel;
  const r = rel.startsWith('/') ? rel : `/${rel}`;
  return `${baseUrl(req)}${r}`;
}

module.exports = { relFromMulter, absUrl, sanitizeBase };
