export const ROLE_NAVIGATION = Object.freeze({
  ADMIN: [
    { label: 'Properties', path: '/admin/properties' },
    { label: 'Inspectors', path: '/admin/inspectors' },
    { label: 'Assignments', path: '/admin/assignments' },
  ],
  INSPECTOR: [
    { label: 'My Properties', path: '/inspector/properties' },
    { label: 'Inspections', path: '/inspector/inspections' },
  ],
  REVIEWER: [{ label: 'Findings to Review', path: '/reviewer/findings' }],
})
