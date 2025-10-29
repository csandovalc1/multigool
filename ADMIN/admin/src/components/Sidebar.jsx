import { NavLink } from "react-router-dom";

const itemClass = ({ isActive }) =>
  `block px-3 py-2 rounded hover:bg-slate-100 ${isActive ? "bg-slate-200 font-semibold" : ""}`;

export default function Sidebar() {
  return (
    <aside className="bg-white border-r min-h-screen w-[240px] p-4">
      <div className="mb-4">
        <div className="text-xs uppercase text-slate-500 mb-1">Menú</div>
        <nav className="space-y-1 text-sm">
          <NavLink to="/" className={itemClass}>Dashboard</NavLink>
          <NavLink to="/torneos" className={itemClass}>Torneos</NavLink>
          <NavLink to="/jornadas" className={itemClass}>Jornadas</NavLink>
          <NavLink to="/canchas" className={itemClass}>Canchas</NavLink>
          <NavLink to="/calendario" className={itemClass}>Calendario</NavLink>
          <NavLink to="/reservas" className={itemClass}>Reservas</NavLink>
          <NavLink to="/noticias" className={itemClass}>Noticias</NavLink>
          <a href="https://multigool.example" className="block px-3 py-2 rounded hover:bg-slate-100" target="_blank" rel="noreferrer">Landing</a>
        </nav>
      </div>
    </aside>
  );
}
