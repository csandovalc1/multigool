// src/components/ui/Button.jsx
export default function Button({ variant="primary", className="", ...props }) {
  const style = {
    primary: "bg-brand-600 hover:bg-brand-500 text-white",
    ghost: "bg-transparent hover:bg-white/5 text-[var(--text)] border border-white/10",
    outline: "border border-white/15 hover:border-white/25 text-[var(--text)]",
  }[variant];
  return (
    <button
      className={`px-3 py-2 rounded-xl shadow-soft focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${style} ${className}`}
      {...props}
    />
  );
}
