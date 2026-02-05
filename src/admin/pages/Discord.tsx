import { useEffect, useState } from 'react'
import { announceDiscord, getDiscordStatus, testDiscord } from '../api/client'

const templates = [
  {
    label: 'Server Online',
    body: '✅ Grey Hour RP is now ONLINE. Connect when ready.'
  },
  {
    label: 'Maintenance',
    body: '🛠️ Grey Hour RP is in MAINTENANCE. Updates underway — progress preserved.'
  },
  {
    label: 'Major Update',
    body: '📡 New Grey Hour update live. Check #updates for details.'
  },
  {
    label: 'Event',
    body: '🔥 Grey Hour event starting soon. Check #announcements for details.'
  }
]

export function AdminDiscord() {
  const [message, setMessage] = useState('')
  const [mentionEveryone, setMentionEveryone] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    getDiscordStatus()
      .then(res => setConfigured(res.enabled))
      .catch(() => setConfigured(false))
  }, [])

  async function send() {
    if (!message.trim()) return
    setStatus('sending')
    setError(null)
    try {
      await announceDiscord(message.trim(), mentionEveryone)
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      setStatus('error')
      setError(String(err))
    }
  }

  async function sendTest() {
    setStatus('sending')
    setError(null)
    try {
      await testDiscord()
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      setStatus('error')
      setError(String(err))
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Discord</div>
          <h1>Discord Announcements</h1>
          <p className="admin-sub">Send broadcast messages to your Discord community.</p>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-grid two">
          <div className="admin-field">
            <span>Webhook Status</span>
            <div className="admin-text">
              {configured === null ? 'Checking…' : configured ? 'Connected' : 'Not configured'}
            </div>
          </div>
          <div className="admin-field">
            <span>Action</span>
            <button className="admin-btn" onClick={sendTest}>Send Test Ping</button>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <label className="admin-field">
          <span>Message</span>
          <textarea
            className="admin-textarea"
            rows={6}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Write your announcement…"
          />
        </label>

        <label className="admin-field checkbox" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={mentionEveryone}
            onChange={e => setMentionEveryone(e.target.checked)}
          />
          <span>Allow @everyone mention</span>
        </label>

        <div className="admin-row">
          <button className="admin-btn primary" onClick={send} disabled={!message.trim() || status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send announcement'}
          </button>
        </div>

        {status === 'sent' && <div className="admin-hint">Announcement sent.</div>}
        {status === 'error' && <div className="admin-error">{error}</div>}
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Quick Templates</h2>
        </div>
        <div className="admin-grid two">
          {templates.map((t) => (
            <div key={t.label} className="admin-card">
              <div style={{ fontWeight: 700 }}>{t.label}</div>
              <div className="p" style={{ marginTop: 8 }}>{t.body}</div>
              <div className="admin-row">
                <button className="admin-btn" onClick={() => setMessage(t.body)}>
                  Use template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
