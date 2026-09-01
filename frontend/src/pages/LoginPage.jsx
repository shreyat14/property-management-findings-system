import { useState } from 'react'
import { ApiError } from '../api/apiClient.js'
import { Brand } from '../components/Brand.jsx'
import { useAuth } from '../context/authContext.js'
import { navigate } from '../routes/navigation.js'
import { getRoleHome } from '../routes/routePolicy.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(email, password) {
  const errors = {}

  if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (password.length === 0) {
    errors.password = 'Enter your password.'
  }

  return errors
}

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(email, password)

    setErrors(nextErrors)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setSubmitting(true)

    try {
      const user = await login(email.trim(), password)
      navigate(getRoleHome(user.role), { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSubmitError('The email or password is incorrect.')
      } else if (error instanceof ApiError || error instanceof Error) {
        setSubmitError(error.message)
      } else {
        setSubmitError('Sign in could not be completed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro" aria-label="Application introduction">
        <Brand />
        <div className="login-intro__content">
          <p className="login-intro__eyebrow">Property operations</p>
          <h1>Clear findings. Confident decisions.</h1>
          <p className="login-intro__description">
            A focused workspace for managing property inspections from assignment through review.
          </p>
        </div>
        <p className="login-intro__footer">Authorized personnel only</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__mobile-brand"><Brand /></div>
          <h2>Welcome back</h2>
          <p className="login-card__subtitle">Sign in with your organization credentials.</p>

          <form onSubmit={handleSubmit} noValidate>
            {submitError && <div className="alert" role="alert">{submitError}</div>}

            <div className="form-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="name@organization.com"
                value={email}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                disabled={submitting}
                onChange={(event) => setEmail(event.target.value)}
              />
              {errors.email && <p className="field-error" id="email-error">{errors.email}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                disabled={submitting}
                onChange={(event) => setPassword(event.target.value)}
              />
              {errors.password && <p className="field-error" id="password-error">{errors.password}</p>}
            </div>

            <button className="button button--primary" type="submit" disabled={submitting}>
              {submitting && <span className="button-spinner" aria-hidden="true" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
