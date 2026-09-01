import { useState } from 'react'
import { createProperty } from '../../api/propertiesApi.js'
import { PageHeader } from '../../components/PageHeader.jsx'
import { Link } from '../../routes/Link.jsx'
import { navigate } from '../../routes/navigation.js'

export function CreatePropertyPage() {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!name.trim()) nextErrors.name = 'Enter a property name.'
    if (!address.trim()) nextErrors.address = 'Enter a property address.'
    setErrors(nextErrors)
    setSubmitError('')
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      const property = await createProperty({ name: name.trim(), address: address.trim() })
      navigate(`/admin/properties/${encodeURIComponent(property.id)}?created=1`, { replace: true })
    } catch (error) {
      setSubmitError(error.message || 'The property could not be created.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="ADMIN · PROPERTIES" title="Add property" description="Create the property record that Inspectors will later be assigned to." />
      <section className="card form-card">
        <form onSubmit={handleSubmit} noValidate>
          {submitError && <div className="alert" role="alert">{submitError}</div>}
          <div className="form-field">
            <label htmlFor="property-name">Property name</label>
            <input id="property-name" value={name} disabled={submitting} aria-invalid={Boolean(errors.name)} onChange={(event) => setName(event.target.value)} />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="property-address">Address</label>
            <input id="property-address" value={address} disabled={submitting} aria-invalid={Boolean(errors.address)} onChange={(event) => setAddress(event.target.value)} />
            {errors.address && <p className="field-error">{errors.address}</p>}
          </div>
          <div className="form-actions">
            <Link className="button button--secondary" to="/admin/properties">Cancel</Link>
            <button className="button button--primary button--fit" type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create property'}</button>
          </div>
        </form>
      </section>
    </>
  )
}
