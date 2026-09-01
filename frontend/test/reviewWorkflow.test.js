import assert from 'node:assert/strict'
import test from 'node:test'
import { ROLE_NAVIGATION } from '../src/routes/roleNavigation.js'
import { canReviewFinding, getReviewError } from '../src/utils/reviewWorkflow.js'

test('Reviewer navigation exposes only the review workflow', () => {
  assert.deepEqual(ROLE_NAVIGATION.REVIEWER, [
    { label: 'Findings to Review', path: '/reviewer/findings' },
  ])
  assert.equal(ROLE_NAVIGATION.REVIEWER.some((item) => item.path?.startsWith('/admin')), false)
  assert.equal(ROLE_NAVIGATION.INSPECTOR.some((item) => item.path?.startsWith('/reviewer')), false)
})

test('only a non-busy SUBMITTED finding can be reviewed', () => {
  assert.equal(canReviewFinding('SUBMITTED', false), true)
  assert.equal(canReviewFinding('SUBMITTED', true), false)
  assert.equal(canReviewFinding('DRAFT', false), false)
  assert.equal(canReviewFinding('APPROVED', false), false)
  assert.equal(canReviewFinding('REJECTED', false), false)
})

test('Reviewer errors are converted to safe actionable messages', () => {
  assert.match(getReviewError({ status: 401 }, 'approve'), /session/i)
  assert.match(getReviewError({ status: 403 }, 'reject'), /permission/i)
  assert.match(getReviewError({ status: 404 }, 'approve'), /not be found/i)
  assert.match(getReviewError({ status: 409 }, 'reject'), /no longer awaiting review/i)
  assert.equal(getReviewError({ message: 'Network unavailable' }, 'approve'), 'Network unavailable')
})
