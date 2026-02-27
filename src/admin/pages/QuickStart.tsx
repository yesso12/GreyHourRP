import { useEffect, useMemo, useRef, useState } from 'react'
import {
  announceDiscord,
  createPanelBackup,
  disableMaintenance,
  enableMaintenance,
  getDiscordMetrics,
  getDiscordStatus,
  getItemCatalogStatus,
  loadSiteSettings,
  getOpsSnapshot,
  getPublicLiveDiagnostics,
  getServerControlResources,
  getServerControlStatus,
  listDiscordBotCommands,
  restartGameServerViaPanel,
  runOpsAutoFix,
  runSyncRestartMacro,
  sendServerCommand,
  sendServerPower,
  syncGame,
  syncItemCatalog,
  testDiscord,
  saveSiteSettings,
  DEFAULT_SITE_SETTINGS,
  executeDiscordBotCommand,
  type ServerControlPowerSignal
} from '../api/client'

const LOCAL_AUTO_SYNC_KEY = 'ghrp_quick_item_autosync'
const LOCAL_AUTO_DEBUG_KEY = 'ghrp_quick_auto_debug'
const AUTO_DEBUG_COOLDOWN_MS = 10 * 60 * 1000
const SERVER_ADDRESS = (import.meta.env.VITE_SERVER_ADDRESS ?? '104.243.40.52:4566').trim()
const SERVER_MEMORY_MB = Number(import.meta.env.VITE_SERVER_MEMORY_MB ?? 20480)
const SERVER_DISK_MB = Number(import.meta.env.VITE_SERVER_DISK_MB ?? 51200)

type HostAction =
  | 'sync_items'
  | 'sync_status'
  | 'workshop_update'
  | 'panel_restart'
  | 'ops_auto_fix'
  | 'maintenance_on'
  | 'maintenance_off'
  | 'backup_create'

type SafeCommandPreset = 'save' | 'players' | 'help' | 'checkModsNeedUpdate' | 'custom'

type OpsSnapshot = Awaited<ReturnType<typeof getOpsSnapshot>>

const safeCommandOptions: Array<{ id: SafeCommandPreset; label: string; command: string }> = [
  { id: 'save', label: 'Save World', command: 'save' },
  { id: 'players', label: 'List Players', command: 'players' },
  { id: 'help', label: 'Console Help', command: 'help' },
  { id: 'checkModsNeedUpdate', label: 'Check Mods Need Update', command: 'checkModsNeedUpdate' },
  { id: 'custom', label: 'Custom Command', command: '' }
]

function fmtBytes(value?: number) {
  if (!value || value <= 0) return 'n/a'
  const gb = value / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function endpointLabel(key: string) {
  if (key === 'game') return 'Public Game API'
  if (key === 'discord') return 'Public Discord API'
  return 'Public Integration API'
}

function collectDebugIssues(diag: Awaited<ReturnType<typeof getPublicLiveDiagnostics>> | null, ops: OpsSnapshot | null) {
  const issues: string[] = []
  if (diag) {
    for (const endpoint of diag.endpoints) {
      if (!endpoint.ok) {
        issues.push(`${endpointLabel(endpoint.key)} is failing (${endpoint.status || 'network'}).`)
      }
    }
  }
  if (ops?.lastPanelHealthError) {
    issues.push(`Panel health warning: ${ops.lastPanelHealthError}`)
  }
  return issues
}

function hasFixableDebugIssue(diag: Awaited<ReturnType<typeof getPublicLiveDiagnostics>> | null) {
  if (!diag) return false
  return diag.endpoints.some((endpoint) => !endpoint.ok)
}

export function AdminQuickStart() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [debugBusy, setDebugBusy] = useState(false)
  const [status, setStatus] = useState('unknown')
  const [cpu, setCpu] = useState<number | undefined>(undefined)
  const [memory, setMemory] = useState<number | undefined>(undefined)
  const [powerAction, setPowerAction] = useState<ServerControlPowerSignal>('restart')
  const [safeCommandPreset, setSafeCommandPreset] = useState<SafeCommandPreset>('save')
  const [customCommand, setCustomCommand] = useState('')
  const [discordEnabled, setDiscordEnabled] = useState<boolean | null>(null)
  const [discordTotalCommands, setDiscordTotalCommands] = useState(0)
  const [discordErrors, setDiscordErrors] = useState(0)
  const [discordAction, setDiscordAction] = useState<'test' | 'announce'>('test')
  const [discordMessage, setDiscordMessage] = useState('Grey Hour RP update: services are healthy and monitored.')
  const [discordInviteUrl, setDiscordInviteUrl] = useState(DEFAULT_SITE_SETTINGS.discordInviteUrl ?? 'https://discord.gg/wCUJckSk3s')
  const [inviteSaving, setInviteSaving] = useState(false)
  const [hostAction, setHostAction] = useState<HostAction>('sync_items')
  const [hostMessage, setHostMessage] = useState('Grey Hour RP is entering maintenance. Progress is preserved.')
  const [catalogItems, setCatalogItems] = useState(0)
  const [catalogMods, setCatalogMods] = useState(0)
  const [catalogUpdatedUtc, setCatalogUpdatedUtc] = useState<string | undefined>(undefined)
  const [catalogAutoSync, setCatalogAutoSync] = useState<boolean>(() => {
    const raw = localStorage.getItem(LOCAL_AUTO_SYNC_KEY)
    return raw == null ? true : raw === 'true'
  })
  const [autoDebugEnabled, setAutoDebugEnabled] = useState<boolean>(() => {
    const raw = localStorage.getItem(LOCAL_AUTO_DEBUG_KEY)
    return raw == null ? true : raw === 'true'
  })
  const [diag, setDiag] = useState<Awaited<ReturnType<typeof getPublicLiveDiagnostics>> | null>(null)
  const [opsSnapshot, setOpsSnapshot] = useState<OpsSnapshot | null>(null)
  const [debugIssues, setDebugIssues] = useState<string[]>([])
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [botCommands, setBotCommands] = useState<Array<{ id: string; label: string; description?: string }>>([])
  const [selectedBotCommand, setSelectedBotCommand] = useState('')
  const [botMessage, setBotMessage] = useState('Server update from admin control panel.')
  const [botChannelId, setBotChannelId] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const autoFixLockRef = useRef(false)
  const lastAutoFixMsRef = useRef(0)

  const selectedBotCommandMeta = useMemo(
    () => botCommands.find((entry) => entry.id === selectedBotCommand) ?? null,
    [botCommands, selectedBotCommand]
  )

  function appendDebugLog(message: string) {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`
    setDebugLog((prev) => [line, ...prev].slice(0, 8))
  }

  function resolveSafeCommand() {
    if (safeCommandPreset === 'custom') return customCommand.trim()
    return safeCommandOptions.find((entry) => entry.id === safeCommandPreset)?.command ?? ''
  }

  async function refreshCore() {
    const [s, r, dStatus, dMetrics, catalog] = await Promise.all([
      getServerControlStatus(),
      getServerControlResources(),
      getDiscordStatus(),
      getDiscordMetrics(),
      getItemCatalogStatus()
    ])

    if (s.ok) setStatus((s.data?.state ?? 'unknown').toLowerCase())
    if (r.ok) {
      setCpu(r.data?.cpuAbsolute)
      setMemory(r.data?.memoryBytes)
    }
    setDiscordEnabled(Boolean(dStatus.enabled))
    setDiscordTotalCommands(Math.round(dMetrics.counters?.gh_bot_commands_total ?? 0))
    setDiscordErrors(Math.round(dMetrics.counters?.gh_bot_command_errors_total ?? 0))
    setCatalogItems(catalog.items ?? 0)
    setCatalogMods(catalog.mods ?? 0)
    setCatalogUpdatedUtc(catalog.updatedUtc)
  }

  async function refreshDebug() {
    const [diagResult, ops] = await Promise.all([
      getPublicLiveDiagnostics(),
      getOpsSnapshot().catch(() => null)
    ])
    const issues = collectDebugIssues(diagResult, ops)
    setDiag(diagResult)
    setOpsSnapshot(ops)
    setDebugIssues(issues)
    return { issues, diagResult, ops }
  }

  async function refreshAll() {
    setError('')
    try {
      await Promise.all([refreshCore(), refreshDebug()])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function runPowerAction() {
    if (powerAction === 'kill') {
      const approved = confirm('Emergency KILL will hard-stop the server immediately. Continue?')
      if (!approved) return
    }
    setBusy(true)
    setError('')
    setResult('')
    try {
      await sendServerPower(powerAction)
      setResult(`Success: ${powerAction.toUpperCase()} sent.`)
      await refreshCore()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runGameCommand() {
    const text = resolveSafeCommand()
    if (!text) {
      setError('Please select a command or type a custom command first.')
      return
    }
    setBusy(true)
    setError('')
    setResult('')
    try {
      await sendServerCommand(text)
      setResult(`Server command sent: ${text}`)
      if (safeCommandPreset === 'custom') setCustomCommand('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runDiscordAction() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      if (discordAction === 'test') {
        await testDiscord()
        setResult('Discord webhook test sent successfully.')
      } else {
        const message = discordMessage.trim()
        if (!message) throw new Error('Announcement message is required.')
        await announceDiscord(message, false)
        setResult('Discord announcement sent.')
      }
      await refreshCore()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function saveInviteLink() {
    const invite = discordInviteUrl.trim()
    if (!invite) {
      setError('Discord invite URL is required.')
      return
    }
    setInviteSaving(true)
    setError('')
    setResult('')
    try {
      await saveSiteSettings({ discordInviteUrl: invite })
      setResult('Discord invite link updated for the public website.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInviteSaving(false)
    }
  }

  async function runBotCommand() {
    if (!selectedBotCommand) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const payload: Record<string, unknown> = {}
      if (selectedBotCommand === 'announce.send' || selectedBotCommand === 'channel.message') {
        payload.message = botMessage.trim()
      }
      if (selectedBotCommand === 'channel.message' && botChannelId.trim()) {
        payload.channelId = botChannelId.trim()
      }
      await executeDiscordBotCommand(selectedBotCommand, payload)
      setResult(`Bot command executed: ${selectedBotCommand}`)
      await refreshCore()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runHostAction() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      switch (hostAction) {
        case 'sync_items':
          await syncItemCatalog()
          setResult('Item catalog synced from current mod sources.')
          break
        case 'sync_status':
          await syncGame(true)
          setResult('Status and mods sync completed.')
          break
        case 'workshop_update':
          await runSyncRestartMacro({ usePanelRestart: true, forceSync: true })
          setResult('Workshop-safe sync/restart macro completed.')
          break
        case 'panel_restart':
          await restartGameServerViaPanel()
          setResult('Panel restart requested.')
          break
        case 'ops_auto_fix':
          await runOpsAutoFix()
          setResult('Ops auto-fix executed.')
          break
        case 'maintenance_on':
          await enableMaintenance({
            message: hostMessage.trim() || undefined,
            announce: true,
            announceMessage: hostMessage.trim() || undefined,
            usePanelRestart: false
          })
          setResult('Maintenance mode enabled.')
          break
        case 'maintenance_off':
          await disableMaintenance(hostMessage.trim() || undefined)
          setResult('Maintenance mode disabled.')
          break
        case 'backup_create':
          await createPanelBackup(`backup-${new Date().toISOString()}`)
          setResult('Panel backup request sent.')
          break
      }
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function syncItemsNow() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      await syncItemCatalog()
      setResult('Item catalog synced.')
      await refreshCore()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runAutoDebug(manual: boolean) {
    if (autoFixLockRef.current) return
    if (!manual && !autoDebugEnabled) return

    const now = Date.now()
    if (!manual && now - lastAutoFixMsRef.current < AUTO_DEBUG_COOLDOWN_MS) return

    setDebugBusy(true)
    try {
      const { issues, diagResult } = await refreshDebug()
      if (issues.length === 0) {
        if (manual) appendDebugLog('No issues detected. All endpoints are healthy.')
        return
      }

      if (!hasFixableDebugIssue(diagResult)) {
        appendDebugLog('Issue is advisory only (panel health warning). Auto-fix skipped.')
        return
      }

      autoFixLockRef.current = true
      appendDebugLog(`Detected ${issues.length} issue(s). Running safe auto-fix.`)
      const fix = await runOpsAutoFix()
      lastAutoFixMsRef.current = Date.now()
      appendDebugLog(fix.message ?? 'Safe auto-fix completed.')
      setResult(fix.message ?? 'Auto-debug applied safe fixes.')
      await refreshAll()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      appendDebugLog(`Auto-debug error: ${message}`)
      setError(message)
    } finally {
      autoFixLockRef.current = false
      setDebugBusy(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    refreshAll().finally(() => setLoading(false))
    const id = window.setInterval(() => {
      refreshCore().catch(() => {})
    }, 15000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    listDiscordBotCommands()
      .then((res) => {
        const rows = (res.commands ?? []).map((cmd) => ({
          id: cmd.id,
          label: cmd.label,
          description: cmd.description
        }))
        setBotCommands(rows)
        if (!selectedBotCommand && rows.length > 0) setSelectedBotCommand(rows[0].id)
      })
      .catch(() => setBotCommands([]))
  }, [])

  useEffect(() => {
    loadSiteSettings()
      .then((settings) => {
        const invite = String(settings.discordInviteUrl ?? '').trim()
        if (invite) setDiscordInviteUrl(invite)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    localStorage.setItem(LOCAL_AUTO_SYNC_KEY, String(catalogAutoSync))
  }, [catalogAutoSync])

  useEffect(() => {
    localStorage.setItem(LOCAL_AUTO_DEBUG_KEY, String(autoDebugEnabled))
  }, [autoDebugEnabled])

  useEffect(() => {
    if (!catalogAutoSync) return
    const id = window.setInterval(() => {
      syncItemCatalog().then(() => refreshCore()).catch(() => {})
    }, 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [catalogAutoSync])

  useEffect(() => {
    const id = window.setInterval(() => {
      runAutoDebug(false).catch(() => {})
    }, 60 * 1000)
    return () => window.clearInterval(id)
  }, [autoDebugEnabled])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Control Center</div>
          <h1>Simple Admin Panel</h1>
          <p className="admin-sub">Beginner-safe actions only. Use one dropdown, then one button.</p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" disabled={busy || debugBusy} onClick={() => void refreshAll()}>Refresh</button>
        </div>
      </div>

      <div className="admin-grid two">
        <div className="admin-card">
          <div className="admin-card-title">1) Server Power</div>
          <div className="admin-card-sub">Address: {SERVER_ADDRESS}</div>
          <div className="admin-card-sub">Limit profile: {SERVER_MEMORY_MB} MB RAM / {SERVER_DISK_MB} MB Disk</div>
          <div className={`admin-status ${status === 'running' ? 'good' : status === 'offline' ? 'bad' : 'warn'}`} style={{ marginTop: 8 }}>
            <span className="admin-status-dot" />
            {status.toUpperCase()}
          </div>
          <div className="admin-card-sub">CPU: {cpu != null ? `${cpu.toFixed(2)}%` : 'n/a'}</div>
          <div className="admin-card-sub">Memory: {fmtBytes(memory)}</div>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Power action</span>
            <select className="admin-select" value={powerAction} onChange={e => setPowerAction(e.currentTarget.value as ServerControlPowerSignal)}>
              <option value="restart">Restart (Recommended)</option>
              <option value="start">Start</option>
              <option value="stop">Stop</option>
              <option value="kill">Emergency Kill</option>
            </select>
          </label>
          <button className="admin-btn" disabled={busy} onClick={() => void runPowerAction()}>
            Run Power Action
          </button>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">2) Safe Console Commands</div>
          <div className="admin-card-sub">Use presets to avoid typos and bad commands.</div>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Command preset</span>
            <select className="admin-select" value={safeCommandPreset} onChange={e => setSafeCommandPreset(e.currentTarget.value as SafeCommandPreset)}>
              {safeCommandOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label}</option>
              ))}
            </select>
          </label>
          {safeCommandPreset === 'custom' && (
            <label className="admin-field">
              <span>Custom command</span>
              <input
                className="admin-input"
                value={customCommand}
                onChange={e => setCustomCommand(e.currentTarget.value)}
                placeholder="Type an exact command"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void runGameCommand()
                  }
                }}
              />
            </label>
          )}
          <button className="admin-btn" disabled={busy} onClick={() => void runGameCommand()}>
            Send Command
          </button>
        </div>
      </div>

      <div className="admin-grid two" style={{ marginTop: 14 }}>
        <div className="admin-card">
          <div className="admin-card-title">3) Discord Quick Actions</div>
          <div className="admin-card-sub">Webhook: {discordEnabled == null ? 'Checking...' : discordEnabled ? 'Connected' : 'Not connected'}</div>
          <div className="admin-card-sub">Commands: {discordTotalCommands} total • {discordErrors} errors</div>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Action</span>
            <select className="admin-select" value={discordAction} onChange={e => setDiscordAction(e.currentTarget.value as 'test' | 'announce')}>
              <option value="test">Send Webhook Test</option>
              <option value="announce">Send Announcement</option>
            </select>
          </label>
          {discordAction === 'announce' && (
            <label className="admin-field">
              <span>Announcement message</span>
              <input className="admin-input" value={discordMessage} onChange={e => setDiscordMessage(e.currentTarget.value)} />
            </label>
          )}
          <button className="admin-btn" disabled={busy} onClick={() => void runDiscordAction()}>
            Run Discord Action
          </button>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Public Discord invite link</span>
            <input
              className="admin-input"
              value={discordInviteUrl}
              onChange={e => setDiscordInviteUrl(e.currentTarget.value)}
              placeholder="https://discord.gg/..."
            />
          </label>
          <button className="admin-btn" disabled={inviteSaving} onClick={() => void saveInviteLink()}>
            {inviteSaving ? 'Saving Invite…' : 'Save Invite Link'}
          </button>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">4) Host Operations</div>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Operation</span>
            <select className="admin-select" value={hostAction} onChange={e => setHostAction(e.currentTarget.value as HostAction)}>
              <option value="sync_items">Sync Item Catalog (Recommended)</option>
              <option value="sync_status">Sync Status + Mods</option>
              <option value="workshop_update">Workshop Safe Sync + Restart</option>
              <option value="panel_restart">Panel Restart</option>
              <option value="ops_auto_fix">Run Ops Auto-Fix</option>
              <option value="maintenance_on">Enable Maintenance</option>
              <option value="maintenance_off">Disable Maintenance</option>
              <option value="backup_create">Create Panel Backup</option>
            </select>
          </label>
          {(hostAction === 'maintenance_on' || hostAction === 'maintenance_off') && (
            <label className="admin-field">
              <span>Maintenance message</span>
              <input className="admin-input" value={hostMessage} onChange={e => setHostMessage(e.currentTarget.value)} />
            </label>
          )}
          <button className="admin-btn" disabled={busy} onClick={() => void runHostAction()}>
            Run Host Operation
          </button>
        </div>
      </div>

      <div className="admin-grid two" style={{ marginTop: 14 }}>
        <div className="admin-card">
          <div className="admin-card-title">5) Item Codes Automation</div>
          <div className="admin-card-sub">Catalog items: {catalogItems}</div>
          <div className="admin-card-sub">Active mods: {catalogMods}</div>
          <div className="admin-card-sub">
            Last sync: {catalogUpdatedUtc ? new Date(catalogUpdatedUtc).toLocaleString() : 'unknown'}
          </div>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Auto-sync item codes every 5 minutes</span>
            <select
              className="admin-select"
              value={catalogAutoSync ? 'on' : 'off'}
              onChange={e => setCatalogAutoSync(e.currentTarget.value === 'on')}
            >
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
          <button className="admin-btn" disabled={busy} onClick={() => void syncItemsNow()}>
            Sync Item Catalog Now
          </button>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">6) Auto Debug Website</div>
          <div className={`admin-status ${debugIssues.length === 0 ? 'good' : 'warn'}`} style={{ marginTop: 6 }}>
            <span className="admin-status-dot" />
            {debugIssues.length === 0 ? 'Healthy' : `${debugIssues.length} issue(s) detected`}
          </div>
          {diag?.checkedUtc && (
            <div className="admin-card-sub">Last check: {new Date(diag.checkedUtc).toLocaleString()}</div>
          )}
          {opsSnapshot?.lastPanelHealthUtc && (
            <div className="admin-card-sub">Panel check: {new Date(opsSnapshot.lastPanelHealthUtc).toLocaleString()}</div>
          )}
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Auto-debug (safe fixes with cooldown)</span>
            <select
              className="admin-select"
              value={autoDebugEnabled ? 'on' : 'off'}
              onChange={e => setAutoDebugEnabled(e.currentTarget.value === 'on')}
            >
              <option value="on">On (Recommended)</option>
              <option value="off">Off</option>
            </select>
          </label>
          <button className="admin-btn" disabled={debugBusy} onClick={() => void runAutoDebug(true)}>
            {debugBusy ? 'Running Auto Debug…' : 'Run Auto Debug Now'}
          </button>
          {debugIssues.length > 0 && (
            <div className="admin-list" style={{ marginTop: 10 }}>
              {debugIssues.slice(0, 4).map((issue) => (
                <div key={issue} className="admin-list-item">{issue}</div>
              ))}
            </div>
          )}
          {debugLog.length > 0 && (
            <div className="admin-list" style={{ marginTop: 10 }}>
              {debugLog.map((line) => (
                <div key={line} className="admin-list-item">{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 14 }}>
        <div className="admin-card-title">Discord Bot Command Runner</div>
        <div className="admin-card-sub">All approved bot operations are available here with dropdown + run button.</div>
        <label className="admin-field" style={{ marginTop: 10 }}>
          <span>Bot command</span>
          <select className="admin-select" value={selectedBotCommand} onChange={e => setSelectedBotCommand(e.currentTarget.value)}>
            {botCommands.map((cmd) => (
              <option key={cmd.id} value={cmd.id}>{cmd.label}</option>
            ))}
          </select>
        </label>
        {selectedBotCommandMeta?.description && (
          <div className="admin-card-sub">{selectedBotCommandMeta.description}</div>
        )}
        {(selectedBotCommand === 'announce.send' || selectedBotCommand === 'channel.message') && (
          <label className="admin-field">
            <span>Message</span>
            <input className="admin-input" value={botMessage} onChange={e => setBotMessage(e.currentTarget.value)} />
          </label>
        )}
        {selectedBotCommand === 'channel.message' && (
          <label className="admin-field">
            <span>Channel ID</span>
            <input className="admin-input" value={botChannelId} onChange={e => setBotChannelId(e.currentTarget.value)} placeholder="Discord text channel ID" />
          </label>
        )}
        <button className="admin-btn" disabled={busy || !selectedBotCommand} onClick={() => void runBotCommand()}>
          Run Bot Command
        </button>
      </div>

      {loading && <div className="admin-notice">Loading control center...</div>}
      {result && <div className="admin-notice success">{result}</div>}
      {error && <div className="admin-notice warn">{error}</div>}
    </div>
  )
}
