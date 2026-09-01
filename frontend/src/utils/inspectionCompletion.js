export function getInspectionCompletionAction(status, completing) {
  return {
    visible: status === 'IN_PROGRESS',
    disabled: Boolean(completing),
    label: completing ? 'Completing…' : 'Complete Inspection',
  }
}

export function canSubmitInspectionCompletion(status, completing) {
  return status === 'IN_PROGRESS' && !completing
}

export function getInspectionCompletionError(error) {
  if (error?.status === 401) {
    return 'Your session is no longer valid. Sign in and try again.'
  }

  if (error?.status === 403) {
    return 'You do not have permission to complete this inspection.'
  }

  if (error?.status === 409) {
    return 'This inspection has already been completed. Refresh to view its current status.'
  }

  return error?.message || 'The inspection could not be completed. Please try again.'
}
