import { NavLink, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function TopNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const LinkItem = ({ to, label, end, onClick }) => (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `px-4 py-2 rounded-xl text-sm font-medium transition ${
          isActive ? 'bg-white/15' : 'hover:bg-white/10'
        }`
      }
    >
      {label}
    </NavLink>
  )

  return (
    <header
      className={`sticky top-0 z-50 text-white border-b border-white/10
                  ${scrolled ? 'bg-black/80 backdrop-blur-md' : 'bg-black/70 backdrop-blur'}
                  transition-colors duration-500`}
    >
      {/* ALTO FIJO del header */}
      <div className="relative max-w-6xl mx-auto h-14 px-4 flex items-center">
        {/* Branding (solo md+) aparece al scrollear */}
        <Link
          to="/"
          className={`hidden md:block mr-auto leading-tight transition-all duration-500
                      ${scrolled ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'}`}
          aria-label="Ir al inicio"
        >
          <div className="uppercase tracking-[0.18em] text-[10px] md:text-xs text-white/70">Multigool</div>
          <div className="font-bold text-sm md:text-base">El Sauce</div>
        </Link>

        {/* NAV desktop */}
        <nav
          className={`absolute inset-0 hidden md:flex items-center gap-1 transition-all duration-500
                      ${scrolled ? 'justify-end pr-4' : 'justify-center'}`}
        >
          <LinkItem to="/" label="Inicio" end />
          <LinkItem to="/reservas" label="Reservas" />
          <LinkItem to="/torneos" label="Torneos" />
          <LinkItem to="/academia" label="Academia" />
          <LinkItem to="/calendario" label="Calendario" />
          <LinkItem to="/noticias" label="Noticias" />
          <LinkItem to="/nosotros" label="Nosotros" />

        </nav>

        {/* Móvil: logo + hamburguesa */}
        <div className="flex w-full items-center justify-between md:hidden">
  <Link
    to="/"
    aria-label="Inicio"
    className={`inline-flex items-center gap-2 transition-all duration-300
                ${scrolled ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}
  >
    <img src="/logo.png" alt="Multigool El Sauce" className="h-8 w-auto" />
  </Link>
  <button
    className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10 active:scale-95"
    aria-expanded={open}
    aria-controls="mobile-menu"
    onClick={() => setOpen((v) => !v)}
  >
    <span>☰</span>
  </button>
</div>
      </div>

      {/* Panel móvil colapsable: NO ocupa alto al estar cerrado */}
      <div
        id="mobile-menu"
        className={`md:hidden overflow-hidden bg-black/90 backdrop-blur
                    transition-[max-height,opacity] duration-300
                    ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <nav className="px-4 pb-3 pt-1 flex flex-col gap-1">
          <LinkItem to="/" label="Inicio" end onClick={() => setOpen(false)} />
          <LinkItem to="/torneos" label="Torneos" onClick={() => setOpen(false)} />
          <LinkItem to="/calendario" label="Calendario" onClick={() => setOpen(false)} />
          <LinkItem to="/noticias" label="Noticias" onClick={() => setOpen(false)} />
          <LinkItem to="/reservas" label="Reservas" onClick={() => setOpen(false)} />
          <LinkItem to="/nosotros" label="Nosotros" onClick={() => setOpen(false)} />
          <LinkItem to="/academia" label="Academia" />
        </nav>
      </div>
    </header>
  )
}