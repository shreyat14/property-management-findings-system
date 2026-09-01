import assert from 'node:assert/strict'
import test from 'node:test'
import { createInspector } from '../src/api/inspectorsApi.js'
import { analyzeFinding } from '../src/api/aiApi.js'
import {
  approveFinding,
  createFinding,
  getFinding,
  getFindingPhoto,
  listReviewFindings,
  listInspectionFindings,
  rejectFinding,
  submitFinding,
  updateFinding,
  uploadFindingPhoto,
} from '../src/api/findingsApi.js'
import { completeInspection, createInspection } from '../src/api/inspectionsApi.js'
import {
  assignInspector,
  createProperty,
  listProperties,
} from '../src/api/propertiesApi.js'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
let requests
let responseBody

test.beforeEach(() => {
  requests = []
  responseBody = {}
  globalThis.window = {
    dispatchEvent() {},
    localStorage: {
      getItem(key) {
        return key === 'property-findings.auth-token' ? 'test-token' : null
      },
    },
  }
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
})

test.after(() => {
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
})

function assertAuthenticatedJsonRequest(request, { path, method, body }) {
  assert.equal(request.url, `http://localhost:3000/api/v1${path}`)
  assert.equal(request.options.method, method)
  assert.equal(request.options.headers.get('Authorization'), 'Bearer test-token')
  assert.equal(request.options.headers.get('Content-Type'), 'application/json')
  assert.deepEqual(JSON.parse(request.options.body), body)
}

test('property creation uses the backend property contract', async () => {
  responseBody = { property: { id: 'property-a', name: 'Maple Court', address: '1 Main St' } }
  const property = await createProperty({ name: 'Maple Court', address: '1 Main St' })

  assert.equal(property.id, 'property-a')
  assertAuthenticatedJsonRequest(requests[0], {
    path: '/properties',
    method: 'POST',
    body: { name: 'Maple Court', address: '1 Main St' },
  })
})

test('Inspector creation sends email and password without a role', async () => {
  responseBody = { inspector: { id: 'inspector-a', email: 'inspector@example.com', role: 'INSPECTOR' } }
  await createInspector({ email: 'inspector@example.com', password: 'Temporary123!' })

  assertAuthenticatedJsonRequest(requests[0], {
    path: '/users/inspectors',
    method: 'POST',
    body: { email: 'inspector@example.com', password: 'Temporary123!' },
  })
  assert.equal('role' in JSON.parse(requests[0].options.body), false)
})

test('property assignment uses the existing nested assignment contract', async () => {
  responseBody = { assignment: { propertyId: 'property a', inspectorId: 'inspector-a' } }
  await assignInspector('property a', 'inspector-a')

  assertAuthenticatedJsonRequest(requests[0], {
    path: '/properties/property%20a/inspectors',
    method: 'POST',
    body: { inspectorId: 'inspector-a' },
  })
})

test('assigned-property retrieval uses the authenticated property list', async () => {
  responseBody = { properties: [{ id: 'assigned-property' }] }
  const properties = await listProperties()

  assert.deepEqual(properties, [{ id: 'assigned-property' }])
  assert.equal(requests[0].url, 'http://localhost:3000/api/v1/properties')
  assert.equal(requests[0].options.method, 'GET')
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer test-token')
})

test('inspection creation sends only the assigned property ID', async () => {
  responseBody = { inspection: { id: 'inspection-a', propertyId: 'property-a', status: 'IN_PROGRESS' } }
  await createInspection('property-a')

  assertAuthenticatedJsonRequest(requests[0], {
    path: '/inspections',
    method: 'POST',
    body: { propertyId: 'property-a' },
  })
})

test('inspection completion posts to the authenticated completion endpoint without a body', async () => {
  responseBody = {
    inspection: {
      id: 'inspection a',
      propertyId: 'property-a',
      status: 'COMPLETED',
      completedAt: '2026-08-31T12:00:00.000Z',
    },
  }
  const inspection = await completeInspection('inspection a')

  assert.equal(inspection.status, 'COMPLETED')
  assert.equal(requests[0].url, 'http://localhost:3000/api/v1/inspections/inspection%20a/complete')
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.body, undefined)
  assert.equal(requests[0].options.headers.get('Content-Type'), null)
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer test-token')
})

test('finding listing and creation use the nested inspection contract', async () => {
  responseBody = { findings: [{ id: 'finding-a' }] }
  assert.deepEqual(await listInspectionFindings('inspection a'), [{ id: 'finding-a' }])
  assert.equal(requests[0].url, 'http://localhost:3000/api/v1/inspections/inspection%20a/findings')

  const findingInput = {
    area: 'KITCHEN',
    category: 'PLUMBING',
    issue: 'Leaking faucet',
    severity: 'MEDIUM',
    description: 'Water is visible below the faucet handle.',
    recommendedAction: 'Repair the faucet and verify that the leak has stopped.',
  }
  responseBody = { finding: { id: 'finding-a', ...findingInput, status: 'DRAFT' } }
  const finding = await createFinding('inspection a', findingInput)

  assert.equal(finding.status, 'DRAFT')
  assertAuthenticatedJsonRequest(requests[1], {
    path: '/inspections/inspection%20a/findings',
    method: 'POST',
    body: findingInput,
  })
})

test('Finding editing uses the authorized PATCH content contract', async () => {
  const findingInput = {
    area: 'BATHROOM',
    category: 'PLUMBING',
    issue: 'Updated leak location',
    severity: 'HIGH',
    description: 'The leak is below the sink supply connection.',
    recommendedAction: 'Repair the supply connection and test it.',
  }
  responseBody = { finding: { id: 'finding a', ...findingInput, status: 'DRAFT' } }

  const finding = await updateFinding('finding a', findingInput)

  assert.equal(finding.status, 'DRAFT')
  assertAuthenticatedJsonRequest(requests[0], {
    path: '/findings/finding%20a',
    method: 'PATCH',
    body: findingInput,
  })
})

test('AI analysis is multipart-only and does not make a Finding request', async () => {
  const photo = new File(['image-bytes'], 'inspection.jpg', { type: 'image/jpeg' })
  responseBody = {
    suggestion: {
      area: 'EXTERIOR',
      category: 'STRUCTURAL',
      issue: 'Visible crack',
      severity: 'MEDIUM',
      description: 'A crack is visible beside the window.',
      recommendedAction: 'Have the area evaluated.',
    },
  }
  const suggestion = await analyzeFinding(photo, '  Crack beside window  ')

  assert.equal(suggestion.issue, 'Visible crack')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'http://localhost:3000/api/v1/ai/analyze-finding')
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer test-token')
  assert.equal(requests[0].options.headers.get('Content-Type'), null)
  assert.equal(requests[0].options.body.get('observation'), 'Crack beside window')
  assert.equal(requests[0].options.body.get('photo').name, 'inspection.jpg')
})

test('finding photo upload uses the post-creation photo endpoint and photo field', async () => {
  const photo = new File(['image-bytes'], 'client-name.webp', { type: 'image/webp' })
  responseBody = { finding: { id: 'finding a', status: 'DRAFT', photoPath: 'uploads/findings/server.webp' } }
  const finding = await uploadFindingPhoto('finding a', photo)

  assert.equal(finding.photoPath, 'uploads/findings/server.webp')
  assert.equal(requests[0].url, 'http://localhost:3000/api/v1/findings/finding%20a/photo')
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.headers.get('Content-Type'), null)
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer test-token')
  assert.equal(requests[0].options.body.get('photo').name, 'client-name.webp')
  assert.deepEqual([...requests[0].options.body.keys()], ['photo'])
})

test('finding photo retrieval uses authenticated binary response handling', async () => {
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return new Response(new Blob(['image-bytes'], { type: 'image/jpeg' }), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    })
  }

  const photo = await getFindingPhoto('finding a')

  assert.equal(photo.type, 'image/jpeg')
  assert.equal(requests[0].url, 'http://localhost:3000/api/v1/findings/finding%20a/photo')
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer test-token')
  assert.equal(requests[0].options.headers.get('Accept'), 'image/*')
})

test('finding submission posts to the authenticated transition endpoint without a body', async () => {
  responseBody = {
    finding: {
      id: 'finding a',
      issue: 'Leaking faucet',
      status: 'SUBMITTED',
    },
  }
  const finding = await submitFinding('finding a')

  assert.equal(finding.status, 'SUBMITTED')
  assert.equal(requests[0].url, 'http://localhost:3000/api/v1/findings/finding%20a/submit')
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.body, undefined)
  assert.equal(requests[0].options.headers.get('Content-Type'), null)
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer test-token')
})

test('Reviewer finding listing and details use the authenticated read contracts', async () => {
  responseBody = { findings: [{ id: 'submitted-a', status: 'SUBMITTED' }] }
  const findings = await listReviewFindings()

  assert.deepEqual(findings, [{ id: 'submitted-a', status: 'SUBMITTED' }])
  assert.equal(requests[0].url, 'http://localhost:3000/api/v1/findings')
  assert.equal(requests[0].options.method, 'GET')
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer test-token')

  responseBody = { finding: { id: 'finding a', status: 'SUBMITTED' } }
  const finding = await getFinding('finding a')

  assert.equal(finding.id, 'finding a')
  assert.equal(requests[1].url, 'http://localhost:3000/api/v1/findings/finding%20a')
  assert.equal(requests[1].options.method, 'GET')
  assert.equal(requests[1].options.headers.get('Authorization'), 'Bearer test-token')
})

test('Reviewer approval and rejection use bodyless authenticated transition requests', async () => {
  responseBody = { finding: { id: 'finding a', status: 'APPROVED' } }
  const approved = await approveFinding('finding a')

  assert.equal(approved.status, 'APPROVED')
  assert.equal(requests[0].url, 'http://localhost:3000/api/v1/findings/finding%20a/approve')
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.body, undefined)
  assert.equal(requests[0].options.headers.get('Content-Type'), null)
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer test-token')

  responseBody = { finding: { id: 'finding a', status: 'DRAFT' } }
  const rejected = await rejectFinding('finding a')

  assert.equal(rejected.status, 'DRAFT')
  assert.equal(requests[1].url, 'http://localhost:3000/api/v1/findings/finding%20a/reject')
  assert.equal(requests[1].options.method, 'POST')
  assert.equal(requests[1].options.body, undefined)
  assert.equal(requests[1].options.headers.get('Content-Type'), null)
  assert.equal(requests[1].options.headers.get('Authorization'), 'Bearer test-token')
})
