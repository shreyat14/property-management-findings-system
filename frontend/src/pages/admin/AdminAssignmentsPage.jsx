import { useCallback, useMemo, useState } from 'react'
import { listInspectors } from '../../api/inspectorsApi.js'
import {
  assignInspector,
  listProperties,
  listPropertyInspectors,
} from '../../api/propertiesApi.js'
import { EmptyState } from '../../components/EmptyState.jsx'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { formatDate } from '../../utils/format.js'

export function AdminAssignmentsPage() {
  const [propertyId, setPropertyId] = useState('')
  const [inspectorId, setInspectorId] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const optionsLoader = useCallback(async ({ signal }) => {
    const [properties, inspectors] = await Promise.all([
      listProperties({ signal }),
      listInspectors({ signal }),
    ])
    return { properties, inspectors }
  }, [])
  const options = useApiResource(optionsLoader)

  const effectivePropertyId = propertyId || options.data?.properties[0]?.id || ''
  const effectiveInspectorId = inspectorId || options.data?.inspectors[0]?.id || ''

  const assignmentsLoader = useCallback(
    ({ signal }) => effectivePropertyId ? listPropertyInspectors(effectivePropertyId, { signal }) : Promise.resolve([]),
    [effectivePropertyId],
  )
  const assignments = useApiResource(assignmentsLoader)
  const assignedIds = useMemo(
    () => new Set((assignments.data || []).map((inspector) => inspector.id)),
    [assignments.data],
  )
  const selectedProperty = options.data?.properties.find((property) => property.id === effectivePropertyId)
  const selectedInspector = options.data?.inspectors.find((inspector) => inspector.id === effectiveInspectorId)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')
    setSuccess('')
    if (!effectivePropertyId || !effectiveInspectorId) {
      setSubmitError('Select both a property and an Inspector.')
      return
    }

    setSubmitting(true)
    try {
      await assignInspector(effectivePropertyId, effectiveInspectorId)
      setSuccess(`${selectedInspector.email} was assigned to ${selectedProperty.name}.`)
      assignments.reload()
    } catch (error) {
      setSubmitError(error.message || 'The assignment could not be created.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="ADMIN · ASSIGNMENTS" title="Property assignments" description="Choose a property and Inspector, then review the persisted assignment state." />
      <ResourceState {...options} label="Loading assignment options…">
        {options.data && (options.data.properties.length === 0 || options.data.inspectors.length === 0) ? (
          <EmptyState
            title="Property and Inspector required"
            description="Create at least one property and one Inspector before making an assignment."
          />
        ) : options.data && (
          <div className="detail-layout">
            <section className="card form-card form-card--compact">
              <div className="section-heading"><div><p className="section-kicker">New assignment</p><h2>Connect an Inspector</h2></div></div>
              <form onSubmit={handleSubmit}>
                {submitError && <div className="alert" role="alert">{submitError}</div>}
                {success && <div className="alert alert--success" role="status">{success}</div>}
                <div className="form-field">
                  <label htmlFor="assignment-property">Property</label>
                  <select id="assignment-property" value={effectivePropertyId} disabled={submitting} onChange={(event) => { setPropertyId(event.target.value); setSuccess('') }}>
                    {options.data.properties.map((property) => <option key={property.id} value={property.id}>{property.name} — {property.address}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="assignment-inspector">Inspector</label>
                  <select id="assignment-inspector" value={effectiveInspectorId} disabled={submitting} onChange={(event) => { setInspectorId(event.target.value); setSuccess('') }}>
                    {options.data.inspectors.map((inspector) => <option key={inspector.id} value={inspector.id}>{inspector.email}{assignedIds.has(inspector.id) ? ' (assigned)' : ''}</option>)}
                  </select>
                </div>
                <button className="button button--primary" type="submit" disabled={submitting || assignedIds.has(effectiveInspectorId)}>
                  {submitting ? 'Assigning…' : assignedIds.has(effectiveInspectorId) ? 'Already assigned' : 'Assign Inspector'}
                </button>
              </form>
            </section>
            <section>
              <div className="section-heading"><div><p className="section-kicker">Current state</p><h2>{selectedProperty?.name || 'Assigned Inspectors'}</h2></div></div>
              <ResourceState {...assignments} label="Loading assignments…">
                {assignments.data?.length === 0 ? (
                  <EmptyState title="No Inspectors assigned" description="Select an Inspector to create the first assignment for this property." />
                ) : (
                  <div className="card list-card">
                    {assignments.data?.map((inspector) => (
                      <div className="list-row" key={inspector.id}><div><strong>{inspector.email}</strong><span>Assigned {formatDate(inspector.assignedAt)}</span></div></div>
                    ))}
                  </div>
                )}
              </ResourceState>
            </section>
          </div>
        )}
      </ResourceState>
    </>
  )
}
