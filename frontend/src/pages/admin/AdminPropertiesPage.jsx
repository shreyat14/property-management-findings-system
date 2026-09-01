import { useCallback } from 'react'
import { listProperties } from '../../api/propertiesApi.js'
import { EmptyState } from '../../components/EmptyState.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'

export function AdminPropertiesPage() {
  const loader = useCallback(({ signal }) => listProperties({ signal }), [])
  const resource = useApiResource(loader)

  return (
    <>
      <div className="page-heading-row">
        <PageHeader eyebrow="ADMIN · PROPERTIES" title="Properties" description="Create and review the properties available for inspection." />
        <Link className="button button--primary button--fit" to="/admin/properties/new">Add property</Link>
      </div>
      <ResourceState {...resource} label="Loading properties…">
        {resource.data?.length === 0 ? (
          <EmptyState title="No properties yet" description="Add the first property to begin assigning inspection work." />
        ) : (
          <section className="resource-grid">
            {resource.data?.map((property) => (
              <article className="card resource-card" key={property.id}>
                <div><p className="resource-card__label">Property</p><h2>{property.name}</h2><p>{property.address}</p></div>
                <Link className="button button--secondary" to={`/admin/properties/${encodeURIComponent(property.id)}`}>View property</Link>
              </article>
            ))}
          </section>
        )}
      </ResourceState>
    </>
  )
}
