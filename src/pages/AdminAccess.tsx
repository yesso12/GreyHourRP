import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearAdminSession, me, ping, setAdminBasic } from '../admin/api/client'
import { Section } from '../components/Section'

export function AdminAccess() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  async function submit() {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      setAdminBasic(username.trim(), password)
      await ping()
      const info = await me()
      setMessage(`Authenticated as ${info.user ?? 'staff'} (${info.role ?? 'unknown'}). Redirecting…`)
      window.setTimeout(() => navigate('/admin'), 500)
    } catch (err) {
      clearAdminSession()
      const detail = err instanceof Error ? err.message : String(err)
      setError(`Login failed. Verify your username/password and try again. ${detail}`)
    } finally {
      setBusy(false)
    }
  }

  async function triggerPrompt() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await ping()
      setMessage('Auth check reached the API.')
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setError(`Auth check failed. ${detail}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section eyebrow="Staff Portal" title="Admin Access">
      <p className="p" style={{ marginTop: 0, marginBottom: 14 }}>
        Staff login from the public site with normal username/password credentials.
      </p>
      <div className="card" style={{ maxWidth: 640 }}>
        <ol className="small" style={{ marginTop: 0, marginBottom: 14, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Enter your admin username and password below.</li>
          <li>Press Sign in to open the admin dashboard.</li>
        </ol>

        <p className="p" style={{ marginTop: 0 }}>
          Credentials are kept in this browser session only.
        </p>

        <label className="small" htmlFor="admin-user-input">Username</label>
        <input
          id="admin-user-input"
          type="text"
          className="input"
          placeholder="Admin username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ width: '100%', marginTop: 8 }}
          autoComplete="username"
        />

        <label className="small" htmlFor="admin-pass-input" style={{ marginTop: 10, display: 'block' }}>
          Password
        </label>
        <input
          id="admin-pass-input"
          type="password"
          className="input"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ width: '100%', marginTop: 8 }}
          autoComplete="current-password"
        />

          {error && (
            <div className="small" style={{ marginTop: 12, color: 'var(--bad)' }}>
              {error}
            </div>
          )}
          {message && (
            <div className="small" style={{ marginTop: 12, color: 'var(--good)' }}>
              {message}
            </div>
          )}

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to Admin'}
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/admin/login')} disabled={busy}>
            Use SSO
          </button>
          <button className="btn btn-ghost" onClick={triggerPrompt} disabled={busy}>
            Check Basic Auth
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearAdminSession()
              setUsername('')
              setPassword('')
              setMessage('')
              setError('')
            }}
            disabled={busy}
          >
            Clear session
          </button>
        </div>
      </div>
    </Section>
  )
}
