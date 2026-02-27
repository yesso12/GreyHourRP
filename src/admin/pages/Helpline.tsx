import { useEffect, useMemo, useState } from 'react'
import type { HelplineScripts } from '../../types/content'
import { loadHelplineScripts, saveHelplineScripts } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

type ScriptScope = 'staff' | 'owner'

function defaultScripts(): HelplineScripts {
  return {
    updatedUtc: new Date().toISOString(),
    staff: {
      ticket: [
        'Thanks for opening a ticket. We’re on it and will follow up soon.',
        'To help us resolve this fast, share any details you can (time, place, who).',
        'Please stay in this channel while we review.'
      ]
    },
    owner: {
      announcement: [
        'Official notice: we’re aware of the issue and investigating.',
        'We’ll share updates here as soon as we have confirmed details.',
        'Thank you for your patience while staff resolves this.'
      ]
    },
    roleOverrides: {}
  }
}

function normalizeScripts(raw: Partial<HelplineScripts>): HelplineScripts {
  const norm = defaultScripts()
  return {
    updatedUtc: raw.updatedUtc ? String(raw.updatedUtc) : norm.updatedUtc,
    staff: typeof raw.staff === 'object' && raw.staff ? raw.staff : norm.staff,
    owner: typeof raw.owner === 'object' && raw.owner ? raw.owner : norm.owner,
    roleOverrides: typeof raw.roleOverrides === 'object' && raw.roleOverrides ? raw.roleOverrides : {}
  }
}

export function AdminHelpline() {
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [testChannelId, setTestChannelId] = useState('')
  const [postingTest, setPostingTest] = useState(false)
  const [postResult, setPostResult] = useState<string | null>(null)
  const [data, setData] = useState<HelplineScripts>(defaultScripts())
  const [scope, setScope] = useState<ScriptScope>('staff')
  const [newTopic, setNewTopic] = useState('')
  const [roleOverridesText, setRoleOverridesText] = useState('{}')
  const [roleOverridesError, setRoleOverridesError] = useState<string | null>(null)

  useEffect(() => {
    loadHelplineScripts()
      .then((payload) => setData(normalizeScripts(payload)))
      .catch(() => setData(defaultScripts()))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setRoleOverridesText(JSON.stringify(data.roleOverrides ?? {}, null, 2))
  }, [data.roleOverrides])

  function updateScripts(next: HelplineScripts) {
    setData(next)
    setDirty(true)
  }

  function updateRoleOverrides(nextRaw: string) {
    setRoleOverridesText(nextRaw)
    try {
      const parsed = JSON.parse(nextRaw)
      if (parsed && typeof parsed === 'object') {
        updateScripts({ ...data, roleOverrides: parsed })
        setRoleOverridesError(null)
        return
      }
      setRoleOverridesError('Role overrides must be a JSON object.')
    } catch (err) {
      setRoleOverridesError(err instanceof Error ? err.message : 'Invalid JSON')
    }
  }

  async function postTestToChannel(topic: string) {
    if (!testChannelId.trim()) {
      setPostResult('Missing test channel ID.')
      return
    }
    setPostingTest(true)
    setPostResult(null)
    try {
      const lines = data[scope]?.[topic] || []
      const payload = {
        scope,
        topic,
        channelId: testChannelId.trim(),
        lines
      }
      const res = await fetch('/api/admin/discord/helpline-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        setPostResult(`Failed to post: ${res.status} ${text}`.trim())
      } else {
        setPostResult('Test post sent.')
      }
    } catch (err) {
      setPostResult(err instanceof Error ? err.message : String(err))
    } finally {
      setPostingTest(false)
    }
  }

  function updateTopic(scopeKey: ScriptScope, topic: string, lines: string[]) {
    updateScripts({
      ...data,
      [scopeKey]: { ...data[scopeKey], [topic]: lines }
    })
  }

  function removeTopic(scopeKey: ScriptScope, topic: string) {
    const next = { ...data[scopeKey] }
    delete next[topic]
    updateScripts({
      ...data,
      [scopeKey]: next
    })
  }

  function addTopic() {
    const topic = newTopic.trim().toLowerCase().replace(/\s+/g, '-')
    if (!topic) return
    if (data[scope][topic]) return
    updateScripts({
      ...data,
      [scope]: { ...data[scope], [topic]: [''] }
    })
    setNewTopic('')
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveHelplineScripts({ ...data, updatedUtc: new Date().toISOString() })
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const topics = useMemo(() => Object.keys(data[scope] || {}), [data, scope])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Support Scripts</div>
          <h1>Helpline Scripts</h1>
          <p className="admin-sub">
            Configure scripted response lines for staff and owners. Used by `/helpline`.
          </p>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-grid two">
          <label className="admin-field">
            <span>Scope</span>
            <select
              className="admin-input"
              value={scope}
              onChange={(e) => setScope(e.target.value as ScriptScope)}
            >
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <label className="admin-field">
            <span>New topic</span>
            <div className="admin-row" style={{ marginTop: 6 }}>
              <input
                className="admin-input"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="ticket, escalation, outage"
              />
              <button className="admin-btn" onClick={addTopic}>Add</button>
            </div>
          </label>
        </div>
        <label className="admin-field" style={{ marginTop: 12 }}>
          <span>Test channel ID</span>
          <input
            className="admin-input"
            value={testChannelId}
            onChange={(e) => setTestChannelId(e.target.value)}
            placeholder="1234567890"
          />
        </label>
        {postResult && (
          <div className="small" style={{ marginTop: 8 }}>
            {postResult}
          </div>
        )}
        <label className="admin-field" style={{ marginTop: 12 }}>
          <span>Role overrides (JSON)</span>
          <textarea
            className="admin-input"
            rows={6}
            value={roleOverridesText}
            onChange={(e) => updateRoleOverrides(e.target.value)}
          />
          {roleOverridesError && (
            <div className="small" style={{ color: 'var(--bad)', marginTop: 6 }}>
              {roleOverridesError}
            </div>
          )}
        </label>
      </div>

      {error && (
        <div className="admin-card" style={{ color: 'var(--bad)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-card">Loading scripts…</div>
      ) : (
        <div className="admin-list">
          {topics.length === 0 && (
            <div className="admin-card admin-empty">No topics yet.</div>
          )}
          {topics.map(topic => (
            <div key={topic} className="admin-card">
              <div className="admin-card-header">
                <div className="admin-card-title">{topic}</div>
                <div className="admin-card-actions">
                  <button className="admin-btn ghost" onClick={() => removeTopic(scope, topic)}>
                    Delete
                  </button>
                </div>
              </div>
              <label className="admin-field">
                <span>Lines (one per line)</span>
                <textarea
                  className="admin-input"
                  rows={5}
                  value={(data[scope]?.[topic] || []).join('\n')}
                  onChange={(e) => updateTopic(scope, topic, e.target.value.split('\n').map(l => l.trim()).filter(Boolean))}
                />
              </label>
              <div className="admin-card" style={{ marginTop: 12 }}>
                <div className="admin-card-eyebrow">Preview</div>
                <div className="admin-card-sub">
                  {(data[scope]?.[topic] || []).length === 0
                    ? 'No lines configured.'
                    : (data[scope]?.[topic] || []).map((line, idx) => (
                        <div key={`${topic}-${idx}`} style={{ marginTop: idx === 0 ? 0 : 6 }}>
                          {line}
                        </div>
                      ))}
                </div>
              </div>
              <div className="admin-actions" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                <button
                  className="admin-btn"
                  onClick={() => setTestMessage((data[scope]?.[topic] || []).join('\n') || 'No lines configured.')}
                >
                  Test Post Preview
                </button>
                <button
                  className="admin-btn"
                  onClick={() => postTestToChannel(topic)}
                  disabled={postingTest}
                >
                  {postingTest ? 'Posting…' : 'Post to Channel'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {testMessage && (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-card-header">
            <div className="admin-card-title">Test Post</div>
            <button className="admin-btn ghost" onClick={() => setTestMessage(null)}>Close</button>
          </div>
          <div className="admin-card-sub">
            {testMessage.split('\n').map((line, idx) => (
              <div key={`test-${idx}`} style={{ marginTop: idx === 0 ? 0 : 6 }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      <AdminSaveBar dirty={dirty} saving={saving} error={error} onSave={save} />
    </div>
  )
}
