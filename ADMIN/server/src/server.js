require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const normalize = (u) => u ? u.replace(/\/$/, '') : u;
const ALLOWLIST = [process.env.FRONT_ORIGIN, process.env.FRONT_ORIGIN2].filter(Boolean).map(normalize);

const app = express();

// Confía en el proxy de DO para X-Forwarded-* (cookies secure, IP real, etc.)
app.set('trust proxy', 1);

// DIRECTORIOS ESTÁTICOS
app.use('/public', express.static(path.join(__dirname, 'public')));

// ⚠️ Filesystem efímero en App Platform: /uploads se borra en redeploy.
// Úsalo solo temporalmente o cambia a DO Spaces. Si igual lo usas:
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads', 'team-logos');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// BODY PARSERS
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
const ALLOWED_ORIGINS = [process.env.FRONT_ORIGIN, process.env.FRONT_ORIGIN2].filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    const o = normalize(origin);
    if (!o || ALLOWLIST.includes(o)) return cb(null, true);
    cb(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(cookieParser());

// Rutas
app.use('/api/torneos', require('./routes/torneoRoutes'));
app.use('/api/equipos', require('./routes/equipoRoutes'));
app.use('/api/jugadores', require('./routes/jugadorRoutes'));
app.use('/api/fixture', require('./routes/fixtureRoutes'));
app.use('/api/partidos', require('./routes/partidoRoutes'));
app.use('/api/eventos', require('./routes/partidoDetalleRoutes'));
app.use('/api/tabla', require('./routes/tablaRoutes'));
app.use('/api/playoffs', require('./routes/playoffsRoutes'));
app.use('/api', require('./routes/jugadoresRoutes'));
app.use('/api/reservas', require('./routes/reservaRoutes'));
app.use('/api/canchas', require('./routes/canchaRoutes'));
app.use('/api/grupos', require('./routes/grupoRoutes'));
app.use('/api/public', require('./routes/public'));
app.use('/api/admin/cierres', require('./routes/adminCierresRoutes'));
app.use('/api/noticias', require('./routes/noticiasRoutes'));
app.use('/api/reportes', require('./routes/reportesRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/academia', require('./routes/academiaRoutes'));
app.use('/api/galeria', require('./routes/galeriaRoutes'));

// Healthcheck
app.get('/health', (req, res) => res.status(200).json({ ok: true }));


app.get('/health', (req, res) => res.status(200).json({ ok: true }));

// Arranque
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listo en puerto ${PORT}`));
