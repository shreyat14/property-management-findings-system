export function StatusBadge({ status }) {
  return (
    <span className={`status-pill status-pill--${status.toLowerCase()}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}
