import { useEffect, useState } from 'react'
import { Section } from '../components/Section'
import { ConversionStrip } from '../components/ConversionStrip'
import { fetchJson } from '../components/utils'
import type { ServerStatus, StatusHistoryItem } from '../types/content'
import { useDiscordInvite } from '../hooks/useDiscordInvite'
import { usePublicLive } from '../hooks/usePublicLive'

export function Status() {
  const discordInviteUrl = useDiscordInvite('status_primary_cta')
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [history, setHistory] = useState<StatusHistoryItem[]>([])
  const liveState = usePublicLive()

  useEffect(() => {
    fetchJson<ServerStatus>('/content/server-status.json')
      .then(setStatus)
      .catch(() => setStatus(null))

    fetchJson<StatusHistoryItem[]>('/content/status-history.json')
      .then(setHistory)
      .catch(() => setHistory([]))

  }, [])

  const label =
    (liveState?.live?.gameServer.status ?? status?.status) === 'online'
      ? 'Online'
      : (liveState?.live?.gameServer.status ?? status?.status) === 'maintenance'
      ? 'Maintenance'
      : 'Offline'

  const color =
    (liveState?.live?.gameServer.status ?? status?.status) === 'online'
      ? 'var(--good)'
      : (liveState?.live?.gameServer.status ?? status?.status) === 'maintenance'
      ? 'var(--warn)'
      : 'var(--bad)'

  function formatBytes(value?: number) {
    if (!value || value <= 0) return '—'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = value
    let idx = 0
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024
      idx += 1
    }
    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[idx]}`
  }

  return (
    <div className="status-page">
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Operations</span></div>
            <h1 className="hero-title">Current world state.</h1>
            <div className="p" style={{ maxWidth: 820 }}>
              Live status for the Grey Hour server. Check here before you connect.
            </div>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">Get Instant Alerts in Discord</a>
              <a className="btn" href="/how-to-join">Start Join Flow</a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '8px 0 0' }}>
        <div className="container">
          <ConversionStrip
            eyebrow="Stay Ready"
            title="Join when the window is open."
            body="Status changes hit Discord first. Keep alerts on so you can move the moment the world comes online."
            primary={{ label: 'Join Discord Alerts', href: discordInviteUrl, external: true }}
            secondary={{ label: 'View Updates', href: '/updates' }}
          />
        </div>
      </section>

      <Section eyebrow="Live" title="Server status">
        <div className="status-terminal status-terminal-retro">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: color }} />
            <div style={{ fontWeight: 760, fontSize: 20 }}>{label}</div>
          </div>
          <div className="p" style={{ marginTop: 12 }}>
            {liveState?.live?.gameServer?.map
              ? `Current map: ${liveState.live.gameServer.map}`
              : status?.message ?? 'Server status information is currently unavailable.'}
          </div>
          {liveState?.live?.gameServer?.maxPlayers ? (
            <div className="small" style={{ marginTop: 6 }}>
              Max players: {liveState.live.gameServer.maxPlayers}
            </div>
          ) : null}
          {typeof liveState?.live?.gameServer?.cpuPercent === 'number' && liveState.live.gameServer.cpuPercent > 0 ? (
            <div className="small" style={{ marginTop: 6 }}>
              CPU: {liveState.live.gameServer.cpuPercent.toFixed(1)}% • Memory: {formatBytes(liveState.live.gameServer.memoryBytes)}
            </div>
          ) : null}
          {liveState?.live?.gameServer?.updatedUtc || status?.updatedUtc ? (
            <div className="small" style={{ marginTop: 10 }}>
              Last updated: {new Date(liveState?.live?.gameServer?.updatedUtc ?? status?.updatedUtc ?? '').toLocaleString()}
            </div>
          ) : null}
        </div>
      </Section>

      <Section eyebrow="History" title="Recent status changes">
        {history.length === 0 ? (
          <div className="card">No status history has been published yet.</div>
        ) : (
          <div className="timeline">
            {history.slice(0, 8).map(item => (
              <div key={item.id} className="timeline-item status-history-item">
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
            <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">
              Open Discord
            </a>
          </div>
        </div>
      </Section>
    </div>
  )
}
