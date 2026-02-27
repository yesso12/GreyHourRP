import { useEffect, useMemo, useState } from 'react'
import { getContent } from '../api/client'
import type { GroupRequest, GroupRequestLog } from '../../types/content'

const fallbackLogs: GroupRequestLog = { updatedUtc: new Date().toISOString(), entries: [] }

function fmtDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function AdminGroupRequests() {
  const [requests, setRequests] = useState<GroupRequest[]>([])
  const [logs, setLogs] = useState<GroupRequestLog>(fallbackLogs)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const payload = await getContent<{ requests?: GroupRequest[] }>('group-requests')
      const logData = await getContent<GroupRequestLog>('group-request-logs')
      setRequests(Array.isArray(payload?.requests) ? payload.requests : [])
      setLogs(logData && Array.isArray(logData.entries) ? logData : fallbackLogs)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const pending = useMemo(
    () => requests.filter((r) => (r.status ?? 'pending') === 'pending'),
    [requests]
  )

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return logs.entries
    return logs.entries.filter((entry) =>
      `${entry.name} ${entry.type} ${entry.action} ${entry.requestId}`.toLowerCase().includes(q)
    )
  }, [logs.entries, query])

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Group Requests</h1>
          <p className="admin-sub">
            Review faction/shop requests from Discord. Approvals and denials happen in Discord, but the queue and logs
            are mirrored here for visibility.
          </p>
        </div>
        <button className="admin-btn" onClick={load} disabled={loading}>Refresh</button>
      </div>

      {error && <div className="admin-card admin-error">{error}</div>}

      <section className="admin-section">
        <div className="admin-section-title">Pending Queue</div>
        {loading ? (
          <div className="admin-card">Loading requests…</div>
        ) : pending.length === 0 ? (
          <div className="admin-card admin-empty">No pending faction or shop requests.</div>
        ) : (
          <div className="admin-grid">
            {pending.map((req) => (
              <div key={req.id} className="admin-card">
                <div className="admin-card-title">{req.name}</div>
                <div className="admin-card-sub">Type: {req.type} • Requested: {fmtDate(req.createdUtc)}</div>
                <div className="admin-meta">Color: {req.color ?? '—'}</div>
                {req.tagline && <div className="admin-meta">Tagline: {req.tagline}</div>}
                {req.details && <div className="admin-meta">Details: {req.details}</div>}
                <div className="admin-meta">Owner ID: {req.ownerId ?? '—'}</div>
                <div className="admin-note">
                  Approve/deny in Discord using the buttons in <strong>#faction-requests</strong>.
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-title">Approval Log</div>
        <div className="admin-toolbar">
          <input
            className="admin-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, type, status, or request ID"
          />
          <div className="admin-hint">Last sync: {fmtDate(logs.updatedUtc)}</div>
        </div>
        {loading ? (
          <div className="admin-card">Loading logs…</div>
        ) : filteredLogs.length === 0 ? (
          <div className="admin-card admin-empty">No approval activity logged yet.</div>
        ) : (
          <div className="admin-list">
            {filteredLogs.map((entry) => (
              <div key={entry.id} className="admin-list-item">
                <div>
                  <div className="admin-list-title">{entry.name} ({entry.type})</div>
                  <div className="admin-list-sub">
                    {entry.action.toUpperCase()} • Request {entry.requestId} • {fmtDate(entry.createdUtc)}
                  </div>
                  <div className="admin-meta">Owner: {entry.ownerId ?? '—'} • Actor: {entry.actorId ?? '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
