import { getFindingSubmissionAction } from '../utils/findingWorkflow.js'

export function FindingSubmissionAction({ status, submitting, error, onSubmit }) {
  const action = getFindingSubmissionAction(status, submitting)

  if (!action.visible) return null

  return (
    <div className="finding-submission">
      <div>
        <strong>Ready for review?</strong>
        <span>Submit this draft when its details are final.</span>
      </div>
      {error && <div className="alert finding-submission__error" role="alert">{error}</div>}
      <button className="button button--primary button--fit" type="button" disabled={action.disabled} onClick={onSubmit}>
        {submitting && <span className="button-spinner" aria-hidden="true" />}
        {action.label}
      </button>
    </div>
  )
}
