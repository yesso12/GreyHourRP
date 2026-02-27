import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../auth/AdminAuthContext'

export function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { login } = useAdminAuth()
  const navigate = useNavigate()

  async function submit() {
    if (!username.trim() || !password) {
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
      setError('Invalid credentials or access not permitted.')
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
        />

        <label className="admin-label">Password</label>
        <input
          type="password"
          className="admin-input"
          placeholder="Enter password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />

        {error && <div className="admin-error">{error}</div>}

        <button className="admin-btn primary" onClick={submit} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="admin-hint">
          This panel requires a valid staff username/password.
        </div>
      </div>
    </div>
  )
}
