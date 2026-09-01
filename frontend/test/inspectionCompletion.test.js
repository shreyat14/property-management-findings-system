import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canSubmitInspectionCompletion,
  getInspectionCompletionAction,
  getInspectionCompletionError,
} from '../src/utils/inspectionCompletion.js'

test('IN_PROGRESS exposes the Complete Inspection action', () => {
  assert.deepEqual(getInspectionCompletionAction('IN_PROGRESS', false), {
    visible: true,
    disabled: false,
    label: 'Complete Inspection',
  })
  assert.equal(canSubmitInspectionCompletion('IN_PROGRESS', false), true)
})

test('completion loading state prevents duplicate submission', () => {
  assert.deepEqual(getInspectionCompletionAction('IN_PROGRESS', true), {
    visible: true,
    disabled: true,
    label: 'Completing…',
  })
  assert.equal(canSubmitInspectionCompletion('IN_PROGRESS', true), false)
})

test('COMPLETED does not expose or submit the completion action', () => {
  assert.equal(getInspectionCompletionAction('COMPLETED', false).visible, false)
  assert.equal(canSubmitInspectionCompletion('COMPLETED', false), false)
})

test('completion failures map to appropriate user-facing messages', () => {
  assert.equal(
    getInspectionCompletionError({ status: 401 }),
    'Your session is no longer valid. Sign in and try again.',
  )
  assert.equal(
    getInspectionCompletionError({ status: 403 }),
    'You do not have permission to complete this inspection.',
  )
  assert.equal(
    getInspectionCompletionError({ status: 409 }),
    'This inspection has already been completed. Refresh to view its current status.',
  )
  assert.equal(
    getInspectionCompletionError({ message: 'Unable to connect to the service.' }),
    'Unable to connect to the service.',
  )
})
