import type {
  AdminUserMap,
  Transmission,
  UpdateItem,
  ServerStatus,
  StatusHistoryItem,
  ModItem,
  HomeMedia,
  PublicLiveSnapshot,
  IntegrationReadiness,
  FactionTerritoryState,
  DossierCollection,
  StoryArcCollection,
  EventCalendar,
  EconomySnapshot,
  HelplineScripts,
  SiteSettings,
  SiteFlags
} from '../../types/content'
import type { DiscordOpsSettings, FactionChannelMap } from '../../types/content'

const BASE = import.meta.env.VITE_ADMIN_API_BASE ?? ''
const LIVE_BASE = (import.meta.env.VITE_LIVE_API_BASE ?? BASE ?? '').trim()
const PUBLIC_GAME_PATH = (import.meta.env.VITE_PUBLIC_GAME_PATH ?? '/api/public/game/telemetry').trim()
const PUBLIC_DISCORD_PATH = (import.meta.env.VITE_PUBLIC_DISCORD_PATH ?? '/api/public/discord/status').trim()
const PUBLIC_INTEGRATION_PATH = (import.meta.env.VITE_PUBLIC_INTEGRATION_PATH ?? '/api/public/integration/readiness').trim()
const BASIC_STORAGE = 'ghrp_admin_basic'
const OIDC_TOKEN_STORAGE = 'ghrp_admin_oidc_token'

export type AdminBasicCredentials = {
  username: string
  password: string
}

export function getAdminBasic(): AdminBasicCredentials | null {
  const raw = sessionStorage.getItem(BASIC_STORAGE)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AdminBasicCredentials>
    if (!parsed.username || !parsed.password) return null
    return { username: parsed.username, password: parsed.password }
  } catch {
    return null
  }
}

export function setAdminBasic(username: string, password: string) {
  sessionStorage.setItem(BASIC_STORAGE, JSON.stringify({ username, password }))
}

export function clearAdminBasic() {
  sessionStorage.removeItem(BASIC_STORAGE)
}

export function clearAdminSession() {
  clearAdminBasic()
  clearAdminOidcToken()
  // clear legacy key session data from older builds
  sessionStorage.removeItem('ghrp_admin_key')
}

export function getAdminOidcToken() {
  return sessionStorage.getItem(OIDC_TOKEN_STORAGE)
}

export function setAdminOidcToken(token: string) {
  sessionStorage.setItem(OIDC_TOKEN_STORAGE, token)
}

export function clearAdminOidcToken() {
  sessionStorage.removeItem(OIDC_TOKEN_STORAGE)
}

function adminHeaders(): HeadersInit {
  const oidcToken = getAdminOidcToken()
  if (oidcToken) {
    return { Authorization: `Bearer ${oidcToken}` }
  }

  const creds = getAdminBasic()
  const basicAuth = creds
    ? `Basic ${btoa(`${creds.username}:${creds.password}`)}`
    : null

  return {
    ...(basicAuth ? { Authorization: basicAuth } : {})
  }
}

function emitSfx(type: 'success' | 'warning') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(type === 'success' ? 'gh:sfx-success' : 'gh:sfx-warning'))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const isMutation = method !== 'GET' && method !== 'HEAD'
  const isReadRequest = !isMutation
  const maxAttempts = isReadRequest ? 4 : 1
  const retryDelaysMs = [250, 700, 1400]
  let lastNetworkError: string | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          ...adminHeaders()
        }
      })
    } catch (err) {
      lastNetworkError = err instanceof Error ? err.message : String(err)
      if (attempt < maxAttempts) {
        await sleep(retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)])
        continue
      }
      if (isMutation) emitSfx('warning')
      throw new Error(`Network/auth request failed. Re-enter admin username/password and try again. Details: ${lastNetworkError}`)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (isReadRequest && attempt < maxAttempts && shouldRetryStatus(res.status)) {
        await sleep(retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)])
        continue
      }
      if (isMutation) emitSfx('warning')
      if (res.status === 401) {
        throw new Error(`401 Unauthorized. Re-enter your admin username/password in /admin/login. ${text}`.trim())
      }
      if (res.status === 403) {
        throw new Error(`403 Forbidden. Your role is not allowed to modify this section. ${text}`.trim())
      }
      if (res.status >= 500) {
        throw new Error(`Server error (${res.status}). The admin API failed while handling this request. ${text}`.trim())
      }
      throw new Error(`${res.status} ${text}`.trim())
    }

    if (isMutation) emitSfx('success')
    if (res.status === 204) return null as T
    return res.json() as Promise<T>
  }

  if (isMutation) emitSfx('warning')
  throw new Error(`Request failed after retries.${lastNetworkError ? ` Last error: ${lastNetworkError}` : ''}`)
}

export async function ping() {
  return adminFetch<{ ok: boolean; timeUtc: string }>('/api/admin/ping')
}

export async function me() {
  return adminFetch<{ user: string | null; role: string | null }>('/api/admin/me')
}

export async function getContent<T>(name: string) {
  return adminFetch<T>(`/api/admin/content/${name}`)
}

export async function saveContent<T>(name: string, data: T) {
  return adminFetch<{ ok: boolean }>(`/api/admin/content/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data, null, 2)
  })
}

export async function listBackups(name: string) {
  return adminFetch<Array<{ file: string; size: number; modifiedUtc: string }>>(
    `/api/admin/backups/${name}`
  )
}

export async function restoreBackup(name: string, file: string) {
  return adminFetch<{ ok: boolean }>(`/api/admin/restore/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file })
  })
}

export async function getActivity(limit = 200) {
  return adminFetch<Array<Record<string, unknown>>>(`/api/admin/activity?limit=${limit}`)
}

export async function getAuditEntries(params?: {
  limit?: number
  q?: string
  user?: string
  action?: string
  role?: string
  fromUtc?: string
  toUtc?: string
}) {
  const qp = new URLSearchParams()
  if (params?.limit) qp.set('limit', String(params.limit))
  if (params?.q) qp.set('q', params.q)
  if (params?.user) qp.set('user', params.user)
  if (params?.action) qp.set('action', params.action)
  if (params?.role) qp.set('role', params.role)
  if (params?.fromUtc) qp.set('fromUtc', params.fromUtc)
  if (params?.toUtc) qp.set('toUtc', params.toUtc)
  const query = qp.toString()
  return adminFetch<{ ok: boolean; count: number; rows: Array<Record<string, unknown>> }>(
    `/api/admin/audit${query ? `?${query}` : ''}`
  )
}

export function getAuditCsvUrl(params?: {
  limit?: number
  q?: string
  user?: string
  action?: string
  role?: string
  fromUtc?: string
  toUtc?: string
}) {
  const qp = new URLSearchParams()
  if (params?.limit) qp.set('limit', String(params.limit))
  if (params?.q) qp.set('q', params.q)
  if (params?.user) qp.set('user', params.user)
  if (params?.action) qp.set('action', params.action)
  if (params?.role) qp.set('role', params.role)
  if (params?.fromUtc) qp.set('fromUtc', params.fromUtc)
  if (params?.toUtc) qp.set('toUtc', params.toUtc)
  const query = qp.toString()
  return `/api/admin/audit/export.csv${query ? `?${query}` : ''}`
}

export async function listUsers() {
  return adminFetch<AdminUserMap>('/api/admin/users')
}

export async function saveUser(user: string, role: string, password?: string) {
  return adminFetch<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(user)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, ...(password ? { password } : {}) })
  })
}

export async function deleteUser(user: string) {
  return adminFetch<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(user)}`, {
    method: 'DELETE'
  })
}

export async function createUserResetTicket(user: string, ttlMinutes = 15) {
  return adminFetch<{
    ok: boolean
    user: string
    ticketId: string
    code: string
    expiresUtc: string
  }>(`/api/admin/users/${encodeURIComponent(user)}/reset-ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttlMinutes })
  })
}

export type ActiveResetTicket = {
  ticketId: string
  user: string
  expiresUtc: string
  createdUtc: string
  createdBy: string
}

// /admin/server/* endpoints for Pterodactyl-backed server control.
export type ServerControlStatus = {
  ok: boolean
  data?: {
    name?: string
    state?: string
    node?: string
    primaryAllocation?: string
    updatedAtUtc?: string
  }
  error?: string
  detail?: string
}

export type ServerControlResources = {
  ok: boolean
  data?: {
    state?: string
    cpuAbsolute?: number
    memoryBytes?: number
    diskBytes?: number
    networkRxBytes?: number
    networkTxBytes?: number
    uptimeMs?: number
    updatedAtUtc?: string
  }
  error?: string
  detail?: string
}

export type ServerControlConsoleConnection = {
  ok: boolean
  connection?: {
    mode: 'websocket'
    token: string
    socket: string
    expiresInSeconds?: number
    retrievedAtUtc?: string
  }
  proxy?: {
    mode: 'websocket-proxy'
    url: string
    expiresAtUtc?: string
  }
  note?: string
  error?: string
  detail?: string
}

export type ServerConsolePollResult = {
  ok: boolean
  cursor: number
  lines: string[]
  source?: string
  updatedAtUtc?: string
}

export type ServerConsoleDiagnosticIssue = {
  id: string
  severity: 'info' | 'warn' | 'error'
  title: string
  meaning: string
  evidence?: string
  fixSteps: string[]
  recommendedCommands: string[]
  recommendedAction?: string
  recommendedEndpoint?: string
}

export type ServerConsoleDiagnosticsResult = {
  ok: boolean
  source?: string
  scannedLines?: number
  issueCount?: number
  issues: ServerConsoleDiagnosticIssue[]
  generatedAtUtc?: string
}

export type ServerControlPowerSignal = 'start' | 'stop' | 'restart' | 'kill'

// Legacy dashboard types kept for compatibility with existing widgets.
export type PteroStatusSnapshot = {
  name?: string
  state?: string
  node?: string
  primaryAllocation?: string
  limits?: {
    memoryMb?: number
    diskMb?: number
    cpu?: number
  }
  featureLimits?: {
    databases?: number
    backups?: number
    allocations?: number
  }
  databases?: number
  updatedAt?: string
}

export type PteroResourceSnapshot = {
  state?: string
  cpu?: number
  memoryBytes?: number
  memoryLimitBytes?: number
  diskBytes?: number
  diskLimitBytes?: number
  networkRxBytes?: number
  networkTxBytes?: number
  uptimeMs?: number
  updatedAt?: string
}

export async function listUserResetTickets(user: string) {
  return adminFetch<ActiveResetTicket[]>(`/api/admin/users/${encodeURIComponent(user)}/reset-tickets`)
}

export async function revokeUserResetTicket(user: string, ticketId: string) {
  return adminFetch<{ ok: boolean; revoked: boolean }>(
    `/api/admin/users/${encodeURIComponent(user)}/reset-tickets/${encodeURIComponent(ticketId)}`,
    { method: 'DELETE' }
  )
}

export async function getServerControlStatus() {
  return adminFetch<ServerControlStatus>('/api/admin/server/status')
}

export async function getServerControlResources() {
  return adminFetch<ServerControlResources>('/api/admin/server/resources')
}

export async function getServerControlConsole() {
  return adminFetch<ServerControlConsoleConnection>('/api/admin/server/console')
}

export async function pollServerConsole(cursor = 0, maxLines = 60) {
  const qp = new URLSearchParams()
  qp.set('cursor', String(Math.max(0, cursor)))
  qp.set('maxLines', String(Math.min(200, Math.max(10, maxLines))))
  return adminFetch<ServerConsolePollResult>(`/api/admin/server/console/poll?${qp.toString()}`)
}

export async function getServerConsoleDiagnostics(tailLines = 1200) {
  const qp = new URLSearchParams()
  qp.set('tailLines', String(Math.min(8000, Math.max(200, tailLines))))
  return adminFetch<ServerConsoleDiagnosticsResult>(`/api/admin/server/console/diagnostics?${qp.toString()}`)
}

export async function sendServerPower(signal: ServerControlPowerSignal) {
  return adminFetch<{ ok: boolean; signal?: string; payload?: Record<string, unknown> }>('/api/admin/server/power', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signal })
  })
}

export async function sendServerCommand(command: string) {
  return adminFetch<{ ok: boolean; payload?: Record<string, unknown> }>('/api/admin/server/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  })
}

export async function runGameQuickAction(action:
  | 'refresh'
  | 'sync_mods'
  | 'sync_items'
  | 'safe_fix'
  | 'panel_restart'
  | 'check_mods_update'
) {
  return adminFetch<{
    ok: boolean
    action: string
    message?: string
    telemetry?: Record<string, unknown>
    sync?: Record<string, unknown>
    result?: Record<string, unknown>
    payload?: Record<string, unknown>
    statusCode?: number
  }>('/api/admin/game/quick-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  })
}

export async function getPteroStatus() {
  const result = await getServerControlStatus()
  if (!result.ok) {
    throw new Error(result.detail ?? result.error ?? 'Pterodactyl status unavailable.')
  }

  return {
    name: result.data?.name,
    state: result.data?.state,
    node: result.data?.node,
    primaryAllocation: result.data?.primaryAllocation,
    updatedAt: result.data?.updatedAtUtc
  } satisfies PteroStatusSnapshot
}

export async function getPteroResources() {
  const result = await getServerControlResources()
  if (!result.ok) {
    throw new Error(result.detail ?? result.error ?? 'Pterodactyl resources unavailable.')
  }

  return {
    state: result.data?.state,
    cpu: result.data?.cpuAbsolute,
    memoryBytes: result.data?.memoryBytes,
    diskBytes: result.data?.diskBytes,
    networkRxBytes: result.data?.networkRxBytes,
    networkTxBytes: result.data?.networkTxBytes,
    uptimeMs: result.data?.uptimeMs,
    updatedAt: result.data?.updatedAtUtc
  } satisfies PteroResourceSnapshot
}

export async function completePasswordReset(
  user: string,
  ticketId: string,
  code: string,
  newPassword: string
) {
  return adminFetch<{ ok: boolean }>(`/api/admin/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, ticketId, code, newPassword })
  })
}

export async function getDiscordStatus() {
  return adminFetch<{ enabled: boolean }>('/api/admin/discord/status')
}

export async function announceDiscord(message: string, mentionEveryone: boolean) {
  return adminFetch<{ ok: boolean }>(`/api/admin/discord/announce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, mentionEveryone })
  })
}

export async function testDiscord() {
  return adminFetch<{ ok: boolean }>(`/api/admin/discord/test`, {
    method: 'POST' }
  )
}

export type DiscordMetrics = {
  ok: boolean
  source?: string
  collectedUtc?: string
  counters?: Record<string, number>
  commandByName?: Array<{ command: string; total: number }>
  error?: string
}

export async function getDiscordMetrics() {
  return adminFetch<DiscordMetrics>('/api/admin/discord/metrics')
}

export async function listDiscordBotCommands() {
  return adminFetch<{
    ok: boolean
    commands: Array<{ id: string; label: string; category: string; description?: string }>
  }>('/api/admin/discord/commands')
}

export async function executeDiscordBotCommand(action: string, payload?: Record<string, unknown>) {
  return adminFetch<{ ok: boolean; action: string; payload?: Record<string, unknown> }>('/api/admin/discord/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload: payload ?? {} })
  })
}

export type GameTelemetry = {
  ok: boolean
  checkedUtc?: string
  version?: string | null
  compatibility?: {
    detectedGameVersion?: string | null
    detectedVersionTrain?: string | null
    versionedModsCount?: number
    mismatchCount?: number
    ok?: boolean
    mismatches?: Array<Record<string, unknown>>
  }
  server?: {
    checkedUtc?: string
    status?: string
    online?: boolean
    message?: string
    source?: string
    host?: string
    port?: number
    latencyMs?: number | null
    error?: string | null
  }
  mods?: {
    source?: string | null
    count?: number
    items?: Array<Record<string, unknown>>
  }
  issues?: {
    sources?: string | string[]
    count?: number
    items?: Array<Record<string, unknown>>
  }
  automation?: {
    enabled?: boolean
    intervalSeconds?: number
  }
}

export type GameSyncResponse = {
  telemetry: GameTelemetry
  sync: {
    ok: boolean
    statusWritten: boolean
    statusChanged: boolean
    modsWritten: boolean
    modsChanged: boolean
    checkedUtc: string
  }
}

export type GameControlStatusResponse = {
  ok: boolean
  configured: boolean
  bridgeUrl?: string | null
  payload?: Record<string, unknown>
}

export type PanelStatusResponse = {
  ok: boolean
  configured: boolean
  panelUrl?: string | null
  serverId?: string | null
  payload?: Record<string, unknown>
}

export type GameIssuesResponse = {
  ok: boolean
  autoFixEnabled: boolean
  autoFixUsePanel: boolean
  autoFixRepeatThreshold: number
  lastMismatchCount: number
  lastAutoFixUtc?: string | null
  sources?: string[]
  issues: Array<{
    source?: string
    message?: string
    type?: string
    fixable?: boolean
    severity?: string
    recommendation?: string
    count?: number
  }>
}

export type ModsDiffResponse = {
  serverCounts: { workshop: number; mods: number }
  siteCounts: { workshop: number; mods: number }
  missingInServer: { workshop: string[]; mods: string[] }
  missingInSite: { workshop: string[]; mods: string[] }
  addedOnServer?: { workshop: string[]; mods: string[] }
  deletedFromServer?: { workshop: string[]; mods: string[] }
  addedOnSite?: { workshop: string[]; mods: string[] }
  deletedFromSite?: { workshop: string[]; mods: string[] }
}

export type PlayerHistoryEntry = {
  timeUtc: string
  playersOnline: number
}

export type GamePlayersResponse = {
  ok: boolean
  command?: string | null
  response?: string | null
  hasCoordinates?: boolean
  coordinateSource?: string | null
  attemptedCommands?: Array<{
    command?: string
    ok?: boolean
    players?: number
    hasCoordinates?: boolean
  }>
  players: Array<{
    name?: string
    raw?: string
    x?: number | string
    y?: number | string
    z?: number | string
  }>
  payload?: Record<string, unknown>
}

export type GameMapStreetsResponse = {
  ok: boolean
  source?: string
  count?: number
  error?: string
  streets: Array<{
    name: string
    x: number
    y: number
    samples?: number
  }>
}

export async function getGameTelemetry() {
  return adminFetch<GameTelemetry>('/api/admin/game/telemetry')
}

export async function syncGame(force = false) {
  return adminFetch<GameSyncResponse>('/api/admin/game/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force })
  })
}

export async function getGameControlStatus() {
  return adminFetch<GameControlStatusResponse>('/api/admin/game/control/status')
}

export async function restartGameServer() {
  return adminFetch<{ ok: boolean; payload?: Record<string, unknown> }>('/api/admin/game/control/restart', {
    method: 'POST'
  })
}

export async function announceGameServer(message: string) {
  return adminFetch<{ ok: boolean; payload?: Record<string, unknown> }>('/api/admin/game/control/announce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  })
}

export async function runGameServerCommand(command: string, args?: unknown) {
  return adminFetch<{ ok: boolean; payload?: Record<string, unknown> }>('/api/admin/game/control/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args: args ?? null })
  })
}

export async function updateGameWorkshop() {
  return adminFetch<{ ok: boolean; payload?: Record<string, unknown> }>('/api/admin/game/control/workshop-update', {
    method: 'POST'
  })
}

export async function restartGameServerViaPanel() {
  return adminFetch<{ ok: boolean; payload?: Record<string, unknown> }>('/api/admin/game/control/panel-restart', {
    method: 'POST'
  })
}

export async function getPanelStatus() {
  return adminFetch<PanelStatusResponse>('/api/admin/game/control/panel-status')
}

export async function getGameIssues(limit = 100) {
  return adminFetch<GameIssuesResponse>(`/api/admin/game/issues?limit=${limit}`)
}

export async function getGamePlayers() {
  return adminFetch<GamePlayersResponse>('/api/admin/game/players')
}

export async function getGamePlayersWithSource(positionsSource: 'live' | 'test' = 'live') {
  const qp = new URLSearchParams()
  qp.set('positionsSource', positionsSource)
  return adminFetch<GamePlayersResponse>(`/api/admin/game/players?${qp.toString()}`)
}

export async function getGameMapStreets() {
  return adminFetch<GameMapStreetsResponse>('/api/admin/game/map/streets')
}

export async function syncItemCatalog() {
  return adminFetch<{ ok: boolean; removed: number; mods: number; items: number; repairedNames?: number }>('/api/admin/game/items/catalog/sync', {
    method: 'POST'
  })
}

export async function validateItemCode(code: string) {
  const qp = new URLSearchParams({ code })
  return adminFetch<{
    ok: boolean
    code: string
    inCatalog: boolean
    active: boolean
    kind?: string
    caliberKeys?: string[]
    sourceModId?: string
    sourceWorkshopId?: string
    reasons?: string[]
  }>(`/api/admin/game/items/validate?${qp.toString()}`)
}

export async function getItemCatalogStatus() {
  return adminFetch<{
    ok: boolean
    updatedUtc?: string
    items: number
    mods: number
    autoSyncEnabled: boolean
    autoSyncIntervalMinutes: number
  }>('/api/admin/game/items/catalog/status')
}

export async function getItemLossWatch(limit = 50) {
  return adminFetch<{
    ok: boolean
    updatedUtc?: string
    rows: Array<{
      id: string
      timeUtc: string
      source: string
      reason: string
      removedCodes: string[]
      removedCount: number
      acknowledged?: boolean
      acknowledgedBy?: string
      acknowledgedUtc?: string
    }>
  }>(`/api/admin/game/items/loss-watch?limit=${Math.min(200, Math.max(1, limit))}`)
}

export async function acknowledgeItemLoss(id: string) {
  return adminFetch<{ ok: boolean }>('/api/admin/game/items/loss-watch/ack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })
}

export async function fixGameIssues() {
  return adminFetch<{ ok: boolean; usePanel?: boolean }>('/api/admin/game/issues/fix', {
    method: 'POST'
  })
}

export async function clearGameIssues() {
  return adminFetch<{ ok: boolean }>('/api/admin/game/issues/clear', {
    method: 'POST'
  })
}

export async function getModsDiff() {
  return adminFetch<ModsDiffResponse>('/api/admin/game/mods-diff')
}

export async function getPlayersHistory(limit = 500) {
  return adminFetch<PlayerHistoryEntry[]>(`/api/admin/game/players-history?limit=${limit}`)
}

export function getPlayersHistoryCsvUrl(options?: { limit?: number; hours?: number }) {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.hours) params.set('hours', String(options.hours))
  const query = params.toString()
  return `/api/admin/game/players-history.csv${query ? `?${query}` : ''}`
}

export async function runOpsAutoFix() {
  try {
    return await adminFetch<{ ok: boolean; message?: string; actions?: string[]; remaining?: string[] }>('/api/admin/ops/auto-fix', {
      method: 'POST'
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Backward compatibility for API builds that only expose the legacy fix endpoint.
    if (!message.includes('404')) throw err
    const legacy = await fixGameIssues()
    return {
      ok: legacy.ok,
      message: legacy.ok ? 'Legacy auto-fix executed via /api/admin/game/issues/fix.' : 'Legacy auto-fix failed.'
    }
  }
}

export async function appendOpsLog(entries: Array<{ timeUtc: string; message: string; payload?: unknown }>) {
  return adminFetch<{ ok: boolean }>('/api/admin/ops/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries })
  })
}

export async function enableMaintenance(options?: {
  message?: string
  announce?: boolean
  announceMessage?: string
  usePanelRestart?: boolean
}) {
  return adminFetch<{ ok: boolean }>('/api/admin/game/maintenance/enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options ?? {})
  })
}

export async function disableMaintenance(message?: string) {
  return adminFetch<{ ok: boolean }>('/api/admin/game/maintenance/disable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message ? { message } : {})
  })
}

export async function getMaintenanceStatus() {
  return adminFetch<{ status: Record<string, unknown> }>('/api/admin/game/maintenance/status')
}

export async function listPanelBackups() {
  return adminFetch<{ ok: boolean; payload?: Record<string, unknown> }>('/api/admin/game/panel/backups')
}

export async function createPanelBackup(name?: string) {
  return adminFetch<{ ok: boolean; payload?: Record<string, unknown> }>('/api/admin/game/panel/backups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(name ? { name } : {})
  })
}

export async function getPanelBackupDownload(backupId: string) {
  return adminFetch<{ ok: boolean; payload?: Record<string, unknown> }>(
    `/api/admin/game/panel/backups/${encodeURIComponent(backupId)}/download`
  )
}

export async function getOpsSnapshot() {
  return adminFetch<{
    lastRestartUtc?: string
    lastMismatchUtc?: string
    lastAutoRestartUtc?: string
    lastPanelHealthUtc?: string
    lastPanelHealthError?: string
    uptimeSplit24h?: { online: number; maintenance: number; offline: number }
    muteAlertsUntilUtc?: string
  }>('/api/admin/ops/snapshot')
}

export async function getOpsAlertEmails() {
  return adminFetch<{
    ok: boolean
    enabled: boolean
    recipients: string[]
    smtpConfigured: boolean
  }>('/api/admin/ops/alerts/emails')
}

export async function saveOpsAlertEmails(payload: { enabled: boolean; recipients: string[] }) {
  return adminFetch<{
    ok: boolean
    enabled: boolean
    recipients: string[]
    smtpConfigured: boolean
  }>('/api/admin/ops/alerts/emails', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function testOpsAlerts() {
  return adminFetch<{ ok: boolean }>('/api/admin/ops/alerts/test', {
    method: 'POST'
  })
}

export function getOpsSnapshotCsvUrl() {
  return '/api/admin/ops/snapshot.csv'
}

export async function muteOpsAlerts(hours: number) {
  return adminFetch<{ ok: boolean; muteUntilUtc?: string }>('/api/admin/ops/alerts/mute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hours })
  })
}

export async function unmuteOpsAlerts() {
  return adminFetch<{ ok: boolean }>('/api/admin/ops/alerts/unmute', {
    method: 'POST'
  })
}

export async function muteOpsAlertsUntil(untilUtc: string) {
  return adminFetch<{ ok: boolean; muteUntilUtc?: string }>('/api/admin/ops/alerts/mute-until', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ untilUtc })
  })
}

export async function runMaintenanceMacro(options?: {
  message?: string
  announceMessage?: string
  usePanelRestart?: boolean
}) {
  return adminFetch<{ ok: boolean }>('/api/admin/game/maintenance/macro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options ?? {})
  })
}

export async function runSyncRestartMacro(options?: {
  usePanelRestart?: boolean
  forceSync?: boolean
}) {
  return adminFetch<{ ok: boolean; restartOk: boolean; sync: Record<string, unknown>; modsDiff: Record<string, unknown> }>(
    '/api/admin/game/control/macro-sync-restart',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options ?? {})
    }
  )
}

export type IntegrationSnapshot = {
  live: PublicLiveSnapshot | null
  readiness: IntegrationReadiness
}

export type PublicEndpointDiagnostic = {
  key: 'game' | 'discord' | 'integration'
  url: string
  ok: boolean
  status: number
  latencyMs: number
  message?: string
}

export type PublicLiveDiagnostics = {
  checkedUtc: string
  overallOk: boolean
  endpoints: PublicEndpointDiagnostic[]
}

function withLiveBase(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  const base = LIVE_BASE.replace(/\/$/, '')
  if (!base) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function diagnosePublicEndpoint(
  key: 'game' | 'discord' | 'integration',
  path: string
): Promise<PublicEndpointDiagnostic> {
  const url = withLiveBase(path)
  const started = Date.now()
  try {
    const res = await fetch(url, { cache: 'no-store' })
    return {
      key,
      url,
      ok: res.ok,
      status: res.status,
      latencyMs: Math.max(1, Date.now() - started),
      message: res.ok ? 'OK' : `${res.status} ${res.statusText}`.trim()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      key,
      url,
      ok: false,
      status: 0,
      latencyMs: Math.max(1, Date.now() - started),
      message
    }
  }
}

export async function getPublicLiveDiagnostics(): Promise<PublicLiveDiagnostics> {
  const endpoints = await Promise.all([
    diagnosePublicEndpoint('game', PUBLIC_GAME_PATH),
    diagnosePublicEndpoint('discord', PUBLIC_DISCORD_PATH),
    diagnosePublicEndpoint('integration', PUBLIC_INTEGRATION_PATH)
  ])
  return {
    checkedUtc: new Date().toISOString(),
    overallOk: endpoints.every((item) => item.ok),
    endpoints
  }
}

function toFlag(input: unknown): boolean {
  if (typeof input === 'boolean') return input
  if (typeof input === 'number') return input > 0
  if (typeof input === 'string') {
    const value = input.trim().toLowerCase()
    return value === 'true' || value === '1' || value === 'yes' || value === 'online' || value === 'ready'
  }
  return false
}

function toNumber(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) return input
  if (typeof input === 'string') {
    const parsed = Number(input)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function toStatus(input: unknown): 'online' | 'offline' | 'maintenance' {
  const value = String(input ?? '').toLowerCase()
  if (value === 'online') return 'online'
  if (value === 'maintenance') return 'maintenance'
  return 'offline'
}

export async function getIntegrationSnapshot() {
  const now = new Date().toISOString()
  try {
    const [game, discordStatus, discordMetrics, published] = await Promise.all([
      getGameTelemetry(),
      getDiscordStatus(),
      getDiscordMetrics(),
      getContent<IntegrationSnapshot>('integration-snapshot').catch(() => null)
    ])

    const server = game.server ?? {}
    const counters = discordMetrics.counters ?? {}
    const commandErrors = toNumber(counters.gh_bot_command_errors_total) ?? 0
    const commandTotal = toNumber(counters.gh_bot_commands_total) ?? 0

    const notes: string[] = [
      `Game telemetry source: ${server.source ?? 'unknown'}`,
      `Discord metrics source: ${discordMetrics.source ?? 'unknown'}`,
      `Discord command health: ${commandErrors}/${commandTotal} errors`
    ]

    if (published?.readiness?.notes?.length) {
      notes.push(...published.readiness.notes.slice(0, 6))
    }

    const live: PublicLiveSnapshot = {
      gameServer: {
        status: toStatus(server.status),
        playersOnline: toNumber((server as Record<string, unknown>).playersOnline) ?? 0,
        maxPlayers: toNumber((server as Record<string, unknown>).maxPlayers) ?? 0,
        queue: toNumber((server as Record<string, unknown>).queue) ?? 0,
        map: String((server as Record<string, unknown>).map ?? ''),
        updatedUtc: String(server.checkedUtc ?? game.checkedUtc ?? now)
      },
      discord: {
        online: toFlag(discordStatus.enabled),
        members: toNumber(counters.gh_bot_discord_members_gauge) ?? undefined,
        activeTickets: toNumber(counters.gh_bot_ticket_open_total) ?? 0,
        openModcalls: toNumber(counters.gh_bot_modcall_open_total) ?? 0,
        updatedUtc: String(discordMetrics.collectedUtc ?? now)
      }
    }

    const readiness: IntegrationReadiness = {
      gameServerApiReady: !!game.ok && !server.error,
      discordApiReady: !!discordMetrics.ok && toFlag(discordStatus.enabled),
      webhooksReady: !!discordMetrics.ok,
      notes
    }

    return { live, readiness }
  } catch {
    // Fallback to content mode for environments where API contracts are not live yet.
    try {
      const data = await getContent<IntegrationSnapshot>('integration-snapshot')
      return data
    } catch {
      return {
        live: null,
        readiness: {
          gameServerApiReady: false,
          discordApiReady: false,
          webhooksReady: false,
          notes: ['Integration snapshot API not available yet.']
        }
      } satisfies IntegrationSnapshot
    }
  }
}

export type DiscordAutomationConfig = {
  enabled: boolean
  timezone: string
  defaultChannelLabel: string
  defaultChannelId?: string
  quietHoursStartUtc: number
  quietHoursEndUtc: number
  rotatingTemplates: Array<{ id: string; title: string; message: string; enabled: boolean }>
  schedules: Array<{
    id: string
    name: string
    timeUtc: string
    days: string[]
    mentionEveryone: boolean
    templateId: string
    message: string
    channelId?: string
    enabled: boolean
  }>
  campaigns: Array<{
    id: string
    name: string
    cadence: string
    audience: string
    callToAction: string
    message: string
    channelId?: string
    enabled: boolean
  }>
  manualDispatches?: Array<{
    id: string
    sourceType: 'schedule' | 'campaign'
    sourceId: string
    name: string
    message: string
    mentionEveryone: boolean
    channelId?: string
    createdUtc: string
    createdBy: string
  }>
}

export async function loadDiscordAutomation() {
  return getContent<DiscordAutomationConfig>('discord-automation')
}

export async function saveDiscordAutomation(data: DiscordAutomationConfig) {
  return saveContent('discord-automation', data)
}

export type ContentLoaders = {
  transmissions: Transmission[]
  updates: UpdateItem[]
  serverStatus: ServerStatus
  statusHistory: StatusHistoryItem[]
  mods: ModItem[]
}

export function loadTransmissions() {
  return getContent<Transmission[]>('transmissions')
}

export function loadUpdates() {
  return getContent<UpdateItem[]>('updates')
}

export function loadServerStatus() {
  return getContent<ServerStatus>('server-status')
}

export function loadStatusHistory() {
  return getContent<StatusHistoryItem[]>('status-history')
}

export function loadMods() {
  return getContent<ModItem[]>('mods-manual')
}

export const DEFAULT_HOME_MEDIA: HomeMedia = {
  enabled: false,
  title: 'Gameplay Trailer',
  description: 'Watch what the Grey Hour feels like before you drop in.',
  videoUrl: '',
  ctaLabel: 'Join the Discord',
  ctaUrl: 'https://discord.gg/wCUJckSk3s'
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  discordInviteUrl: 'https://discord.gg/wCUJckSk3s'
}

export const DEFAULT_SITE_FLAGS: SiteFlags = {
  showMods: true,
  showUpdates: true,
  showEvents: true,
  showFactions: true,
  showDirectory: true,
  showDossiers: false,
  showEconomy: false,
  showLevels: true,
  showTransmissions: true,
  showDiscordPage: true,
  showHowToJoin: true,
  showStaff: true
}

export async function loadHomeMedia() {
  return getContent<HomeMedia>('homepage-media')
}

export async function saveHomeMedia(data: HomeMedia) {
  return saveContent('homepage-media', data)
}

export async function loadSiteSettings() {
  return getContent<SiteSettings>('site-settings')
}

export async function saveSiteSettings(data: SiteSettings) {
  return saveContent('site-settings', data)
}

export async function loadSiteFlags() {
  return getContent<SiteFlags>('site-flags')
}

export async function saveSiteFlags(data: SiteFlags) {
  return saveContent('site-flags', data)
}

export async function loadFactionTerritory() {
  return getContent<FactionTerritoryState>('factions-territory')
}

export async function saveFactionTerritory(data: FactionTerritoryState) {
  return saveContent('factions-territory', data)
}

export async function loadDossiers() {
  return getContent<DossierCollection>('player-dossiers')
}

export async function saveDossiers(data: DossierCollection) {
  return saveContent('player-dossiers', data)
}

export async function loadStoryArcs() {
  return getContent<StoryArcCollection>('story-arcs')
}

export async function saveStoryArcs(data: StoryArcCollection) {
  return saveContent('story-arcs', data)
}

export async function loadEventCalendar() {
  return getContent<EventCalendar>('event-calendar')
}

export async function saveEventCalendar(data: EventCalendar) {
  return saveContent('event-calendar', data)
}

export async function loadEconomySnapshot() {
  return getContent<EconomySnapshot>('economy-snapshot')
}

export async function saveEconomySnapshot(data: EconomySnapshot) {
  return saveContent('economy-snapshot', data)
}

export async function loadHelplineScripts() {
  return getContent<HelplineScripts>('helpline-scripts')
}

export async function saveHelplineScripts(data: HelplineScripts) {
  return saveContent('helpline-scripts', data)
}

export async function loadDiscordOpsSettings() {
  return getContent<DiscordOpsSettings>('discord-ops')
}

export async function saveDiscordOpsSettings(data: DiscordOpsSettings) {
  return saveContent('discord-ops', data)
}

export async function loadFactionChannelMap() {
  return getContent<FactionChannelMap>('faction-channels')
}

export async function saveFactionChannelMap(data: FactionChannelMap) {
  return saveContent('faction-channels', data)
}

export async function uploadHomeMediaVideo(file: File) {
  return uploadHomeMediaVideoWithProgress(file)
}

export async function uploadHomeMediaVideoWithProgress(
  file: File,
  onProgress?: (percent: number) => void
) {
  const form = new FormData()
  form.append('file', file)

  const headers = adminHeaders()
  const headerEntries = Object.entries(headers as Record<string, string>)

  return new Promise<{ ok: boolean; url: string; fileName: string; size: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/api/admin/upload/home-video`)
    xhr.withCredentials = true
    headerEntries.forEach(([k, v]) => xhr.setRequestHeader(k, v))

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      const percent = Math.round((event.loaded / event.total) * 100)
      onProgress?.(Math.max(0, Math.min(100, percent)))
    }

    xhr.onerror = () => {
      emitSfx('warning')
      reject(new Error('Network error during upload.'))
    }

    xhr.onload = () => {
      const text = xhr.responseText || ''
      if (xhr.status < 200 || xhr.status >= 300) {
        emitSfx('warning')
        if (xhr.status === 401) {
          reject(new Error(`401 Unauthorized. Re-enter your admin username/password in /admin/login. ${text}`.trim()))
          return
        }
        if (xhr.status === 403) {
          reject(new Error(`403 Forbidden. Your role is not allowed to upload video. ${text}`.trim()))
          return
        }
        reject(new Error(`${xhr.status} ${text}`.trim()))
        return
      }

      try {
        emitSfx('success')
        const parsed = JSON.parse(text) as { ok: boolean; url: string; fileName: string; size: number }
        onProgress?.(100)
        resolve(parsed)
      } catch {
        reject(new Error('Upload succeeded but response was invalid JSON.'))
      }
    }

    xhr.send(form)
  })
}
