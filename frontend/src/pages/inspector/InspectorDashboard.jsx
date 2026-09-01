import { useCallback } from 'react'
import { listInspections } from '../../api/inspectionsApi.js'
import { listProperties } from '../../api/propertiesApi.js'
import { EmptyState } from '../../components/EmptyState.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { StatCard } from '../../components/StatCard.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'

export function InspectorDashboard() {
  const loader = useCallback(async ({ signal }) => {
    const [properties, inspections] = await Promise.all([
      listProperties({ signal }),
      listInspections({ signal }),
    ])
    return { properties, inspections }
  }, [])
  const resource = useApiResource(loader)

  return (
    <>
      <PageHeader eyebrow="INSPECTOR" title="Inspector dashboard" description="Access assigned properties and start inspection work from one place." />
      <ResourceState {...resource} label="Loading your workspace…">
        {resource.data && (
          <>
            <section className="stat-grid" aria-label="Inspector summary">
              <StatCard label="Assigned properties" value={resource.data.properties.length} detail="Available to inspect" />
              <StatCard label="Inspections" value={resource.data.inspections.length} detail="Your authorized records" />
              <StatCard label="In progress" value={resource.data.inspections.filter((item) => item.status === 'IN_PROGRESS').length} detail="Ready to continue" />
            </section>
            <section className="section-block">
              <div className="section-heading"><div><p className="section-kicker">Assigned work</p><h2>Properties</h2></div><Link className="text-link" to="/inspector/properties">View all</Link></div>
              {resource.data.properties.length === 0 ? (
                <EmptyState title="No properties assigned" description="An Administrator must assign a property before you can create an inspection." />
              ) : (
                <div className="resource-grid">
                  {resource.data.properties.slice(0, 3).map((property) => (
                    <article className="card resource-card" key={property.id}>
                      <div><p className="resource-card__label">Assigned property</p><h2>{property.name}</h2><p>{property.address}</p></div>
                      <Link className="button button--secondary" to={`/inspector/properties/${encodeURIComponent(property.id)}`}>Open property</Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </ResourceState>
    </>
  )
}
