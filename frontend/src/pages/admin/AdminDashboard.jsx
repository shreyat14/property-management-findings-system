import { useCallback } from 'react'
import { listInspectors } from '../../api/inspectorsApi.js'
import { listProperties, listPropertyInspectors } from '../../api/propertiesApi.js'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { StatCard } from '../../components/StatCard.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'

export function AdminDashboard() {
  const loader = useCallback(async ({ signal }) => {
    const [properties, inspectors] = await Promise.all([
      listProperties({ signal }),
      listInspectors({ signal }),
    ])
    const assignments = await Promise.all(
      properties.map((property) => listPropertyInspectors(property.id, { signal })),
    )

    return {
      properties,
      inspectors,
      assignmentCount: assignments.reduce((total, items) => total + items.length, 0),
    }
  }, [])
  const resource = useApiResource(loader)

  return (
    <>
      <PageHeader
        eyebrow="ADMIN"
        title="Admin dashboard"
        description="Manage the properties, Inspectors, and assignments that keep inspections moving."
      />
      <ResourceState {...resource} label="Loading administration summary…">
        {resource.data && (
          <>
            <section className="stat-grid" aria-label="Administration summary">
              <StatCard label="Properties" value={resource.data.properties.length} detail="Available properties" />
              <StatCard label="Inspectors" value={resource.data.inspectors.length} detail="Inspector accounts" />
              <StatCard label="Assignments" value={resource.data.assignmentCount} detail="Active property assignments" />
            </section>
            <section className="section-block">
              <div className="section-heading">
                <div><p className="section-kicker">Quick actions</p><h2>Continue administration</h2></div>
              </div>
              <div className="action-grid">
                <Link className="card action-card" to="/admin/properties/new"><strong>Add property</strong><span>Create a property record and address.</span></Link>
                <Link className="card action-card" to="/admin/inspectors/new"><strong>Add Inspector</strong><span>Create a secure Inspector account.</span></Link>
                <Link className="card action-card" to="/admin/assignments"><strong>Assign property</strong><span>Connect an Inspector to a property.</span></Link>
              </div>
            </section>
          </>
        )}
      </ResourceState>
    </>
  )
}
