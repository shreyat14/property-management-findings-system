import { navigate } from '../routes/navigation.js'

function ErrorPage({ code, title, description, home }) {
  return (
    <main className="error-page">
      <section className="card error-card">
        <p className="error-card__code">{code}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <button className="button button--secondary" type="button" onClick={() => navigate(home || '/login', { replace: true })}>
          {home === '/login' ? 'Go to sign in' : 'Return to dashboard'}
        </button>
      </section>
    </main>
  )
}

export function AccessDeniedPage({ home }) {
  return (
    <ErrorPage
      code="403 · Access restricted"
      title="This area is not available to your role"
      description="Your account is signed in, but it does not have access to this workspace."
      home={home}
    />
  )
}

export function NotFoundPage({ home }) {
  return (
    <ErrorPage
      code="404 · Not found"
      title="We could not find that page"
      description="The address may be incorrect, or the page may not be available yet."
      home={home}
    />
  )
}
