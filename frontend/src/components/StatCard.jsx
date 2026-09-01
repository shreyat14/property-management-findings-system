export function StatCard({ label, value, detail }) {
  return (
    <article className="card stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </article>
  )
}
