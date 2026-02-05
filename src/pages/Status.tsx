import { useEffect, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { ServerStatus, StatusHistoryItem } from '../types/content'

export function Status() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [history, setHistory] = useState<StatusHistoryItem[]>([])

  useEffect(() => {
    fetchJson<ServerStatus>('/content/server-status.json')
      .then(setStatus)
      .catch(() => setStatus(null))

    fetchJson<StatusHistoryItem[]>('/content/status-history.json')
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [])

  const label =
    status?.status === 'online'
      ? 'Online'
      : status?.status === 'maintenance'
      ? 'Maintenance'
      : 'Offline'

  const color =
    status?.status === 'online'
      ? 'var(--good)'
      : status?.status === 'maintenance'
      ? 'var(--warn)'
      : 'var(--bad)'

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Operations</span></div>
            <h1 className="hero-title">Current world state.</h1>
            <div className="p" style={{ maxWidth: 820 }}>
              Live status for the Grey Hour server. Check here before you connect.
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Live" title="Server status">
        <div className="status-terminal">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: color }} />
            <div style={{ fontWeight: 760, fontSize: 20 }}>{label}</div>
          </div>
          <div className="p" style={{ marginTop: 12 }}>
            {status?.message ?? 'Server status information is currently unavailable.'}
          </div>
          {status?.updatedUtc && (
            <div className="small" style={{ marginTop: 10 }}>
              Last updated: {new Date(status.updatedUtc).toLocaleString()}
            </div>
          )}
        </div>
      </Section>

      <Section eyebrow="History" title="Recent status changes">
        {history.length === 0 ? (
          <div className="card">No status history has been published yet.</div>
        ) : (
          <div className="timeline">
            {history.slice(0, 8).map(item => (
              <div key={item.id} className="timeline-item">
                <div className="timeline-title">{item.status.toUpperCase()}</div>
                <div className="small">{new Date(item.dateUtc).toLocaleString()}</div>
                {item.message && <div className="p" style={{ marginTop: 10 }}>{item.message}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="Definitions" title="Understanding the states">
        <div className="grid grid-3" style={{ marginTop: 14 }}>
          <div className="card">
            <div style={{ fontWeight: 760 }}>Online</div>
            <div className="p" style={{ marginTop: 8 }}>
              The server is live and accepting connections. Characters are active and the world is progressing.
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 760 }}>Maintenance</div>
            <div className="p" style={{ marginTop: 8 }}>
              Temporary downtime for updates, fixes, or world adjustments. Progress is preserved.
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 760 }}>Offline</div>
            <div className="p" style={{ marginTop: 8 }}>
              The server is currently unavailable. Check Discord for updates and timelines.
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Stay Informed" title="Never miss a change">
        <div className="callout">
          <div className="p">
            All downtime announcements and recovery updates are posted in Discord. If the server is offline,
            that’s the first place to check.
          </div>
          <div className="hero-actions" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">
              Open Discord
            </a>
          </div>
        </div>
      </Section>
    </div>
  )
}
