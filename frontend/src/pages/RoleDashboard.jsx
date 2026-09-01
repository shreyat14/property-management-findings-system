import { EmptyState } from '../components/EmptyState.jsx'
import { PageHeader } from '../components/PageHeader.jsx'

const CONTENT = {
  ADMIN: {
    title: 'Admin dashboard',
    description: 'Your workspace for overseeing properties, inspectors, and assignments.',
    emptyTitle: 'Administration tools are coming next',
    emptyDescription: 'Property, inspector, and assignment management will be added in later implementation tasks.',
  },
  INSPECTOR: {
    title: 'Inspector dashboard',
    description: 'Your workspace for assigned properties and inspection activity.',
    emptyTitle: 'Your inspection workspace is ready',
    emptyDescription: 'Assigned properties and inspection workflows will appear here when those features are implemented.',
  },
  REVIEWER: {
    title: 'Reviewer dashboard',
    description: 'Your workspace for reviewing submitted inspection findings.',
    emptyTitle: 'Your review workspace is ready',
    emptyDescription: 'Submitted findings and review actions will appear here in a later implementation task.',
  },
}

export function RoleDashboard({ role }) {
  const content = CONTENT[role]

  return (
    <>
      <PageHeader eyebrow={role} title={content.title} description={content.description} />
      <EmptyState title={content.emptyTitle} description={content.emptyDescription} />
    </>
  )
}
