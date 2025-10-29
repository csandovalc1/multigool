import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Torneos from './pages/Torneos.jsx'
import Reservas from './pages/Reservas.jsx'
import CalendarioMes from './pages/calendario/CalendarioMes.jsx'
import CalendarioDia from './pages/calendario/CalendarioDia.jsx'
import Placeholder from './pages/Placeholder.jsx'
import TorneoDetalle from './pages/torneos/TorneoDetalle.jsx'
import Noticias from './pages/Noticias.jsx'
import Academia from './pages/Academia.jsx'
import Nosotros from "./pages/Nosotros.jsx";

export default function App() {
  return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/torneos" element={<Torneos />} />
        <Route path="/torneos/:id" element={<TorneoDetalle />} />
        <Route path="/calendario" element={<CalendarioMes />} />
        <Route path="/calendario/:ymd" element={<CalendarioDia />} />
        <Route path="/reservas" element={<Reservas />} />
        <Route path="/noticias" element={<Noticias />} />
        <Route path="/academia" element={<Academia title="Academia" />} />
         <Route path="/nosotros" element={<Nosotros />} />
        <Route path="*" element={<Placeholder title="404" />} />
      </Routes>
  )
}
