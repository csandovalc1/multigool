export default function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md border font-medium hover:bg-blue-50 ${
        active ? 'bg-blue-100 border-blue-300' : 'bg-white'
      }`}
    >
      {children}
    </button>
  )
}
