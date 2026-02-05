import { Navigate } from 'react-router-dom'
import { useAdminAuth } from './AdminAuthContext'

export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { checking, loggedIn } = useAdminAuth()

  if (checking) {
    return (
      <div className="admin-screen">
        <div className="admin-card">
          <div className="admin-title">Checking admin access…</div>
          <div className="admin-sub">Please wait.</div>
        </div>
      </div>
    )
  }

  if (!loggedIn) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}
