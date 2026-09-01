import { Link } from '../routes/Link.jsx'
import { formatDate } from '../utils/format.js'
import { formatEnumLabel } from '../utils/findingWorkflow.js'
import { EmptyState } from './EmptyState.jsx'
import { StatusBadge } from './StatusBadge.jsx'

export function ReviewerFindingList({ findings, emptyDescription, limit }) {
  if (findings.length === 0) {
    return (
      <EmptyState
        title="No findings are currently awaiting review"
        description={emptyDescription || 'Submitted findings will appear here when an Inspector sends them for review.'}
      />
    )
  }

  const visibleFindings = typeof limit === 'number' ? findings.slice(0, limit) : findings

  return (
    <div className="review-list">
      {visibleFindings.map((finding) => (
        <article className="card review-card" key={finding.id}>
          <div className="review-card__main">
            <div className="finding-card__meta">
              <span>{formatEnumLabel(finding.area)}</span>
              <span>{formatEnumLabel(finding.category)}</span>
            </div>
            <h2>{finding.issue}</h2>
            <p>{finding.inspection.property.name} · {finding.inspection.property.address}</p>
            <div className="review-card__context">
              <span>Severity: <strong>{formatEnumLabel(finding.severity)}</strong></span>
              <span>Inspector: <strong>{finding.inspection.inspector.email}</strong></span>
              <span>Submitted: <strong>{formatDate(finding.updatedAt)}</strong></span>
              <span>Photo: <strong>{finding.photoPath ? 'Available' : 'Not provided'}</strong></span>
            </div>
          </div>
          <div className="review-card__side">
            <StatusBadge status={finding.status} />
            <Link className="button button--secondary button--fit" to={`/reviewer/findings/${encodeURIComponent(finding.id)}`}>
              Review finding
            </Link>
          </div>
        </article>
      ))}
    </div>
  )
}
