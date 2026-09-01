import { useCallback } from 'react'
import { listProperties } from '../../api/propertiesApi.js'
import { EmptyState } from '../../components/EmptyState.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'

export function InspectorPropertiesPage() {
  const loader = useCallback(({ signal }) => listProperties({ signal }), [])
  const resource = useApiResource(loader)

  return (
    <>
      <PageHeader eyebrow="INSPECTOR · PROPERTIES" title="My properties" description="Only properties assigned to your authenticated Inspector account are shown." />
      <ResourceState {...resource} label="Loading assigned properties…">
        {resource.data?.length === 0 ? (
          <EmptyState title="No properties assigned" description="Your assigned properties will appear here when an Administrator adds an assignment." />
        ) : (
          <section className="resource-grid">
            {resource.data?.map((property) => (
              <article className="card resource-card" key={property.id}>
                <div><p className="resource-card__label">Assigned property</p><h2>{property.name}</h2><p>{property.address}</p></div>
                <div className="card-actions">
                  <Link className="button button--secondary" to={`/inspector/properties/${encodeURIComponent(property.id)}`}>View property</Link>
                  <Link className="button button--primary button--fit" to={`/inspector/properties/${encodeURIComponent(property.id)}/inspections/new`}>Create inspection</Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </ResourceState>
    </>
  )
}
