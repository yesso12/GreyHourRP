import { useEffect, useState } from 'react'
import {
  createPanelBackup,
  disableMaintenance,
  enableMaintenance,
  getContent,
  getMaintenanceStatus,
  getModsDiff,
  getGameIssues,
  getGamePlayers,
  runGameServerCommand,
  syncItemCatalog,
  fixGameIssues,
  restartGameServerViaPanel,
  getPanelBackupDownload,
  getPlayersHistory,
  getPlayersHistoryCsvUrl,
  getOpsSnapshot,
  loadStatusHistory,
  listPanelBackups,
  muteOpsAlerts,
  muteOpsAlertsUntil,
  appendOpsLog,
  clearGameIssues,
  runMaintenanceMacro,
  runSyncRestartMacro,
  unmuteOpsAlerts,
  saveContent,
  type ModsDiffResponse,
  type PlayerHistoryEntry
} from '../api/client'
import type { StatusHistoryItem } from '../../types/content'

export function AdminOps() {
  const [opsConfigRaw, setOpsConfigRaw] = useState('')
  const [opsConfigDirty, setOpsConfigDirty] = useState(false)
  const [opsConfigError, setOpsConfigError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [alertMinInterval, setAlertMinInterval] = useState(15)
  const [quietEnabled, setQuietEnabled] = useState(false)
  const [quietStart, setQuietStart] = useState('00:00')
  const [quietEnd, setQuietEnd] = useState('06:00')
  const [alertPanelHealth, setAlertPanelHealth] = useState(true)
  const [alertRestarts, setAlertRestarts] = useState(true)
  const [alertMismatches, setAlertMismatches] = useState(true)
  const [alertSchedule, setAlertSchedule] = useState(true)
  const [alertSummary, setAlertSummary] = useState(true)
  const [dailyEnabled, setDailyEnabled] = useState(false)
  const [dailyTime, setDailyTime] = useState('20:00')
  const [dailyIncludeCsv, setDailyIncludeCsv] = useState(false)
  const [weeklyEnabled, setWeeklyEnabled] = useState(false)
  const [weeklyTime, setWeeklyTime] = useState('20:00')
  const [weeklyDay, setWeeklyDay] = useState('sun')
  const [weeklyIncludeCsv, setWeeklyIncludeCsv] = useState(false)
  const [exportEnabled, setExportEnabled] = useState(false)
  const [exportCadence, setExportCadence] = useState('daily')
  const [exportTime, setExportTime] = useState('21:00')
  const [exportDay, setExportDay] = useState('sun')
  const [exportHours, setExportHours] = useState(24)
  const [exportLimit, setExportLimit] = useState(2000)
  const [exportMessage, setExportMessage] = useState('Scheduled CSV export.')
  const [muteUntil, setMuteUntil] = useState<string | null>(null)
  const [muteUntilInput, setMuteUntilInput] = useState('')
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [maintenanceAutoMute, setMaintenanceAutoMute] = useState(true)
  const [maintenanceStatus, setMaintenanceStatus] = useState<Record<string, unknown> | null>(null)
  const [modsDiff, setModsDiff] = useState<ModsDiffResponse | null>(null)
  const [panelBackups, setPanelBackups] = useState<Record<string, unknown> | null>(null)
  const [panelBackupName, setPanelBackupName] = useState('')
  const [issueLog, setIssueLog] = useState<Array<{
    source?: string
    message?: string
    type?: string
    fixable?: boolean
    severity?: string
    recommendation?: string
    count?: number
  }>>([])
  const [issueSources, setIssueSources] = useState<string[]>([])
  const [issueSummary, setIssueSummary] = useState<{
    autoFixEnabled: boolean
    autoFixUsePanel: boolean
    autoFixRepeatThreshold: number
    lastMismatchCount: number
    lastAutoFixUtc?: string | null
  } | null>(null)
  const [issueAutoRefresh, setIssueAutoRefresh] = useState(true)
  const [issueRefreshSeconds, setIssueRefreshSeconds] = useState(45)
  const [issueLastRefresh, setIssueLastRefresh] = useState<string | null>(null)
  const [summaryWebhookUrl, setSummaryWebhookUrl] = useState('')
  const [summaryRoleIds, setSummaryRoleIds] = useState('')
  const [playerHistory, setPlayerHistory] = useState<PlayerHistoryEntry[]>([])
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([])
  const [playersOnline, setPlayersOnline] = useState<Array<{ name?: string; raw?: string }>>([])
  const [playersRaw, setPlayersRaw] = useState<string | null>(null)
  const [playersSelected, setPlayersSelected] = useState<Set<string>>(new Set())
  const [giftItemCode, setGiftItemCode] = useState('Base.WaterBottleFull')
  const [giftItemCount, setGiftItemCount] = useState(1)
  const [giftCommandTemplate, setGiftCommandTemplate] = useState('additem "{player}" "{item}" {count}')
  const [rewardGroups, setRewardGroups] = useState<Array<{ id: string; label: string; members: string[] }>>([])
  const [rewardGroupLabel, setRewardGroupLabel] = useState('')
  const [rewardGroupMembers, setRewardGroupMembers] = useState('')
  const [playerFilter, setPlayerFilter] = useState('')
  const [giftPresetCounts] = useState([1, 3, 5, 10])
  const [itemCatalog, setItemCatalog] = useState<Array<{ code: string; name: string; category?: string; favorite?: boolean; sourceModId?: string; sourceWorkshopId?: string }>>([])
  const [itemPresets, setItemPresets] = useState<Array<{ id: string; label: string; items: Array<{ code: string; count: number }> }>>([])
  const [factionRoster, setFactionRoster] = useState<Array<{ id: string; name: string; members: string[] }>>([])
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [selectedFactionId, setSelectedFactionId] = useState('')
  const [factionOnlyOnline, setFactionOnlyOnline] = useState(true)
  const [newItemCode, setNewItemCode] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newItemSourceModId, setNewItemSourceModId] = useState('')
  const [newItemSourceWorkshopId, setNewItemSourceWorkshopId] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [itemCategoryFilter, setItemCategoryFilter] = useState('all')
  const [bulkImportText, setBulkImportText] = useState('')
  const [bulkImportTarget, setBulkImportTarget] = useState<'items' | 'presets' | 'factions'>('items')
  const [bulkImportFileName, setBulkImportFileName] = useState('')
  const [favoriteCodesText, setFavoriteCodesText] = useState('')
  const [newPresetLabel, setNewPresetLabel] = useState('')
  const [newPresetItems, setNewPresetItems] = useState('')
  const [newFactionName, setNewFactionName] = useState('')
  const [newFactionMembers, setNewFactionMembers] = useState('')
  const [historyRange, setHistoryRange] = useState('24h')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [smoothSeries, setSmoothSeries] = useState(true)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [opsLog, setOpsLog] = useState<Array<{ time: string; message: string; payload?: string }>>([])
  const [showFixableOnly, setShowFixableOnly] = useState(false)

  function pushOpsLog(message: string, payload?: unknown) {
    const entry = {
      time: new Date().toLocaleString(),
      message,
      payload: payload ? JSON.stringify(payload, null, 2) : undefined
    }
    setOpsLog((prev) => [entry, ...prev].slice(0, 8))
    void appendOpsLog([
      {
        timeUtc: new Date().toISOString(),
        message,
        payload
      }
    ]).catch(() => {})
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ghrp_ops_log')
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ time: string; message: string; payload?: string }>
        setOpsLog(parsed.slice(0, 8))
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('ghrp_ops_log', JSON.stringify(opsLog.slice(0, 8)))
    } catch {
      // ignore storage errors
    }
  }, [opsLog])

  async function loadOpsConfig() {
    setOpsConfigError('')
    try {
      const config = await getContent<Record<string, unknown>>('ops-config')
      setOpsConfigRaw(JSON.stringify(config, null, 2))
      setOpsConfigDirty(false)
      const alerts = (config.discordAlerts ?? {}) as Record<string, unknown>
      const quiet = (alerts.quietHours ?? {}) as Record<string, unknown>
      const categories = (alerts.categories ?? {}) as Record<string, unknown>
      setAlertMinInterval(Number(alerts.minIntervalMinutes ?? 15))
      setQuietEnabled(Boolean(quiet.enabled ?? false))
      setQuietStart(String(quiet.start ?? '00:00'))
      setQuietEnd(String(quiet.end ?? '06:00'))
      setAlertPanelHealth(Boolean(categories.panelHealth ?? true))
      setAlertRestarts(Boolean(categories.restarts ?? true))
      setAlertMismatches(Boolean(categories.mismatches ?? true))
      setAlertSchedule(Boolean(categories.schedule ?? true))
      setAlertSummary(Boolean(categories.summary ?? true))
      const daily = (config.dailySummary ?? {}) as Record<string, unknown>
      setDailyEnabled(Boolean(daily.enabled ?? false))
      setDailyTime(String(daily.time ?? '20:00'))
      setDailyIncludeCsv(Boolean(daily.includeCsv ?? false))
      const weekly = (config.weeklySummary ?? {}) as Record<string, unknown>
      setWeeklyEnabled(Boolean(weekly.enabled ?? false))
      setWeeklyTime(String(weekly.time ?? '20:00'))
      setWeeklyDay(String(weekly.dayOfWeek ?? 'sun'))
      setWeeklyIncludeCsv(Boolean(weekly.includeCsv ?? false))
      const exportSchedule = (config.exportSchedule ?? {}) as Record<string, unknown>
      setExportEnabled(Boolean(exportSchedule.enabled ?? false))
      setExportCadence(String(exportSchedule.cadence ?? 'daily'))
      setExportTime(String(exportSchedule.time ?? '21:00'))
      setExportDay(String(exportSchedule.dayOfWeek ?? 'sun'))
      setExportHours(Number(exportSchedule.hours ?? 24))
      setExportLimit(Number(exportSchedule.limit ?? 2000))
      setExportMessage(String(exportSchedule.message ?? 'Scheduled CSV export.'))
      const maintenance = (config.maintenance ?? {}) as Record<string, unknown>
      setMaintenanceAutoMute(Boolean(maintenance.autoMuteAlerts ?? true))
      setSummaryWebhookUrl(String(alerts.summaryWebhookUrl ?? ''))
      setSummaryRoleIds(
        Array.isArray(alerts.summaryRoleIds)
          ? (alerts.summaryRoleIds as string[]).join(', ')
          : ''
      )
      const rewardCommands = (config.rewardCommands ?? {}) as Record<string, unknown>
      setGiftCommandTemplate(String(rewardCommands.itemTemplate ?? 'additem "{player}" "{item}" {count}'))
      const groups = Array.isArray((config as Record<string, unknown>).rewardGroups)
        ? ((config as Record<string, unknown>).rewardGroups as Array<{ id?: string; label?: string; members?: string[] }>)
        : []
      setRewardGroups(groups.map((group) => ({
        id: String(group.id ?? group.label ?? `group-${Math.random().toString(36).slice(2, 8)}`),
        label: String(group.label ?? group.id ?? 'Group'),
        members: Array.isArray(group.members) ? group.members.map(String) : []
      })))
    } catch (err) {
      setOpsConfigError(err instanceof Error ? err.message : String(err))
    }
  }

  async function refreshMuteStatus() {
    try {
      const snapshot = await getOpsSnapshot()
      setMuteUntil(snapshot.muteAlertsUntilUtc ?? null)
    } catch { }
  }

  async function saveOpsConfig() {
    setOpsConfigError('')
    try {
      const parsed = JSON.parse(opsConfigRaw || '{}') as Record<string, unknown>
      await saveContent('ops-config', parsed)
      setOpsConfigDirty(false)
      setResult('Ops config saved.')
    } catch (err) {
      setOpsConfigError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveAlertSettings() {
    setOpsConfigError('')
    try {
      const parsed = JSON.parse(opsConfigRaw || '{}') as Record<string, unknown>
      const alerts = (parsed.discordAlerts ?? {}) as Record<string, unknown>
      const quiet = (alerts.quietHours ?? {}) as Record<string, unknown>
      const categories = (alerts.categories ?? {}) as Record<string, unknown>
      alerts.minIntervalMinutes = alertMinInterval
      categories.panelHealth = alertPanelHealth
      categories.restarts = alertRestarts
      categories.mismatches = alertMismatches
      categories.schedule = alertSchedule
      categories.summary = alertSummary
      alerts.categories = categories
      quiet.enabled = quietEnabled
      quiet.start = quietStart
      quiet.end = quietEnd
      alerts.quietHours = quiet
      parsed.discordAlerts = alerts
      setOpsConfigRaw(JSON.stringify(parsed, null, 2))
      await saveContent('ops-config', parsed)
      setOpsConfigDirty(false)
      setResult('Alert settings saved.')
    } catch (err) {
      setOpsConfigError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveSummarySettings() {
    setOpsConfigError('')
    try {
      const parsed = JSON.parse(opsConfigRaw || '{}') as Record<string, unknown>
      parsed.dailySummary = {
        ...(parsed.dailySummary as Record<string, unknown> ?? {}),
        enabled: dailyEnabled,
        time: dailyTime,
        includeCsv: dailyIncludeCsv
      }
      parsed.weeklySummary = {
        ...(parsed.weeklySummary as Record<string, unknown> ?? {}),
        enabled: weeklyEnabled,
        time: weeklyTime,
        dayOfWeek: weeklyDay,
        includeCsv: weeklyIncludeCsv
      }
      const alerts = (parsed.discordAlerts ?? {}) as Record<string, unknown>
      alerts.summaryWebhookUrl = summaryWebhookUrl.trim() || null
      alerts.summaryRoleIds = summaryRoleIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      parsed.discordAlerts = alerts
      setOpsConfigRaw(JSON.stringify(parsed, null, 2))
      await saveContent('ops-config', parsed)
      setOpsConfigDirty(false)
      setResult('Summary settings saved.')
    } catch (err) {
      setOpsConfigError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveRewardSettings() {
    setOpsConfigError('')
    try {
      const parsed = JSON.parse(opsConfigRaw || '{}') as Record<string, unknown>
      parsed.rewardCommands = {
        ...(parsed.rewardCommands as Record<string, unknown> ?? {}),
        itemTemplate: giftCommandTemplate
      }
      parsed.rewardGroups = rewardGroups.map((group) => ({
        id: group.id,
        label: group.label,
        members: group.members
      }))
      setOpsConfigRaw(JSON.stringify(parsed, null, 2))
      await saveContent('ops-config', parsed)
      setOpsConfigDirty(false)
      setResult('Reward settings saved.')
    } catch (err) {
      setOpsConfigError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveRewardLibrary() {
    setOpsConfigError('')
    try {
      await saveContent('items-catalog', {
        updatedUtc: new Date().toISOString(),
        items: itemCatalog
      })
      await saveContent('item-presets', {
        updatedUtc: new Date().toISOString(),
        presets: itemPresets
      })
      await saveContent('factions-roster', {
        updatedUtc: new Date().toISOString(),
        factions: factionRoster
      })
      setResult('Reward library saved.')
    } catch (err) {
      setOpsConfigError(err instanceof Error ? err.message : String(err))
    }
  }

  async function runCatalogSync() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await syncItemCatalog()
      await loadRewardSources()
      setResult(`Catalog synced. Mods: ${res.mods}, Items: ${res.items}, Removed: ${res.removed}.`)
      pushOpsLog('Catalog sync', res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function saveExportSchedule() {
    setOpsConfigError('')
    try {
      const parsed = JSON.parse(opsConfigRaw || '{}') as Record<string, unknown>
      parsed.exportSchedule = {
        ...(parsed.exportSchedule as Record<string, unknown> ?? {}),
        enabled: exportEnabled,
        cadence: exportCadence,
        time: exportTime,
        dayOfWeek: exportDay,
        hours: exportHours,
        limit: exportLimit,
        message: exportMessage
      }
      setOpsConfigRaw(JSON.stringify(parsed, null, 2))
      await saveContent('ops-config', parsed)
      setOpsConfigDirty(false)
      setResult('Export schedule saved.')
    } catch (err) {
      setOpsConfigError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveMaintenanceSettings() {
    setOpsConfigError('')
    try {
      const parsed = JSON.parse(opsConfigRaw || '{}') as Record<string, unknown>
      parsed.maintenance = {
        ...(parsed.maintenance as Record<string, unknown> ?? {}),
        autoMuteAlerts: maintenanceAutoMute
      }
      setOpsConfigRaw(JSON.stringify(parsed, null, 2))
      await saveContent('ops-config', parsed)
      setOpsConfigDirty(false)
      setResult('Maintenance settings saved.')
    } catch (err) {
      setOpsConfigError(err instanceof Error ? err.message : String(err))
    }
  }

  async function runMute(hours: number) {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await muteOpsAlerts(hours)
      setMuteUntil(res.muteUntilUtc ?? null)
      setResult(`Alerts muted for ${hours}h.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runUnmute() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      await unmuteOpsAlerts()
      setMuteUntil(null)
      setResult('Alerts unmuted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runMuteUntil() {
    if (!muteUntilInput.trim()) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await muteOpsAlertsUntil(new Date(muteUntilInput).toISOString())
      setMuteUntil(res.muteUntilUtc ?? null)
      setResult('Alerts muted until specified time.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function refreshMaintenanceStatus() {
    try {
      const status = await getMaintenanceStatus()
      setMaintenanceStatus(status.status ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function runEnableMaintenance() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      await enableMaintenance(maintenanceMessage ? { message: maintenanceMessage } : undefined)
      setResult('Maintenance enabled.')
      pushOpsLog('Maintenance enabled.')
      await refreshMaintenanceStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Maintenance enable failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function runDisableMaintenance() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      await disableMaintenance(maintenanceMessage || undefined)
      setResult('Maintenance disabled.')
      pushOpsLog('Maintenance disabled.')
      await refreshMaintenanceStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Maintenance disable failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function runMaintenanceMacroAction() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      await runMaintenanceMacro(maintenanceMessage ? { message: maintenanceMessage } : undefined)
      setResult('Maintenance + announce + restart triggered.')
      pushOpsLog('Maintenance macro triggered.')
      await refreshMaintenanceStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Maintenance macro failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function runPanelRestartQuick() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await restartGameServerViaPanel()
      if (!res.ok) {
        setError('Panel restart failed. Check panel auth and try again.')
        pushOpsLog('Panel restart failed. Check panel auth.')
      } else {
        setResult('Panel restart triggered.')
        pushOpsLog('Panel restart triggered.', res.payload ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Panel restart failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function runModsDiff() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const diff = await getModsDiff()
      setModsDiff(diff)
      setResult('Mods diff refreshed.')
      pushOpsLog('Mods diff refreshed.', diff)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Mods diff failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function refreshBackups() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await listPanelBackups()
      setPanelBackups((res.payload ?? {}) as Record<string, unknown>)
      setResult('Panel backups loaded.')
      pushOpsLog('Panel backups loaded.', res.payload ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Panel backups failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function runCreateBackup() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await createPanelBackup(panelBackupName || undefined)
      setPanelBackups((res.payload ?? {}) as Record<string, unknown>)
      setResult('Panel backup requested.')
      pushOpsLog('Panel backup requested.', res.payload ?? null)
      setPanelBackupName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Panel backup failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function runBackupDownload(backupId: string) {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await getPanelBackupDownload(backupId)
      setResult(`Download payload received for ${backupId}.`)
      setPanelBackups((res.payload ?? {}) as Record<string, unknown>)
      pushOpsLog(`Backup download payload received: ${backupId}.`, res.payload ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Backup download failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function runSyncRestartMacroAction() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await runSyncRestartMacro({ usePanelRestart: true })
      setModsDiff(res.modsDiff as ModsDiffResponse)
      setResult('Sync + mods diff + restart completed.')
      pushOpsLog('Sync + mods diff + restart completed.', res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Sync + restart failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function refreshPlayerHistory() {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const limit = historyRange === '7d' || historyRange === '30d' ? 2000 : 500
      const history = await getPlayersHistory(limit)
      setPlayerHistory(history)
      setResult('Player history refreshed.')
      pushOpsLog('Player history refreshed.', { count: history.length, range: historyRange })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      pushOpsLog(`Player history failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  function rangeToHours(value: string) {
    if (value === '1h') return 1
    if (value === '6h') return 6
    if (value === '24h') return 24
    if (value === '7d') return 24 * 7
    if (value === '30d') return 24 * 30
    return 24
  }

  function filterHistoryByRange(history: PlayerHistoryEntry[]) {
    const hours = rangeToHours(historyRange)
    const cutoff = Date.now() - hours * 3600 * 1000
    return history.filter(item => new Date(item.timeUtc).getTime() >= cutoff)
  }

  function computeUptimeSplit(items: StatusHistoryItem[]) {
    const hours = rangeToHours(historyRange)
    const end = Date.now()
    const start = end - hours * 3600 * 1000
    const sorted = items
      .map(item => ({ ...item, ts: new Date(item.dateUtc).getTime() }))
      .filter(item => !Number.isNaN(item.ts) && item.ts <= end)
      .sort((a, b) => a.ts - b.ts)

    if (sorted.length === 0) return null

    let lastStatus = sorted[0].status
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (sorted[i].ts <= start) {
        lastStatus = sorted[i].status
        break
      }
    }

    const windowEvents = sorted.filter(item => item.ts >= start)
    const events = [{ status: lastStatus, ts: start }, ...windowEvents]
    const totals: Record<string, number> = { online: 0, maintenance: 0, offline: 0 }

    for (let i = 0; i < events.length; i += 1) {
      const current = events[i]
      const nextTs = i + 1 < events.length ? events[i + 1].ts : end
      const duration = Math.max(0, nextTs - current.ts)
      totals[current.status] = (totals[current.status] ?? 0) + duration
    }

    const totalMs = Math.max(1, end - start)
    return {
      online: totals.online / totalMs,
      maintenance: totals.maintenance / totalMs,
      offline: totals.offline / totalMs
    }
  }

  async function refreshStatusHistory() {
    try {
      const history = await loadStatusHistory()
      setStatusHistory(history)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    loadOpsConfig()
    refreshMaintenanceStatus()
    refreshStatusHistory()
    refreshMuteStatus()
    refreshIssueLog()
    loadRewardSources()
  }, [])

  async function loadRewardSources() {
    try {
      const catalog = await getContent<{ items?: Array<{ code: string; name: string; category?: string }> }>('items-catalog')
      setItemCatalog(Array.isArray(catalog.items) ? catalog.items : [])
    } catch {
      setItemCatalog([])
    }
    try {
      const presets = await getContent<{ presets?: Array<{ id: string; label: string; items: Array<{ code: string; count: number }> }> }>('item-presets')
      setItemPresets(Array.isArray(presets.presets) ? presets.presets : [])
    } catch {
      setItemPresets([])
    }
    try {
      const roster = await getContent<{ factions?: Array<{ id: string; name: string; members: string[] }> }>('factions-roster')
      setFactionRoster(Array.isArray(roster.factions) ? roster.factions : [])
    } catch {
      setFactionRoster([])
    }
  }

  async function refreshIssueLog() {
    try {
      const res = await getGameIssues(120)
      setIssueLog(res.issues ?? [])
      setIssueSources(res.sources ?? [])
      setIssueLastRefresh(new Date().toLocaleTimeString())
      setIssueSummary({
        autoFixEnabled: res.autoFixEnabled,
        autoFixUsePanel: res.autoFixUsePanel,
        autoFixRepeatThreshold: res.autoFixRepeatThreshold ?? 2,
        lastMismatchCount: res.lastMismatchCount ?? 0,
        lastAutoFixUtc: res.lastAutoFixUtc ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function refreshPlayers() {
    setError('')
    try {
      const res = await getGamePlayers()
      setPlayersOnline(res.players ?? [])
      setPlayersRaw(res.response ?? null)
      if ((res.players ?? []).length === 0) {
        setPlayersSelected(new Set())
      } else {
        setPlayersSelected((prev) => {
          const next = new Set<string>()
          for (const player of res.players ?? []) {
            const key = (player.name ?? player.raw ?? '').trim()
            if (key && prev.has(key)) next.add(key)
          }
          return next
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function togglePlayerSelection(key: string) {
    setPlayersSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function normalizePlayerKey(player: { name?: string; raw?: string }, fallback: string) {
    return (player.name ?? player.raw ?? fallback).trim()
  }

  function buildGiftCommand(player: string, item: string, count: number) {
    return giftCommandTemplate
      .replaceAll('{player}', player)
      .replaceAll('{item}', item)
      .replaceAll('{count}', String(count))
      .trim()
  }

  async function runGiftCommand(players: string[], item: string, count: number) {
    if (players.length === 0) {
      setError('Select at least one player to gift items.')
      return
    }
    if (!item.trim()) {
      setError('Enter an item code (example: Base.WaterBottleFull).')
      return
    }
    setBusy(true)
    setError('')
    setResult('')
    try {
      for (const player of players) {
        const command = buildGiftCommand(player, item, count)
        await runGameServerCommand(command)
      }
      setResult(`Gift sent to ${players.length} player(s).`)
      pushOpsLog('Gift items sent', { players, item, count })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runGiftPreset(players: string[], presetId: string) {
    const preset = itemPresets.find((entry) => entry.id === presetId)
    if (!preset) {
      setError('Pick a preset first.')
      return
    }
    if (players.length === 0) {
      setError('Select at least one player to gift items.')
      return
    }
    setBusy(true)
    setError('')
    setResult('')
    try {
      for (const player of players) {
        for (const item of preset.items) {
          const command = buildGiftCommand(player, item.code, item.count)
          await runGameServerCommand(command)
        }
      }
      setResult(`Preset sent to ${players.length} player(s).`)
      pushOpsLog('Gift preset sent', { players, preset: preset.label })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function getSelectedFactionMembers() {
    const faction = factionRoster.find((entry) => entry.id === selectedFactionId)
    if (!faction) return []
    const members = faction.members ?? []
    if (!factionOnlyOnline) return members
    const online = new Set(playersOnline.map((p, idx) => normalizePlayerKey(p, `player-${idx}`)))
    return members.filter((name) => online.has(name))
  }

  function parseCsvLines(text: string) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('#'))
  }

  function parseBulkItems(text: string) {
    const lines = parseCsvLines(text)
    const items: Array<{ code: string; name: string; category?: string; sourceModId?: string; sourceWorkshopId?: string }> = []
    for (const line of lines) {
      if (line.startsWith('{')) {
        const parsed = JSON.parse(line) as { code: string; name: string; category?: string; sourceModId?: string; sourceWorkshopId?: string }
        if (parsed?.code && parsed?.name) items.push(parsed)
        continue
      }
      const parts = line.split(',').map((part) => part.trim())
      const [code, name, category, sourceModId, sourceWorkshopId] = parts
      if (!code || !name) continue
      items.push({ code, name, category, sourceModId, sourceWorkshopId })
    }
    return items
  }

  function parseBulkPresets(text: string) {
    const lines = parseCsvLines(text)
    const presets: Array<{ id: string; label: string; items: Array<{ code: string; count: number }> }> = []
    for (const line of lines) {
      if (line.startsWith('{')) {
        const parsed = JSON.parse(line) as { id: string; label: string; items: Array<{ code: string; count: number }> }
        if (parsed?.id && parsed?.label && Array.isArray(parsed.items)) presets.push(parsed)
        continue
      }
      const [label, itemsText] = line.split('|').map((part) => part.trim())
      if (!label || !itemsText) continue
      const items = itemsText.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
        const [code, countRaw] = entry.split(':').map((part) => part.trim())
        const count = Number(countRaw || 1)
        return { code, count: Number.isNaN(count) ? 1 : count }
      }).filter((item) => item.code)
      const id = `preset-${label.toLowerCase().replace(/\s+/g, '-')}`
      presets.push({ id, label, items })
    }
    return presets
  }

  function parseBulkFactions(text: string) {
    const lines = parseCsvLines(text)
    const factions: Array<{ id: string; name: string; members: string[] }> = []
    for (const line of lines) {
      if (line.startsWith('{')) {
        const parsed = JSON.parse(line) as { id: string; name: string; members: string[] }
        if (parsed?.id && parsed?.name && Array.isArray(parsed.members)) factions.push(parsed)
        continue
      }
      const [name, membersText] = line.split('|').map((part) => part.trim())
      if (!name || !membersText) continue
      const members = membersText.split(',').map((entry) => entry.trim()).filter(Boolean)
      const id = `faction-${name.toLowerCase().replace(/\s+/g, '-')}`
      factions.push({ id, name, members })
    }
    return factions
  }

  function downloadTextFile(filename: string, text: string) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function exportItemsCsv() {
    const header = 'code,name,category,sourceModId,sourceWorkshopId,favorite'
    const lines = itemCatalog.map((item) => [
      item.code,
      item.name,
      item.category ?? '',
      item.sourceModId ?? '',
      item.sourceWorkshopId ?? '',
      item.favorite ? 'true' : ''
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    downloadTextFile('items-catalog.csv', [header, ...lines].join('\n'))
  }

  function exportPresetsCsv() {
    const header = 'label|items'
    const lines = itemPresets.map((preset) => {
      const items = preset.items.map((item) => `${item.code}:${item.count}`).join(', ')
      return `${preset.label} | ${items}`
    })
    downloadTextFile('item-presets.txt', [header, ...lines].join('\n'))
  }

  function exportFactionsCsv() {
    const header = 'name|members'
    const lines = factionRoster.map((faction) => `${faction.name} | ${faction.members.join(', ')}`)
    downloadTextFile('factions-roster.txt', [header, ...lines].join('\n'))
  }

  useEffect(() => {
    if (!issueAutoRefresh) return
    const intervalMs = Math.max(15, issueRefreshSeconds) * 1000
    const id = window.setInterval(() => {
      refreshIssueLog()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [issueAutoRefresh, issueRefreshSeconds])

  async function runFixNow() {
    if (!confirm('Run the auto-fix now? This will restart the server.')) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await fixGameIssues()
      if (!res.ok) {
        setError('Auto-fix failed. Please try again.')
      } else {
        setResult(`Auto-fix triggered via ${res.usePanel ? 'panel restart' : 'game restart'}.`)
      }
      await refreshIssueLog()
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
          <h1>Host Operations</h1>
          <p className="admin-sub">
            Fast controls first, advanced options below. Use the quick actions to restart, sync mods, or enter maintenance.
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={() => setShowAdvanced((prev) => !prev)}>
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Quick Actions</div>
        </div>
        <div className="admin-card-sub">
          One-click actions for the most common fixes. Safe for non-technical admins.
        </div>
        <div className="admin-card-sub" style={{ marginTop: 6 }}>
          Recommended flow when players see “workshop version is different”:
        </div>
        <div className="admin-card-sub">
          1. Sync + Mods Diff + Restart
        </div>
        <div className="admin-card-sub">
          2. If it still happens, run Panel Restart again
        </div>
        <div className="admin-row" style={{ marginTop: 10 }}>
          <button className="admin-btn primary" onClick={runSyncRestartMacroAction} disabled={busy}>
            Sync + Mods Diff + Restart
          </button>
          <button className="admin-btn danger" onClick={runPanelRestartQuick} disabled={busy}>
            Panel Restart
          </button>
          <button className="admin-btn" onClick={runMaintenanceMacroAction} disabled={busy}>
            Maintenance + Restart
          </button>
        </div>
        <div className="admin-card-sub" style={{ marginTop: 8 }}>
          Panel Restart uses the hosting panel API. If it fails, check the Panel API status in Game Server Control.
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Players & Rewards</div>
          <div className="admin-card-actions">
            <button className="admin-btn" onClick={saveRewardSettings} disabled={busy}>Save Rewards</button>
            <button className="admin-btn" onClick={saveRewardLibrary} disabled={busy}>Save Library</button>
            <button className="admin-btn" onClick={loadRewardSources} disabled={busy}>Reload Library</button>
            <button className="admin-btn" onClick={runCatalogSync} disabled={busy}>Sync Catalog (Mods)</button>
            <button className="admin-btn" onClick={refreshPlayers} disabled={busy}>Refresh Players</button>
            <button className="admin-btn" onClick={() => {
              const keys = playersOnline.map((p) => (p.name ?? p.raw ?? '').trim()).filter(Boolean)
              setPlayersSelected(new Set(keys))
            }} disabled={busy || playersOnline.length === 0}>
              Select All
            </button>
            <button className="admin-btn" onClick={() => setPlayersSelected(new Set())} disabled={busy}>
              Clear
            </button>
          </div>
        </div>
        <div className="admin-card-sub">
          View who is online and quickly gift items for events, challenges, or factions.
        </div>
        <div className="admin-row" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
          <div className="admin-pill count">Online: {playersOnline.length}</div>
          <div className="admin-pill fixable">Selected: {playersSelected.size}</div>
          <input
            className="admin-input"
            style={{ maxWidth: 220 }}
            placeholder="Search player..."
            value={playerFilter}
            onChange={(e) => setPlayerFilter(e.target.value)}
          />
        </div>

        {playersOnline.length === 0 ? (
          <div className="admin-card-sub" style={{ marginTop: 10 }}>
            No players detected. Click “Refresh Players”.
          </div>
        ) : (
          <div className="admin-list" style={{ marginTop: 12 }}>
            {playersOnline
              .filter((player, idx) => {
                const label = (player.name ?? player.raw ?? `Player ${idx + 1}`).toLowerCase()
                return label.includes(playerFilter.trim().toLowerCase())
              })
              .map((player, idx) => {
              const key = normalizePlayerKey(player, `player-${idx}`)
              const label = player.name ?? player.raw ?? `Player ${idx + 1}`
              return (
                <div key={`${key}-${idx}`} className="admin-list-item">
                  <label className="admin-toggle" style={{ marginRight: 12 }}>
                    <input
                      type="checkbox"
                      checked={playersSelected.has(key)}
                      onChange={() => togglePlayerSelection(key)}
                    />
                    <span>{label}</span>
                  </label>
                </div>
              )
            })}
          </div>
        )}

        <div className="admin-card-sub" style={{ marginTop: 12 }}>
          Gift items to selected players
        </div>
        <div className="admin-grid two" style={{ marginTop: 10 }}>
          <label className="admin-field">
            <span>Item Code</span>
            <input
              className="admin-input"
              value={giftItemCode}
              onChange={(e) => setGiftItemCode(e.target.value)}
              placeholder="Base.WaterBottleFull"
            />
          </label>
          <label className="admin-field">
            <span>Item Picker</span>
            <select
              className="admin-select"
              value={giftItemCode}
              onChange={(e) => setGiftItemCode(e.currentTarget.value)}
            >
              <option value="">Select item…</option>
              {itemCatalog.some((item) => item.favorite) && (
                <optgroup label="Favorites">
                  {itemCatalog
                    .filter((item) => item.favorite)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((item) => (
                      <option key={`fav-${item.code}`} value={item.code}>
                        {item.name} ({item.code})
                      </option>
                    ))}
                </optgroup>
              )}
              {[...new Set(itemCatalog.map((item) => item.category ?? 'Other'))].sort().map((category) => (
                <optgroup key={`cat-${category}`} label={category}>
                  {itemCatalog
                    .filter((item) => {
                      const q = itemSearch.trim().toLowerCase()
                      if (!q) return true
                      return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
                    })
                    .filter((item) => itemCategoryFilter === 'all' || (item.category ?? 'Other') === itemCategoryFilter)
                    .filter((item) => (item.category ?? 'Other') === category)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name} ({item.code})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Search Items</span>
            <input
              className="admin-input"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search by name or code"
            />
          </label>
          <div className="admin-field" style={{ gridColumn: 'span 2' }}>
            <span>Filter Category</span>
            <div className="admin-row" style={{ marginTop: 6, justifyContent: 'flex-start' }}>
              {['all', ...new Set(itemCatalog.map((item) => item.category ?? 'Other'))]
                .map((category) => String(category))
                .sort((a, b) => (a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b)))
                .map((category) => (
                  <button
                    key={`cat-filter-${category}`}
                    className={`admin-chip ${itemCategoryFilter === category ? 'active' : ''}`}
                    onClick={() => setItemCategoryFilter(category)}
                    type="button"
                  >
                    {category === 'all' ? 'All' : category}
                  </button>
                ))}
            </div>
          </div>
          <label className="admin-field">
            <span>Quantity</span>
            <input
              className="admin-input"
              type="number"
              min={1}
              max={100}
              value={giftItemCount}
              onChange={(e) => setGiftItemCount(Number(e.target.value))}
            />
          </label>
          <label className="admin-field" style={{ gridColumn: 'span 2' }}>
            <span>Gift Command Template</span>
            <input
              className="admin-input"
              value={giftCommandTemplate}
              onChange={(e) => setGiftCommandTemplate(e.target.value)}
              placeholder='additem "{player}" "{item}" {count}'
            />
          </label>
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <div className="admin-card-sub" style={{ marginRight: 6 }}>Quick amounts:</div>
          {giftPresetCounts.map((amount) => (
            <button
              key={`gift-count-${amount}`}
              className="admin-btn"
              onClick={() => setGiftItemCount(amount)}
              disabled={busy}
            >
              {amount}x
            </button>
          ))}
        </div>
        {itemCatalog.some((item) => item.favorite) && (
          <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
            <div className="admin-card-sub" style={{ marginRight: 6 }}>Favorites:</div>
            {itemCatalog
              .filter((item) => item.favorite)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item) => (
                <button
                  key={`fav-btn-${item.code}`}
                  className="admin-btn"
                  onClick={() => setGiftItemCode(item.code)}
                  disabled={busy}
                >
                  {item.name}
                </button>
              ))}
          </div>
        )}
        <div className="admin-row" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
          <button
            className="admin-btn primary"
            onClick={() => runGiftCommand(Array.from(playersSelected), giftItemCode, giftItemCount)}
            disabled={busy || playersSelected.size === 0}
          >
            Gift Selected Players
          </button>
          <button
            className="admin-btn"
            onClick={() => {
              if (!confirm('Gift this item to every online player?')) return
              const allKeys = playersOnline.map((p, idx) => normalizePlayerKey(p, `player-${idx}`)).filter(Boolean)
              runGiftCommand(allKeys, giftItemCode, giftItemCount)
            }}
            disabled={busy || playersOnline.length === 0}
          >
            Gift All Online
          </button>
        </div>

        <div className="admin-card-sub" style={{ marginTop: 14 }}>
          Presets (bundle of items)
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <select
            className="admin-select"
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.currentTarget.value)}
            style={{ minWidth: 220 }}
          >
            <option value="">Select preset…</option>
            {itemPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
          <button
            className="admin-btn"
            onClick={() => runGiftPreset(Array.from(playersSelected), selectedPresetId)}
            disabled={busy || playersSelected.size === 0 || !selectedPresetId}
          >
            Gift Preset to Selected
          </button>
          <button
            className="admin-btn"
            onClick={() => {
              if (!confirm('Gift this preset to every online player?')) return
              const allKeys = playersOnline.map((p, idx) => normalizePlayerKey(p, `player-${idx}`)).filter(Boolean)
              runGiftPreset(allKeys, selectedPresetId)
            }}
            disabled={busy || playersOnline.length === 0 || !selectedPresetId}
          >
            Gift Preset to All Online
          </button>
        </div>

        <div className="admin-card-sub" style={{ marginTop: 14 }}>
          Gift a faction
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <select
            className="admin-select"
            value={selectedFactionId}
            onChange={(e) => setSelectedFactionId(e.currentTarget.value)}
            style={{ minWidth: 220 }}
          >
            <option value="">Select faction…</option>
            {factionRoster.map((faction) => (
              <option key={faction.id} value={faction.id}>{faction.name}</option>
            ))}
          </select>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={factionOnlyOnline}
              onChange={(e) => setFactionOnlyOnline(e.currentTarget.checked)}
            />
            <span>Only online members</span>
          </label>
          <button
            className="admin-btn"
            onClick={() => runGiftCommand(getSelectedFactionMembers(), giftItemCode, giftItemCount)}
            disabled={busy || !selectedFactionId}
          >
            Gift Faction
          </button>
          <button
            className="admin-btn"
            onClick={() => runGiftPreset(getSelectedFactionMembers(), selectedPresetId)}
            disabled={busy || !selectedFactionId || !selectedPresetId}
          >
            Gift Preset to Faction
          </button>
        </div>

        <div className="admin-card-sub" style={{ marginTop: 14 }}>
          Reward Groups (for factions or event teams)
        </div>
        <div className="admin-grid two" style={{ marginTop: 8 }}>
          <label className="admin-field">
            <span>Group Name</span>
            <input
              className="admin-input"
              value={rewardGroupLabel}
              onChange={(e) => setRewardGroupLabel(e.target.value)}
              placeholder="Faction: Rangers"
            />
          </label>
          <label className="admin-field">
            <span>Members (comma separated)</span>
            <input
              className="admin-input"
              value={rewardGroupMembers}
              onChange={(e) => setRewardGroupMembers(e.target.value)}
              placeholder="PlayerOne, PlayerTwo"
            />
          </label>
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button
            className="admin-btn"
            onClick={() => {
              const label = rewardGroupLabel.trim()
              const members = rewardGroupMembers
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
              if (!label || members.length === 0) {
                setError('Add a group name and at least one member.')
                return
              }
              const id = `group-${label.toLowerCase().replace(/\\s+/g, '-')}`
              setRewardGroups((prev) => {
                const next = prev.filter((group) => group.id !== id)
                return [...next, { id, label, members }]
              })
              setRewardGroupLabel('')
              setRewardGroupMembers('')
              setResult('Group saved. Click Save Rewards to persist.')
            }}
            disabled={busy}
          >
            Add/Update Group
          </button>
        </div>
        {rewardGroups.length > 0 && (
          <div className="admin-list" style={{ marginTop: 10 }}>
            {rewardGroups.map((group) => (
              <div key={group.id} className="admin-list-item">
                <div>
                  <div className="admin-list-title">{group.label}</div>
                  <div className="admin-list-sub">{group.members.join(', ')}</div>
                </div>
                <div className="admin-list-actions">
                  <button
                    className="admin-btn"
                    onClick={() => runGiftCommand(group.members, giftItemCode, giftItemCount)}
                    disabled={busy}
                  >
                    Gift Group
                  </button>
                  <button
                    className="admin-btn"
                    onClick={() => {
                      const members = group.members
                      setPlayersSelected(new Set(members))
                    }}
                    disabled={busy}
                  >
                    Select Group
                  </button>
                  <button
                    className="admin-btn danger"
                    onClick={() => setRewardGroups((prev) => prev.filter((item) => item.id !== group.id))}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {playersRaw && (
          <details style={{ marginTop: 12 }}>
            <summary className="admin-card-sub">Raw player response</summary>
            <pre className="admin-code" style={{ marginTop: 8 }}>{playersRaw}</pre>
          </details>
        )}

        <div className="admin-card-sub" style={{ marginTop: 16 }}>
          Reward Library (managed content files)
        </div>
        <div className="admin-card-sub">
          Auto-sync removes items tied to mods that are no longer installed.
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button className="admin-btn" onClick={exportItemsCsv} disabled={busy}>Export Items CSV</button>
          <button className="admin-btn" onClick={exportPresetsCsv} disabled={busy}>Export Presets CSV</button>
          <button className="admin-btn" onClick={exportFactionsCsv} disabled={busy}>Export Factions CSV</button>
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <label className="admin-field" style={{ minWidth: 220 }}>
            <span>Bulk Import Target</span>
            <select
              className="admin-select"
              value={bulkImportTarget}
              onChange={(e) => setBulkImportTarget(e.currentTarget.value as 'items' | 'presets' | 'factions')}
            >
              <option value="items">Items</option>
              <option value="presets">Presets</option>
              <option value="factions">Factions</option>
            </select>
          </label>
          <label className="admin-field" style={{ minWidth: 220 }}>
            <span>Import File (CSV/JSON)</span>
            <input
              className="admin-input"
              type="file"
              accept=".csv,.txt,.json"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (!file) return
                setBulkImportFileName(file.name)
                const reader = new FileReader()
                reader.onload = () => {
                  setBulkImportText(String(reader.result ?? ''))
                }
                reader.readAsText(file)
              }}
            />
          </label>
          <button
            className="admin-btn"
            onClick={() => {
              if (!bulkImportText.trim()) {
                setError('Paste bulk data first.')
                return
              }
              try {
                if (bulkImportTarget === 'items') {
                  const parsed = parseBulkItems(bulkImportText)
                  setItemCatalog((prev) => {
                    const map = new Map(prev.map((item) => [item.code, item]))
                    for (const item of parsed) {
                      map.set(item.code, { ...map.get(item.code), ...item })
                    }
                    return Array.from(map.values())
                  })
                  setResult(`Imported ${parsed.length} items. Click Save Library to persist.`)
                } else if (bulkImportTarget === 'presets') {
                  const parsed = parseBulkPresets(bulkImportText)
                  setItemPresets((prev) => {
                    const map = new Map(prev.map((preset) => [preset.id, preset]))
                    for (const preset of parsed) {
                      map.set(preset.id, preset)
                    }
                    return Array.from(map.values())
                  })
                  setResult(`Imported ${parsed.length} presets. Click Save Library to persist.`)
                } else {
                  const parsed = parseBulkFactions(bulkImportText)
                  setFactionRoster((prev) => {
                    const map = new Map(prev.map((faction) => [faction.id, faction]))
                    for (const faction of parsed) {
                      map.set(faction.id, faction)
                    }
                    return Array.from(map.values())
                  })
                  setResult(`Imported ${parsed.length} factions. Click Save Library to persist.`)
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              }
            }}
            disabled={busy}
          >
            Import
          </button>
          <button className="admin-btn" onClick={() => setBulkImportText('')} disabled={busy}>Clear</button>
        </div>
        <label className="admin-field" style={{ marginTop: 8 }}>
          <span>Bulk Import Data</span>
          <textarea
            className="admin-textarea"
            rows={4}
            value={bulkImportText}
            onChange={(e) => setBulkImportText(e.target.value)}
            placeholder={`Items CSV: code,name,category,sourceModId,sourceWorkshopId\nPresets: Label | code:count, code:count\nFactions: Name | MemberOne, MemberTwo`}
          />
        </label>
        {bulkImportFileName && (
          <div className="admin-card-sub">
            Loaded file: {bulkImportFileName}
          </div>
        )}
        <div className="admin-grid two" style={{ marginTop: 8 }}>
          <label className="admin-field">
            <span>Add Item Code</span>
            <input
              className="admin-input"
              value={newItemCode}
              onChange={(e) => setNewItemCode(e.target.value)}
              placeholder="Base.WaterBottleFull"
            />
          </label>
          <label className="admin-field">
            <span>Add Item Name</span>
            <input
              className="admin-input"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Water Bottle (Full)"
            />
          </label>
          <label className="admin-field">
            <span>Add Item Category</span>
            <input
              className="admin-input"
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              placeholder="Core"
            />
          </label>
          <label className="admin-field">
            <span>Source Mod ID (optional)</span>
            <input
              className="admin-input"
              value={newItemSourceModId}
              onChange={(e) => setNewItemSourceModId(e.target.value)}
              placeholder="damnlib"
            />
          </label>
          <label className="admin-field">
            <span>Source Workshop ID (optional)</span>
            <input
              className="admin-input"
              value={newItemSourceWorkshopId}
              onChange={(e) => setNewItemSourceWorkshopId(e.target.value)}
              placeholder="3171167894"
            />
          </label>
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button
            className="admin-btn"
            onClick={() => {
              const code = newItemCode.trim()
              const name = newItemName.trim()
              if (!code || !name) {
                setError('Item code and name are required.')
                return
              }
              const category = newItemCategory.trim() || 'Other'
              setItemCatalog((prev) => {
                const next = prev.filter((item) => item.code !== code)
                return [...next, {
                  code,
                  name,
                  category,
                  sourceModId: newItemSourceModId.trim() || undefined,
                  sourceWorkshopId: newItemSourceWorkshopId.trim() || undefined
                }]
              })
              setNewItemCode('')
              setNewItemName('')
              setNewItemCategory('')
              setNewItemSourceModId('')
              setNewItemSourceWorkshopId('')
              setResult('Item added. Click Save Library to persist.')
            }}
            disabled={busy}
          >
            Add Item
          </button>
          <button
            className="admin-btn"
            onClick={() => {
              if (!giftItemCode.trim()) {
                setError('Pick an item code first.')
                return
              }
              setItemCatalog((prev) => prev.map((item) => (
                item.code === giftItemCode ? { ...item, favorite: !item.favorite } : item
              )))
              setResult('Favorite updated. Click Save Library to persist.')
            }}
            disabled={busy}
          >
            Toggle Favorite
          </button>
        </div>

        <label className="admin-field" style={{ marginTop: 10 }}>
          <span>Favorites List (one code per line)</span>
          <textarea
            className="admin-textarea"
            rows={3}
            value={favoriteCodesText}
            onChange={(e) => setFavoriteCodesText(e.target.value)}
            placeholder="Base.WaterBottleFull\nBase.Bandage"
          />
        </label>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button
            className="admin-btn"
            onClick={() => {
              const codes = new Set(
                favoriteCodesText
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
              )
              if (codes.size === 0) {
                setError('Paste at least one item code.')
                return
              }
              setItemCatalog((prev) => prev.map((item) => ({
                ...item,
                favorite: codes.has(item.code)
              })))
              setResult('Favorites applied. Click Save Library to persist.')
            }}
            disabled={busy}
          >
            Apply Favorites (Replace)
          </button>
        </div>

        <div className="admin-grid two" style={{ marginTop: 12 }}>
          <label className="admin-field">
            <span>Preset Name</span>
            <input
              className="admin-input"
              value={newPresetLabel}
              onChange={(e) => setNewPresetLabel(e.target.value)}
              placeholder="Event Pack"
            />
          </label>
          <label className="admin-field">
            <span>Preset Items (code:count, comma separated)</span>
            <input
              className="admin-input"
              value={newPresetItems}
              onChange={(e) => setNewPresetItems(e.target.value)}
              placeholder="Base.CannedSoup:2, Base.WaterBottleFull:1"
            />
          </label>
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button
            className="admin-btn"
            onClick={() => {
              const label = newPresetLabel.trim()
              if (!label || !newPresetItems.trim()) {
                setError('Preset name and items are required.')
                return
              }
              const items = newPresetItems.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
                const [code, countRaw] = entry.split(':').map((part) => part.trim())
                const count = Number(countRaw || 1)
                return { code, count: Number.isNaN(count) ? 1 : count }
              }).filter((item) => item.code)
              const id = `preset-${label.toLowerCase().replace(/\\s+/g, '-')}`
              setItemPresets((prev) => {
                const next = prev.filter((preset) => preset.id !== id)
                return [...next, { id, label, items }]
              })
              setNewPresetLabel('')
              setNewPresetItems('')
              setResult('Preset added. Click Save Library to persist.')
            }}
            disabled={busy}
          >
            Add Preset
          </button>
        </div>

        <div className="admin-grid two" style={{ marginTop: 12 }}>
          <label className="admin-field">
            <span>Faction Name</span>
            <input
              className="admin-input"
              value={newFactionName}
              onChange={(e) => setNewFactionName(e.target.value)}
              placeholder="Rangers"
            />
          </label>
          <label className="admin-field">
            <span>Members (comma separated)</span>
            <input
              className="admin-input"
              value={newFactionMembers}
              onChange={(e) => setNewFactionMembers(e.target.value)}
              placeholder="PlayerOne, PlayerTwo"
            />
          </label>
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button
            className="admin-btn"
            onClick={() => {
              const name = newFactionName.trim()
              const members = newFactionMembers.split(',').map((value) => value.trim()).filter(Boolean)
              if (!name || members.length === 0) {
                setError('Faction name and at least one member are required.')
                return
              }
              const id = `faction-${name.toLowerCase().replace(/\\s+/g, '-')}`
              setFactionRoster((prev) => {
                const next = prev.filter((faction) => faction.id !== id)
                return [...next, { id, name, members }]
              })
              setNewFactionName('')
              setNewFactionMembers('')
              setResult('Faction added. Click Save Library to persist.')
            }}
            disabled={busy}
          >
            Add Faction
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Issue Log (Errors Only)</div>
          <div className="admin-card-actions">
            <button className="admin-btn" onClick={refreshIssueLog} disabled={busy}>Refresh</button>
            <button className="admin-btn" onClick={runFixNow} disabled={busy}>Auto-Fix Now</button>
            <button
              className="admin-btn"
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  await clearGameIssues()
                  setIssueLog([])
                  setIssueSources([])
                  setIssueSummary(null)
                  setResult('Issue log cleared.')
                  pushOpsLog('Issue log cleared.')
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err))
                } finally {
                  setBusy(false)
                }
              }}
              disabled={busy}
            >
              Clear Issues
            </button>
            {issueSources[0] && (
              <a
                className="admin-btn"
                href={`/api/admin/game/issues/download?source=${encodeURIComponent(issueSources[0])}`}
                target="_blank"
                rel="noreferrer"
              >
                Download Log
              </a>
            )}
          </div>
        </div>
        <div className="admin-card-sub">
          Clean, grouped errors from the live server logs. Auto-fix only appears when it is safe.
        </div>
        <div className="admin-card-sub">
          Auto-fix: {issueSummary?.autoFixEnabled ? `On (${issueSummary.autoFixUsePanel ? 'panel restart' : 'game restart'})` : 'Off'}
          {issueSummary?.autoFixEnabled ? ` • Triggers after ${issueSummary.autoFixRepeatThreshold} repeats` : ''}
          {issueSummary?.autoFixEnabled ? ` • Seen ${issueSummary.lastMismatchCount}x` : ''}
          {issueSummary?.lastAutoFixUtc ? ` • Last fix: ${new Date(issueSummary.lastAutoFixUtc).toLocaleString()}` : ''}
          {issueLastRefresh ? ` • Refreshed: ${issueLastRefresh}` : ''}
        </div>
        <div className="admin-card-sub" style={{ marginTop: 8 }}>
          Fix pack:
        </div>
        <div className="admin-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button className="admin-btn primary" onClick={runFixNow} disabled={busy}>Fix Workshop Mismatch</button>
          <button className="admin-btn" onClick={runSyncRestartMacroAction} disabled={busy}>Fix Mod Missing</button>
          <button className="admin-btn danger" onClick={runPanelRestartQuick} disabled={busy}>Fix Server Not Responding</button>
        </div>
        <div className="admin-card-sub" style={{ marginTop: 8 }}>
          Live refresh:
          <label className="admin-toggle" style={{ marginLeft: 8 }}>
            <input
              type="checkbox"
              checked={issueAutoRefresh}
              onChange={(e) => setIssueAutoRefresh(e.currentTarget.checked)}
            />
            <span>On</span>
          </label>
          <input
            className="admin-input"
            style={{ width: 90, marginLeft: 10 }}
            type="number"
            min={15}
            max={180}
            value={issueRefreshSeconds}
            onChange={(e) => setIssueRefreshSeconds(Number(e.target.value))}
          />
          <span className="admin-card-sub" style={{ marginLeft: 6 }}>seconds</span>
        </div>
        {issueLog.filter((row) => !showFixableOnly || row.fixable).length === 0 ? (
          <div className="admin-card-sub" style={{ marginTop: 8 }}>No error lines detected.</div>
        ) : (
          <div className="admin-list" style={{ marginTop: 10 }}>
            {issueLog.filter((row) => !showFixableOnly || row.fixable).map((row, idx) => (
              <div key={`${String(row.message ?? idx)}-${idx}`} className="admin-list-item">
                <div>
                  <div className="admin-list-title">
                    {row.type === 'workshop-mismatch' ? 'Workshop Mismatch' : 'Error'}
                  </div>
                  <div className="admin-list-sub">
                    {String(row.message ?? '').slice(0, 220)}
                  </div>
                  <div className="admin-list-sub">
                    Recommendation: {row.recommendation ?? (row.fixable ? 'Auto-fix available.' : 'Review manually.')}
                  </div>
                  <div className="admin-list-sub" style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`admin-pill ${row.severity === 'needs-fix' ? 'needs-fix' : 'review'}`}>
                      {row.severity === 'needs-fix' ? 'Needs Fix' : 'Review'}
                    </span>
                    {row.fixable && <span className="admin-pill fixable">Auto-Fix</span>}
                    {typeof row.count === 'number' && <span className="admin-pill count">{row.count}x</span>}
                  </div>
                </div>
                <div className="admin-list-meta">{String(row.source ?? '')}</div>
                {row.fixable && (
                  <div className="admin-list-actions">
                    <button className="admin-btn" onClick={runFixNow} disabled={busy}>Fix Now</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {issueLog.some((row) => !row.fixable) && (
          <div className="admin-card-sub" style={{ marginTop: 10 }}>
            Manual steps:
          </div>
        )}
        {issueLog.some((row) => !row.fixable) && (
          <div className="admin-card-sub">
            Step 1: Run “Sync + Mods Diff + Restart”.
          </div>
        )}
        {issueLog.some((row) => !row.fixable) && (
          <div className="admin-card-sub">
            Step 2: If it still happens, run “Panel Restart”.
          </div>
        )}
        {issueLog.some((row) => !row.fixable) && (
          <div className="admin-card-sub">
            Step 3: If it still happens, contact the host and share the issue log.
          </div>
        )}
        <div className="admin-card-sub" style={{ marginTop: 8 }}>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={showFixableOnly}
              onChange={(e) => setShowFixableOnly(e.currentTarget.checked)}
            />
            <span>Show only fixable issues</span>
          </label>
        </div>
      </div>

      <div className="admin-grid two" style={{ marginTop: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Maintenance Mode</div>
            <div className="admin-card-actions">
              <button className="admin-btn" onClick={refreshMaintenanceStatus} disabled={busy}>Refresh</button>
              <button className="admin-btn" onClick={saveMaintenanceSettings} disabled={busy}>Save</button>
            </div>
          </div>
          <div className="admin-card-sub">
            Turn on a clear maintenance banner and optionally mute ops alerts while maintenance runs.
          </div>
          <div className="admin-card-sub">
            Current: {String((maintenanceStatus as { status?: string })?.status ?? 'unknown')}
          </div>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Message</span>
            <input
              className="admin-input"
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              placeholder="Maintenance in progress."
            />
          </label>
          <label className="admin-toggle" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={maintenanceAutoMute}
              onChange={(e) => setMaintenanceAutoMute(e.currentTarget.checked)}
            />
            <span>Auto-mute ops alerts during maintenance</span>
            <span
              className="admin-tooltip"
              title="When enabled, ops alerts are suppressed while maintenance is active."
              aria-label="When enabled, ops alerts are suppressed while maintenance is active."
            >
              ?
            </span>
          </label>
          <div className="admin-row" style={{ marginTop: 10 }}>
            <button className="admin-btn" onClick={runEnableMaintenance} disabled={busy}>Enable</button>
            <button className="admin-btn danger" onClick={runDisableMaintenance} disabled={busy}>Disable</button>
            <button className="admin-btn" onClick={runMaintenanceMacroAction} disabled={busy}>
              Maintenance + Restart
            </button>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Mods Diff</div>
            <div className="admin-card-actions">
              <button className="admin-btn" onClick={runModsDiff} disabled={busy}>Check</button>
            </div>
          </div>
          <div className="admin-card-sub">
            Compares the website mod list to what the server currently has installed.
          </div>
          {modsDiff ? (
            <div className="admin-card-sub">
              Added on server: {((modsDiff.addedOnServer?.workshop ?? modsDiff.missingInSite.workshop).length + (modsDiff.addedOnServer?.mods ?? modsDiff.missingInSite.mods).length)}
              {' • '}
              Deleted from server: {((modsDiff.deletedFromServer?.workshop ?? modsDiff.missingInServer.workshop).length + (modsDiff.deletedFromServer?.mods ?? modsDiff.missingInServer.mods).length)}
            </div>
          ) : (
            <div className="admin-card-sub">Run a check to compare site mods vs server mods.</div>
          )}
          <div className="admin-row" style={{ marginTop: 10 }}>
            <button className="admin-btn" onClick={runSyncRestartMacroAction} disabled={busy}>
              Sync + Mods Diff + Restart
            </button>
          </div>
          {modsDiff && (
            <pre className="admin-code" style={{ marginTop: 12 }}>
{JSON.stringify(modsDiff, null, 2)}
            </pre>
          )}
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Alert Controls</div>
          <div className="admin-card-actions">
            <button className="admin-btn" onClick={saveAlertSettings} disabled={busy}>Save</button>
          </div>
        </div>
        <div className="admin-card-sub">
          Controls Discord alert volume, quiet hours, and which categories are allowed.
        </div>
        <div className="admin-row" style={{ marginTop: 6 }}>
          <div className="admin-card-sub">
            Mute until: {muteUntil ? new Date(muteUntil).toLocaleString() : 'not muted'}
          </div>
          <div className="admin-card-actions" style={{ marginLeft: 'auto' }}>
            <button className="admin-btn" onClick={() => runMute(1)} disabled={busy}>Mute 1h</button>
            <button className="admin-btn" onClick={() => runMute(6)} disabled={busy}>Mute 6h</button>
            <button className="admin-btn" onClick={() => runMute(24)} disabled={busy}>Mute 24h</button>
            <button className="admin-btn danger" onClick={runUnmute} disabled={busy}>Unmute</button>
          </div>
        </div>
        <div className="admin-row" style={{ marginTop: 10 }}>
          <input
            className="admin-input"
            type="datetime-local"
            value={muteUntilInput}
            onChange={(e) => setMuteUntilInput(e.target.value)}
          />
          <button className="admin-btn" onClick={runMuteUntil} disabled={busy || !muteUntilInput.trim()}>
            Mute Until
          </button>
        </div>
        <div className="admin-grid two" style={{ marginTop: 10 }}>
          <label className="admin-field">
            <span>Min Interval (minutes)</span>
            <input
              className="admin-input"
              type="number"
              min={1}
              max={120}
              value={alertMinInterval}
              onChange={(e) => setAlertMinInterval(Number(e.target.value))}
            />
          </label>
          <label className="admin-field">
            <span>Quiet Hours</span>
            <select
              className="admin-select"
              value={quietEnabled ? 'on' : 'off'}
              onChange={(e) => setQuietEnabled(e.currentTarget.value === 'on')}
            >
              <option value="off">Disabled</option>
              <option value="on">Enabled</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Quiet Start</span>
            <input
              className="admin-input"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              placeholder="00:00"
            />
          </label>
          <label className="admin-field">
            <span>Quiet End</span>
            <input
              className="admin-input"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              placeholder="06:00"
            />
          </label>
        </div>
        <div className="admin-row" style={{ marginTop: 10 }}>
          <label className="admin-toggle">
            <input type="checkbox" checked={alertPanelHealth} onChange={(e) => setAlertPanelHealth(e.currentTarget.checked)} />
            <span>Panel Health</span>
          </label>
          <label className="admin-toggle">
            <input type="checkbox" checked={alertRestarts} onChange={(e) => setAlertRestarts(e.currentTarget.checked)} />
            <span>Restarts</span>
          </label>
          <label className="admin-toggle">
            <input type="checkbox" checked={alertMismatches} onChange={(e) => setAlertMismatches(e.currentTarget.checked)} />
            <span>Mismatches</span>
          </label>
          <label className="admin-toggle">
            <input type="checkbox" checked={alertSchedule} onChange={(e) => setAlertSchedule(e.currentTarget.checked)} />
            <span>Schedule</span>
          </label>
          <label className="admin-toggle">
            <input type="checkbox" checked={alertSummary} onChange={(e) => setAlertSummary(e.currentTarget.checked)} />
            <span>Summary</span>
          </label>
        </div>
      </div>

      <div className="admin-grid two" style={{ marginTop: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Summary Settings</div>
            <div className="admin-card-actions">
              <button className="admin-btn" onClick={saveSummarySettings} disabled={busy}>Save</button>
            </div>
          </div>
          <div className="admin-card-sub">
            Daily/weekly summaries for owners. Set role IDs to ping only owner/dev.
          </div>
          <div className="admin-grid two" style={{ marginTop: 10 }}>
            <label className="admin-field">
              <span>Daily Summary</span>
              <select
                className="admin-select"
                value={dailyEnabled ? 'on' : 'off'}
                onChange={(e) => setDailyEnabled(e.currentTarget.value === 'on')}
              >
                <option value="off">Disabled</option>
                <option value="on">Enabled</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Daily Time</span>
              <input className="admin-input" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Daily CSV</span>
              <select
                className="admin-select"
                value={dailyIncludeCsv ? 'on' : 'off'}
                onChange={(e) => setDailyIncludeCsv(e.currentTarget.value === 'on')}
              >
                <option value="off">Disabled</option>
                <option value="on">Enabled</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Weekly Summary</span>
              <select
                className="admin-select"
                value={weeklyEnabled ? 'on' : 'off'}
                onChange={(e) => setWeeklyEnabled(e.currentTarget.value === 'on')}
              >
                <option value="off">Disabled</option>
                <option value="on">Enabled</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Weekly Time</span>
              <input className="admin-input" value={weeklyTime} onChange={(e) => setWeeklyTime(e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Weekly Day</span>
              <select className="admin-select" value={weeklyDay} onChange={(e) => setWeeklyDay(e.currentTarget.value)}>
                <option value="mon">Mon</option>
                <option value="tue">Tue</option>
                <option value="wed">Wed</option>
                <option value="thu">Thu</option>
                <option value="fri">Fri</option>
                <option value="sat">Sat</option>
                <option value="sun">Sun</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Weekly CSV</span>
              <select
                className="admin-select"
                value={weeklyIncludeCsv ? 'on' : 'off'}
                onChange={(e) => setWeeklyIncludeCsv(e.currentTarget.value === 'on')}
              >
                <option value="off">Disabled</option>
                <option value="on">Enabled</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Summary Webhook (optional)</span>
              <input
                className="admin-input"
                value={summaryWebhookUrl}
                onChange={(e) => setSummaryWebhookUrl(e.target.value)}
                placeholder="Discord webhook URL for summary-only"
              />
            </label>
            <label className="admin-field">
              <span>Summary Role IDs</span>
              <input
                className="admin-input"
                value={summaryRoleIds}
                onChange={(e) => setSummaryRoleIds(e.target.value)}
                placeholder="OwnerRoleId, DevRoleId"
              />
            </label>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Export Schedule</div>
            <div className="admin-card-actions">
              <button className="admin-btn" onClick={saveExportSchedule} disabled={busy}>Save</button>
            </div>
          </div>
          <div className="admin-card-sub">
            Automates CSV exports on a schedule for quick reporting.
          </div>
          <div className="admin-grid two" style={{ marginTop: 10 }}>
            <label className="admin-field">
              <span>Enabled</span>
              <select
                className="admin-select"
                value={exportEnabled ? 'on' : 'off'}
                onChange={(e) => setExportEnabled(e.currentTarget.value === 'on')}
              >
                <option value="off">Disabled</option>
                <option value="on">Enabled</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Cadence</span>
              <select
                className="admin-select"
                value={exportCadence}
                onChange={(e) => setExportCadence(e.currentTarget.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Time</span>
              <input className="admin-input" value={exportTime} onChange={(e) => setExportTime(e.target.value)} />
            </label>
            <label className="admin-field">
              <span>Day (Weekly)</span>
              <select className="admin-select" value={exportDay} onChange={(e) => setExportDay(e.currentTarget.value)}>
                <option value="mon">Mon</option>
                <option value="tue">Tue</option>
                <option value="wed">Wed</option>
                <option value="thu">Thu</option>
                <option value="fri">Fri</option>
                <option value="sat">Sat</option>
                <option value="sun">Sun</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Hours</span>
              <input
                className="admin-input"
                type="number"
                min={1}
                max={720}
                value={exportHours}
                onChange={(e) => setExportHours(Number(e.target.value))}
              />
            </label>
            <label className="admin-field">
              <span>Limit</span>
              <input
                className="admin-input"
                type="number"
                min={100}
                max={10000}
                value={exportLimit}
                onChange={(e) => setExportLimit(Number(e.target.value))}
              />
            </label>
            <label className="admin-field" style={{ gridColumn: 'span 2' }}>
              <span>Message</span>
              <input className="admin-input" value={exportMessage} onChange={(e) => setExportMessage(e.target.value)} />
            </label>
          </div>
        </div>
      </div>

      {showAdvanced && (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-card-header">
            <div className="admin-card-title">Ops Config (JSON)</div>
            <div className="admin-card-actions">
              <button className="admin-btn" onClick={loadOpsConfig} disabled={busy}>Reload</button>
              <button className="admin-btn primary" onClick={saveOpsConfig} disabled={busy || !opsConfigDirty}>Save</button>
            </div>
          </div>
          <div className="admin-card-sub">
            Advanced settings. Only change if you are comfortable with JSON.
          </div>
          <textarea
            className="admin-textarea"
            rows={14}
            value={opsConfigRaw}
            onChange={(e) => {
              setOpsConfigRaw(e.target.value)
              setOpsConfigDirty(true)
            }}
            placeholder="Ops config JSON..."
          />
          {opsConfigError && <div className="admin-card-sub" style={{ color: 'var(--bad)' }}>{opsConfigError}</div>}
        </div>
      )}

      <div className="admin-grid two" style={{ marginTop: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Panel Backups</div>
            <div className="admin-card-actions">
              <button className="admin-btn" onClick={refreshBackups} disabled={busy}>Refresh</button>
            </div>
          </div>
          <div className="admin-card-sub">
            Create and view panel backups stored on your host.
          </div>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Create Backup</span>
            <input
              className="admin-input"
              value={panelBackupName}
              onChange={(e) => setPanelBackupName(e.target.value)}
              placeholder="Optional backup name"
            />
          </label>
          <div className="admin-row" style={{ marginTop: 8 }}>
            <button className="admin-btn" onClick={runCreateBackup} disabled={busy}>Create</button>
          </div>
          {panelBackups && (
            <pre className="admin-code" style={{ marginTop: 12 }}>
{JSON.stringify(panelBackups, null, 2)}
            </pre>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Player History</div>
            <div className="admin-card-actions">
              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={smoothSeries}
                  onChange={(e) => setSmoothSeries(e.currentTarget.checked)}
                />
                <span>Smooth</span>
              </label>
              <select
                className="admin-select"
                value={historyRange}
                onChange={(e) => setHistoryRange(e.currentTarget.value)}
              >
                <option value="1h">Last 1h</option>
                <option value="6h">Last 6h</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
              </select>
              <button className="admin-btn" onClick={refreshPlayerHistory} disabled={busy}>Refresh</button>
              <a
                className="admin-btn"
                href={getPlayersHistoryCsvUrl({
                  limit: historyRange === '30d' ? 10000 : historyRange === '7d' ? 5000 : 2000,
                  hours: rangeToHours(historyRange)
                })}
                target="_blank"
                rel="noreferrer"
              >
                Export CSV
              </a>
            </div>
          </div>
          <div className="admin-card-sub">
            Live player counts with quick charts and CSV export.
          </div>
          {filterHistoryByRange(playerHistory).length === 0 ? (
            <div className="admin-card-sub">No history yet.</div>
          ) : (
            <>
              <div
                className="admin-chart"
                onMouseLeave={() => setHoverIndex(null)}
                onMouseMove={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
                  const series = filterHistoryByRange(playerHistory).slice(-60)
                  if (series.length === 0) return
                  const idx = Math.round((x / rect.width) * (series.length - 1))
                  setHoverIndex(idx)
                }}
              >
                <svg viewBox="0 0 100 32" preserveAspectRatio="none">
                  <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
                  <line x1="0" y1="2" x2="0" y2="30" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    points={(() => {
                      const series = playerHistory.slice(-60)
                      const filtered = filterHistoryByRange(series)
                      const plotted = !smoothSeries || filtered.length < 3
                        ? filtered
                        : filtered.map((entry, idx, arr) => {
                          const start = Math.max(0, idx - 2)
                          const end = Math.min(arr.length - 1, idx + 2)
                          const slice = arr.slice(start, end + 1)
                          const avg = slice.reduce((sum, item) => sum + item.playersOnline, 0) / slice.length
                          return { ...entry, playersOnline: avg }
                        })
                      return plotted
                        .map((entry, idx, arr) => {
                          const min = Math.min(...arr.map(a => a.playersOnline))
                          const max = Math.max(...arr.map(a => a.playersOnline))
                          const range = Math.max(1, max - min)
                          const x = (idx / Math.max(1, arr.length - 1)) * 100
                          const y = 30 - ((entry.playersOnline - min) / range) * 28
                          return `${x.toFixed(2)},${y.toFixed(2)}`
                        })
                        .join(' ')
                    })()}
                  />
                </svg>
              </div>
              {hoverIndex !== null && filterHistoryByRange(playerHistory).slice(-60)[hoverIndex] && (
                <div className="admin-card-sub">
                  {new Date(filterHistoryByRange(playerHistory).slice(-60)[hoverIndex].timeUtc).toLocaleString()} • Players:{' '}
                  {filterHistoryByRange(playerHistory).slice(-60)[hoverIndex].playersOnline}
                </div>
              )}
              <div className="admin-list" style={{ marginTop: 10 }}>
                {filterHistoryByRange(playerHistory).slice(-12).map((entry, idx) => (
                  <div key={`${entry.timeUtc}-${idx}`} className="admin-list-item">
                    <div>
                      <div className="admin-list-title">{new Date(entry.timeUtc).toLocaleString()}</div>
                      <div className="admin-list-sub">Players: {entry.playersOnline}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Backup Downloads</div>
        </div>
        <div className="admin-card-sub">
          To download a backup, paste its ID and fetch the download payload.
        </div>
        <div className="admin-row" style={{ marginTop: 10 }}>
          <input
            className="admin-input"
            placeholder="Backup ID"
            onChange={(e) => setPanelBackupName(e.target.value)}
            value={panelBackupName}
          />
          <button className="admin-btn" onClick={() => runBackupDownload(panelBackupName)} disabled={busy || !panelBackupName.trim()}>
            Get Download
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Export Center</div>
        </div>
        <div className="admin-card-sub">
          Quick CSV exports for player history. Files open in a new tab so you can download or save.
        </div>
        <div className="admin-row" style={{ marginTop: 10 }}>
          <a className="admin-btn" href={getPlayersHistoryCsvUrl({ limit: 300, hours: 1 })} target="_blank" rel="noreferrer">
            CSV 1h
          </a>
          <a className="admin-btn" href={getPlayersHistoryCsvUrl({ limit: 600, hours: 6 })} target="_blank" rel="noreferrer">
            CSV 6h
          </a>
          <a className="admin-btn" href={getPlayersHistoryCsvUrl({ limit: 2000, hours: 24 })} target="_blank" rel="noreferrer">
            CSV 24h
          </a>
          <a className="admin-btn" href={getPlayersHistoryCsvUrl({ limit: 5000, hours: 168 })} target="_blank" rel="noreferrer">
            CSV 7d
          </a>
          <a className="admin-btn" href={getPlayersHistoryCsvUrl({ limit: 10000, hours: 720 })} target="_blank" rel="noreferrer">
            CSV 30d
          </a>
        </div>
      </div>

      {(result || error) && (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-card-header">
            <div className="admin-card-title">Last Result</div>
          </div>
          <div className="admin-card-sub">
            The most recent success or error from an action you ran.
          </div>
          {result && <div className="admin-card-sub" style={{ color: 'rgba(74,222,128,0.95)', marginTop: 8 }}>{result}</div>}
          {error && <div className="admin-card-sub" style={{ color: 'rgba(248,113,113,0.95)', marginTop: 8 }}>{error}</div>}
        </div>
      )}

      {opsLog.length > 0 && (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-card-header">
            <div className="admin-card-title">Ops Activity Log</div>
            <div className="admin-card-actions">
              <button
                className="admin-btn"
                onClick={() => {
                  const lines = opsLog.map((entry) => {
                    const payload = entry.payload ? `\n${entry.payload}` : ''
                    return `[${entry.time}] ${entry.message}${payload}`
                  })
                  navigator.clipboard?.writeText(lines.join('\n\n'))
                }}
              >
                Copy Log
              </button>
              <button
                className="admin-btn"
                onClick={() => {
                  setOpsLog([])
                  try {
                    localStorage.removeItem('ghrp_ops_log')
                  } catch {}
                }}
              >
                Clear Log
              </button>
            </div>
          </div>
          <div className="admin-card-sub">
            Local activity log for quick context when troubleshooting.
          </div>
          <div className="admin-list">
            {opsLog.map((entry, index) => (
              <div key={`${entry.time}-${index}`} className="admin-list-item">
                <div>
                  <div className="admin-list-title">{entry.message}</div>
                  <div className="admin-list-sub">{entry.time}</div>
                  {entry.payload && (
                    <pre className="admin-code" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                      {entry.payload}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-grid two" style={{ marginTop: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Uptime Split</div>
            <div className="admin-card-actions">
              <button className="admin-btn" onClick={refreshStatusHistory} disabled={busy}>Refresh</button>
            </div>
          </div>
          <div className="admin-card-sub">
            A simple view of online vs maintenance vs offline time.
          </div>
          {(() => {
            const split = computeUptimeSplit(statusHistory)
            if (!split) return <div className="admin-card-sub">No status history yet.</div>
            return (
              <>
                <div className="admin-uptime-bar">
                  <div className="admin-uptime-segment online" style={{ flex: split.online }} />
                  <div className="admin-uptime-segment maintenance" style={{ flex: split.maintenance }} />
                  <div className="admin-uptime-segment offline" style={{ flex: split.offline }} />
                </div>
                <div className="admin-card-sub">
                  Online {(split.online * 100).toFixed(1)}% • Maintenance {(split.maintenance * 100).toFixed(1)}% • Offline {(split.offline * 100).toFixed(1)}%
                </div>
              </>
            )
          })()}
        </div>
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">What Requires Host Access</div>
          </div>
          <div className="admin-card-sub" style={{ marginTop: 8 }}>
            Workshop updates, SteamCMD, service installs, systemd restarts, and log inspection are all host-level.
            If you do not have SSH or a host console, use a panel startup script or ask your host to run commands.
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">What RCON Can Do</div>
          </div>
          <div className="admin-card-sub" style={{ marginTop: 8 }}>
            Announcements, in-game commands, and basic status checks. RCON cannot update Workshop content.
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Bridge Install (Game VPS)</div>
        </div>
        <div className="admin-card-sub" style={{ marginTop: 8 }}>
          Use this command on the game VPS host. Replace the token and paths as needed.
        </div>
        <pre className="admin-code" style={{ marginTop: 12 }}>
{`chmod +x /home/container/install-game-bridge.sh /home/container/workshop-update.sh

sudo env \\
  GREYHOURRP_GAME_CONTROL_TOKEN="<token>" \\
  GAME_SERVICE_NAME="zomboid.service" \\
  WORKSHOP_UPDATE_SCRIPT="/home/container/workshop-update.sh" \\
  STEAMCMD_PATH="/steamcmd/steamcmd.sh" \\
  GAME_APP_ID="380870" \\
  WORKSHOP_APP_ID="108600" \\
  SERVER_INI="/.cache/Server/legionhosting2.ini" \\
  bash /home/container/install-game-bridge.sh`}
        </pre>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Verify Bridge</div>
        </div>
        <div className="admin-card-sub">
          Confirms the bridge service is running and responding.
        </div>
        <pre className="admin-code" style={{ marginTop: 12 }}>
{`sudo systemctl status greyhourrp-game-bridge.service --no-pager
curl -s -H "Authorization: Bearer <token>" http://127.0.0.1:8787/control/status`}
        </pre>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Admin API Config (API VPS)</div>
        </div>
        <div className="admin-card-sub">
          Connects the admin API to the game bridge.
        </div>
        <pre className="admin-code" style={{ marginTop: 12 }}>
{`# /etc/greyhourrp-admin-api.env
GREYHOURRP_GAME_CONTROL_URL=http://<GAME_VPS_IP>:8787
GREYHOURRP_GAME_CONTROL_TOKEN=<token>

sudo systemctl restart greyhourrp-admin-api`}
        </pre>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-header">
          <div className="admin-card-title">Panel API Restart (No SSH)</div>
        </div>
        <div className="admin-card-sub" style={{ marginTop: 8 }}>
          If your host provides a panel API (Pterodactyl), the admin API can restart the server directly.
        </div>
        <pre className="admin-code" style={{ marginTop: 12 }}>
{`# /etc/greyhourrp-admin-api.env
GREYHOURRP_PANEL_URL=https://<PANEL_HOST>
GREYHOURRP_PANEL_API_KEY=<client_api_key>
GREYHOURRP_PANEL_SERVER_ID=<server_identifier>

sudo systemctl restart greyhourrp-admin-api`}
        </pre>
      </div>
    </div>
  )
}
