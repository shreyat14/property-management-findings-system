export function canReviewFinding(status, reviewing) {
  return status === 'SUBMITTED' && !reviewing
}

export function getReviewError(error, action) {
  const verb = action === 'approve' ? 'approve' : 'reject'

  if (error?.status === 401) return 'Your session is no longer valid. Sign in and try again.'
  if (error?.status === 403) return `You do not have permission to ${verb} this finding.`
  if (error?.status === 404) return 'This finding could not be found.'
  if (error?.status === 409) return 'This finding is no longer awaiting review. Its status may have changed.'
  return error?.message || `The finding could not be ${verb}d. Please try again.`
}
