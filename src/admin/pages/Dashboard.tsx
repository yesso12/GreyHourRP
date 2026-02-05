import { useEffect, useState } from 'react'
import {
  getActivity,
  loadMods,
  loadServerStatus,
  loadStatusHistory,
  loadTransmissions,
  loadUpdates
} from '../api/client'
import type { ServerStatus } from '../../types/content'

export function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({
    transmissions: 0,
    updates: 0,
    mods: 0,
    history: 0,
    status: null as ServerStatus | null
  })
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([])

  useEffect(() => {
    Promise.all([
      loadTransmissions(),
      loadUpdates(),
      loadMods(),
      loadStatusHistory(),
      loadServerStatus(),
      getActivity(8)
    ])
      .then(([transmissions, updates, mods, history, status, activityItems]) => {
        setSummary({
          transmissions: transmissions.length,
          updates: updates.length,
          mods: mods.length,
          history: history.length,
          status
        })
        setActivity(activityItems)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Overview</div>
          <h1>Admin Dashboard</h1>
          <p className="admin-sub">Snapshot of content and operations.</p>
        </div>
      </div>

      {loading ? (
        <div className="admin-card">Loading dashboard…</div>
      ) : (
        <>
          <div className="admin-grid four">
            <div className="admin-card">
              <div className="admin-card-label">Transmissions</div>
              <div className="admin-card-value">{summary.transmissions}</div>
            </div>
            <div className="admin-card">
              <div className="admin-card-label">Updates</div>
              <div className="admin-card-value">{summary.updates}</div>
            </div>
            <div className="admin-card">
              <div className="admin-card-label">Mods</div>
              <div className="admin-card-value">{summary.mods}</div>
            </div>
            <div className="admin-card">
              <div className="admin-card-label">Status Entries</div>
              <div className="admin-card-value">{summary.history}</div>
            </div>
          </div>

          <div className="admin-grid" style={{ marginTop: 18 }}>
            <div className="admin-card emphasis">
              <div className="admin-card-label">Server Status</div>
              <div className="admin-card-value">
                {summary.status?.status ?? 'Unknown'}
              </div>
              <div className="admin-card-sub">
                {summary.status?.message ?? 'No status published.'}
              </div>
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Recent Activity</h2>
            </div>
            {activity.length === 0 ? (
              <div className="admin-card">No activity yet.</div>
            ) : (
              <div className="admin-list">
                {activity.map((item, index) => (
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
        </>
      )}
    </div>
  )
}
