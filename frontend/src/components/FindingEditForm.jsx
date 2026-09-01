import { useEffect, useState } from 'react'
import { updateFinding, uploadFindingPhoto } from '../api/findingsApi.js'
import {
  ALLOWED_PHOTO_TYPES,
  FINDING_AREAS,
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  canEditFinding,
  formatEnumLabel,
  getEditableFindingFields,
  getFindingEditError,
  validateFinding,
  validatePhoto,
} from '../utils/findingWorkflow.js'

function SelectField({ label, name, options, value, onChange, disabled }) {
  return (
    <div className="form-field">
      <label htmlFor={`edit-finding-${name}`}>{label} <span aria-hidden="true">*</span></label>
      <select id={`edit-finding-${name}`} name={name} value={value} onChange={onChange} disabled={disabled} required>
        {options.map((option) => <option value={option} key={option}>{formatEnumLabel(option)}</option>)}
      </select>
    </div>
  )
}

export function FindingEditForm({ finding, onCancel, onSaved, onStale }) {
  const [fields, setFields] = useState(() => getEditableFindingFields(finding))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  function updateField(event) {
    const { name, value } = event.target
    setFields((current) => ({ ...current, [name]: value }))
  }

  function selectPhoto(event) {
    const nextPhoto = event.target.files?.[0] || null
    const photoError = nextPhoto ? validatePhoto(nextPhoto) : ''
    setError(photoError)
    setPhoto(photoError ? null : nextPhoto)
    setPhotoPreview(photoError || !nextPhoto ? '' : URL.createObjectURL(nextPhoto))
    if (photoError) event.target.value = ''
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!canEditFinding(finding.status, saving)) return

    const validationError = validateFinding(fields)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    try {
      const updatedFinding = await updateFinding(finding.id, fields)

      if (!photo) {
        onSaved(updatedFinding)
        return
      }

      try {
        onSaved(await uploadFindingPhoto(updatedFinding.id, photo))
      } catch (photoError) {
        onSaved(
          updatedFinding,
          `Finding details were saved, but the photo could not be uploaded. ${photoError.message}`,
        )
      }
    } catch (requestError) {
      setError(getFindingEditError(requestError))
      if (requestError.status === 404 || requestError.status === 409) onStale()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="finding-edit-form" onSubmit={handleSave} noValidate>
      <div className="section-heading">
        <div><p className="section-kicker">Draft finding</p><h3>Edit finding</h3></div>
      </div>
      <p className="field-hint">Update the finding details before submitting it for review. Any existing photo remains attached.</p>
      {error && <div className="alert" role="alert">{error}</div>}
      {!finding.photoPath && (
        <div className="form-field">
          <label htmlFor={`edit-finding-photo-${finding.id}`}>Add finding photo</label>
          <input id={`edit-finding-photo-${finding.id}`} type="file" accept={ALLOWED_PHOTO_TYPES.join(',')} onChange={selectPhoto} disabled={saving} />
          <p className="field-hint">Optional. JPEG, PNG, or WebP, up to 5 MB. Existing photos cannot be replaced.</p>
        </div>
      )}
      {photoPreview && <img className="photo-preview" src={photoPreview} alt="Selected finding preview" />}
      <div className="form-row">
        <SelectField label="Area" name="area" options={FINDING_AREAS} value={fields.area} onChange={updateField} disabled={saving} />
        <SelectField label="Category" name="category" options={FINDING_CATEGORIES} value={fields.category} onChange={updateField} disabled={saving} />
        <SelectField label="Severity" name="severity" options={FINDING_SEVERITIES} value={fields.severity} onChange={updateField} disabled={saving} />
      </div>
      <div className="form-field">
        <label htmlFor="edit-finding-issue">Issue <span aria-hidden="true">*</span></label>
        <input id="edit-finding-issue" name="issue" value={fields.issue} onChange={updateField} disabled={saving} required />
      </div>
      <div className="form-field">
        <label htmlFor="edit-finding-description">Finding description <span aria-hidden="true">*</span></label>
        <textarea id="edit-finding-description" name="description" value={fields.description} onChange={updateField} disabled={saving} rows="4" required />
      </div>
      <div className="form-field">
        <label htmlFor="edit-finding-recommended-action">Recommended action <span aria-hidden="true">*</span></label>
        <textarea id="edit-finding-recommended-action" name="recommendedAction" value={fields.recommendedAction} onChange={updateField} disabled={saving} rows="3" required />
      </div>
      <div className="form-actions">
        <button className="button button--secondary" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="button button--primary button--fit" type="submit" disabled={saving}>
          {saving && <span className="button-spinner" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
