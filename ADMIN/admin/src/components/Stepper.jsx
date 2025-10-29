export default function Stepper({ value, setValue, min = 60, max = 180, step = 60 }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={() => setValue(Math.max(min, value - step))} className="h-8 w-8 rounded-md border grid place-items-center">-</button>
      <div className="px-3 py-1 rounded-md border bg-white text-sm font-semibold">{value / 60}h</div>
      <button onClick={() => setValue(Math.min(max, value + step))} className="h-8 w-8 rounded-md border grid place-items-center">+</button>
    </div>
  )
}
