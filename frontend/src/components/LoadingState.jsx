export function LoadingState({ label = 'Loading…', fullPage = false }) {
  const state = (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )

  return fullPage ? <div className="app-loading">{state}</div> : state
}
