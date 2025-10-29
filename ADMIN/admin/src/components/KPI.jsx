// src/components/KPI.jsx
import { Card, CardBody } from "./ui/Card";
export default function KPI({label, value, hint}) {
  return (
    <Card>
      <CardBody>
        <div className="text-[var(--muted)] text-sm">{label}</div>
        <div className="text-2xl md:text-3xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-xs text-[var(--muted)] mt-1">{hint}</div>}
      </CardBody>
    </Card>
  );
}
