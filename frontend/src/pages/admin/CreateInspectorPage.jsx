import { useState } from 'react'
import { createInspector } from '../../api/inspectorsApi.js'
import { PageHeader } from '../../components/PageHeader.jsx'
import { Link } from '../../routes/Link.jsx'
import { navigate } from '../../routes/navigation.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CreateInspectorPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Enter a temporary password.'
    setErrors(nextErrors)
    setSubmitError('')
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    try {
      await createInspector({ email: email.trim(), password })
      navigate('/admin/inspectors?created=1', { replace: true })
    } catch (error) {
      setSubmitError(error.message || 'The Inspector could not be created.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="ADMIN · INSPECTORS" title="Add Inspector" description="Create an Inspector account. The backend always applies the Inspector role." />
      <section className="card form-card">
        <form onSubmit={handleSubmit} noValidate>
          {submitError && <div className="alert" role="alert">{submitError}</div>}
          <div className="form-field">
            <label htmlFor="inspector-email">Email address</label>
            <input id="inspector-email" type="email" autoComplete="off" value={email} disabled={submitting} aria-invalid={Boolean(errors.email)} onChange={(event) => setEmail(event.target.value)} />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="inspector-password">Temporary password</label>
            <input id="inspector-password" type="password" autoComplete="new-password" value={password} disabled={submitting} aria-invalid={Boolean(errors.password)} onChange={(event) => setPassword(event.target.value)} />
            {errors.password && <p className="field-error">{errors.password}</p>}
            <p className="field-hint">Share credentials through an appropriate secure channel.</p>
          </div>
          <div className="form-actions">
            <Link className="button button--secondary" to="/admin/inspectors">Cancel</Link>
            <button className="button button--primary button--fit" type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Inspector'}</button>
          </div>
        </form>
      </section>
    </>
  )
}
