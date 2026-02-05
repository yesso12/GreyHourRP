import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SiteShell } from './components/SiteShell'

import { Home } from './pages/Home'
import { Mods } from './pages/Mods'
import { Updates } from './pages/Updates'
import { Rules } from './pages/Rules'
import { Status } from './pages/Status'
import { About } from './pages/About'
import { HowToJoin } from './pages/HowToJoin'
import { Discord } from './pages/Discord'
import { Staff } from './pages/Staff'
import { Transmissions } from './pages/Transmissions'

import { AdminApp } from './admin/app/AdminApp'
import { AdminAuthProvider } from './admin/auth/AdminAuthContext'

function PublicRoutes() {
  return (
    <SiteShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mods" element={<Mods />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/status" element={<Status />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-to-join" element={<HowToJoin />} />
        <Route path="/discord" element={<Discord />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/transmissions" element={<Transmissions />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </SiteShell>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <AdminAuthProvider>
              <AdminApp />
            </AdminAuthProvider>
          }
        />
        <Route path="/*" element={<PublicRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}
