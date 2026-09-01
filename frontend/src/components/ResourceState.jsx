import { LoadingState } from './LoadingState.jsx'

export function ErrorState({ message, onRetry }) {
  return (
    <section className="card feedback-state" role="alert">
      <div className="feedback-state__icon feedback-state__icon--error" aria-hidden="true">!</div>
      <h2>Unable to load this information</h2>
      <p>{message || 'The request could not be completed.'}</p>
      {onRetry && <button className="button button--secondary" type="button" onClick={onRetry}>Try again</button>}
    </section>
  )
}

export function ResourceState({ loading, error, onRetry, reload, label, children }) {
  if (loading) {
    return (
      <section className="card feedback-state">
        <LoadingState label={label} />
      </section>
    )
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={onRetry || reload} />
  }

  return children
}
