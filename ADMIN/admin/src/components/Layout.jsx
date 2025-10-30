import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { userAtom } from "../lib/auth";
import { logout } from "../lib/apis/auth";

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useAtom(userAtom);
  const navigate = useNavigate();

  // Bloquea scroll del body cuando el drawer está abierto (móvil)
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [open]);

  const links = useMemo(
    () => [
      { to: "/", label: "Dashboard", icon: DashIcon, end: true },
      { to: "/torneos", label: "Torneos", icon: TrophyIcon },
      { to: "/jornadas", label: "Jornadas", icon: CalendarIcon },
      { to: "/calendario", label: "Calendario", icon: ScheduleIcon },
      { to: "/canchas", label: "Canchas", icon: FieldIcon },
      { to: "/reservas", label: "Reservas", icon: TicketIcon },
      { to: "/noticias", label: "Noticias", icon: NewsIcon },
      { to: "/academia", label: "Academia", icon: CalendarIcon },
      { to: "/galeria", label: "Galería", icon: GalleryIcon },
    ],
    []
  );

  async function onLogout() {
    try { await logout(); } finally {
      setUser(null);
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Topbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Botón menú (sólo móvil) */}
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Abrir menú"
          >
            <BurgerIcon />
          </button>

          {/* Marca */}
          <div className="flex items-center gap-3">
            <img
              src="https://multigoollanding.onrender.com/logo.png"
              alt="Multigool"
              className="h-9 w-9 rounded-xl object-contain shadow-sm"
              loading="eager"
              decoding="async"
              onError={(e) => {
                e.currentTarget.src =
                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36'><rect width='36' height='36' rx='10' fill='%23e2e8f0'/></svg>";
              }}
            />
            <div>
              <h1 className="text-base sm:text-lg font-semibold leading-none">
                Multigool El Sauce
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">Panel de control</p>
            </div>
          </div>

          {/* Usuario + Logout */}
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="text-xs sm:text-sm text-slate-600">
                {user.username}
              </span>
            )}
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <PowerIcon className="h-4 w-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Overlay (móvil) */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      {/* Sidebar */}
      <aside
        className={[
          "fixed left-0 top-0 z-40 w-72 h-full bg-white border-r border-slate-200 shadow-sm",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:z-40",
        ].join(" ")}
        aria-hidden={!open && typeof window !== "undefined" && window.innerWidth < 1024}
      >
        {/* Header Sidebar */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Navegación</div>
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Cerrar menú"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Links */}
        <nav className="px-2 py-4 overflow-y-auto h-[calc(100%-3.25rem)]">
          <ul className="space-y-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                      "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300",
                      isActive
                        ? "bg-slate-100 font-semibold text-slate-900"
                        : "text-slate-700",
                    ].join(" ")
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-700" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <a
              href="https://multigoolelsauce.me/"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700"
            >
              <ExternalIcon className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-slate-700" />
              <span>Landing</span>
            </a>
          </div>
        </nav>
      </aside>

      {/* Main */}
      <main className="lg:pl-72">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* =========================
   Íconos en SVG (sin libs)
   ========================= */
function BurgerIcon(props){return(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" {...props}><path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>);}
function CloseIcon(props){return(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" {...props}><path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6l-12 12" /></svg>);}
function DashIcon(props){return(<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}><path strokeWidth="2" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>);}
function TrophyIcon(props){return(<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}><path strokeWidth="2" d="M8 21h8M12 17v4M7 4h10v3a5 5 0 01-10 0V4z" /><path strokeWidth="2" d="M17 5h3a3 3 0 01-3 3M7 5H4a3 3 0 003 3" /></svg>);}
function CalendarIcon(props){return(<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><path strokeWidth="2" d="M16 2v4M8 2v4M3 10h18" /></svg>);}
function ScheduleIcon(props){return(<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}><circle cx="12" cy="12" r="9" /><path strokeWidth="2" d="M12 7v5l3 3" /></svg>);}
function FieldIcon(props){return(<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path strokeWidth="2" d="M12 6v12M3 12h6M15 12h6" /></svg>);}
function TicketIcon(props){return(<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}><path strokeWidth="2" d="M3 8a3 3 0 003-3h12a3 3 0 003 3v8a3 3 0 00-3 3H6a3 3 0 00-3-3V8z" /><path strokeWidth="2" d="M8 12h8" /></svg>);}
function NewsIcon(props){return(<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}><path strokeWidth="2" d="M4 5h12v14H6a2 2 0 01-2-2V5z" /><path strokeWidth="2" d="M16 7h3a1 1 0 011 1v9a2 2 0 01-2 2h-2V7zM8 9h6M8 13h6M8 17h3" /></svg>);}
function ExternalIcon(props){return(<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}><path strokeWidth="2" d="M14 3h7v7M21 3l-8 8" /><path strokeWidth="2" d="M5 12v7a2 2 0 002 2h7" /><path strokeWidth="2" d="M12 5H7a2 2 0 00-2 2v5" /></svg>);}
function PowerIcon(props){return(<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}><path strokeWidth="2" d="M12 2v8" /><path strokeWidth="2" d="M5.5 4.5a10 10 0 1013 0" /></svg>);}
function GalleryIcon(props){
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}