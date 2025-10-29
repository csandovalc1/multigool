// src/components/ui/Section.jsx
import Button from "./Button";
export default function Section({title, actions, children}) {
  return (
    <div className="bg-[var(--panel)] rounded-2xl shadow-card">
      <div className="px-4 md:px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}
