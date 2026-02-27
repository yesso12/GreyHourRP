import { Navigate } from 'react-router-dom'
import { useAdminAuth } from './AdminAuthContext'

export function RequireOwner({ children }: { children: JSX.Element }) {
  const { checking, loggedIn, identity } = useAdminAuth()

  if (checking) {
    return (
      <div className="admin-screen">
        <div className="admin-card">
          <div className="admin-title">Checking owner access…</div>
          <div className="admin-sub">Please wait.</div>
        </div>
      </div>
    )
  }

  if (!loggedIn) return <Navigate to="/admin/login" replace />
  if (identity.role !== 'owner') return <Navigate to="/admin" replace />
  return children
}
