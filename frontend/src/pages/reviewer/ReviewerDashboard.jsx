import { useCallback } from 'react'
import { listReviewFindings } from '../../api/findingsApi.js'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { ReviewerFindingList } from '../../components/ReviewerFindingList.jsx'
import { StatCard } from '../../components/StatCard.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'

export function ReviewerDashboard() {
  const loader = useCallback(({ signal }) => listReviewFindings({ signal }), [])
  const resource = useApiResource(loader)

  return (
    <>
      <PageHeader
        eyebrow="REVIEWER"
        title="Reviewer dashboard"
        description="Review submitted inspection findings and record an approval or rejection decision."
      />
      <ResourceState {...resource} label="Loading findings awaiting review…">
        {resource.data && (
          <>
            <section className="stat-grid stat-grid--single" aria-label="Review summary">
              <StatCard label="Awaiting review" value={resource.data.length} detail="Submitted findings requiring a decision" />
            </section>
            <section className="section-block">
              <div className="section-heading">
                <div><p className="section-kicker">Review queue</p><h2>Findings awaiting review</h2></div>
                {resource.data.length > 0 && <Link className="text-link" to="/reviewer/findings">View all</Link>}
              </div>
              <ReviewerFindingList findings={resource.data} limit={3} />
            </section>
          </>
        )}
      </ResourceState>
    </>
  )
}
