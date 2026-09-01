import { useCallback, useState } from 'react'
import { createInspection } from '../../api/inspectionsApi.js'
import { getProperty } from '../../api/propertiesApi.js'
import { PageHeader } from '../../components/PageHeader.jsx'
import { ResourceState } from '../../components/ResourceState.jsx'
import { useApiResource } from '../../hooks/useApiResource.js'
import { Link } from '../../routes/Link.jsx'
import { navigate } from '../../routes/navigation.js'

export function CreateInspectionPage({ propertyId }) {
  const loader = useCallback(({ signal }) => getProperty(propertyId, { signal }), [propertyId])
  const resource = useApiResource(loader)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    try {
      const inspection = await createInspection(propertyId)
      navigate(`/inspector/inspections/${encodeURIComponent(inspection.id)}?created=1`, { replace: true })
    } catch (error) {
      setSubmitError(error.message || 'The inspection could not be created.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="INSPECTOR · INSPECTIONS" title="Create inspection" description="Confirm the assigned property. Status, ownership, and timestamps are set by the backend." />
      <ResourceState {...resource} label="Loading property…">
        {resource.data && (
          <section className="card form-card">
            {submitError && <div className="alert" role="alert">{submitError}</div>}
            <div className="confirmation-panel">
              <p className="section-kicker">Assigned property</p>
              <h2>{resource.data.name}</h2>
              <p>{resource.data.address}</p>
            </div>
            <form onSubmit={handleSubmit}>
              <p className="form-note">Creating this inspection will start a new <strong>IN PROGRESS</strong> inspection assigned to your account.</p>
              <div className="form-actions">
                <Link className="button button--secondary" to={`/inspector/properties/${encodeURIComponent(propertyId)}`}>Cancel</Link>
                <button className="button button--primary button--fit" type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create inspection'}</button>
              </div>
            </form>
          </section>
        )}
      </ResourceState>
    </>
  )
}
