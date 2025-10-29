import PageShell from '../components/PageShell.jsx'
export default function Placeholder({ title }) {
  return (
    <PageShell>
      <div className="rounded-2xl border bg-white/95 shadow-sm p-6">
        <h1 className="font-extrabold tracking-wide uppercase text-3xl mb-2">{title}</h1>
        <p className="text-neutral-600">Contenido próximamente.</p>
      </div>
    </PageShell>
  )
}
