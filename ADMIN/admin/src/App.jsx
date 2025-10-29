import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Torneos from './pages/Torneos';
import Calendario from './pages/calendario/CalendarioMes';
import CalendarioDia from './pages/calendario/CalendarioDia.jsx';
import Reservas from './pages/Reservas';
import Noticias from './pages/Noticias';
import Jornadas from './pages/Jornadas';
import Canchas from "./pages/Canchas";
import Login from './pages/Login';
import RequireAuth from './components/RequireAuth';
import AcademiaAdmin from './pages/AcademiaAdmin.jsx';
import Galeria from './pages/Galeria.jsx';

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login/>} />
      {/* Protegido: una sola instancia de RequireAuth */}
      <Route element={<RequireAuth><Layout/></RequireAuth>}>
        <Route path="/" element={<Dashboard/>} />
        <Route path="/torneos" element={<Torneos/>} />
        <Route path="/jornadas" element={<Jornadas/>} />
        <Route path="/calendario" element={<Calendario/>} />
        <Route path="/calendario/:ymd" element={<CalendarioDia/>} />
        <Route path="/reservas" element={<Reservas/>} />
        <Route path="/noticias" element={<Noticias/>} />
        <Route path="/canchas" element={<Canchas/>} />
        <Route path="/academia" element={<AcademiaAdmin/>} />
        <Route path="/galeria" element={<Galeria/>} />
      </Route>
    </Routes>
  );
}
