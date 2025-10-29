// src/components/ui/Field.jsx
export function Field({label,children}) {
  return (
    <label className="text-sm w-full">
      <span className="block text-[var(--muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}
// inputs con tailwind-forms plugin
