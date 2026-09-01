import { EmptyIcon } from './Icons.jsx'

export function EmptyState({ title, description }) {
  return (
    <section className="card empty-state">
      <div className="empty-state__content">
        <span className="empty-state__icon"><EmptyIcon /></span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  )
}
