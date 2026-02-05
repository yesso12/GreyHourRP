import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../auth/AdminAuthContext'

export function AdminLogin() {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { login } = useAdminAuth()
  const navigate = useNavigate()

  async function submit() {
    if (!key.trim()) {
      setError('Admin key is required.')
      return
    }

    setBusy(true)
    setError('')
    const ok = await login(key.trim())
    setBusy(false)

    if (ok) {
      navigate('/admin')
    } else {
      setError('Invalid admin key or access not permitted.')
    }
  }

  return (
    <div className="admin-screen">
      <div className="admin-card">
        <div className="admin-title">Grey Hour RP Admin</div>
        <div className="admin-sub">Secure access for staff and operators.</div>

        <label className="admin-label">Admin API Key</label>
        <input
          type="password"
          className="admin-input"
          placeholder="Paste your admin key"
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />

        {error && <div className="admin-error">{error}</div>}

        <button className="admin-btn primary" onClick={submit} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="admin-hint">
          This panel requires HTTP Basic access plus a valid API key.
        </div>
      </div>
    </div>
  )
}
