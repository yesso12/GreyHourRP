import { NavLink, Outlet } from 'react-router-dom'
import { useAdminAuth } from '../auth/AdminAuthContext'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', to: '/admin' },
  { id: 'transmissions', label: 'Transmissions', to: '/admin/transmissions' },
  { id: 'updates', label: 'Updates', to: '/admin/updates' },
  { id: 'server-status', label: 'Server Status', to: '/admin/server-status' },
  { id: 'status-history', label: 'Status History', to: '/admin/status-history' },
  { id: 'mods', label: 'Mods List', to: '/admin/mods' },
  { id: 'discord', label: 'Discord', to: '/admin/discord' },
  { id: 'activity', label: 'Activity Log', to: '/admin/activity' },
  { id: 'backups', label: 'Backups', to: '/admin/backups' },
  { id: 'users', label: 'Users & Roles', to: '/admin/users' }
]

export function AdminLayout() {
  const { identity, logout, canAccess } = useAdminAuth()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-title">Grey Hour RP</div>
          <div className="admin-brand-sub">Admin Console</div>
        </div>

        <div className="admin-user">
          <div className="admin-user-name">{identity.user ?? 'Unknown User'}</div>
          <div className="admin-user-role">Role: {identity.role ?? 'none'}</div>
        </div>

        <nav className="admin-nav">
          {navItems
            .filter(item => canAccess(item.id) || item.id === 'users' || item.id === 'backups')
            .filter(item => item.id !== 'users' || identity.role === 'owner')
            .filter(item => item.id !== 'backups' || identity.role === 'owner')
            .map(item => (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.id === 'dashboard'}
                className={({ isActive }) =>
                  isActive ? 'admin-link active' : 'admin-link'
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-btn" onClick={logout}>
            Log out
          </button>
          <a className="admin-link muted" href="/" target="_blank" rel="noreferrer">
            View public site
          </a>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div>
            <div className="admin-topbar-title">Enterprise Control</div>
            <div className="admin-topbar-sub">
              Manage content, operations, and staff access for Grey Hour RP.
            </div>
          </div>
          <div className="admin-chip">Role: {identity.role ?? 'none'}</div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
