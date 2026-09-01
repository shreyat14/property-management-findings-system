import { useEffect, useState } from 'react'
import { analyzeFinding } from '../api/aiApi.js'
import { createFinding, uploadFindingPhoto } from '../api/findingsApi.js'
import { getInspection } from '../api/inspectionsApi.js'
import {
  ALLOWED_PHOTO_TYPES,
  EMPTY_FINDING,
  FINDING_AREAS,
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  applyFindingSuggestion,
  canSubmitFinding,
  formatEnumLabel,
  validateFinding,
  validatePhoto,
} from '../utils/findingWorkflow.js'
import { AiSuggestionPanel } from './AiSuggestionPanel.jsx'

function SelectField({ label, name, options, value, onChange, disabled }) {
  return (
    <div className="form-field">
      <label htmlFor={`finding-${name}`}>{label} <span aria-hidden="true">*</span></label>
      <select id={`finding-${name}`} name={name} value={value} onChange={onChange} disabled={disabled} required>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option value={option} key={option}>{formatEnumLabel(option)}</option>)}
      </select>
    </div>
  )
}

export function FindingForm({ inspectionId, onCancel, onFindingChanged, onInspectionCompleted }) {
  const [finding, setFinding] = useState({ ...EMPTY_FINDING })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [observation, setObservation] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pendingPhotoFinding, setPendingPhotoFinding] = useState(null)
  const [aiError, setAiError] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const locked = creating || Boolean(pendingPhotoFinding)

  function updateFinding(event) {
    const { name, value } = event.target
    setFinding((current) => ({ ...current, [name]: value }))
  }

  function selectPhoto(event) {
    const nextPhoto = event.target.files?.[0] || null
    const error = nextPhoto ? validatePhoto(nextPhoto) : ''
    setAiError(error)
    setSuggestion(null)
    setPhoto(error ? null : nextPhoto)
    setPhotoPreview(error || !nextPhoto ? '' : URL.createObjectURL(nextPhoto))
    if (error) event.target.value = ''
  }

  async function handleAnalyze() {
    const photoError = validatePhoto(photo)
    if (photoError) {
      setAiError(photoError)
      return
    }

    setAiError('')
    setAnalyzing(true)
    try {
      const inspection = await getInspection(inspectionId)

      if (inspection.status === 'COMPLETED') {
        setAiError('This inspection has been completed. New finding analysis is no longer available.')
        onInspectionCompleted()
        return
      }

      setSuggestion(await analyzeFinding(photo, observation))
    } catch (error) {
      setAiError(error.message || 'AI analysis could not be completed. You can still enter the finding manually.')
    } finally {
      setAnalyzing(false)
    }
  }

  function finishCreation(createdFinding) {
    setFinding({ ...EMPTY_FINDING })
    setPhoto(null)
    setPhotoPreview('')
    setObservation('')
    setSuggestion(null)
    setPendingPhotoFinding(null)
    setFormError('')
    onFindingChanged(createdFinding, { complete: true })
  }

  async function handleCreate(event) {
    event.preventDefault()
    if (!canSubmitFinding({ creating, pendingPhotoFinding })) return

    const validationError = validateFinding(finding)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setFormError('')
    setCreating(true)
    try {
      const createdFinding = await createFinding(inspectionId, finding)

      if (!photo) {
        finishCreation(createdFinding)
        return
      }

      try {
        finishCreation(await uploadFindingPhoto(createdFinding.id, photo))
      } catch (error) {
        setPendingPhotoFinding(createdFinding)
        setFormError(`The finding was created, but its photo could not be uploaded. ${error.message}`)
        onFindingChanged(createdFinding, { complete: false })
      }
    } catch (error) {
      if (error.status === 409) {
        setFormError('This inspection has been completed. New findings can no longer be created.')
        onInspectionCompleted()
        return
      }

      setFormError(error.message || 'The finding could not be created.')
    } finally {
      setCreating(false)
    }
  }

  async function retryPhotoUpload() {
    if (!pendingPhotoFinding || creating) return
    setCreating(true)
    setFormError('')
    try {
      finishCreation(await uploadFindingPhoto(pendingPhotoFinding.id, photo))
    } catch (error) {
      setFormError(`The finding is saved, but its photo still could not be uploaded. ${error.message}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="card finding-form-card" aria-labelledby="create-finding-title">
      <div className="section-heading">
        <div><p className="section-kicker">Inspector entry</p><h2 id="create-finding-title">Create finding</h2></div>
      </div>

      {formError && <div className="alert" role="alert">{formError}</div>}

      <div className="finding-workflow-grid">
        <section className="photo-analysis-panel" aria-labelledby="photo-analysis-title">
          <div><p className="section-kicker">Optional assistant</p><h3 id="photo-analysis-title">Photo and AI analysis</h3></div>
          <p className="field-hint">JPEG, PNG, or WebP, up to 5 MB. A selected photo is uploaded to the saved finding only after you click Create Finding.</p>
          <div className="form-field">
            <label htmlFor="finding-photo">Finding photo</label>
            <input id="finding-photo" type="file" accept={ALLOWED_PHOTO_TYPES.join(',')} onChange={selectPhoto} disabled={locked || analyzing} />
          </div>
          {photoPreview && <img className="photo-preview" src={photoPreview} alt="Selected finding preview" />}
          <div className="form-field">
            <label htmlFor="inspector-observation">Inspector observation</label>
            <textarea id="inspector-observation" value={observation} onChange={(event) => setObservation(event.target.value)} disabled={locked || analyzing} rows="3" placeholder="Optional context for AI analysis only" />
            <p className="field-hint">This observation is sent to AI as context and is not saved as a Finding field.</p>
          </div>
          {aiError && <div className="alert" role="alert">{aiError}</div>}
          <button className="button button--secondary button--fit" type="button" onClick={handleAnalyze} disabled={locked || analyzing}>
            {analyzing && <span className="button-spinner button-spinner--blue" aria-hidden="true" />}
            {analyzing ? 'Analyzing…' : 'Analyze with AI'}
          </button>
        </section>

        <form className="finding-fields" onSubmit={handleCreate} noValidate>
          <div className="form-row">
            <SelectField label="Area" name="area" options={FINDING_AREAS} value={finding.area} onChange={updateFinding} disabled={locked} />
            <SelectField label="Category" name="category" options={FINDING_CATEGORIES} value={finding.category} onChange={updateFinding} disabled={locked} />
            <SelectField label="Severity" name="severity" options={FINDING_SEVERITIES} value={finding.severity} onChange={updateFinding} disabled={locked} />
          </div>
          <div className="form-field">
            <label htmlFor="finding-issue">Issue <span aria-hidden="true">*</span></label>
            <input id="finding-issue" name="issue" value={finding.issue} onChange={updateFinding} disabled={locked} placeholder="Concise issue title" required />
          </div>
          <div className="form-field">
            <label htmlFor="finding-description">Finding description <span aria-hidden="true">*</span></label>
            <textarea id="finding-description" name="description" value={finding.description} onChange={updateFinding} disabled={locked} rows="5" placeholder="Describe the visible condition and location" required />
          </div>
          <div className="form-field">
            <label htmlFor="finding-recommended-action">Recommended action <span aria-hidden="true">*</span></label>
            <textarea id="finding-recommended-action" name="recommendedAction" value={finding.recommendedAction} onChange={updateFinding} disabled={locked} rows="4" placeholder="Document the recommended next step" required />
          </div>
          <div className="form-actions">
            {pendingPhotoFinding ? (
              <>
                <button className="button button--secondary" type="button" onClick={() => finishCreation(pendingPhotoFinding)} disabled={creating}>Keep without photo</button>
                <button className="button button--primary button--fit" type="button" onClick={retryPhotoUpload} disabled={creating}>
                  {creating ? 'Uploading…' : 'Retry Photo Upload'}
                </button>
              </>
            ) : (
              <>
                <button className="button button--secondary" type="button" onClick={onCancel} disabled={creating}>Cancel</button>
                <button className="button button--primary button--fit" type="submit" disabled={creating}>
                  {creating && <span className="button-spinner" aria-hidden="true" />}
                  {creating ? 'Creating…' : 'Create Finding'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      <AiSuggestionPanel suggestion={suggestion} onUse={() => setFinding(applyFindingSuggestion(suggestion))} />
    </section>
  )
}
