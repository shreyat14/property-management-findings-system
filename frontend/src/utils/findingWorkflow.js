export const FINDING_AREAS = Object.freeze([
  'KITCHEN',
  'LIVING_ROOM',
  'BEDROOM',
  'BATHROOM',
  'HALLWAY',
  'LAUNDRY',
  'GARAGE',
  'EXTERIOR',
  'OTHER',
])

export const FINDING_CATEGORIES = Object.freeze([
  'PLUMBING',
  'ELECTRICAL',
  'FLOORING',
  'WALLS_CEILINGS',
  'DOORS_WINDOWS',
  'HVAC',
  'APPLIANCES',
  'STRUCTURAL',
  'SAFETY',
  'PEST',
  'CLEANLINESS',
  'OTHER',
])

export const FINDING_SEVERITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export const ALLOWED_PHOTO_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp'])
export const MAX_FINDING_PHOTO_SIZE = 5 * 1024 * 1024
export const EMPTY_FINDING = Object.freeze({
  area: '',
  category: '',
  issue: '',
  severity: '',
  description: '',
  recommendedAction: '',
})

export function formatEnumLabel(value) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function validatePhoto(photo) {
  if (!photo) return 'Select a photo before using AI analysis.'
  if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) return 'Choose a JPEG, PNG, or WebP image.'
  if (photo.size > MAX_FINDING_PHOTO_SIZE) return 'The photo must be 5 MB or smaller.'
  return ''
}

export function validateFinding(finding) {
  if (!FINDING_AREAS.includes(finding.area)) return 'Select a valid area.'
  if (!FINDING_CATEGORIES.includes(finding.category)) return 'Select a valid category.'
  if (!FINDING_SEVERITIES.includes(finding.severity)) return 'Select a valid severity.'
  if (!finding.issue.trim()) return 'Enter an issue title.'
  if (!finding.description.trim()) return 'Enter a finding description.'
  if (!finding.recommendedAction.trim()) return 'Enter a recommended action.'
  return ''
}

export function applyFindingSuggestion(suggestion) {
  return {
    area: suggestion.area,
    category: suggestion.category,
    issue: suggestion.issue,
    severity: suggestion.severity,
    description: suggestion.description,
    recommendedAction: suggestion.recommendedAction,
  }
}

export function canSubmitFinding({ creating, pendingPhotoFinding }) {
  return !creating && !pendingPhotoFinding
}

export function canCreateFindingForInspection(status) {
  return status === 'IN_PROGRESS'
}

export function getEditableFindingFields(finding) {
  return {
    area: finding.area,
    category: finding.category,
    issue: finding.issue,
    severity: finding.severity,
    description: finding.description,
    recommendedAction: finding.recommendedAction,
  }
}

export function canEditFinding(status, saving) {
  return status === 'DRAFT' && !saving
}

export function getFindingEditError(error) {
  if (error?.status === 401) return 'Your session is no longer valid. Sign in and try again.'
  if (error?.status === 403) return 'You do not have permission to edit this finding.'
  if (error?.status === 404) return 'This finding could not be found. Refresh the inspection and try again.'
  if (error?.status === 409) return 'This finding is no longer editable. Its status may have changed.'
  return error?.message || 'The finding could not be updated. Please try again.'
}

export function getFindingSubmissionAction(status, submitting) {
  return {
    visible: status === 'DRAFT',
    disabled: Boolean(submitting),
    label: submitting ? 'Submitting...' : 'Submit Finding',
  }
}

export function canSubmitFindingForReview(status, submitting) {
  return status === 'DRAFT' && !submitting
}

export function getFindingSubmissionError(error) {
  if (error?.status === 401) return 'Your session is no longer valid. Sign in and try again.'
  if (error?.status === 403) return 'You do not have permission to submit this finding.'
  if (error?.status === 404) return 'This finding could not be found. Refresh the inspection and try again.'
  if (error?.status === 409) return 'This finding is no longer eligible for submission. Its status may have changed.'
  return error?.message || 'The finding could not be submitted. Please try again.'
}
