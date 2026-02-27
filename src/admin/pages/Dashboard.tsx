import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  getActivity,
  getOpsSnapshot,
  getOpsSnapshotCsvUrl,
  getPublicLiveDiagnostics,
  getGameTelemetry,
  getPlayersHistoryCsvUrl,
  getPteroResources,
  getPteroStatus,
  loadMods,
  loadServerStatus,
  loadStatusHistory,
  loadTransmissions,
  loadUpdates,
  loadDiscordOpsSettings
} from '../api/client'
import type { ServerStatus } from '../../types/content'
import type { PteroResourceSnapshot, PteroStatusSnapshot } from '../api/client'
import type { PublicLiveDiagnostics } from '../api/client'
import { loadPublicLiveSnapshot } from '../../api/liveClient'

function formatBytes(bytes?: number) {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = Math.max(0, Number(bytes))
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const formatted = value >= 100 ? Math.round(value) : value >= 10 ? value.toFixed(1) : value.toFixed(2)
  return `${formatted} ${units[unitIndex]}`
}

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
  const [liveNote, setLiveNote] = useState<string>('Live API endpoint not configured yet.')
  const [telemetryNote, setTelemetryNote] = useState<string>('Game telemetry not available yet.')
  const [diagnostics, setDiagnostics] = useState<PublicLiveDiagnostics | null>(null)
  const [diagnosticsError, setDiagnosticsError] = useState(false)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsCheckedAt, setDiagnosticsCheckedAt] = useState<string | null>(null)
  const [latencyHistory, setLatencyHistory] = useState<Record<string, number[]>>({})
  const [opsSettings, setOpsSettings] = useState<{
    quietHoursEnabled: boolean
    quietHoursStartUtc?: string
    quietHoursEndUtc?: string
    staffDigestChannelId?: string
    lastDigestPostedUtc?: string
  } | null>(null)
  const [postingDigest, setPostingDigest] = useState(false)
  const [pteroStatus, setPteroStatus] = useState<PteroStatusSnapshot | null>(null)
  const [pteroResources, setPteroResources] = useState<PteroResourceSnapshot | null>(null)
  const [pteroError, setPteroError] = useState<string | null>(null)
  const [pteroLoading, setPteroLoading] = useState(false)
  const [pteroCheckedAt, setPteroCheckedAt] = useState<string | null>(null)
  const [opsSnapshot, setOpsSnapshot] = useState<{
    lastRestartUtc?: string
    lastMismatchUtc?: string
    lastAutoRestartUtc?: string
    lastPanelHealthUtc?: string
    lastPanelHealthError?: string
    uptimeSplit24h?: { online: number; maintenance: number; offline: number }
  } | null>(null)
  const [csvPreset, setCsvPreset] = useState('24h')
  const statusValue = summary.status?.status ?? 'Unknown'
  const statusTone =
    statusValue === 'online' ? 'good' : statusValue === 'maintenance' ? 'warn' : statusValue === 'offline' ? 'bad' : ''

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

    loadPublicLiveSnapshot()
      .then((snapshot) => {
        const note = snapshot.readiness?.notes?.length
          ? snapshot.readiness.notes.join(' ')
          : 'Live API endpoint not configured yet.'
        setLiveNote(note)
      })
      .catch(() => setLiveNote('Live API endpoint not configured yet.'))

    getGameTelemetry()
      .then((telemetry) => {
        const source = String(telemetry.mods?.source ?? telemetry.server?.source ?? 'unknown')
        setTelemetryNote(`Game telemetry source: ${source}`)
      })
      .catch(() => setTelemetryNote('Game telemetry not available yet.'))

    getOpsSnapshot()
      .then(setOpsSnapshot)
      .catch(() => setOpsSnapshot(null))

    loadDiscordOpsSettings()
      .then((settings) => {
        setOpsSettings({
          quietHoursEnabled: Boolean(settings.quietHoursEnabled),
          quietHoursStartUtc: settings.quietHoursStartUtc,
          quietHoursEndUtc: settings.quietHoursEndUtc,
          staffDigestChannelId: settings.staffDigestChannelId,
          lastDigestPostedUtc: settings.lastDigestPostedUtc
        })
      })
      .catch(() => setOpsSettings(null))

    refreshDiagnostics()
    refreshPtero()
  }, [])

  function refreshDiagnostics() {
    setDiagnosticsLoading(true)
    getPublicLiveDiagnostics()
      .then((result) => {
        setDiagnostics(result)
        setDiagnosticsError(false)
        setDiagnosticsCheckedAt(new Date().toLocaleTimeString())
        setLatencyHistory((prev) => {
          const next: Record<string, number[]> = { ...prev }
          result.endpoints.forEach((endpoint) => {
            const prior = next[endpoint.key] ?? []
            next[endpoint.key] = [...prior, endpoint.latencyMs].slice(-6)
          })
          return next
        })
      })
      .catch(() => {
        setDiagnostics(null)
        setDiagnosticsError(true)
        setDiagnosticsCheckedAt(new Date().toLocaleTimeString())
      })
      .finally(() => setDiagnosticsLoading(false))
  }

  async function postDigestNow() {
    setPostingDigest(true)
    try {
      await fetch('/api/admin/discord/digest', { method: 'POST' })
      loadDiscordOpsSettings()
        .then((settings) => {
          setOpsSettings({
            quietHoursEnabled: Boolean(settings.quietHoursEnabled),
            quietHoursStartUtc: settings.quietHoursStartUtc,
            quietHoursEndUtc: settings.quietHoursEndUtc,
            staffDigestChannelId: settings.staffDigestChannelId,
            lastDigestPostedUtc: settings.lastDigestPostedUtc
          })
        })
        .catch(() => {})
    } finally {
      setPostingDigest(false)
    }
  }
  useEffect(() => {
    const id = window.setInterval(refreshDiagnostics, 30000)
    return () => window.clearInterval(id)
  }, [])

  function refreshPtero() {
    setPteroLoading(true)
    Promise.all([getPteroStatus(), getPteroResources()])
      .then(([status, resources]) => {
        setPteroStatus(status)
        setPteroResources(resources)
        setPteroError(null)
        setPteroCheckedAt(new Date().toLocaleTimeString())
      })
      .catch((err) => {
        setPteroStatus(null)
        setPteroResources(null)
        setPteroError(err instanceof Error ? err.message : 'Pterodactyl endpoint unavailable.')
        setPteroCheckedAt(new Date().toLocaleTimeString())
      })
      .finally(() => setPteroLoading(false))
  }

  useEffect(() => {
    const id = window.setInterval(refreshPtero, 60000)
    return () => window.clearInterval(id)
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
        <div className="admin-grid four">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="admin-card">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-value" />
              <div className="skeleton skeleton-line" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="admin-grid four">
            <div className="admin-card">
              <div className="admin-card-header">
                <div className="admin-card-title">Transmissions</div>
              </div>
              <div className="admin-card-value">{summary.transmissions}</div>
            </div>
            <div className="admin-card">
              <div className="admin-card-header">
                <div className="admin-card-title">Updates</div>
              </div>
              <div className="admin-card-value">{summary.updates}</div>
            </div>
            <div className="admin-card">
              <div className="admin-card-header">
                <div className="admin-card-title">Mods</div>
              </div>
              <div className="admin-card-value">{summary.mods}</div>
            </div>
            <div className="admin-card">
              <div className="admin-card-header">
                <div className="admin-card-title">Status Entries</div>
              </div>
              <div className="admin-card-value">{summary.history}</div>
            </div>
          </div>

          <div className="admin-grid" style={{ marginTop: 18 }}>
            <div className="admin-card emphasis">
              <div className="admin-card-header">
                <div>
                  <div className="admin-card-eyebrow">Operations</div>
                  <div className="admin-card-title">Server Status</div>
                </div>
                <div className={`admin-status ${statusTone}`}>
                  <span className="admin-status-dot" />
                  {statusValue}
                </div>
              </div>
              <div className="admin-card-sub">
                {summary.status?.message ?? 'No status published.'}
              </div>
            </div>
            <div className="admin-card emphasis">
              <div className="admin-card-header">
                <div>
                  <div className="admin-card-eyebrow">Live Snapshot</div>
                  <div className="admin-card-title">Integration Ready</div>
                </div>
              </div>
              <div className="admin-card-sub">
                Public and admin surfaces are connected to the live snapshot feed.
              </div>
              <div className="admin-card-sub" style={{ marginTop: 8 }}>
                {liveNote}
              </div>
              <div className="admin-card-sub" style={{ marginTop: 8 }}>
                {telemetryNote}
              </div>
            </div>
          </div>

          <div className="admin-grid two" style={{ marginTop: 18 }}>
            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <div className="admin-card-eyebrow">Operations</div>
                  <div className="admin-card-title">Host Ops Quick Access</div>
                </div>
              </div>
              <div className="admin-card-sub">
                Host-level commands and checklists for Workshop updates, bridge installs, and future upgrades.
              </div>
              <div className="admin-card-actions" style={{ marginTop: 12 }}>
                <NavLink className="admin-btn" to="/admin/ops">Open Host Ops</NavLink>
              </div>
            </div>
            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <div className="admin-card-eyebrow">Operations</div>
                  <div className="admin-card-title">Server Control</div>
                </div>
              </div>
              <div className="admin-card-sub">
                Manage server power, resources, and console commands.
              </div>
              <div className="admin-card-actions" style={{ marginTop: 12 }}>
                <NavLink className="admin-btn" to="/admin/server-control">Open Server Control</NavLink>
              </div>
            </div>
          </div>

          <div className="admin-card" style={{ marginTop: 18 }}>
            <div className="admin-card-header">
              <div>
                <div className="admin-card-eyebrow">Ops Snapshot</div>
                <div className="admin-card-title">Last 24h Overview</div>
              </div>
              <div className="admin-card-actions">
                <select
                  className="admin-select"
                  value={csvPreset}
                  onChange={(e) => setCsvPreset(e.currentTarget.value)}
                >
                  <option value="1h">CSV 1h</option>
                  <option value="6h">CSV 6h</option>
                  <option value="24h">CSV 24h</option>
                  <option value="7d">CSV 7d</option>
                  <option value="30d">CSV 30d</option>
                </select>
                <a
                  className="admin-btn"
                  href={getPlayersHistoryCsvUrl({
                    limit: csvPreset === '30d' ? 10000 : csvPreset === '7d' ? 5000 : 2000,
                    hours: csvPreset === '1h' ? 1 : csvPreset === '6h' ? 6 : csvPreset === '24h' ? 24 : csvPreset === '7d' ? 168 : 720
                  })}
                  target="_blank"
                  rel="noreferrer"
                >
                  Export
                </a>
                <a
                  className="admin-btn"
                  href={getOpsSnapshotCsvUrl()}
                  target="_blank"
                  rel="noreferrer"
                >
                  Snapshot CSV
                </a>
                <NavLink className="admin-btn" to="/admin/ops">Details</NavLink>
              </div>
            </div>
            {opsSnapshot ? (
              <>
                {opsSnapshot.uptimeSplit24h && (
                  <div className="admin-uptime-bar" style={{ marginTop: 6 }}>
                    <div className="admin-uptime-segment online" style={{ flex: opsSnapshot.uptimeSplit24h.online }} />
                    <div className="admin-uptime-segment maintenance" style={{ flex: opsSnapshot.uptimeSplit24h.maintenance }} />
                    <div className="admin-uptime-segment offline" style={{ flex: opsSnapshot.uptimeSplit24h.offline }} />
                  </div>
                )}
                <div className="admin-card-sub">
                  Last restart: {opsSnapshot.lastRestartUtc ? new Date(opsSnapshot.lastRestartUtc).toLocaleString() : 'n/a'}
                </div>
                <div className="admin-card-sub">
                  Last mismatch: {opsSnapshot.lastMismatchUtc ? new Date(opsSnapshot.lastMismatchUtc).toLocaleString() : 'n/a'}
                </div>
                {opsSnapshot.lastPanelHealthError && (
                  <div className="admin-card-sub" style={{ color: 'var(--bad)' }}>
                    Panel health error: {opsSnapshot.lastPanelHealthError}
                  </div>
                )}
              </>
            ) : (
              <div className="admin-card-sub">Ops snapshot unavailable.</div>
            )}
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Recent Activity</h2>
            </div>
            {activity.length === 0 ? (
              <div className="admin-card admin-empty">No activity yet.</div>
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

          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Live Endpoint Health</h2>
            </div>
            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <div className="admin-card-eyebrow">Public APIs</div>
                  <div className="admin-card-title">Endpoint Diagnostics</div>
                </div>
                {diagnostics && (
                  <div className="admin-card-actions">
                    <div className={`admin-status ${diagnostics.overallOk ? 'good' : 'bad'}`}>
                      <span className="admin-status-dot" />
                      {diagnostics.overallOk ? 'Healthy' : 'Degraded'}
                    </div>
                    <button className="admin-btn" onClick={refreshDiagnostics} disabled={diagnosticsLoading}>
                      {diagnosticsLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>
                )}
              </div>
              {diagnosticsError && (
                <div className="admin-notice warn">Diagnostics unavailable. Check admin API connectivity.</div>
              )}
              {!diagnosticsError && !diagnostics && (
                <div className="admin-card-sub">Checking live endpoints…</div>
              )}
              {diagnostics && diagnostics.endpoints.some(item => !item.ok) && (
                <div className="admin-notice warn">
                  One or more live endpoints are degraded. Review status below.
                </div>
              )}
              {diagnosticsCheckedAt && (
                <div className="admin-card-sub">Last checked: {diagnosticsCheckedAt}</div>
              )}
              {diagnostics && (
                <div className="admin-list">
                  {diagnostics.endpoints.map((endpoint) => {
                    const label =
                      endpoint.key === 'game'
                        ? 'Game Telemetry'
                        : endpoint.key === 'discord'
                        ? 'Discord Status'
                        : 'Integration Readiness'
                    const history = latencyHistory[endpoint.key] ?? []
                    const avgLatency = history.length
                      ? Math.round(history.reduce((sum, value) => sum + value, 0) / history.length)
                      : endpoint.latencyMs
                    return (
                      <div key={endpoint.key} className="admin-list-item">
                        <div>
                          <div className="admin-list-title">{label}</div>
                          <div className="admin-list-sub">{endpoint.url}</div>
                        </div>
                        <div className="admin-row" style={{ marginTop: 0, justifyContent: 'flex-end' }}>
                          <div className={`admin-status ${endpoint.ok ? 'good' : 'bad'}`}>
                            <span className="admin-status-dot" />
                            {endpoint.ok ? 'OK' : 'Error'}
                          </div>
                          <div className="admin-list-meta">
                            {endpoint.status || 'ERR'} · {endpoint.latencyMs}ms · avg {avgLatency}ms
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Discord Ops</h2>
            </div>
            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <div className="admin-card-eyebrow">Routing & Quiet Hours</div>
                  <div className="admin-card-title">Discord Automation Controls</div>
                </div>
              </div>
              <div className="admin-card-sub">
                Quiet hours: {opsSettings?.quietHoursEnabled ? 'Enabled' : 'Disabled'}{opsSettings?.quietHoursStartUtc ? ` • ${opsSettings.quietHoursStartUtc}–${opsSettings.quietHoursEndUtc || '??:??'} UTC` : ''}
              </div>
              <div className="admin-card-sub" style={{ marginTop: 6 }}>
                Staff digest channel: {opsSettings?.staffDigestChannelId ? opsSettings.staffDigestChannelId : 'Not configured'}
              </div>
              <div className="admin-card-sub" style={{ marginTop: 6 }}>
                Last digest: {opsSettings?.lastDigestPostedUtc ? new Date(opsSettings.lastDigestPostedUtc).toLocaleString() : 'Unknown'}
              </div>
              <div className="admin-actions" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                <a className="admin-btn" href="/admin/discord-routing">Open Discord Routing</a>
                <button className="admin-btn" onClick={postDigestNow} disabled={postingDigest}>
                  {postingDigest ? 'Posting…' : 'Post Digest Now'}
                </button>
              </div>
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Pterodactyl</h2>
            </div>
            <div className="admin-card">
              <div className="admin-card-header">
                <div>
                  <div className="admin-card-eyebrow">Infrastructure</div>
                  <div className="admin-card-title">Game Node Status</div>
                </div>
                <div className="admin-card-actions">
                  <button className="admin-btn" onClick={refreshPtero} disabled={pteroLoading}>
                    {pteroLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
              </div>
              {pteroError && (
                <div className="admin-notice warn">{pteroError}</div>
              )}
              {!pteroError && !pteroStatus && (
                <div className="admin-card-sub">Pterodactyl endpoint not configured yet.</div>
              )}
              {pteroCheckedAt && (
                <div className="admin-card-sub">Last checked: {pteroCheckedAt}</div>
              )}
              {pteroStatus && (
                <div className="admin-list" style={{ marginTop: 8 }}>
                  <div className="admin-list-item">
                    <div>
                      <div className="admin-list-title">{pteroStatus.name || 'Server'}</div>
                      <div className="admin-list-sub">
                        State: {pteroStatus.state || 'unknown'} • Node: {pteroStatus.node || '—'} • Primary: {pteroStatus.primaryAllocation || '—'}
                      </div>
                    </div>
                    <div className="admin-list-meta">
                      Limits: CPU {pteroStatus.limits?.cpu ?? '—'}% • Mem {pteroStatus.limits?.memoryMb ?? '—'} MB • Disk {pteroStatus.limits?.diskMb ?? '—'} MB
                    </div>
                  </div>
                  <div className="admin-list-item">
                    <div>
                      <div className="admin-list-title">Features</div>
                      <div className="admin-list-sub">
                        DB {pteroStatus.featureLimits?.databases ?? '—'} • Backups {pteroStatus.featureLimits?.backups ?? '—'} • Alloc {pteroStatus.featureLimits?.allocations ?? '—'}
                      </div>
                    </div>
                    <div className="admin-list-meta">
                      Databases: {pteroStatus.databases ?? '—'}
                    </div>
                  </div>
                </div>
              )}
              {pteroResources && (
                <div className="admin-list" style={{ marginTop: 8 }}>
                  <div className="admin-list-item">
                    <div>
                      <div className="admin-list-title">Live Usage</div>
                      <div className="admin-list-sub">
                        State: {pteroResources.state || 'unknown'} • CPU {pteroResources.cpu ?? '—'}% • Uptime {pteroResources.uptimeMs ? Math.round(pteroResources.uptimeMs / 1000) + 's' : '—'}
                      </div>
                    </div>
                    <div className="admin-list-meta">
                      Mem {formatBytes(pteroResources.memoryBytes)} / {formatBytes(pteroResources.memoryLimitBytes)} • Disk {formatBytes(pteroResources.diskBytes)} / {formatBytes(pteroResources.diskLimitBytes)}
                    </div>
                  </div>
                  <div className="admin-list-item">
                    <div>
                      <div className="admin-list-title">Network</div>
                      <div className="admin-list-sub">
                        Down {formatBytes(pteroResources.networkRxBytes)} • Up {formatBytes(pteroResources.networkTxBytes)}
                      </div>
                    </div>
                    <div className="admin-list-meta">
                      Updated: {pteroResources.updatedAt ? new Date(pteroResources.updatedAt).toLocaleString() : '—'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
