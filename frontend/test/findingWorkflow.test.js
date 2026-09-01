import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_FINDING_PHOTO_SIZE,
  applyFindingSuggestion,
  canCreateFindingForInspection,
  canEditFinding,
  canSubmitFinding,
  canSubmitFindingForReview,
  getEditableFindingFields,
  getFindingEditError,
  getFindingSubmissionAction,
  getFindingSubmissionError,
  validateFinding,
  validatePhoto,
} from '../src/utils/findingWorkflow.js'

const suggestion = {
  area: 'BATHROOM',
  category: 'PLUMBING',
  issue: 'Loose faucet',
  severity: 'LOW',
  description: 'The faucet fixture moves under light pressure.',
  recommendedAction: 'Secure the fixture and check its connections.',
}

test('Use Suggestion copies exactly the six editable Finding fields', () => {
  assert.deepEqual(applyFindingSuggestion(suggestion), suggestion)
  const editable = applyFindingSuggestion(suggestion)
  editable.issue = 'Inspector-edited title'
  assert.equal(suggestion.issue, 'Loose faucet')
})

test('Finding validation follows the required backend content contract', () => {
  assert.equal(validateFinding(suggestion), '')
  assert.equal(validateFinding({ ...suggestion, area: 'ROOF' }), 'Select a valid area.')
  assert.equal(validateFinding({ ...suggestion, issue: '  ' }), 'Enter an issue title.')
})

test('photo validation follows the backend types and five MB limit', () => {
  assert.equal(validatePhoto(null), 'Select a photo before using AI analysis.')
  assert.equal(validatePhoto({ type: 'application/pdf', size: 10 }), 'Choose a JPEG, PNG, or WebP image.')
  assert.equal(validatePhoto({ type: 'image/png', size: MAX_FINDING_PHOTO_SIZE }), '')
  assert.equal(validatePhoto({ type: 'image/png', size: MAX_FINDING_PHOTO_SIZE + 1 }), 'The photo must be 5 MB or smaller.')
})

test('duplicate Finding creation is blocked while creating or resolving an uploaded photo', () => {
  assert.equal(canSubmitFinding({ creating: false, pendingPhotoFinding: null }), true)
  assert.equal(canSubmitFinding({ creating: true, pendingPhotoFinding: null }), false)
  assert.equal(canSubmitFinding({ creating: false, pendingPhotoFinding: { id: 'saved-finding' } }), false)
})

test('only IN_PROGRESS inspections expose the new Finding workflow', () => {
  assert.equal(canCreateFindingForInspection('IN_PROGRESS'), true)
  assert.equal(canCreateFindingForInspection('COMPLETED'), false)
  assert.equal(canCreateFindingForInspection(undefined), false)
})

test('only DRAFT findings expose editing and duplicate saves are blocked', () => {
  assert.equal(canEditFinding('DRAFT', false), true)
  assert.equal(canEditFinding('DRAFT', true), false)
  assert.equal(canEditFinding('SUBMITTED', false), false)
  assert.equal(canEditFinding('APPROVED', false), false)
  assert.equal(canEditFinding('REJECTED', false), false)
})

test('Finding editing sends only the six mutable content fields', () => {
  assert.deepEqual(
    getEditableFindingFields({
      id: 'finding-a',
      inspectionId: 'inspection-a',
      status: 'DRAFT',
      photoPath: 'uploads/findings/photo.jpg',
      ...suggestion,
    }),
    suggestion,
  )
})

test('Finding edit errors are converted to safe actionable messages', () => {
  assert.match(getFindingEditError({ status: 401 }), /session/i)
  assert.match(getFindingEditError({ status: 403 }), /permission/i)
  assert.match(getFindingEditError({ status: 404 }), /not be found/i)
  assert.match(getFindingEditError({ status: 409 }), /no longer editable/i)
  assert.equal(getFindingEditError({ message: 'Network unavailable' }), 'Network unavailable')
})

test('only DRAFT findings expose the Submit Finding action', () => {
  assert.deepEqual(getFindingSubmissionAction('DRAFT', false), {
    visible: true,
    disabled: false,
    label: 'Submit Finding',
  })
  assert.equal(getFindingSubmissionAction('SUBMITTED', false).visible, false)
  assert.equal(getFindingSubmissionAction('APPROVED', false).visible, false)
  assert.equal(getFindingSubmissionAction('REJECTED', false).visible, false)
})

test('finding submission loading state prevents duplicate requests', () => {
  assert.equal(canSubmitFindingForReview('DRAFT', false), true)
  assert.equal(canSubmitFindingForReview('DRAFT', true), false)
  assert.equal(canSubmitFindingForReview('SUBMITTED', false), false)
  assert.deepEqual(getFindingSubmissionAction('DRAFT', true), {
    visible: true,
    disabled: true,
    label: 'Submitting...',
  })
})

test('finding submission errors are converted to useful messages', () => {
  assert.match(getFindingSubmissionError({ status: 401 }), /session/i)
  assert.match(getFindingSubmissionError({ status: 403 }), /permission/i)
  assert.match(getFindingSubmissionError({ status: 404 }), /not be found/i)
  assert.match(getFindingSubmissionError({ status: 409 }), /no longer eligible/i)
  assert.equal(getFindingSubmissionError({ message: 'Network unavailable' }), 'Network unavailable')
})
