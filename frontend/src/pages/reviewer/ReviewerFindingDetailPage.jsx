import { useCallback, useState } from 'react'
import { approveFinding, getFinding, rejectFinding } from '../../api/findingsApi.js'
import { FindingPhoto } from '../../components/FindingPhoto.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'
import { formatDate } from '../../utils/format.js'
import { formatEnumLabel } from '../../utils/findingWorkflow.js'
import { canReviewFinding, getReviewError } from '../../utils/reviewWorkflow.js'

export function ReviewerFindingDetailPage({ findingId }) {
  const loader = useCallback(({ signal }) => getFinding(findingId, { signal }), [findingId])
  const resource = useApiResource(loader)
  const [reviewedFinding, setReviewedFinding] = useState(null)
  const [reviewing, setReviewing] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const finding = reviewedFinding || resource.data
  const reviewAvailable = canReviewFinding(finding?.status, Boolean(reviewing))

  async function handleDecision(action) {
    if (!canReviewFinding(finding?.status, Boolean(reviewing))) return

    setReviewing(action)
    setError('')
    setSuccess('')

    try {
      const authoritativeFinding = action === 'approve'
        ? await approveFinding(finding.id)
        : await rejectFinding(finding.id)
      setReviewedFinding((current) => ({
        ...(current || resource.data),
        ...authoritativeFinding,
      }))
      setSuccess(
        action === 'reject'
          ? 'Finding returned to the Inspector as a draft.'
          : 'Finding approved successfully.',
      )
    } catch (requestError) {
      setError(getReviewError(requestError, action))
      if (requestError.status === 404 || requestError.status === 409) {
        setReviewedFinding(null)
        resource.reload()
      }
    } finally {
      setReviewing('')
    }
  }

  return (
    <>
      <div className="page-heading-row">
        <PageHeader eyebrow="REVIEWER · FINDING" title="Finding details" description="Review the reported condition and its property context before recording a decision." />
        <Link className="button button--secondary" to="/reviewer/findings">Back to findings</Link>
      </div>
      {success && <div className="alert alert--success" role="status">{success}</div>}
      <ResourceState {...resource} label="Loading finding…">
        {finding && (
          <>
            <section className="review-detail-grid">
              <article className="card detail-card review-detail">
                <div className="section-heading">
                  <div><p className="section-kicker">{formatEnumLabel(finding.area)} · {formatEnumLabel(finding.category)}</p><h2>{finding.issue}</h2></div>
                  <StatusBadge status={finding.status} />
                </div>
                <div className="review-detail__severity">
                  <span className={`severity severity--${finding.severity.toLowerCase()}`}>{formatEnumLabel(finding.severity)}</span>
                </div>
                <dl className="detail-list">
                  <div><dt>Description</dt><dd>{finding.description}</dd></div>
                  <div><dt>Recommended action</dt><dd>{finding.recommendedAction}</dd></div>
                  <div><dt>Finding ID</dt><dd className="mono-text">{finding.id}</dd></div>
                  <div><dt>Created</dt><dd>{formatDate(finding.createdAt)}</dd></div>
                </dl>
              </article>
              <aside className="card detail-card">
                <div className="section-heading"><div><p className="section-kicker">Context</p><h2>Inspection and property</h2></div></div>
                <dl className="detail-list">
                  <div><dt>Property</dt><dd>{finding.inspection.property.name}</dd></div>
                  <div><dt>Address</dt><dd>{finding.inspection.property.address}</dd></div>
                  <div><dt>Inspector</dt><dd>{finding.inspection.inspector.email}</dd></div>
                  <div><dt>Inspection status</dt><dd><StatusBadge status={finding.inspection.status} /></dd></div>
                  <div><dt>Inspection ID</dt><dd className="mono-text">{finding.inspection.id}</dd></div>
                  <div><dt>Inspected</dt><dd>{formatDate(finding.inspection.inspectedAt)}</dd></div>
                </dl>
              </aside>
            </section>

            {finding.photoPath && (
              <section className="section-block" aria-labelledby="review-photo-title">
                <div className="section-heading"><div><p className="section-kicker">Evidence</p><h2 id="review-photo-title">Finding photo</h2></div></div>
                <div className="card review-photo-card"><FindingPhoto findingId={finding.id} issue={finding.issue} /></div>
              </section>
            )}

            <section className="card review-decision" aria-labelledby="review-decision-title">
              <div>
                <p className="section-kicker">Decision</p>
                <h2 id="review-decision-title">Review outcome</h2>
                <p>{finding.status === 'SUBMITTED'
                  ? 'Approve this finding or return it to the Inspector as a draft.'
                  : finding.status === 'DRAFT'
                    ? 'This finding was returned to the Inspector and is no longer in the review queue.'
                    : `This finding is ${finding.status.toLowerCase()} and is now read-only.`}</p>
              </div>
              {error && <div className="alert review-decision__feedback" role="alert">{error}</div>}
              {finding.status === 'SUBMITTED' && (
                <div className="review-decision__actions">
                  <button className="button button--danger button--fit" type="button" disabled={!reviewAvailable} onClick={() => handleDecision('reject')}>
                    {reviewing === 'reject' && <span className="button-spinner" aria-hidden="true" />}
                    {reviewing === 'reject' ? 'Rejecting…' : 'Reject Finding'}
                  </button>
                  <button className="button button--success button--fit" type="button" disabled={!reviewAvailable} onClick={() => handleDecision('approve')}>
                    {reviewing === 'approve' && <span className="button-spinner" aria-hidden="true" />}
                    {reviewing === 'approve' ? 'Approving…' : 'Approve Finding'}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </ResourceState>
    </>
  )
}
