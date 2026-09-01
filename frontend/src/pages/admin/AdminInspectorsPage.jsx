import { useCallback } from 'react'
import { listInspectors } from '../../api/inspectorsApi.js'
import { EmptyState } from '../../components/EmptyState.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'

export function AdminInspectorsPage() {
  const loader = useCallback(({ signal }) => listInspectors({ signal }), [])
  const resource = useApiResource(loader)
  const created = new URLSearchParams(window.location.search).get('created') === '1'

  return (
    <>
      <div className="page-heading-row">
        <PageHeader eyebrow="ADMIN · INSPECTORS" title="Inspectors" description="Create and review accounts that can receive property assignments." />
        <Link className="button button--primary button--fit" to="/admin/inspectors/new">Add Inspector</Link>
      </div>
      {created && <div className="alert alert--success" role="status">Inspector created successfully.</div>}
      <ResourceState {...resource} label="Loading Inspectors…">
        {resource.data?.length === 0 ? (
          <EmptyState title="No Inspectors yet" description="Add an Inspector before assigning property work." />
        ) : (
          <div className="card list-card">
            {resource.data?.map((inspector) => (
              <div className="list-row" key={inspector.id}>
                <div className="identity-mark" aria-hidden="true">{inspector.email.slice(0, 2).toUpperCase()}</div>
                <div><strong>{inspector.email}</strong><span>{inspector.role}</span></div>
              </div>
            ))}
          </div>
        )}
      </ResourceState>
    </>
  )
}
