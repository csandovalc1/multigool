import TopNav from './TopNav.jsx'
import { Link } from 'react-router-dom'

const DEFAULT_BG =
  'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=2000&auto=format&fit=crop'

// Acepta tanto "https://..." como 'url(https://...)'
function toCssBg(u) {
  if (!u) return `url(${DEFAULT_BG})`
  return u.startsWith('url(') ? u : `url(${u})`
}

export default function PageShell({ children, bgUrl }) {
  // Dos capas: la primera es la que envías; la segunda es fallback
  const bgImage = `${toCssBg(bgUrl)}, ${toCssBg(DEFAULT_BG)}`

  return (
    <div className="relative isolate min-h-screen flex flex-col text-neutral-900">
      {/* Fondo global hasta arriba */}
      <div
        className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: bgImage, backgroundColor: '#0b1520' }}
      />
      {/* Oscurecedor */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-black/55" />

      {/* Logo arriba */}
      <div className="relative z-40 grid place-items-center py-2">
        <Link to="/" className="inline-flex">
          <img
            src="/logo.png"
            alt="Multigool El Sauce"
            className="h-24 md:h-28 w-auto drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] select-none"
          />
        </Link>
      </div>

      {/* Navbar */}
      <TopNav />

      {/* Contenido */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 py-12 md:py-16">
        {children}
      </main>

      {/* Footer fino */}
      <footer className="relative z-10 bg-white/95 border-t">
        <div className="max-w-6xl mx-auto px-4 py-3 text-sm text-neutral-600">
          © {new Date().getFullYear()} Multigool El Sauce
        </div>
      </footer>
    </div>
  )
}
