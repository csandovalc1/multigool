export default function Toast({ text }) {
  if (!text) return null
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="rounded-md bg-neutral-900 text-white px-4 py-2 shadow-lg">{text}</div>
    </div>
  )
}
