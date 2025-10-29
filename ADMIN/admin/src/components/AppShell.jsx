// src/components/AppShell.jsx
import { useState } from "react";
import { Menu } from "lucide-react";

export default function AppShell({ sidebar, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-40 bg-[var(--panel)]/80 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button className="md:hidden p-2 -ml-2" onClick={()=>setOpen(true)}><Menu/></button>
          <div className="font-semibold">Admin</div>
          <div className="flex items-center gap-3">
            {/* switches / profile */}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid md:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block">
          <div className="bg-[var(--panel)] rounded-2xl shadow-card p-3 sticky top-20">
            {sidebar}
          </div>
        </aside>
        {/* Content */}
        <main className="min-w-0">{children}</main>
      </div>

      {/* Drawer (mobile) */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[80%] max-w-[320px] bg-[var(--panel)] p-4">
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
