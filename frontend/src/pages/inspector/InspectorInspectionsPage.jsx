import { useCallback } from 'react'
import { listInspections } from '../../api/inspectionsApi.js'
import { listProperties } from '../../api/propertiesApi.js'
import { EmptyState } from '../../components/EmptyState.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'
import { formatDate } from '../../utils/format.js'

export function InspectorInspectionsPage() {
  const loader = useCallback(async ({ signal }) => {
    const [inspections, properties] = await Promise.all([
      listInspections({ signal }),
      listProperties({ signal }),
    ])
    return { inspections, properties: new Map(properties.map((property) => [property.id, property])) }
  }, [])
  const resource = useApiResource(loader)

  return (
    <>
      <PageHeader eyebrow="INSPECTOR · INSPECTIONS" title="Inspections" description="Review inspections created under your authorized property assignments." />
      <ResourceState {...resource} label="Loading inspections…">
        {resource.data?.inspections.length === 0 ? (
          <EmptyState title="No inspections yet" description="Open an assigned property to create your first inspection." />
        ) : (
          <div className="card table-wrap">
            <table className="data-table">
              <thead><tr><th>Property</th><th>Inspected</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {resource.data?.inspections.map((inspection) => (
                  <tr key={inspection.id}>
                    <td><strong>{resource.data.properties.get(inspection.propertyId)?.name || 'Property'}</strong></td>
                    <td>{formatDate(inspection.inspectedAt)}</td>
                    <td><StatusBadge status={inspection.status} /></td>
                    <td><Link className="text-link" to={`/inspector/inspections/${encodeURIComponent(inspection.id)}`}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ResourceState>
    </>
  )
}
