import { useCallback, useState } from 'react'
import { completeInspection, getInspection } from '../../api/inspectionsApi.js'
import { getProperty } from '../../api/propertiesApi.js'
import { InspectionCompletionAction } from '../../components/InspectionCompletionAction.jsx'
import { FindingsWorkflow } from '../../components/FindingsWorkflow.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'
import { formatDate } from '../../utils/format.js'
import {
  canSubmitInspectionCompletion,
  getInspectionCompletionError,
} from '../../utils/inspectionCompletion.js'

export function InspectionDetailPage({ inspectionId }) {
  const loader = useCallback(async ({ signal }) => {
    const inspection = await getInspection(inspectionId, { signal })
    const property = await getProperty(inspection.propertyId, { signal })
    return { inspection, property }
  }, [inspectionId])
  const resource = useApiResource(loader)
  const created = new URLSearchParams(window.location.search).get('created') === '1'
  const [completedInspection, setCompletedInspection] = useState(null)
  const [completionError, setCompletionError] = useState('')
  const [completing, setCompleting] = useState(false)
  const inspection = completedInspection || resource.data?.inspection

  async function handleComplete() {
    if (!canSubmitInspectionCompletion(inspection?.status, completing)) return

    setCompletionError('')
    setCompleting(true)

    try {
      const authoritativeInspection = await completeInspection(inspection.id)
      setCompletedInspection(authoritativeInspection)
    } catch (error) {
      setCompletionError(getInspectionCompletionError(error))
    } finally {
      setCompleting(false)
    }
  }

  function refreshInspection() {
    setCompletedInspection(null)
    resource.reload()
  }

  return (
    <>
      <div className="page-heading-row">
        <PageHeader eyebrow="INSPECTOR · INSPECTION" title="Inspection details" description="Review the inspection record created for this assigned property." />
        {resource.data && <Link className="button button--secondary" to={`/inspector/properties/${encodeURIComponent(resource.data.property.id)}`}>Back to property</Link>}
      </div>
      {created && <div className="alert alert--success" role="status">Inspection created successfully.</div>}
      <ResourceState {...resource} label="Loading inspection…">
        {resource.data && (
          <section className="card detail-card">
            <div className="section-heading"><div><p className="section-kicker">{resource.data.property.name}</p><h2>{resource.data.property.address}</h2></div><StatusBadge status={inspection.status} /></div>
            <dl className="detail-list detail-list--grid">
              <div><dt>Inspected</dt><dd>{formatDate(inspection.inspectedAt)}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(inspection.createdAt)}</dd></div>
              <div><dt>Completed</dt><dd>{formatDate(inspection.completedAt)}</dd></div>
              <div><dt>Inspection ID</dt><dd className="mono-text">{inspection.id}</dd></div>
            </dl>
            <InspectionCompletionAction
              status={inspection.status}
              completing={completing}
              error={completionError}
              completedSuccessfully={Boolean(completedInspection)}
              onComplete={handleComplete}
            />
          </section>
        )}
      </ResourceState>
      {resource.data && (
        <FindingsWorkflow
          inspectionId={inspectionId}
          inspectionStatus={inspection.status}
          onInspectionRefresh={refreshInspection}
        />
      )}
    </>
  )
}
