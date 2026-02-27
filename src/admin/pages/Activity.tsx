import { useEffect, useMemo, useState } from 'react'
import { getAuditCsvUrl, getAuditEntries } from '../api/client'

type AuditRow = {
  action: string
  target: string
  user: string
  role: string
  timeUtc: string
  hash?: string
  prevHash?: string
  raw: Record<string, unknown>
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeRow(item: Record<string, unknown>): AuditRow {
  return {
    action: readString(item.action) || 'event',
    target: readString(item.target) || '-',
    user: readString(item.user) || 'system',
    role: readString(item.role) || 'unknown',
    timeUtc: readString(item.timeUtc),
    hash: readString(item.hash) || undefined,
    prevHash: readString(item.prevHash) || undefined,
    raw: item
  }
}

export function AdminActivity() {
  const [items, setItems] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selected, setSelected] = useState<AuditRow | null>(null)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const data = await getAuditEntries({
        limit: 500,
        q: query.trim() || undefined,
        user: userFilter.trim() || undefined,
        action: actionFilter.trim() || undefined,
        role: roleFilter.trim() || undefined
      })
      setItems((data.rows ?? []).map(normalizeRow))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const exportUrl = useMemo(() => {
    return getAuditCsvUrl({
      limit: 5000,
      q: query.trim() || undefined,
      user: userFilter.trim() || undefined,
      action: actionFilter.trim() || undefined,
      role: roleFilter.trim() || undefined
    })
  }, [query, userFilter, actionFilter, roleFilter])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Security</div>
          <h1>Immutable Audit Log</h1>
          <p className="admin-sub">Tamper-evident chain logging with filter and CSV export.</p>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-grid two">
          <label className="admin-field">
            <span>Search</span>
            <input className="admin-input small" value={query} onChange={e => setQuery(e.target.value)} placeholder="Any text..." />
          </label>
          <label className="admin-field">
            <span>User</span>
            <input className="admin-input small" value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder="owner/editor/ops user" />
          </label>
          <label className="admin-field">
            <span>Action</span>
            <input className="admin-input small" value={actionFilter} onChange={e => setActionFilter(e.target.value)} placeholder="discord-execute, write..." />
          </label>
          <label className="admin-field">
            <span>Role</span>
            <input className="admin-input small" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} placeholder="owner, editor, ops" />
          </label>
        </div>
        <div className="admin-row" style={{ marginTop: 10 }}>
          <button className="admin-btn" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Loading...' : 'Apply Filters'}
          </button>
          <a className="admin-btn" href={exportUrl}>
            Export CSV
          </a>
        </div>
      </div>

      {error && <div className="admin-notice warn">{error}</div>}

      {loading ? (
        <div className="admin-card">Loading audit log...</div>
      ) : items.length === 0 ? (
        <div className="admin-card admin-empty">No audit entries found for these filters.</div>
      ) : (
        <div className="admin-list">
          {items.map((item, index) => (
            <div key={`${item.timeUtc}-${item.hash ?? index}`} className="admin-list-item">
              <div>
                <div className="admin-list-title">
                  {item.action} · {item.target}
                </div>
                <div className="admin-list-sub">
                  {item.user} ({item.role})
                </div>
                <div className="admin-list-sub">hash: {item.hash ? `${item.hash.slice(0, 16)}...` : 'legacy-entry'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="admin-list-meta">
                  {item.timeUtc ? new Date(item.timeUtc).toLocaleString() : ''}
                </div>
                <button className="admin-btn" onClick={() => setSelected(item)}>
                  View Raw
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Raw Audit Entry</h2>
            <button className="admin-btn" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="admin-list-sub" style={{ marginBottom: 8 }}>
            {selected.action} · {selected.target} · {selected.user}
          </div>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'rgba(7,8,10,0.75)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              padding: 12,
              maxHeight: 360,
              overflow: 'auto'
            }}
          >
            {JSON.stringify(selected.raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
