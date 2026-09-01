import { useCallback, useState } from 'react'
import { listInspectionFindings, submitFinding } from '../api/findingsApi.js'
import { useApiResource } from '../hooks/useApiResource.js'
import { formatDate } from '../utils/format.js'
import {
  canCreateFindingForInspection,
  canSubmitFindingForReview,
  formatEnumLabel,
  getFindingSubmissionError,
} from '../utils/findingWorkflow.js'
import { EmptyState } from './EmptyState.jsx'
import { FindingEditForm } from './FindingEditForm.jsx'
import { FindingForm } from './FindingForm.jsx'
import { FindingPhoto } from './FindingPhoto.jsx'
import { FindingSubmissionAction } from './FindingSubmissionAction.jsx'
import { ResourceState } from './ResourceState.jsx'
import { StatusBadge } from './StatusBadge.jsx'

export function FindingsWorkflow({ inspectionId, inspectionStatus, onInspectionRefresh }) {
  const loader = useCallback(
    ({ signal }) => listInspectionFindings(inspectionId, { signal }),
    [inspectionId],
  )
  const resource = useApiResource(loader)
  const [showForm, setShowForm] = useState(false)
  const [success, setSuccess] = useState('')
  const [serverLocked, setServerLocked] = useState(false)
  const [submittedFindings, setSubmittedFindings] = useState({})
  const [submittingId, setSubmittingId] = useState('')
  const [submissionError, setSubmissionError] = useState(null)
  const [editingId, setEditingId] = useState('')
  const canCreateFinding = canCreateFindingForInspection(inspectionStatus) && !serverLocked
  const findings = resource.data?.map((finding) => submittedFindings[finding.id] || finding)

  function handleInspectionCompleted() {
    setServerLocked(true)
    setShowForm(false)
    setSuccess('')
    onInspectionRefresh()
  }

  function handleFindingChanged(_finding, { complete }) {
    resource.reload()
    if (complete) {
      setShowForm(false)
      setSuccess('Finding created successfully.')
    } else {
      setSuccess('Finding created. Complete or skip the pending photo upload below.')
    }
  }

  async function handleSubmitFinding(finding) {
    const submitting = submittingId === finding.id
    if (!canSubmitFindingForReview(finding.status, submitting)) return

    setSubmittingId(finding.id)
    setSubmissionError(null)
    setSuccess('')

    try {
      const authoritativeFinding = await submitFinding(finding.id)
      setSubmittedFindings((current) => ({
        ...current,
        [authoritativeFinding.id]: authoritativeFinding,
      }))
      setSuccess(`“${authoritativeFinding.issue}” was submitted for review.`)
    } catch (error) {
      setSubmissionError({ id: finding.id, message: getFindingSubmissionError(error) })
      if (error.status === 404 || error.status === 409) resource.reload()
    } finally {
      setSubmittingId('')
    }
  }

  function handleFindingSaved(authoritativeFinding, message) {
    setSubmittedFindings((current) => ({
      ...current,
      [authoritativeFinding.id]: authoritativeFinding,
    }))
    setEditingId('')
    setSuccess(message || `“${authoritativeFinding.issue}” was updated successfully.`)
  }

  function handleStaleFinding(findingId) {
    setSubmittedFindings((current) => {
      const next = { ...current }
      delete next[findingId]
      return next
    })
    setEditingId('')
    resource.reload()
  }

  return (
    <section className="section-block" aria-labelledby="inspection-findings-title">
      <div className="section-heading">
        <div><p className="section-kicker">Inspection record</p><h2 id="inspection-findings-title">Findings</h2></div>
        {canCreateFinding && !showForm && <button className="button button--primary button--fit" type="button" onClick={() => { setShowForm(true); setSuccess('') }}>+ Create Finding</button>}
      </div>

      {!canCreateFinding && <div className="read-only-note" role="status"><strong>Completed inspection</strong><span>Existing findings remain available, but new findings and AI analysis are disabled.</span></div>}
      {success && <div className="alert alert--success" role="status">{success}</div>}
      {canCreateFinding && showForm && <FindingForm inspectionId={inspectionId} onCancel={() => setShowForm(false)} onFindingChanged={handleFindingChanged} onInspectionCompleted={handleInspectionCompleted} />}

      <div className={showForm ? 'findings-list findings-list--spaced' : 'findings-list'}>
        <ResourceState {...resource} label="Loading findings…">
          {findings?.length === 0 ? (
            <EmptyState title="No findings recorded" description="Create a finding manually or use a photo and AI suggestion as a starting point." />
          ) : (
            findings?.map((finding) => (
              <article className="card finding-card" key={finding.id}>
                {finding.photoPath && <FindingPhoto findingId={finding.id} issue={finding.issue} />}
                <div className="finding-card__content">
                  <div className="finding-card__meta">
                    <span>{formatEnumLabel(finding.area)}</span>
                    <span>{formatEnumLabel(finding.category)}</span>
                  </div>
                  <div className="finding-card__heading">
                    <h3>{finding.issue}</h3>
                    <div className="finding-card__heading-actions">
                      <span className={`severity severity--${finding.severity.toLowerCase()}`}>{finding.severity}</span>
                      {finding.status === 'DRAFT' && editingId !== finding.id && (
                        <button className="button button--secondary button--compact" type="button" onClick={() => { setEditingId(finding.id); setShowForm(false); setSuccess(''); setSubmissionError(null) }}>
                          Edit Finding
                        </button>
                      )}
                    </div>
                  </div>
                  <p>{finding.description}</p>
                  <div className="finding-card__action"><strong>Recommended action</strong><span>{finding.recommendedAction}</span></div>
                  {editingId === finding.id ? (
                    <FindingEditForm
                      finding={finding}
                      onCancel={() => setEditingId('')}
                      onSaved={handleFindingSaved}
                      onStale={() => handleStaleFinding(finding.id)}
                    />
                  ) : (
                    <FindingSubmissionAction
                      status={finding.status}
                      submitting={submittingId === finding.id}
                      error={submissionError?.id === finding.id ? submissionError.message : ''}
                      onSubmit={() => handleSubmitFinding(finding)}
                    />
                  )}
                  <div className="finding-card__footer"><StatusBadge status={finding.status} /><span>Created {formatDate(finding.createdAt)}</span></div>
                </div>
              </article>
            ))
          )}
        </ResourceState>
      </div>
    </section>
  )
}
