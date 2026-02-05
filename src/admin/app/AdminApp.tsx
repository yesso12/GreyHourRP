import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAdmin } from '../auth/RequireAdmin'
import { AdminLayout } from './AdminLayout'

import { AdminLogin } from '../pages/Login'
import { AdminDashboard } from '../pages/Dashboard'
import { AdminTransmissions } from '../pages/Transmissions'
import { AdminUpdates } from '../pages/Updates'
import { AdminServerStatus } from '../pages/ServerStatus'
import { AdminStatusHistory } from '../pages/StatusHistory'
import { AdminMods } from '../pages/Mods'
import { AdminUsers } from '../pages/Users'
import { AdminBackups } from '../pages/Backups'
import { AdminActivity } from '../pages/Activity'
import { AdminDiscord } from '../pages/Discord'

export function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />
      <Route
        path="/"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="transmissions" element={<AdminTransmissions />} />
        <Route path="updates" element={<AdminUpdates />} />
        <Route path="server-status" element={<AdminServerStatus />} />
        <Route path="status-history" element={<AdminStatusHistory />} />
        <Route path="mods" element={<AdminMods />} />
        <Route path="activity" element={<AdminActivity />} />
        <Route path="backups" element={<AdminBackups />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="discord" element={<AdminDiscord />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
