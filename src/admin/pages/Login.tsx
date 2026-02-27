import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completePasswordReset, setAdminOidcToken } from '../api/client'
import { useAdminAuth } from '../auth/AdminAuthContext'
import { beginOidcLogin, exchangeOidcCode, isOidcConfigured } from '../auth/oidc'

export function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [resetUser, setResetUser] = useState('')
  const [resetTicketId, setResetTicketId] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [error, setError] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const { login, loginWithOidcToken } = useAdminAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) return

    setBusy(true)
    setError('')

    exchangeOidcCode(code, state)
      .then(async (token) => {
        setAdminOidcToken(token)
        const ok = await loginWithOidcToken(token)
        if (!ok) {
          setError('SSO login succeeded, but your account has no admin role access.')
          return
        }
        navigate('/admin', { replace: true })
      })
      .catch((err) => {
        const detail = err instanceof Error ? err.message : String(err)
        setError(`SSO login failed. ${detail}`)
      })
      .finally(() => {
        setBusy(false)
        window.history.replaceState({}, document.title, '/admin/login')
      })
  }, [loginWithOidcToken, navigate])

  async function submit() {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.')
      return
    }

    setBusy(true)
    setError('')
    const ok = await login(username.trim(), password)
    setBusy(false)

    if (ok) {
      navigate('/admin')
    } else {
      setError('Invalid username/password or access not permitted.')
    }
  }

  async function sso() {
    try {
      setBusy(true)
      setError('')
      await beginOidcLogin()
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setError(`Unable to start SSO login. ${detail}`)
      setBusy(false)
    }
  }

  async function submitReset() {
    if (!resetUser.trim() || !resetTicketId.trim() || !resetCode.trim() || !resetNewPassword.trim()) {
      setError('Reset requires username, ticket ID, recovery code, and new password.')
      return
    }
    setBusy(true)
    setError('')
    setResetMessage('')
    try {
      await completePasswordReset(
        resetUser.trim(),
        resetTicketId.trim(),
        resetCode.trim(),
        resetNewPassword
      )
      setResetMessage('Password reset complete. Sign in with your new password.')
      setResetTicketId('')
      setResetCode('')
      setResetNewPassword('')
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setError(`Password reset failed. ${detail}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-screen">
      <div className="admin-card">
        <div className="admin-title">Grey Hour RP Admin</div>
        <div className="admin-sub">Secure access for staff and operators.</div>

        <label className="admin-label">Username</label>
        <input
          type="text"
          className="admin-input"
          placeholder="Enter admin username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoComplete="username"
        />

        <label className="admin-label" style={{ marginTop: 10 }}>Password</label>
        <input
          type="password"
          className="admin-input"
          placeholder="Enter admin password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoComplete="current-password"
        />

        {error && <div className="admin-error">{error}</div>}
        {resetMessage && <div className="admin-hint">{resetMessage}</div>}

        <button className="admin-btn primary" onClick={submit} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {isOidcConfigured() && (
          <button className="admin-btn" onClick={sso} disabled={busy} style={{ marginTop: 10 }}>
            {busy ? 'Starting SSO…' : 'Sign in with SSO'}
          </button>
        )}

        <div className="admin-hint">
          Standard web login. Credentials are kept only in this browser session.
          {isOidcConfigured() ? ' OIDC SSO is enabled for enterprise login.' : ''}
        </div>

        <div className="admin-section" style={{ marginTop: 16 }}>
          <div className="admin-eyebrow">Secure Recovery</div>
          <div className="admin-hint" style={{ marginTop: 6 }}>
            Requires an owner-issued reset ticket and recovery code.
          </div>

          <label className="admin-label" style={{ marginTop: 10 }}>Username</label>
          <input
            type="text"
            className="admin-input"
            value={resetUser}
            onChange={e => setResetUser(e.target.value)}
            placeholder="username"
          />

          <label className="admin-label" style={{ marginTop: 10 }}>Ticket ID</label>
          <input
            type="text"
            className="admin-input"
            value={resetTicketId}
            onChange={e => setResetTicketId(e.target.value)}
            placeholder="rst_xxx"
          />

          <label className="admin-label" style={{ marginTop: 10 }}>Recovery Code</label>
          <input
            type="text"
            className="admin-input"
            value={resetCode}
            onChange={e => setResetCode(e.target.value)}
            placeholder="one-time code"
          />

          <label className="admin-label" style={{ marginTop: 10 }}>New Password</label>
          <input
            type="password"
            className="admin-input"
            value={resetNewPassword}
            onChange={e => setResetNewPassword(e.target.value)}
            placeholder="new password (10+ chars)"
          />

          <button className="admin-btn" onClick={submitReset} disabled={busy} style={{ marginTop: 10 }}>
            {busy ? 'Submitting…' : 'Complete Password Reset'}
          </button>
        </div>
      </div>
    </div>
  )
}
