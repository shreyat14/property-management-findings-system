import { useState } from 'react'
import { Brand } from '../components/Brand.jsx'
import { DashboardIcon, ListIcon, MenuIcon } from '../components/Icons.jsx'
import { useAuth } from '../context/authContext.js'
import { Link } from '../routes/Link.jsx'
import { getRoleHome } from '../routes/routePolicy.js'
import { ROLE_NAVIGATION } from '../routes/roleNavigation.js'
import { usePathname } from '../routes/usePathname.js'

export function AppLayout({ children }) {
  const { user, role, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase()
  const initials = user.email.slice(0, 2).toUpperCase()

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <Brand />
        <nav className="sidebar-nav" aria-label={`${roleLabel} navigation`}>
          <Link className={`sidebar-nav__link${pathname === getRoleHome(role) ? ' sidebar-nav__link--active' : ''}`} to={getRoleHome(role)} aria-current={pathname === getRoleHome(role) ? 'page' : undefined} onClick={() => setSidebarOpen(false)}>
            <span className="nav-label"><DashboardIcon />Dashboard</span>
          </Link>
          {ROLE_NAVIGATION[role].map((item) => item.path ? (
            <Link className={`sidebar-nav__link${pathname.startsWith(item.path) ? ' sidebar-nav__link--active' : ''}`} key={item.label} to={item.path} aria-current={pathname.startsWith(item.path) ? 'page' : undefined} onClick={() => setSidebarOpen(false)}>
              <span className="nav-label"><ListIcon />{item.label}</span>
            </Link>
          ) : (
            <span className="sidebar-nav__link sidebar-nav__link--disabled" key={item.label} aria-disabled="true">
              <span className="nav-label"><ListIcon />{item.label}</span><span className="coming-soon">Soon</span>
            </span>
          ))}
        </nav>
        <p className="sidebar__footer">Internal inspection workspace</p>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="menu-button" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <MenuIcon />
          </button>
          <p className="topbar__title">{roleLabel} workspace</p>
          <div className="topbar__actions">
            <div className="user-summary">
              <span className="user-summary__avatar" aria-hidden="true">{initials}</span>
              <span className="user-summary__identity">
                <span className="user-summary__email">{user.email}</span>
                <span className="role-badge">{role}</span>
              </span>
            </div>
            <button className="logout-button" type="button" onClick={logout}>Log out</button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
