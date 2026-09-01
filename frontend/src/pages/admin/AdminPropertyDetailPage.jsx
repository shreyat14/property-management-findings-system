import { useCallback } from 'react'
import { getProperty, listPropertyInspectors } from '../../api/propertiesApi.js'
import { EmptyState } from '../../components/EmptyState.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'
import { formatDate } from '../../utils/format.js'

export function AdminPropertyDetailPage({ propertyId }) {
  const loader = useCallback(async ({ signal }) => {
    const [property, inspectors] = await Promise.all([
      getProperty(propertyId, { signal }),
      listPropertyInspectors(propertyId, { signal }),
    ])
    return { property, inspectors }
  }, [propertyId])
  const resource = useApiResource(loader)
  const created = new URLSearchParams(window.location.search).get('created') === '1'

  return (
    <>
      <div className="page-heading-row">
        <PageHeader eyebrow="ADMIN · PROPERTY" title={resource.data?.property.name || 'Property details'} description="Review property information and current Inspector assignments." />
        <Link className="button button--secondary" to="/admin/assignments">Manage assignments</Link>
      </div>
      {created && <div className="alert alert--success" role="status">Property created successfully.</div>}
      <ResourceState {...resource} label="Loading property…">
        {resource.data && (
          <div className="detail-layout">
            <section className="card detail-card">
              <div className="section-heading"><div><p className="section-kicker">Property information</p><h2>{resource.data.property.name}</h2></div></div>
              <dl className="detail-list">
                <div><dt>Address</dt><dd>{resource.data.property.address}</dd></div>
                <div><dt>Created</dt><dd>{formatDate(resource.data.property.createdAt)}</dd></div>
                <div><dt>Last updated</dt><dd>{formatDate(resource.data.property.updatedAt)}</dd></div>
              </dl>
            </section>
            <section>
              <div className="section-heading"><div><p className="section-kicker">Assignments</p><h2>Assigned Inspectors</h2></div><span className="count-badge">{resource.data.inspectors.length}</span></div>
              {resource.data.inspectors.length === 0 ? (
                <EmptyState title="No Inspectors assigned" description="Use Manage assignments to connect an Inspector to this property." />
              ) : (
                <div className="card list-card">
                  {resource.data.inspectors.map((inspector) => (
                    <div className="list-row" key={inspector.id}><div><strong>{inspector.email}</strong><span>Assigned {formatDate(inspector.assignedAt)}</span></div></div>
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
