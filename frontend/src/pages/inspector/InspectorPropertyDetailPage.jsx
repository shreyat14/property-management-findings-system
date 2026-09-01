import { useCallback } from 'react'
import { listInspections } from '../../api/inspectionsApi.js'
import { getProperty } from '../../api/propertiesApi.js'
import { EmptyState } from '../../components/EmptyState.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'
import { formatDate } from '../../utils/format.js'

export function InspectorPropertyDetailPage({ propertyId }) {
  const loader = useCallback(async ({ signal }) => {
    const [property, inspections] = await Promise.all([
      getProperty(propertyId, { signal }),
      listInspections({ signal }),
    ])
    return {
      property,
      inspections: inspections.filter((inspection) => inspection.propertyId === propertyId),
    }
  }, [propertyId])
  const resource = useApiResource(loader)

  return (
    <>
      <div className="page-heading-row">
        <PageHeader eyebrow="INSPECTOR · PROPERTY" title={resource.data?.property.name || 'Property details'} description="Review the assigned property and its inspections." />
        <Link className="button button--primary button--fit" to={`/inspector/properties/${encodeURIComponent(propertyId)}/inspections/new`}>Create inspection</Link>
      </div>
      <ResourceState {...resource} label="Loading property details…">
        {resource.data && (
          <div className="detail-layout">
            <section className="card detail-card">
              <div className="section-heading"><div><p className="section-kicker">Assigned property</p><h2>{resource.data.property.name}</h2></div></div>
              <dl className="detail-list">
                <div><dt>Address</dt><dd>{resource.data.property.address}</dd></div>
                <div><dt>Assignment access</dt><dd>Available to your Inspector account</dd></div>
                <div><dt>Property updated</dt><dd>{formatDate(resource.data.property.updatedAt)}</dd></div>
              </dl>
            </section>
            <section>
              <div className="section-heading"><div><p className="section-kicker">Inspection history</p><h2>Inspections</h2></div><span className="count-badge">{resource.data.inspections.length}</span></div>
              {resource.data.inspections.length === 0 ? (
                <EmptyState title="No inspections yet" description="Create the first inspection for this assigned property." />
              ) : (
                <div className="card list-card">
                  {resource.data.inspections.map((inspection) => (
                    <div className="list-row list-row--action" key={inspection.id}>
                      <div><strong>Inspection {formatDate(inspection.inspectedAt)}</strong><span><StatusBadge status={inspection.status} /></span></div>
                      <Link className="text-link" to={`/inspector/inspections/${encodeURIComponent(inspection.id)}`}>View</Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </ResourceState>
    </>
  )
}
