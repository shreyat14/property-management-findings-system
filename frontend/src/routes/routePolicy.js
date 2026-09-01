export const ROLE_PATHS = Object.freeze({
  ADMIN: '/admin',
  INSPECTOR: '/inspector',
  REVIEWER: '/reviewer',
})

const STATIC_ROUTES = new Map([
  ['/admin/properties', { page: 'admin-properties', role: 'ADMIN' }],
  ['/admin/properties/new', { page: 'admin-property-new', role: 'ADMIN' }],
  ['/admin/inspectors', { page: 'admin-inspectors', role: 'ADMIN' }],
  ['/admin/inspectors/new', { page: 'admin-inspector-new', role: 'ADMIN' }],
  ['/admin/assignments', { page: 'admin-assignments', role: 'ADMIN' }],
  ['/inspector/properties', { page: 'inspector-properties', role: 'INSPECTOR' }],
  ['/inspector/inspections', { page: 'inspector-inspections', role: 'INSPECTOR' }],
  ['/reviewer/findings', { page: 'reviewer-findings', role: 'REVIEWER' }],
])

const DYNAMIC_ROUTES = [
  { pattern: /^\/admin\/properties\/([^/]+)$/, page: 'admin-property-detail', role: 'ADMIN', param: 'propertyId' },
  { pattern: /^\/inspector\/properties\/([^/]+)\/inspections\/new$/, page: 'inspector-inspection-new', role: 'INSPECTOR', param: 'propertyId' },
  { pattern: /^\/inspector\/properties\/([^/]+)$/, page: 'inspector-property-detail', role: 'INSPECTOR', param: 'propertyId' },
  { pattern: /^\/inspector\/inspections\/([^/]+)$/, page: 'inspector-inspection-detail', role: 'INSPECTOR', param: 'inspectionId' },
  { pattern: /^\/reviewer\/findings\/([^/]+)$/, page: 'reviewer-finding-detail', role: 'REVIEWER', param: 'findingId' },
]

export function isSupportedRole(role) {
  return Object.hasOwn(ROLE_PATHS, role)
}

export function getRoleHome(role) {
  return ROLE_PATHS[role] ?? null
}

export function getRequiredRole(pathname) {
  return Object.entries(ROLE_PATHS).find(
    ([, path]) => pathname === path || pathname.startsWith(`${path}/`),
  )?.[0] ?? null
}

export function matchWorkflowRoute(pathname) {
  const staticRoute = STATIC_ROUTES.get(pathname)
  if (staticRoute) return { ...staticRoute, params: {} }

  for (const route of DYNAMIC_ROUTES) {
    const match = pathname.match(route.pattern)
    if (!match) continue

    try {
      return {
        page: route.page,
        role: route.role,
        params: { [route.param]: decodeURIComponent(match[1]) },
      }
    } catch {
      return null
    }
  }

  return null
}

export function resolveRoute(pathname, { isAuthenticated, role }) {
  const home = getRoleHome(role)

  if (pathname === '/login') {
    return isAuthenticated && home ? { type: 'redirect', to: home } : { type: 'login' }
  }

  if (pathname === '/') {
    return { type: 'redirect', to: isAuthenticated && home ? home : '/login' }
  }

  const requiredRole = getRequiredRole(pathname)
  if (requiredRole) {
    if (!isAuthenticated) return { type: 'redirect', to: '/login' }
    if (role !== requiredRole) return { type: 'forbidden', home }
    if (pathname === ROLE_PATHS[requiredRole]) return { type: 'dashboard', role }

    const workflowRoute = matchWorkflowRoute(pathname)
    return workflowRoute
      ? { type: 'workflow', page: workflowRoute.page, params: workflowRoute.params }
      : { type: 'not-found', home }
  }

  return { type: 'not-found', home: isAuthenticated ? home : '/login' }
}
