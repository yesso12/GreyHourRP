import type { PublicLiveSnapshot } from '../types/content'
import { logTelemetry } from '../observability'

const LIVE_BASE = (import.meta.env.VITE_LIVE_API_BASE ?? '').trim()
const LIVE_ENDPOINT = (import.meta.env.VITE_LIVE_SNAPSHOT_PATH ?? '/api/public/live-snapshot').trim()
const GAME_ENDPOINT = (import.meta.env.VITE_PUBLIC_GAME_PATH ?? '/api/public/game/telemetry').trim()
const DISCORD_ENDPOINT = (import.meta.env.VITE_PUBLIC_DISCORD_PATH ?? '/api/public/discord/status').trim()
const READINESS_ENDPOINT = (import.meta.env.VITE_PUBLIC_INTEGRATION_PATH ?? '/api/public/integration/readiness').trim()
const LIVE_ERROR_THROTTLE_MS = 5 * 60 * 1000
let lastLiveErrorAt = 0

function withBase(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  if (!LIVE_BASE) return path
  return `${LIVE_BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`)
  return res.json() as Promise<T>
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
}

function num(input: unknown, fallback = 0): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input
  if (typeof input === 'string') {
    const parsed = Number(input)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function bool(input: unknown, fallback = false): boolean {
  if (typeof input === 'boolean') return input
  if (typeof input === 'number') return input > 0
  if (typeof input === 'string') {
    const value = input.trim().toLowerCase()
    if (['true', '1', 'yes', 'online', 'ready'].includes(value)) return true
    if (['false', '0', 'no', 'offline', 'down'].includes(value)) return false
  }
  return fallback
}

function status(input: unknown): 'online' | 'offline' | 'maintenance' {
  const value = String(input ?? '').toLowerCase()
  if (value === 'online') return 'online'
  if (value === 'maintenance') return 'maintenance'
  return 'offline'
}

function iso(input: unknown, fallback: string): string {
  if (typeof input === 'string' && input.trim()) return input
  return fallback
}

function players(input: unknown): Array<{ name?: string; raw: string }> {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      const row = asRecord(entry)
      const raw = String(row.raw ?? '').trim()
      if (!raw) return null
      const name = String(row.name ?? '').trim()
      return name ? { name, raw } : { raw }
    })
    .filter((entry): entry is { name?: string; raw: string } => entry !== null)
}

function defaultSnapshot(): PublicLiveSnapshot {
  const now = new Date().toISOString()
  return {
    gameServer: {
      status: 'offline',
      playersOnline: 0,
      maxPlayers: 0,
      queue: 0,
      map: 'Unknown',
      updatedUtc: now
    },
    discord: {
      online: false,
      updatedUtc: now
    },
    readiness: {
      gameServerApiReady: false,
      discordApiReady: false,
      webhooksReady: false,
      notes: ['Live API endpoint not configured yet.']
    }
  }
}

function logLiveError(message: string) {
  const now = Date.now()
  if (now - lastLiveErrorAt < LIVE_ERROR_THROTTLE_MS) return
  lastLiveErrorAt = now
  logTelemetry({
    level: 'warn',
    event: 'live.endpoints.failed',
    message
  })
}

export async function loadPublicLiveSnapshot() {
  const now = new Date().toISOString()
  const base = defaultSnapshot()

  // Preferred mode: aggregate dedicated API contract endpoints.
  try {
    const [gameRaw, discordRaw, readinessRaw] = await Promise.all([
      fetchJson<unknown>(withBase(GAME_ENDPOINT)),
      fetchJson<unknown>(withBase(DISCORD_ENDPOINT)),
      fetchJson<unknown>(withBase(READINESS_ENDPOINT))
    ])

    const gameTop = asRecord(gameRaw)
    const gameServer = asRecord(gameTop.server)

    const discordTop = asRecord(discordRaw)
    const counters = asRecord(discordTop.counters)

    const readinessTop = asRecord(readinessRaw)
    const notesRaw = readinessTop.notes
    const notes = Array.isArray(notesRaw)
      ? notesRaw.map((item) => String(item)).filter(Boolean)
      : []

    const readinessGame = Object.prototype.hasOwnProperty.call(readinessTop, 'gameServerApiReady')
      ? bool(readinessTop.gameServerApiReady, false)
      : true
    const readinessDiscord = Object.prototype.hasOwnProperty.call(readinessTop, 'discordApiReady')
      ? bool(readinessTop.discordApiReady, false)
      : true
    const readinessWebhooks = Object.prototype.hasOwnProperty.call(readinessTop, 'webhooksReady')
      ? bool(readinessTop.webhooksReady, false)
      : true

    return {
      gameServer: {
        status: status(gameServer.status ?? gameTop.status),
        state: String(gameServer.state ?? ''),
        playersOnline: num(gameServer.playersOnline ?? gameTop.playersOnline, 0),
        players: players(gameServer.players ?? gameTop.players),
        maxPlayers: num(gameServer.maxPlayers ?? gameTop.maxPlayers, 0),
        queue: num(gameServer.queue ?? gameTop.queue, 0),
        map: String(gameServer.map ?? gameTop.map ?? base.gameServer.map),
        wipeEta: String(gameServer.wipeEta ?? gameTop.wipeEta ?? ''),
        cpuPercent: num(gameServer.cpuPercent ?? gameTop.cpuPercent, 0),
        memoryBytes: num(gameServer.memoryBytes ?? gameTop.memoryBytes, 0),
        diskBytes: num(gameServer.diskBytes ?? gameTop.diskBytes, 0),
        networkRxBytes: num(gameServer.networkRxBytes ?? gameTop.networkRxBytes, 0),
        networkTxBytes: num(gameServer.networkTxBytes ?? gameTop.networkTxBytes, 0),
        uptimeMs: num(gameServer.uptimeMs ?? gameTop.uptimeMs, 0),
        updatedUtc: iso(gameServer.checkedUtc ?? gameTop.checkedUtc ?? gameTop.updatedUtc, now)
      },
      discord: {
        online: bool(discordTop.online ?? discordTop.enabled, false),
        members: num(discordTop.members ?? counters.gh_bot_discord_members_gauge, 0),
        activeTickets: num(discordTop.activeTickets ?? counters.gh_bot_ticket_open_total, 0),
        openModcalls: num(discordTop.openModcalls ?? counters.gh_bot_modcall_open_total, 0),
        botUptimeSec: num(discordTop.botUptimeSec ?? counters.gh_bot_uptime_seconds_gauge, 0),
        updatedUtc: iso(discordTop.collectedUtc ?? discordTop.updatedUtc, now)
      },
      readiness: {
        gameServerApiReady: readinessGame,
        discordApiReady: readinessDiscord,
        webhooksReady: readinessWebhooks,
        notes
      }
    } satisfies PublicLiveSnapshot
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logLiveError(`primary endpoints failed: ${message}`)
    // fall through to snapshot endpoint mode
  }

  // Legacy mode: single live snapshot endpoint.
  try {
    const data = await fetchJson<PublicLiveSnapshot>(withBase(LIVE_ENDPOINT))
    return data
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logLiveError(`snapshot endpoint failed: ${message}`)
    try {
      return await fetchJson<PublicLiveSnapshot>('/content/live-snapshot.json')
    } catch {
      return defaultSnapshot()
    }
  }
}
