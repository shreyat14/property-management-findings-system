import { useEffect } from 'react'
import { LoadingState } from '../components/LoadingState.jsx'
import { useAuth } from '../context/authContext.js'
import { AppLayout } from '../layouts/AppLayout.jsx'
import { AccessDeniedPage, NotFoundPage } from '../pages/ErrorPages.jsx'
import { LoginPage } from '../pages/LoginPage.jsx'
import { RoleDashboard } from '../pages/RoleDashboard.jsx'
import { AdminAssignmentsPage } from '../pages/admin/AdminAssignmentsPage.jsx'
import { AdminDashboard } from '../pages/admin/AdminDashboard.jsx'
import { AdminInspectorsPage } from '../pages/admin/AdminInspectorsPage.jsx'
import { AdminPropertiesPage } from '../pages/admin/AdminPropertiesPage.jsx'
import { AdminPropertyDetailPage } from '../pages/admin/AdminPropertyDetailPage.jsx'
import { CreateInspectorPage } from '../pages/admin/CreateInspectorPage.jsx'
import { CreatePropertyPage } from '../pages/admin/CreatePropertyPage.jsx'
import { CreateInspectionPage } from '../pages/inspector/CreateInspectionPage.jsx'
import { InspectionDetailPage } from '../pages/inspector/InspectionDetailPage.jsx'
import { InspectorDashboard } from '../pages/inspector/InspectorDashboard.jsx'
import { InspectorInspectionsPage } from '../pages/inspector/InspectorInspectionsPage.jsx'
import { InspectorPropertiesPage } from '../pages/inspector/InspectorPropertiesPage.jsx'
import { InspectorPropertyDetailPage } from '../pages/inspector/InspectorPropertyDetailPage.jsx'
import { ReviewerDashboard } from '../pages/reviewer/ReviewerDashboard.jsx'
import { ReviewerFindingDetailPage } from '../pages/reviewer/ReviewerFindingDetailPage.jsx'
import { ReviewerFindingsPage } from '../pages/reviewer/ReviewerFindingsPage.jsx'
import { navigate } from './navigation.js'
import { resolveRoute } from './routePolicy.js'
import { usePathname } from './usePathname.js'

function Redirect({ to }) {
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to])

  return <LoadingState label="Redirecting…" fullPage />
}

function Dashboard({ role }) {
  if (role === 'ADMIN') return <AdminDashboard />
  if (role === 'INSPECTOR') return <InspectorDashboard />
  if (role === 'REVIEWER') return <ReviewerDashboard />
  return <RoleDashboard role={role} />
}

function WorkflowPage({ page, params }) {
  switch (page) {
    case 'admin-properties': return <AdminPropertiesPage />
    case 'admin-property-new': return <CreatePropertyPage />
    case 'admin-property-detail': return <AdminPropertyDetailPage {...params} />
    case 'admin-inspectors': return <AdminInspectorsPage />
    case 'admin-inspector-new': return <CreateInspectorPage />
    case 'admin-assignments': return <AdminAssignmentsPage />
    case 'inspector-properties': return <InspectorPropertiesPage />
    case 'inspector-property-detail': return <InspectorPropertyDetailPage {...params} />
    case 'inspector-inspections': return <InspectorInspectionsPage />
    case 'inspector-inspection-new': return <CreateInspectionPage {...params} />
    case 'inspector-inspection-detail': return <InspectionDetailPage {...params} />
    case 'reviewer-findings': return <ReviewerFindingsPage />
    case 'reviewer-finding-detail': return <ReviewerFindingDetailPage {...params} />
    default: return null
  }
}

export function AppRoutes() {
  const pathname = usePathname()
  const { initializing, isAuthenticated, role } = useAuth()

  if (initializing) return <LoadingState label="Restoring your session…" fullPage />

  const route = resolveRoute(pathname, { isAuthenticated, role })
  if (route.type === 'redirect') return <Redirect to={route.to} />
  if (route.type === 'login') return <LoginPage />
  if (route.type === 'forbidden') return <AccessDeniedPage home={route.home} />
  if (route.type === 'not-found') return <NotFoundPage home={route.home} />

  return (
    <AppLayout>
      {route.type === 'dashboard'
        ? <Dashboard role={route.role} />
        : <WorkflowPage page={route.page} params={route.params} />}
    </AppLayout>
  )
}
