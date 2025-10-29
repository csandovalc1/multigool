import { X } from 'lucide-react'

export default function Modal({ open, onClose, children, title }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="rounded-2xl border bg-white/95 shadow-sm relative w-full max-w-2xl p-6">
        <button onClick={onClose} className="absolute right-3 top-3 p-2 rounded-md hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
        {title && <h3 className="font-extrabold tracking-wide uppercase text-2xl text-center mb-4">{title}</h3>}
        {children}
      </div>
    </div>
  )
}
