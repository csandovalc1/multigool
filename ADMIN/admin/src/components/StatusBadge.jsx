import { STATUS_COLORS } from '../lib/constants.js'

export default function StatusBadge({ type, children }) {
  const base =
    'inline-flex items-center rounded-md font-extrabold tracking-wide uppercase ' +
    'text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1'
  const cls = `${base} ${STATUS_COLORS[type] ?? 'bg-gray-200 text-gray-800'}`
  return <span className={cls}>{children ?? type}</span>
}