import { getInspectionCompletionAction } from '../utils/inspectionCompletion.js'

export function InspectionCompletionAction({
  status,
  completing,
  error,
  completedSuccessfully,
  onComplete,
}) {
  const action = getInspectionCompletionAction(status, completing)

  if (status === 'COMPLETED') {
    return completedSuccessfully ? (
      <div className="alert alert--success completion-feedback" role="status">
        Inspection completed successfully.
      </div>
    ) : null
  }

  if (!action.visible) return null

  return (
    <section className="inspection-completion" aria-labelledby="complete-inspection-title">
      <div>
        <h3 id="complete-inspection-title">Finish this inspection</h3>
        <p>Mark the inspection complete when the property review is finished.</p>
      </div>
      {error && <div className="alert completion-feedback" role="alert">{error}</div>}
      <button
        className="button button--primary button--fit"
        type="button"
        disabled={action.disabled}
        onClick={onComplete}
      >
        {action.label}
      </button>
    </section>
  )
}
