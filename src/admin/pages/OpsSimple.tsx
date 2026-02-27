import { useEffect, useState } from 'react'
import {
  createPanelBackup,
  disableMaintenance,
  enableMaintenance,
  getOpsAlertEmails,
  getItemCatalogStatus,
  restartGameServerViaPanel,
  runOpsAutoFix,
  runSyncRestartMacro,
  saveOpsAlertEmails,
  syncGame,
  syncItemCatalog,
  testOpsAlerts
} from '../api/client'
import { useAdminAuth } from '../auth/AdminAuthContext'
import { NavLink } from 'react-router-dom'

type HostAction =
  | 'sync_status'
  | 'sync_items'
  | 'panel_restart'
  | 'macro_sync_restart'
  | 'ops_auto_fix'
  | 'maintenance_on'
  | 'maintenance_off'
  | 'backup_create'

export function AdminOpsSimple() {
  const { identity } = useAdminAuth()
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<HostAction>('sync_items')
  const [actionStatus, setActionStatus] = useState('')
  const [message, setMessage] = useState('Maintenance in progress. Server will return shortly.')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [catalogItems, setCatalogItems] = useState(0)
  const [catalogMods, setCatalogMods] = useState(0)
  const [catalogUpdatedUtc, setCatalogUpdatedUtc] = useState<string | undefined>(undefined)
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false)
  const [emailRecipientsInput, setEmailRecipientsInput] = useState('')
  const [smtpConfigured, setSmtpConfigured] = useState(false)

  async function refresh() {
    try {
      const catalog = await getItemCatalogStatus()
      setCatalogItems(catalog.items ?? 0)
      setCatalogMods(catalog.mods ?? 0)
      setCatalogUpdatedUtc(catalog.updatedUtc)
    } catch {}
    try {
      const email = await getOpsAlertEmails()
      setEmailAlertsEnabled(Boolean(email.enabled))
      setEmailRecipientsInput((email.recipients ?? []).join(', '))
      setSmtpConfigured(Boolean(email.smtpConfigured))
    } catch {}
  }

  async function saveEmails() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const recipients = emailRecipientsInput
        .split(/[,\n]/g)
        .map(value => value.trim())
        .filter(Boolean)
      const saved = await saveOpsAlertEmails({ enabled: emailAlertsEnabled, recipients })
      setEmailAlertsEnabled(Boolean(saved.enabled))
      setEmailRecipientsInput((saved.recipients ?? []).join(', '))
      setSmtpConfigured(Boolean(saved.smtpConfigured))
      setResult('Alert email list saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function sendEmailTest() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await testOpsAlerts()
      setResult(res.ok ? 'Test alert sent.' : 'Test alert did not send. Check SMTP config and recipients.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function run() {
    const actionLabel = action === 'sync_items'
      ? 'Sync Item Catalog'
      : action === 'sync_status'
        ? 'Sync Status + Mods'
        : action === 'panel_restart'
          ? 'Panel Restart'
          : action === 'macro_sync_restart'
            ? 'Sync + Restart Macro'
            : action === 'ops_auto_fix'
              ? 'Run Ops Auto-Fix'
              : action === 'maintenance_on'
                ? 'Enable Maintenance'
                : action === 'maintenance_off'
                  ? 'Disable Maintenance'
                  : 'Create Backup'
    setBusy(true)
    setError('')
    setResult('')
    setActionStatus(`Running: ${actionLabel}...`)
    try {
      switch (action) {
        case 'sync_status':
          await syncGame(true)
          setResult('Status + mod sync complete.')
          break
        case 'sync_items':
          {
            const sync = await syncItemCatalog()
            setResult(`Item catalog synced. Items: ${sync.items ?? 'n/a'}, Mods: ${sync.mods ?? 'n/a'}, Removed: ${sync.removed ?? 0}.`)
          }
          break
        case 'panel_restart':
          await restartGameServerViaPanel()
          setResult('Panel restart requested.')
          break
        case 'macro_sync_restart':
          await runSyncRestartMacro({ usePanelRestart: true, forceSync: true })
          setResult('Sync + restart macro completed.')
          break
        case 'ops_auto_fix':
          await runOpsAutoFix()
          setResult('Ops auto-fix executed.')
          break
        case 'maintenance_on':
          await enableMaintenance({ message, announce: true, announceMessage: message, usePanelRestart: false })
          setResult('Maintenance mode enabled.')
          break
        case 'maintenance_off':
          await disableMaintenance(message)
          setResult('Maintenance mode disabled.')
          break
        case 'backup_create':
          await createPanelBackup(`backup-${new Date().toISOString()}`)
          setResult('Backup request sent.')
          break
      }
      setActionStatus(`Done: ${actionLabel}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setActionStatus(`Failed: ${actionLabel}`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Host Operations</div>
          <h1>Simple Host Ops</h1>
          <p className="admin-sub">Pick one operation and click run.</p>
        </div>
      </div>

      <div className="admin-card">
        <label className="admin-field">
          <span>Operation</span>
          <select className="admin-select" value={action} onChange={e => setAction(e.currentTarget.value as HostAction)}>
            <option value="sync_items">Sync Item Catalog</option>
            <option value="sync_status">Sync Status + Mods</option>
            <option value="panel_restart">Panel Restart</option>
            <option value="macro_sync_restart">Sync + Restart Macro</option>
            <option value="ops_auto_fix">Run Ops Auto-Fix</option>
            <option value="maintenance_on">Enable Maintenance</option>
            <option value="maintenance_off">Disable Maintenance</option>
            <option value="backup_create">Create Backup</option>
          </select>
        </label>
        {(action === 'maintenance_on' || action === 'maintenance_off') && (
          <label className="admin-field">
            <span>Message</span>
            <input className="admin-input" value={message} onChange={e => setMessage(e.currentTarget.value)} />
          </label>
        )}
        <button className="admin-btn" disabled={busy} onClick={() => void run()}>
          {busy ? 'Running...' : 'Run Operation'}
        </button>
        {actionStatus && <div className="admin-notice" style={{ marginTop: 10 }}>{actionStatus}</div>}
      </div>

      <div className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-title">Item Catalog</div>
        <div className="admin-card-sub">Items: {catalogItems}</div>
        <div className="admin-card-sub">Mods: {catalogMods}</div>
        <div className="admin-card-sub">Updated: {catalogUpdatedUtc ? new Date(catalogUpdatedUtc).toLocaleString() : 'Unknown'}</div>
      </div>

      {false && (
        <div className="admin-card" style={{ marginTop: 12 }}>
          <div className="admin-card-title">Ops Alert Emails</div>
          <div className="admin-card-sub">
            SMTP status: {smtpConfigured ? 'Configured' : 'Missing SMTP env vars on server'}
          </div>
          <label className="admin-checkbox" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={emailAlertsEnabled}
              onChange={e => setEmailAlertsEnabled(e.currentTarget.checked)}
            />
            <span>Enable Email Alerts</span>
          </label>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Recipient Emails (comma-separated)</span>
            <textarea
              className="admin-textarea"
              rows={3}
              value={emailRecipientsInput}
              onChange={e => setEmailRecipientsInput(e.currentTarget.value)}
              placeholder="owner@example.com, admin@example.com"
            />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="admin-btn" disabled={busy} onClick={() => void saveEmails()}>
              Save Emails
            </button>
            <button className="admin-btn" disabled={busy} onClick={() => void sendEmailTest()}>
              Send Test Alert
            </button>
          </div>
        </div>
      )}

      {identity.role === 'owner' && (
        <div className="admin-card" style={{ marginTop: 12 }}>
          <div className="admin-card-title">Advanced</div>
          <div className="admin-card-sub">Owner-only deep operations page.</div>
          <NavLink className="admin-btn" to="/admin/ops-advanced">Open Advanced Ops</NavLink>
        </div>
      )}

      {result && <div className="admin-notice success">{result}</div>}
      {error && <div className="admin-notice warn">{error}</div>}
    </div>
  )
}
