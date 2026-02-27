import type {
  AdminUserMap,
  Transmission,
  UpdateItem,
  ServerStatus,
  StatusHistoryItem,
  ModItem
} from '../../types/content'

const BASE = import.meta.env.VITE_ADMIN_API_BASE ?? 'https://api.frenzynets.com/api/ghrp'
const TOKEN_STORAGE = 'ghrp_admin_token'

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_STORAGE)
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(TOKEN_STORAGE, token)
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_STORAGE)
}

function adminHeaders(): HeadersInit {
  const token = getAdminToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...adminHeaders()
    }
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${text}`.trim())
  }

  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

export async function ping() {
  return adminFetch<{ ok: boolean; timeUtc: string }>('/api/admin/ping')
}

export async function loginWithPassword(username: string, password: string) {
  return adminFetch<{
    token: string
    expiresAt?: string
    user?: { username?: string; role?: string }
  }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
}

export async function session() {
  return adminFetch<{
    user: { username?: string; role?: string }
    expiresAt?: string
  }>('/api/auth/session')
}

export async function logoutRequest() {
  return adminFetch<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
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

export async function listUsers() {
  return adminFetch<AdminUserMap>('/api/admin/users')
}

export async function saveUser(user: string, role: string) {
  return adminFetch<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(user)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  })
}

export async function deleteUser(user: string) {
  return adminFetch<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(user)}`, {
    method: 'DELETE'
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
  return getContent<ModItem[]>('mods')
}
