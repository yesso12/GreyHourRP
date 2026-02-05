import { useEffect, useMemo, useState } from 'react'
import { getActivity } from '../api/client'

export function AdminActivity() {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    getActivity(200)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(item => {
      const text = `${item.action ?? ''} ${item.target ?? ''} ${item.user ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [items, query])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Security</div>
          <h1>Activity Log</h1>
          <p className="admin-sub">Every write, restore, and role change is recorded.</p>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <label className="admin-field">
          <span>Search</span>
          <input
            className="admin-input small"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by user, action, or target"
          />
        </label>
      </div>

      {loading ? (
        <div className="admin-card">Loading activity…</div>
      ) : filtered.length === 0 ? (
        <div className="admin-card">No activity yet.</div>
      ) : (
        <div className="admin-list">
          {filtered.map((item, index) => (
            <div key={index} className="admin-list-item">
              <div>
                <div className="admin-list-title">
                  {String(item.action ?? 'action')} · {String(item.target ?? '')}
                </div>
                <div className="admin-list-sub">
                  {String(item.user ?? 'unknown')} ({String(item.role ?? 'unknown')})
                </div>
              </div>
              <div className="admin-list-meta">
                {item.timeUtc ? new Date(String(item.timeUtc)).toLocaleString() : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
