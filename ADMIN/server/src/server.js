require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, 'uploads', 'team-logos');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_ORIGINS = [
  process.env.FRONT_ORIGIN || 'http://localhost:5173',
  process.env.FRONT_ORIGIN2 || 'http://localhost:5174',
];

const app = express();

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cookieParser());
app.use(cors({
  origin(origin, cb) {
    // permite llamadas desde herramientas (sin origin) y desde tu front
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


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








const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server listo en puerto ${PORT}`));