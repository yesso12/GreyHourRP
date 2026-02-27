import { useEffect, useMemo, useState } from 'react'
import {
  announceGameServer,
  getActivity,
  getGameControlStatus,
  getGameTelemetry,
  getPanelStatus,
  restartGameServer,
  restartGameServerViaPanel,
  runGameServerCommand,
  updateGameWorkshop,
  syncGame,
  type GameControlStatusResponse,
  type GameTelemetry,
  type PanelStatusResponse
} from '../api/client'

const COMMAND_ALLOWLIST = ['save', 'kick', 'ban', 'unban', 'weather', 'settime', 'whitelist']

function fmtDate(value?: string | null) {
  if (!value) return 'n/a'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

function extractPanelError(payload?: Record<string, unknown> | null) {
  if (!payload) return null
  const errors = (payload as { errors?: Array<Record<string, unknown>> }).errors
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] ?? {}
    const detail = String(first.detail ?? first.message ?? '').trim()
    const status = String(first.status ?? '').trim()
    const code = String(first.code ?? '').trim()
    const parts = [detail || null, status ? `status=${status}` : null, code ? `code=${code}` : null].filter(Boolean)
    return parts.length ? parts.join(' • ') : 'Panel API error.'
  }
  return 'Panel API error.'
}

export function AdminGameControl() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [telemetry, setTelemetry] = useState<GameTelemetry | null>(null)
  const [bridge, setBridge] = useState<GameControlStatusResponse | null>(null)
  const [panel, setPanel] = useState<PanelStatusResponse | null>(null)
  const [panelCheckedAt, setPanelCheckedAt] = useState<string | null>(null)
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([])
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [announceMessage, setAnnounceMessage] = useState('')
  const [commandName, setCommandName] = useState(COMMAND_ALLOWLIST[0])
  const [commandArgs, setCommandArgs] = useState('')
  const [lastRestartAt, setLastRestartAt] = useState<number>(0)

  const restartCooldownMs = 5 * 60 * 1000
  const restartLocked = Date.now() - lastRestartAt < restartCooldownMs
  const restartSecondsLeft = Math.max(0, Math.ceil((restartCooldownMs - (Date.now() - lastRestartAt)) / 1000))
  const mismatchCount = telemetry?.compatibility?.mismatchCount ?? 0
  const detectedVersion = telemetry?.compatibility?.detectedGameVersion ?? telemetry?.version ?? null

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [t, s, a] = await Promise.all([
        getGameTelemetry(),
        getGameControlStatus(),
        getActivity(200)
      ])
      setTelemetry(t)
      setBridge(s)
      const gameRows = a.filter(row => String(row.action ?? '').startsWith('game-'))
      setActivity(gameRows.slice(0, 30))
      try {
        const panelStatus = await getPanelStatus()
        setPanel(panelStatus)
        setPanelCheckedAt(new Date().toLocaleTimeString())
      } catch (err) {
        setPanel(null)
        setPanelCheckedAt(new Date().toLocaleTimeString())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    const id = window.setInterval(loadAll, 30000)
    return () => window.clearInterval(id)
  }, [])

  const status = telemetry?.server?.status ?? 'unknown'
  const statusBadge = useMemo(() => {
    if (status === 'online') return { label: 'ONLINE', color: 'rgba(74,222,128,0.25)', border: 'rgba(74,222,128,0.5)', tone: 'good' }
    if (status === 'maintenance') return { label: 'MAINT', color: 'rgba(250,204,21,0.2)', border: 'rgba(250,204,21,0.45)', tone: 'warn' }
    if (status === 'offline') return { label: 'OFFLINE', color: 'rgba(248,113,113,0.2)', border: 'rgba(248,113,113,0.45)', tone: 'bad' }
    return { label: 'UNKNOWN', color: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.2)', tone: '' }
  }, [status])

  async function runSync(force = false) {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await syncGame(force)
      setTelemetry(res.telemetry)
      setResult(`Sync complete. statusChanged=${res.sync.statusChanged} modsChanged=${res.sync.modsChanged}`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runRestart() {
    if (restartLocked) return
    if (!confirm('Restart the game server now? This affects live players.')) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await restartGameServer()
      setLastRestartAt(Date.now())
      setResult(`Restart request sent. ok=${res.ok}`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runPanelRestart() {
    if (restartLocked) return
    if (!confirm('Restart the game server via the hosting panel now? This affects live players.')) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await restartGameServerViaPanel()
      setLastRestartAt(Date.now())
      if (!res.ok) {
        const msg = extractPanelError(res.payload ?? null)
        setError(`Panel restart failed. ${msg ?? ''}`.trim())
      } else {
        setResult(`Panel restart request sent. ok=${res.ok}`)
      }
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runPanelCheck() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await getPanelStatus()
      setPanel(res)
      setPanelCheckedAt(new Date().toLocaleTimeString())
      if (!res.ok) {
        const msg = extractPanelError(res.payload ?? null)
        setError(`Panel status check failed. ${msg ?? ''}`.trim())
      } else {
        setResult(`Panel status check complete. ok=${res.ok}`)
      }
    } catch (err) {
      setPanel(null)
      setPanelCheckedAt(new Date().toLocaleTimeString())
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runAnnounce() {
    if (!announceMessage.trim()) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await announceGameServer(announceMessage.trim())
      setResult(`Announcement sent. ok=${res.ok}`)
      setAnnounceMessage('')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runWorkshopUpdate() {
    if (!confirm('Run workshop update on the game server now? This can take a few minutes.')) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await updateGameWorkshop()
      setResult(`Workshop update triggered. ok=${res.ok}`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runCommand() {
    if (!COMMAND_ALLOWLIST.includes(commandName)) {
      setError('Command is not in allowlist.')
      return
    }

    let parsedArgs: unknown = null
    const raw = commandArgs.trim()
    if (raw) {
      try {
        parsedArgs = JSON.parse(raw)
      } catch {
        parsedArgs = raw
      }
    }

    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await runGameServerCommand(commandName, parsedArgs)
      setResult(`Command "${commandName}" executed. ok=${res.ok}`)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Operations</div>
          <h1>Game Server Control</h1>
          <p className="admin-sub">Control and monitor the remote Project Zomboid VPS from one admin panel.</p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={() => loadAll()} disabled={loading || busy}>Refresh</button>
        </div>
      </div>

      <div className="admin-grid four">
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Server Status</div>
          </div>
          <div className={`admin-status ${statusBadge.tone}`} style={{ marginTop: 6 }}>
            <span className="admin-status-dot" />
            {statusBadge.label}
          </div>
          <div style={{ marginTop: 8, display: 'inline-block', padding: '6px 10px', borderRadius: 999, border: `1px solid ${statusBadge.border}`, background: statusBadge.color }}>
            {statusBadge.label}
          </div>
          <div className="admin-card-sub">{telemetry?.server?.message ?? 'No message yet.'}</div>
          <div className="admin-card-sub">Last check: {fmtDate(telemetry?.checkedUtc)}</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Bridge</div>
          </div>
          <div className={`admin-status ${bridge?.configured ? 'good' : 'bad'}`} style={{ marginTop: 6 }}>
            <span className="admin-status-dot" />
            {bridge?.configured ? 'Connected' : 'Not Configured'}
          </div>
          <div className="admin-card-value" style={{ fontSize: 22 }}>{bridge?.configured ? 'Connected' : 'Not Configured'}</div>
          <div className="admin-card-sub">URL: {bridge?.bridgeUrl ?? 'set GREYHOURRP_GAME_CONTROL_URL'}</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Mods</div>
          </div>
          <div className="admin-card-value" style={{ fontSize: 22 }}>{telemetry?.mods?.count ?? 0}</div>
          <div className="admin-card-sub">Source: {telemetry?.mods?.source ?? 'set GREYHOURRP_GAME_SERVER_INI'}</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Issue Signals</div>
          </div>
          <div className="admin-card-value" style={{ fontSize: 22 }}>{telemetry?.issues?.count ?? 0}</div>
          <div className="admin-card-sub">Autosync: {telemetry?.automation?.enabled ? `On (${telemetry.automation.intervalSeconds}s)` : 'Off'}</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Version Guard</div>
          </div>
          <div className={`admin-status ${mismatchCount > 0 ? 'bad' : 'good'}`} style={{ marginTop: 6 }}>
            <span className="admin-status-dot" />
            {mismatchCount > 0 ? 'Mismatch Detected' : 'Aligned'}
          </div>
          <div className="admin-card-value" style={{ fontSize: 22 }}>{detectedVersion ?? 'unknown'}</div>
          <div className="admin-card-sub">Game Version</div>
          <div className="admin-card-sub">Version-suffixed mod mismatches: {mismatchCount}</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Panel API</div>
            <div className="admin-card-actions">
              <button className="admin-btn" onClick={runPanelCheck} disabled={busy || loading}>Check Panel</button>
            </div>
          </div>
          <div className={`admin-status ${panel?.configured ? (panel.ok ? 'good' : 'warn') : 'bad'}`} style={{ marginTop: 6 }}>
            <span className="admin-status-dot" />
            {panel?.configured ? (panel.ok ? 'Connected' : 'Degraded') : 'Not Configured'}
          </div>
          <div className="admin-card-value" style={{ fontSize: 22 }}>
            {panel?.configured ? (panel.ok ? 'Connected' : 'Degraded') : 'Not Configured'}
          </div>
          <div className="admin-card-sub">
            URL: {panel?.panelUrl ?? 'set GREYHOURRP_PANEL_URL'}
          </div>
          <div className="admin-card-sub">
            Server: {panel?.serverId ?? 'set GREYHOURRP_PANEL_SERVER_ID'}
          </div>
          {!panel?.ok && panel?.payload && (
            <div className="admin-card-sub" style={{ color: 'rgba(248,113,113,0.9)' }}>
              Last error: {extractPanelError(panel.payload)}
            </div>
          )}
          {panelCheckedAt && (
            <div className="admin-card-sub">Last check: {panelCheckedAt}</div>
          )}
        </div>
      </div>

      <div className="admin-grid two" style={{ marginTop: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Safe Controls</div>
          </div>
          <div className="admin-row" style={{ justifyContent: 'flex-start' }}>
            <button className="admin-btn" onClick={() => runSync(false)} disabled={busy || loading}>Sync Now</button>
            <button className="admin-btn" onClick={() => runSync(true)} disabled={busy || loading}>Force Sync</button>
            <button className="admin-btn" onClick={runWorkshopUpdate} disabled={busy || loading}>Update Workshop</button>
            <button className="admin-btn danger" onClick={runRestart} disabled={busy || loading || restartLocked}>
              {restartLocked ? `Restart Cooldown (${restartSecondsLeft}s)` : 'Restart Server'}
            </button>
            <button className="admin-btn danger" onClick={runPanelRestart} disabled={busy || loading || restartLocked}>
              {restartLocked ? `Restart Cooldown (${restartSecondsLeft}s)` : 'Restart via Panel'}
            </button>
          </div>
          <div className="admin-card-sub" style={{ marginTop: 8 }}>
            Restart is rate-limited to once every 5 minutes from this panel.
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Announce In-Game</div>
          </div>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Message</span>
            <textarea
              className="admin-textarea"
              rows={3}
              value={announceMessage}
              onChange={(e) => setAnnounceMessage(e.target.value)}
              placeholder="Server restart in 5 minutes..."
            />
          </label>
          <div className="admin-row">
            <button className="admin-btn primary" onClick={runAnnounce} disabled={busy || !announceMessage.trim()}>
              Send Announcement
            </button>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Advanced Command</div>
        </div>
        <div className="admin-grid two" style={{ marginTop: 10 }}>
          <label className="admin-field">
            <span>Command</span>
            <select className="admin-select" value={commandName} onChange={(e) => setCommandName(e.currentTarget.value)}>
              {COMMAND_ALLOWLIST.map((cmd) => (
                <option key={cmd} value={cmd}>{cmd}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Args (JSON or text)</span>
            <input
              className="admin-input"
              value={commandArgs}
              onChange={(e) => setCommandArgs(e.currentTarget.value)}
              placeholder='{"user":"name"}'
            />
          </label>
        </div>
        <div className="admin-row">
          <button className="admin-btn" onClick={runCommand} disabled={busy}>Run Command</button>
        </div>
        <div className="admin-card-sub">Only allowlisted commands are accepted from this panel.</div>
      </div>

      {(result || error) && (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-card-header">
            <div className="admin-card-title">Last Result</div>
          </div>
          {result && <div className="admin-card-sub" style={{ color: 'rgba(74,222,128,0.95)', marginTop: 8 }}>{result}</div>}
          {error && <div className="admin-card-sub" style={{ color: 'rgba(248,113,113,0.95)', marginTop: 8 }}>{error}</div>}
        </div>
      )}

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Game Activity</div>
        </div>
        <div className="admin-list" style={{ marginTop: 10 }}>
          {activity.length === 0 && <div className="admin-card-sub admin-empty">No game-control activity yet.</div>}
          {activity.map((row, idx) => (
            <div key={`${String(row.timeUtc ?? idx)}-${idx}`} className="admin-list-item">
              <div>
                <div className="admin-list-title">
                  {String(row.action ?? 'game-action')} · {String(row.target ?? '')}
                </div>
                <div className="admin-list-sub">
                  {String(row.user ?? 'unknown')} ({String(row.role ?? 'unknown')})
                </div>
              </div>
              <div className="admin-list-meta">{fmtDate(String(row.timeUtc ?? ''))}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
