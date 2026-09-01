import { useCallback } from 'react'
import { listReviewFindings } from '../../api/findingsApi.js'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { ReviewerFindingList } from '../../components/ReviewerFindingList.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'

export function ReviewerFindingsPage() {
  const loader = useCallback(({ signal }) => listReviewFindings({ signal }), [])
  const resource = useApiResource(loader)

  return (
    <>
      <PageHeader
        eyebrow="REVIEWER · FINDINGS"
        title="Findings to review"
        description="Open a submitted finding to review its inspection context, photo, and recommended action."
      />
      <ResourceState {...resource} label="Loading findings…">
        {resource.data && <ReviewerFindingList findings={resource.data} />}
      </ResourceState>
    </>
  )
}
