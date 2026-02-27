import { useEffect, useMemo, useState } from 'react'
import {
  announceDiscord,
  getActivity,
  getDiscordMetrics,
  getDiscordStatus,
  getIntegrationSnapshot,
  testDiscord,
  type IntegrationSnapshot
} from '../api/client'
import { useAdminAuth } from '../auth/AdminAuthContext'
import { fetchJson } from '../../components/utils'
import type { DiscordChannelCommandDoc, DiscordCommandDoc, DiscordCommandDocEntry } from '../../types/content'

type DiscordAction = {
  timeUtc?: string
  user?: string
  role?: string
  action?: string
  target?: string
}

const templates = [
  { label: 'Server Online', body: '✅ Grey Hour RP is ONLINE. Reconnect and keep the story moving.' },
  { label: 'Maintenance', body: '🛠️ Grey Hour RP is in maintenance. Progress is preserved and updates are underway.' },
  { label: 'Story Transmission', body: '📡 New transmission is live. Check #transmissions for the latest chapter.' },
  { label: 'Event Alert', body: '🔥 Event window opens soon. Rally up and watch #announcements.' }
]

export function AdminDiscord() {
  const { identity } = useAdminAuth()
  const canPublish = identity.role === 'owner' || identity.role === 'editor'

  const [message, setMessage] = useState('')
  const [mentionEveryone, setMentionEveryone] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const [configured, setConfigured] = useState<boolean | null>(null)
  const [metrics, setMetrics] = useState<Record<string, number>>({})
  const [topCommands, setTopCommands] = useState<Array<{ command: string; total: number }>>([])
  const [activity, setActivity] = useState<DiscordAction[]>([])
  const [integration, setIntegration] = useState<IntegrationSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<string>('')
  const [commandDoc, setCommandDoc] = useState<DiscordCommandDoc | null>(null)
  const [commandQuery, setCommandQuery] = useState('')
  const [commandError, setCommandError] = useState<string | null>(null)
  const [channelCommandDoc, setChannelCommandDoc] = useState<DiscordChannelCommandDoc | null>(null)
  const [channelCommandQuery, setChannelCommandQuery] = useState('')
  const [channelCommandError, setChannelCommandError] = useState<string | null>(null)

  const digest = useMemo(() => {
    const total = Math.round(metrics.gh_bot_commands_total ?? 0)
    const errors = Math.round(metrics.gh_bot_command_errors_total ?? 0)
    const queue = Math.round(metrics.gh_bot_queue_processed_total ?? 0)
    const abuse = Math.round(metrics.gh_bot_abuse_blocked_total ?? 0)
    const rate = total > 0 ? ((errors / total) * 100).toFixed(1) : '0.0'
    return { total, errors, queue, abuse, rate }
  }, [metrics])

  async function refresh() {
    setLoading(true)
    try {
      const [discordStatus, metricsData, logItems, integrationData] = await Promise.all([
        getDiscordStatus(),
        getDiscordMetrics(),
        getActivity(600),
        getIntegrationSnapshot()
      ])
      setConfigured(discordStatus.enabled)
      setMetrics(metricsData.counters ?? {})
      setTopCommands((metricsData.commandByName ?? []).slice(0, 10))
      setActivity(
        logItems
          .filter((item): item is DiscordAction => typeof item === 'object' && item !== null)
          .filter((item) => String(item.action ?? '').startsWith('discord-'))
          .sort((a, b) => String(b.timeUtc ?? '').localeCompare(String(a.timeUtc ?? '')))
      )
      setIntegration(integrationData)
      setError(null)
    } catch (err) {
      setConfigured(false)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLastRefresh(new Date().toLocaleTimeString())
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchJson<DiscordCommandDoc>('/content/discord-commands.json')
      .then((doc) => {
        setCommandDoc(doc)
        setCommandError(null)
      })
      .catch((err) => {
        setCommandDoc(null)
        setCommandError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  useEffect(() => {
    fetchJson<DiscordChannelCommandDoc>('/content/discord-channel-commands.json')
      .then((doc) => {
        setChannelCommandDoc(doc)
        setChannelCommandError(null)
      })
      .catch((err) => {
        setChannelCommandDoc(null)
        setChannelCommandError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  async function sendAnnouncement() {
    if (!canPublish || !message.trim()) return
    setSending(true)
    setStatus('idle')
    setError(null)
    try {
      await announceDiscord(message.trim(), mentionEveryone)
      setMessage('')
      setStatus('sent')
      await refresh()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  async function sendTestPing() {
    if (!canPublish) return
    setSending(true)
    setStatus('idle')
    setError(null)
    try {
      await testDiscord()
      setStatus('sent')
      await refresh()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  const readiness = integration?.readiness
  const readinessState = readiness
    ? Number(readiness.gameServerApiReady) + Number(readiness.discordApiReady) + Number(readiness.webhooksReady)
    : 0
  const readinessLabel = readinessState >= 3 ? 'Ready' : readinessState === 2 ? 'Near Ready' : readinessState === 1 ? 'Partial' : 'Pending'
  const readinessTone = readinessState >= 3 ? 'good' : readinessState === 2 ? 'warn' : readinessState === 1 ? 'warn' : 'bad'
  const hookLabel = configured === null ? 'Pending' : configured ? 'Connected' : 'Offline'
  const hookTone = configured === null ? 'warn' : configured ? 'good' : 'bad'
  const allCommands = useMemo(() => {
    const list = commandDoc?.commands ?? []
    const q = commandQuery.trim().toLowerCase()
    return list.filter((cmd) => {
      if (!q) return true
      const hay = `${cmd.name} ${cmd.description} ${(cmd.subcommands ?? []).map(sub => `${sub.name} ${sub.description}`).join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [commandDoc, commandQuery])

  const commandsByPermission = useMemo(() => {
    const groups: Record<string, DiscordCommandDocEntry[]> = { admin: [], staff: [], public: [], restricted: [] }
    for (const cmd of allCommands) {
      const key = cmd.permission ?? 'public'
      if (!groups[key]) groups[key] = []
      groups[key].push(cmd)
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.name.localeCompare(b.name))
    }
    return groups
  }, [allCommands])

  const commandCountByPermission = useMemo(() => {
    return {
      public: commandsByPermission.public.length,
      staff: commandsByPermission.staff.length,
      admin: commandsByPermission.admin.length,
      restricted: commandsByPermission.restricted.length
    }
  }, [commandsByPermission])

  const channelCommandRows = useMemo(() => {
    const list = channelCommandDoc?.channels ?? []
    const q = channelCommandQuery.trim().toLowerCase()
    return list.filter((channel) => {
      if (!q) return true
      const hay = `${channel.name} ${channel.parentName ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [channelCommandDoc, channelCommandQuery])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Discord Command Deck</div>
          <h1>Discord Operations</h1>
          <p className="admin-sub">Live telemetry, broadcast controls, and API integration readiness in one panel.</p>
        </div>
        <div className="admin-row" style={{ marginTop: 0 }}>
          <button className="admin-btn" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          <button className="admin-btn" onClick={sendTestPing} disabled={!canPublish || sending}>Test Ping</button>
        </div>
      </div>

      <div className="admin-grid four" style={{ marginBottom: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Discord Hook</div>
          </div>
          <div className={`admin-status ${hookTone}`} style={{ marginTop: 6 }}>
            <span className="admin-status-dot" />
            {hookLabel}
          </div>
          <div className="admin-card-value" style={{ fontSize: 22 }}>{configured === null ? '...' : configured ? 'Connected' : 'Offline'}</div>
          <div className="admin-card-sub">Last refresh: {lastRefresh || 'pending'}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Commands</div>
          </div>
          <div className="admin-card-value">{digest.total}</div>
          <div className="admin-card-sub">Error rate: {digest.rate}%</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Queue Processed</div>
          </div>
          <div className="admin-card-value">{digest.queue}</div>
          <div className="admin-card-sub">Abuse blocks: {digest.abuse}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Integration Readiness</div>
          </div>
          <div className="admin-card-value" style={{ fontSize: 22 }}>
            {readinessLabel}
          </div>
          <div className={`admin-status ${readinessTone}`} style={{ marginTop: 6 }}>
            <span className="admin-status-dot" />
            {readinessLabel}
          </div>
          <div className="admin-card-sub">Game + Discord + webhooks</div>
        </div>
      </div>

      <div className="admin-grid two" style={{ marginBottom: 16 }}>
        <div className="admin-card">
          <div className="admin-section-header">
            <h2>Broadcast Studio</h2>
          </div>
          <label className="admin-field">
            <span>Announcement Message</span>
            <textarea
              className="admin-textarea"
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the message for Discord..."
              disabled={!canPublish}
            />
          </label>
          <label className="admin-field checkbox" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={mentionEveryone}
              onChange={(e) => setMentionEveryone(e.target.checked)}
              disabled={!canPublish}
            />
            <span>Include @everyone mention</span>
          </label>
          <div className="admin-row">
            <button className="admin-btn primary" onClick={sendAnnouncement} disabled={!canPublish || !message.trim() || sending}>
              {sending ? 'Sending…' : 'Send Announcement'}
            </button>
          </div>
          {status === 'sent' && <div className="admin-hint">Message sent successfully.</div>}
          {status === 'error' && <div className="admin-error">{error}</div>}
        </div>

        <div className="admin-card">
          <div className="admin-section-header">
            <h2>Quick Templates</h2>
          </div>
          <div className="admin-grid two">
            {templates.map((item) => (
              <div key={item.label} className="admin-card" style={{ padding: 12 }}>
                <div className="admin-list-title">{item.label}</div>
                <div className="admin-list-sub" style={{ marginTop: 8 }}>{item.body}</div>
                <div className="admin-row">
                  <button className="admin-btn" onClick={() => setMessage(item.body)}>Use</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-grid two" style={{ marginBottom: 16 }}>
        <div className="admin-card">
          <div className="admin-section-header">
            <h2>API Integration Readiness</h2>
          </div>
          <div className="admin-list">
            <div className="admin-list-item">
              <div>
                <div className="admin-list-title">Game Server API</div>
                <div className="admin-list-sub">Realtime status, players, queue, map rotation.</div>
              </div>
              <div className="admin-chip">{readiness?.gameServerApiReady ? 'Ready' : 'Pending'}</div>
            </div>
            <div className="admin-list-item">
              <div>
                <div className="admin-list-title">Discord API Bridge</div>
                <div className="admin-list-sub">Bot status, ticket/modcall telemetry, command health.</div>
              </div>
              <div className="admin-chip">{readiness?.discordApiReady ? 'Ready' : 'Pending'}</div>
            </div>
            <div className="admin-list-item">
              <div>
                <div className="admin-list-title">Webhook/Events</div>
                <div className="admin-list-sub">Join/leave, incident, and announcement event handoff.</div>
              </div>
              <div className="admin-chip">{readiness?.webhooksReady ? 'Ready' : 'Pending'}</div>
            </div>
          </div>
          {!!readiness?.notes?.length && (
            <div className="admin-hint" style={{ marginTop: 12 }}>
              {readiness.notes.slice(0, 8).map((note, idx) => <div key={`${idx}-${note}`}>- {note}</div>)}
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-section-header">
            <h2>Top Commands</h2>
          </div>
          {topCommands.length === 0 ? (
            <div className="admin-text admin-empty">No command metrics reported yet.</div>
          ) : (
            topCommands.map((row) => (
              <div key={row.command} className="admin-list-item">
                <div>
                  <div className="admin-list-title">/{row.command}</div>
                  <div className="admin-list-sub">Total invocations</div>
                </div>
                <div className="admin-chip">{Math.round(row.total)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Discord Command Catalog</h2>
          <div className="admin-hint">All registered commands with permission scope. Public website shows only public commands.</div>
        </div>
        <div className="admin-card" style={{ marginBottom: 16 }}>
          <div className="admin-row" style={{ marginTop: 0 }}>
            <input
              className="admin-input"
              placeholder="Search commands..."
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              style={{ flex: 1, minWidth: 240 }}
            />
            <div className="admin-chip">{allCommands.length} total</div>
          </div>
          <div className="admin-row" style={{ marginTop: 10 }}>
            <div className="admin-chip">Public: {commandCountByPermission.public}</div>
            <div className="admin-chip">Staff: {commandCountByPermission.staff}</div>
            <div className="admin-chip">Admin: {commandCountByPermission.admin}</div>
            <div className="admin-chip">Restricted: {commandCountByPermission.restricted}</div>
          </div>
          <div className="admin-hint" style={{ marginTop: 10 }}>
            Last command sync: {commandDoc?.generatedUtc ? new Date(commandDoc.generatedUtc).toLocaleString() : 'unknown'}.
            Command add/remove changes appear automatically after bot command registration.
          </div>
          {commandError && <div className="admin-error" style={{ marginTop: 10 }}>{commandError}</div>}
        </div>

        <div className="admin-grid two" style={{ marginBottom: 16 }}>
          {(['public', 'staff', 'admin', 'restricted'] as const).map((bucket) => {
            const label = bucket === 'public'
              ? 'Public Commands'
              : bucket === 'staff'
                ? 'Staff Commands'
                : bucket === 'admin'
                  ? 'Admin Commands'
                  : 'Restricted Commands'
            const list = commandsByPermission[bucket] ?? []
            return (
              <div key={bucket} className="admin-card">
                <div className="admin-section-header">
                  <h2>{label}</h2>
                </div>
                {list.length === 0 ? (
                  <div className="admin-text admin-empty">No commands in this bucket.</div>
                ) : (
                  list.map((cmd) => (
                    <div key={`${bucket}-${cmd.name}`} className="admin-list-item">
                      <div>
                        <div className="admin-list-title">/{cmd.name}</div>
                        <div className="admin-list-sub">{cmd.description || 'No description'}</div>
                        {cmd.subcommands && cmd.subcommands.length > 0 && (
                          <div className="admin-list-sub" style={{ marginTop: 6 }}>
                            {cmd.subcommands.map((sub) => `${sub.usage}${sub.description ? ` — ${sub.description}` : ''}`).join(' • ')}
                          </div>
                        )}
                      </div>
                      <div className="admin-chip">{bucket}</div>
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Channel Command Map</h2>
          <div className="admin-hint">Per-channel command allowlists (includes staff/admin commands).</div>
        </div>
        <div className="admin-card" style={{ marginBottom: 16 }}>
          <div className="admin-row" style={{ marginTop: 0 }}>
            <input
              className="admin-input"
              placeholder="Search channels..."
              value={channelCommandQuery}
              onChange={(e) => setChannelCommandQuery(e.target.value)}
              style={{ flex: 1, minWidth: 240 }}
            />
            <div className="admin-chip">{channelCommandRows.length} channels</div>
          </div>
          <div className="admin-hint" style={{ marginTop: 10 }}>
            Last channel-map sync: {channelCommandDoc?.generatedUtc ? new Date(channelCommandDoc.generatedUtc).toLocaleString() : 'unknown'}.
          </div>
          {channelCommandError && <div className="admin-error" style={{ marginTop: 10 }}>{channelCommandError}</div>}
        </div>
        <div className="admin-grid two" style={{ marginBottom: 16 }}>
          {channelCommandRows.map((channel) => (
            <div key={channel.id} className="admin-card">
              <div className="admin-section-header">
                <h2>#{channel.name}</h2>
              </div>
              {channel.parentName && (
                <div className="admin-hint" style={{ marginBottom: 8 }}>{channel.parentName}</div>
              )}
              {channel.allowRules?.length > 0 && (
                <div className="admin-list-sub" style={{ marginBottom: 10 }}>
                  Allow rules: {channel.allowRules.join(', ')}
                </div>
              )}
              {channel.commands?.length ? (
                channel.commands.map((cmd) => (
                  <div key={`${channel.id}-${cmd.usage}`} className="admin-list-item">
                    <div>
                      <div className="admin-list-title">{cmd.usage}</div>
                      <div className="admin-list-sub">{cmd.description || 'No description'}</div>
                    </div>
                    <div className="admin-chip">{cmd.permission}</div>
                  </div>
                ))
              ) : (
                <div className="admin-text admin-empty">No commands mapped for this channel.</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Recent Discord Activity</h2>
        </div>
        <div className="admin-card">
          {activity.length === 0 ? (
            <div className="admin-text admin-empty">No Discord activity logged yet.</div>
          ) : (
            activity.slice(0, 25).map((item, idx) => (
              <div key={`${item.timeUtc ?? 'time'}-${idx}`} className="admin-list-item">
                <div>
                  <div className="admin-list-title">{item.action ?? 'discord-action'} • {item.target ?? 'channel'}</div>
                  <div className="admin-list-sub">{item.user ?? 'unknown'} ({item.role ?? 'unknown'})</div>
                </div>
                <div className="admin-list-meta">
                  {item.timeUtc ? new Date(item.timeUtc).toLocaleString() : 'Unknown time'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
