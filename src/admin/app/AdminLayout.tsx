import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useAdminAuth } from '../auth/AdminAuthContext'
import { getAdminBasic, getAdminOidcToken, getPublicLiveDiagnostics, me, ping } from '../api/client'
import { useAmbientAudio } from '../../components/useAmbientAudio'

const navItems = [
  { id: 'dashboard', label: 'Control Center', to: '/admin' },
  { id: 'server-control', label: 'Server Control', to: '/admin/server-control' },
  { id: 'loadouts', label: 'Loadouts', to: '/admin/loadouts' },
  { id: 'governance', label: 'Governance', to: '/admin/governance' },
  { id: 'discord', label: 'Discord Bot', to: '/admin/discord' },
  { id: 'discord-commands', label: 'Discord Bot Commands', to: '/admin/discord-bot-commands' },
  { id: 'ops', label: 'Host Operations', to: '/admin/ops' },
  { id: 'item-codes', label: 'All Item Codes', to: '/admin/item-codes' },
  { id: 'activity', label: 'Audit Log', to: '/admin/activity' },
  { id: 'users', label: 'Users & Roles', to: '/admin/users' }
]

export function AdminLayout() {
  const location = useLocation()
  const { identity, logout, canAccess } = useAdminAuth()
  const audio = useAmbientAudio()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [authOk, setAuthOk] = useState(false)
  const [authMessage, setAuthMessage] = useState('Checking authentication…')
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [topbarStuck, setTopbarStuck] = useState(false)
  const [serviceHealth, setServiceHealth] = useState<{ tone: 'good' | 'warn' | 'bad'; label: string } | null>(null)

  async function refreshAuthHealth() {
    setCheckingAuth(true)
    const creds = getAdminBasic()
    const oidc = getAdminOidcToken()
    if (!creds && !oidc) {
      setAuthOk(false)
      setAuthMessage('Login session missing in this browser. Re-login at /admin/login.')
      setLastChecked(new Date().toLocaleTimeString())
      setCheckingAuth(false)
      return
    }

    try {
      await ping()
      const info = await me()
      setAuthOk(true)
      setAuthMessage(`Connected as ${info.user ?? 'unknown'} (${info.role ?? 'none'}).`)
      audio.playSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('401')) {
        setAuthMessage('401 Unauthorized. Re-enter your admin username/password at /admin/login.')
      } else if (message.includes('403')) {
        setAuthMessage('403 Forbidden. Your role does not allow this action.')
      } else {
        setAuthMessage(`Auth check failed: ${message}`)
      }
      setAuthOk(false)
      audio.playWarning()
    } finally {
      setLastChecked(new Date().toLocaleTimeString())
      setCheckingAuth(false)
    }
  }

  useEffect(() => {
    refreshAuthHealth()
    const timer = window.setInterval(refreshAuthHealth, 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function onScroll() {
      setTopbarStuck(window.scrollY > 4)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    let mounted = true
    const run = () => {
      getPublicLiveDiagnostics()
        .then((result) => {
          if (!mounted) return
          setServiceHealth({
            tone: result.overallOk ? 'good' : 'warn',
            label: result.overallOk ? 'Healthy' : 'Degraded'
          })
        })
        .catch(() => {
          if (!mounted) return
          setServiceHealth({ tone: 'bad', label: 'Offline' })
        })
    }
    run()
    const id = window.setInterval(run, 60000)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [])

  function closeMenu(e: React.MouseEvent) {
    const details = (e.currentTarget as HTMLElement).closest('details')
    if (details) details.removeAttribute('open')
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div>
            <div className="admin-brand-title">Grey Hour RP</div>
            <div className="admin-brand-sub">Admin Console</div>
          </div>
          <details className="admin-menu">
            <summary className="admin-menu-trigger">
              <span>Menu</span>
              <span className="admin-menu-icon" aria-hidden="true">v</span>
            </summary>
            <div className="admin-menu-panel">
              <button className="admin-menu-item" onClick={e => { closeMenu(e); logout() }}>
                Log out
              </button>
              <a className="admin-menu-item" href="/" target="_blank" rel="noreferrer" onClick={closeMenu}>
                View public site
              </a>
            </div>
          </details>
        </div>

        <div className="admin-user">
          <div className="admin-user-name">{identity.user ?? 'Unknown User'}</div>
          <div className="admin-user-role">Role: {identity.role ?? 'none'}</div>
        </div>

        <nav className="admin-nav">
          {navItems
            .filter(item => canAccess(item.id) || (item.id === 'discord-commands' && canAccess('discord')) || item.id === 'users')
            .filter(item => item.id !== 'users' || identity.role === 'owner')
            .filter(item => item.id !== 'advanced-dashboard' || identity.role === 'owner')
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
          <div className="admin-audio-box">
            <div className="admin-audio-title">Console Sound</div>
            <button className="admin-btn" onClick={() => audio.setEnabled(v => !v)}>
              {audio.enabled ? 'Disable Sound' : 'Enable Sound'}
            </button>
            <label className="admin-field" style={{ marginTop: 8 }}>
              <span>Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(audio.volume * 100)}
                onChange={e => audio.setVolume(Number(e.currentTarget.value) / 100)}
              />
            </label>
            <button className="admin-btn" onClick={() => audio.setSfxEnabled(v => !v)}>
              UI Effects: {audio.sfxEnabled ? 'On' : 'Off'}
            </button>
          </div>
          <button className="admin-btn desktop-only" onClick={logout}>
            Log out
          </button>
          <a className="admin-link muted desktop-only" href="/" target="_blank" rel="noreferrer">
            View public site
          </a>
        </div>
      </aside>

      <main className="admin-main">
        <div className={`admin-topbar ${topbarStuck ? 'stuck' : ''}`}>
          <div>
            <div className="admin-topbar-title">Simple Admin Control</div>
            <div className="admin-topbar-sub">
              Beginner-safe operations first. Advanced tools are owner-only.
            </div>
          </div>
          <div className="admin-row" style={{ marginTop: 0 }}>
            {serviceHealth && (
              <div className={`admin-status ${serviceHealth.tone}`}>
                <span className="admin-status-dot" />
                Service {serviceHealth.label}
              </div>
            )}
            <div className="admin-chip">Role: {identity.role ?? 'none'}</div>
          </div>
        </div>

        <div className={`admin-auth-status ${authOk ? 'ok' : 'bad'}`}>
          <div>
            <div className="admin-auth-title">
              Auth Status: {checkingAuth ? 'Checking…' : authOk ? 'Healthy' : 'Needs Attention'}
            </div>
            <div className="admin-auth-sub">{authMessage}</div>
            <div className="admin-auth-sub">
              Login session: {(getAdminBasic() || getAdminOidcToken()) ? 'yes' : 'no'}{lastChecked ? ` • Last check: ${lastChecked}` : ''}
            </div>
          </div>
          <button className="admin-btn" onClick={refreshAuthHealth} disabled={checkingAuth}>
            {checkingAuth ? 'Checking…' : 'Recheck Auth'}
          </button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
