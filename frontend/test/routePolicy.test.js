import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRequiredRole,
  getRoleHome,
  matchWorkflowRoute,
  resolveRoute,
} from '../src/routes/routePolicy.js'

const roles = [
  ['ADMIN', '/admin'],
  ['INSPECTOR', '/inspector'],
  ['REVIEWER', '/reviewer'],
]

test('maps every backend role to its intended dashboard', () => {
  for (const [role, path] of roles) {
    assert.equal(getRoleHome(role), path)
    assert.equal(getRequiredRole(path), role)
  }
})

test('redirects unauthenticated protected routes to login', () => {
  for (const [, path] of roles) {
    assert.deepEqual(
      resolveRoute(path, { isAuthenticated: false, role: null }),
      { type: 'redirect', to: '/login' },
    )
  }
})

test('allows each role into only its matching dashboard', () => {
  for (const [role, path] of roles) {
    assert.deepEqual(
      resolveRoute(path, { isAuthenticated: true, role }),
      { type: 'dashboard', role },
    )

    for (const [otherRole, otherPath] of roles) {
      if (otherRole !== role) {
        assert.deepEqual(
          resolveRoute(otherPath, { isAuthenticated: true, role }),
          { type: 'forbidden', home: path },
        )
      }
    }
  }
})

test('keeps authenticated users away from the login page', () => {
  for (const [role, path] of roles) {
    assert.deepEqual(
      resolveRoute('/login', { isAuthenticated: true, role }),
      { type: 'redirect', to: path },
    )
  }
})

test('maps Admin workflow routes and dynamic property IDs', () => {
  assert.deepEqual(
    resolveRoute('/admin/properties', { isAuthenticated: true, role: 'ADMIN' }),
    { type: 'workflow', page: 'admin-properties', params: {} },
  )
  assert.deepEqual(matchWorkflowRoute('/admin/properties/property%201'), {
    page: 'admin-property-detail',
    role: 'ADMIN',
    params: { propertyId: 'property 1' },
  })
  assert.deepEqual(
    resolveRoute('/admin/inspectors/new', { isAuthenticated: true, role: 'ADMIN' }),
    { type: 'workflow', page: 'admin-inspector-new', params: {} },
  )
  assert.deepEqual(
    resolveRoute('/admin/assignments', { isAuthenticated: true, role: 'ADMIN' }),
    { type: 'workflow', page: 'admin-assignments', params: {} },
  )
})

test('maps Inspector workflow routes and dynamic resource IDs', () => {
  assert.deepEqual(
    resolveRoute('/inspector/properties', { isAuthenticated: true, role: 'INSPECTOR' }),
    { type: 'workflow', page: 'inspector-properties', params: {} },
  )
  assert.deepEqual(
    resolveRoute('/inspector/properties/property-a/inspections/new', {
      isAuthenticated: true,
      role: 'INSPECTOR',
    }),
    {
      type: 'workflow',
      page: 'inspector-inspection-new',
      params: { propertyId: 'property-a' },
    },
  )
  assert.deepEqual(
    resolveRoute('/inspector/inspections/inspection-a', {
      isAuthenticated: true,
      role: 'INSPECTOR',
    }),
    {
      type: 'workflow',
      page: 'inspector-inspection-detail',
      params: { inspectionId: 'inspection-a' },
    },
  )
})

test('maps Reviewer queue and Finding detail routes', () => {
  assert.deepEqual(
    resolveRoute('/reviewer/findings', { isAuthenticated: true, role: 'REVIEWER' }),
    { type: 'workflow', page: 'reviewer-findings', params: {} },
  )
  assert.deepEqual(
    resolveRoute('/reviewer/findings/finding%201', { isAuthenticated: true, role: 'REVIEWER' }),
    {
      type: 'workflow',
      page: 'reviewer-finding-detail',
      params: { findingId: 'finding 1' },
    },
  )
})

test('protects every workflow from unauthenticated and wrong-role users', () => {
  const routes = [
    ['/admin/properties', 'INSPECTOR', '/inspector'],
    ['/admin/inspectors', 'REVIEWER', '/reviewer'],
    ['/inspector/properties', 'ADMIN', '/admin'],
    ['/inspector/inspections', 'REVIEWER', '/reviewer'],
    ['/reviewer/findings', 'INSPECTOR', '/inspector'],
    ['/reviewer/findings/finding-a', 'ADMIN', '/admin'],
  ]

  for (const [pathname, wrongRole, home] of routes) {
    assert.deepEqual(
      resolveRoute(pathname, { isAuthenticated: false, role: null }),
      { type: 'redirect', to: '/login' },
    )
    assert.deepEqual(
      resolveRoute(pathname, { isAuthenticated: true, role: wrongRole }),
      { type: 'forbidden', home },
    )
  }
})
