// src/components/ui/Card.jsx
export function Card({children,className=""}) {
  return <div className={`bg-[var(--panel)] rounded-2xl shadow-card ${className}`}>{children}</div>;
}
export function CardBody({children,className=""}) {
  return <div className={`p-4 md:p-5 ${className}`}>{children}</div>;
}

