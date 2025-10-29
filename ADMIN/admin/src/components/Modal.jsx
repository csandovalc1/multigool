// src/components/Modal.jsx
import { X } from "lucide-react";

export default function Modal({ open, onClose, children, title, panelClass = "", bodyClass = "" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
      <div
        className={
          `bg-white w-full max-w-xl rounded-xl shadow-lg ` + // ← más pequeño (xl)
          `max-h-[85vh] flex flex-col ` +                    // ← limita alto total
          panelClass
        }
      >
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className={`p-3 overflow-y-auto ${bodyClass}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
