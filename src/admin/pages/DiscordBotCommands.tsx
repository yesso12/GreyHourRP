import { useEffect, useMemo, useState } from 'react'
import { getDiscordMetrics, loadDiscordOpsSettings, saveDiscordOpsSettings } from '../api/client'
import { useAdminAuth } from '../auth/AdminAuthContext'
import { AdminSaveBar } from '../../components/AdminSaveBar'
import { fetchJson } from '../../components/utils'
import type { DiscordCommandDoc, DiscordCommandDocEntry, DiscordOpsSettings } from '../../types/content'

const buckets: Array<{ key: 'public' | 'staff' | 'admin' | 'restricted'; label: string }> = [
  { key: 'public', label: 'Public' },
  { key: 'staff', label: 'Staff' },
  { key: 'admin', label: 'Admin' },
  { key: 'restricted', label: 'Restricted' }
]

function defaultOpsSettings(): DiscordOpsSettings {
  return {
    updatedUtc: new Date().toISOString(),
    quietHoursEnabled: true,
    quietHoursStartUtc: '',
    quietHoursEndUtc: '',
    mentionAllowedChannelIds: [],
    disabledCommandKeys: [],
    musicAutoPlaylistSize: 8,
    staffDigestChannelId: '',
    staffDigestTimeUtc: '17:30'
  }
}

export function AdminDiscordBotCommands() {
  const { identity } = useAdminAuth()
  const canEdit = identity.role === 'owner' || identity.role === 'editor'
  const [doc, setDoc] = useState<DiscordCommandDoc | null>(null)
  const [ops, setOps] = useState<DiscordOpsSettings>(defaultOpsSettings())
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getDiscordMetrics>> | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const [nextDoc, nextOps] = await Promise.all([
        fetchJson<DiscordCommandDoc>('/content/discord-commands.json'),
        loadDiscordOpsSettings().catch(() => defaultOpsSettings())
      ])
      const nextMetrics = await getDiscordMetrics().catch(() => null)
      setDoc(nextDoc)
      setOps({ ...defaultOpsSettings(), ...nextOps })
      setMetrics(nextMetrics)
      setError(null)
      setDirty(false)
    } catch (err) {
      setDoc(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const commands = useMemo(() => {
    const list = doc?.commands ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((cmd) => {
      const hay = `${cmd.name} ${cmd.description} ${(cmd.subcommands ?? []).map((sub) => `${sub.name} ${sub.description} ${sub.usage}`).join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [doc, query])

  const grouped = useMemo(() => {
    const out: Record<string, DiscordCommandDocEntry[]> = { public: [], staff: [], admin: [], restricted: [] }
    for (const cmd of commands) {
      const key = cmd.permission || 'public'
      if (!out[key]) out[key] = []
      out[key].push(cmd)
    }
    for (const key of Object.keys(out)) out[key].sort((a, b) => a.name.localeCompare(b.name))
    return out
  }, [commands])

  const disabledSet = useMemo(() => new Set((ops.disabledCommandKeys ?? []).map((x) => String(x).toLowerCase())), [ops.disabledCommandKeys])
  const enabledCount = useMemo(() => commands.filter((cmd) => !disabledSet.has(cmd.name.toLowerCase())).length, [commands, disabledSet])
  const total = doc?.commands?.length ?? 0
  const playlistSize = Math.max(1, Math.min(20, Number(ops.musicAutoPlaylistSize ?? 8)))

  function setCommandEnabled(commandName: string, enabled: boolean) {
    const key = commandName.toLowerCase()
    const next = new Set((ops.disabledCommandKeys ?? []).map((x) => String(x).toLowerCase()))
    if (enabled) next.delete(key)
    else next.add(key)
    setOps((prev) => ({ ...prev, disabledCommandKeys: Array.from(next).sort() }))
    setDirty(true)
  }

  function applyCommandPreset(preset: 'all' | 'public_only' | 'staff_core') {
    const rows = doc?.commands ?? []
    if (!rows.length) return
    const next = new Set<string>()
    if (preset === 'public_only') {
      for (const cmd of rows) {
        if (cmd.permission !== 'public') next.add(cmd.name.toLowerCase())
      }
    } else if (preset === 'staff_core') {
      for (const cmd of rows) {
        const keep = cmd.permission === 'public' || cmd.permission === 'staff'
        if (!keep) next.add(cmd.name.toLowerCase())
      }
    }
    setOps((prev) => ({ ...prev, disabledCommandKeys: Array.from(next).sort() }))
    setDirty(true)
  }

  async function save() {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    try {
      await saveDiscordOpsSettings({
        ...ops,
        updatedUtc: new Date().toISOString(),
        disabledCommandKeys: Array.from(new Set((ops.disabledCommandKeys ?? []).map((x) => String(x).toLowerCase()))).sort(),
        musicAutoPlaylistSize: playlistSize
      })
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Discord Bot Commands</div>
          <h1>Discord Bot Commands</h1>
          <p className="admin-sub">Professional command manager with grouped dropdowns and enable/disable controls.</p>
        </div>
        <div className="admin-row" style={{ marginTop: 0 }}>
          <button className="admin-btn" onClick={() => void refresh()} disabled={loading || saving}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-row" style={{ marginTop: 0 }}>
          <input
            className="admin-input"
            placeholder="Search commands or descriptions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 260 }}
          />
          <div className="admin-chip">{commands.length} shown</div>
          <div className="admin-chip">{total} total</div>
          <div className="admin-chip">Enabled: {enabledCount}</div>
          <div className="admin-chip">Disabled: {Math.max(0, total - enabledCount)}</div>
        </div>
        <div className="admin-row" style={{ marginTop: 10 }}>
          {buckets.map((bucket) => (
            <div key={bucket.key} className="admin-chip">{bucket.label}: {grouped[bucket.key]?.length ?? 0}</div>
          ))}
        </div>
        <div className="admin-row" style={{ marginTop: 10 }}>
          <button className="admin-btn" onClick={() => applyCommandPreset('all')} disabled={!canEdit || saving}>Preset: All Enabled</button>
          <button className="admin-btn" onClick={() => applyCommandPreset('public_only')} disabled={!canEdit || saving}>Preset: Public Only</button>
          <button className="admin-btn" onClick={() => applyCommandPreset('staff_core')} disabled={!canEdit || saving}>Preset: Public + Staff</button>
        </div>
        <div className="admin-hint" style={{ marginTop: 10 }}>
          Last command sync: {doc?.generatedUtc ? new Date(doc.generatedUtc).toLocaleString() : 'unknown'}
        </div>
        <div className="admin-hint" style={{ marginTop: 6 }}>
          Command toggles update live bot behavior. Disabled commands return an admin-disabled message when used.
        </div>
        <div className="admin-grid three" style={{ marginTop: 12 }}>
          <label className="admin-field">
            <span>Auto Playlist Size</span>
            <input
              className="admin-input"
              type="number"
              min={1}
              max={20}
              step={1}
              value={playlistSize}
              onChange={(e) => {
                const raw = Number(e.target.value)
                const next = Number.isFinite(raw) ? Math.max(1, Math.min(20, Math.round(raw))) : 8
                setOps((prev) => ({ ...prev, musicAutoPlaylistSize: next }))
                setDirty(true)
              }}
              disabled={!canEdit || saving}
            />
          </label>
        </div>
        <div className="admin-hint" style={{ marginTop: 8 }}>
          Used by <code>/music play</code> when <code>autoplaylist</code> is enabled or playlist intent is detected.
        </div>
        {!canEdit && (
          <div className="admin-hint" style={{ marginTop: 8 }}>
            Your role is read-only for command toggles. Use an owner/editor account to change command state.
          </div>
        )}
        {error && <div className="admin-error" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {loading ? (
        <div className="admin-card">Loading command catalog…</div>
      ) : (
        <div className="admin-section" style={{ marginBottom: 16 }}>
          <div className="admin-card" style={{ marginBottom: 12 }}>
            <div className="admin-section-header">
              <h2>Live Bot Health</h2>
            </div>
            {!metrics?.ok ? (
              <div className="admin-hint">Discord metrics unavailable right now.</div>
            ) : (
              <>
                <div className="admin-row" style={{ marginTop: 0 }}>
                  <div className="admin-chip">Collected: {metrics.collectedUtc ? new Date(metrics.collectedUtc).toLocaleString() : 'unknown'}</div>
                  <div className="admin-chip">Commands: {Math.round(metrics.counters?.gh_bot_commands_total ?? 0)}</div>
                  <div className="admin-chip">Errors: {Math.round(metrics.counters?.gh_bot_command_errors_total ?? 0)}</div>
                  <div className="admin-chip">Music Active: {Math.round(metrics.counters?.gh_bot_music_sessions_active_gauge ?? 0)}</div>
                  <div className="admin-chip">Music Queue: {Math.round(metrics.counters?.gh_bot_music_queue_tracks_gauge ?? 0)}</div>
                </div>
              </>
            )}
          </div>
          {buckets.map((bucket) => {
            const rows = grouped[bucket.key] ?? []
            const enabledInBucket = rows.filter((cmd) => !disabledSet.has(cmd.name.toLowerCase())).length
            return (
              <details key={bucket.key} className="admin-card" open>
                <summary className="admin-section-header" style={{ cursor: 'pointer', listStyle: 'none' }}>
                  <h2>{bucket.label} Commands</h2>
                  <div className="admin-row" style={{ marginTop: 0 }}>
                    <div className="admin-chip">{enabledInBucket} enabled</div>
                    <div className="admin-chip">{rows.length - enabledInBucket} disabled</div>
                  </div>
                </summary>
                {rows.length === 0 ? (
                  <div className="admin-text admin-empty">No commands in this group.</div>
                ) : (
                  rows.map((cmd) => {
                    const isEnabled = !disabledSet.has(cmd.name.toLowerCase())
                    return (
                      <details key={`${bucket.key}-${cmd.name}`} className="admin-list-item">
                        <summary style={{ cursor: 'pointer', listStyle: 'none', width: '100%' }}>
                          <div className="admin-row" style={{ marginTop: 0, justifyContent: 'space-between', width: '100%' }}>
                            <div>
                              <div className="admin-list-title">{cmd.usage || `/${cmd.name}`}</div>
                              <div className="admin-list-sub">{cmd.description || 'No description'}</div>
                            </div>
                            <div className="admin-row" style={{ marginTop: 0 }}>
                              <div className={`admin-chip ${isEnabled ? 'active' : ''}`}>{isEnabled ? 'Enabled' : 'Disabled'}</div>
                              <button
                                className={`admin-btn ${isEnabled ? 'danger' : 'primary'}`}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setCommandEnabled(cmd.name, !isEnabled)
                                }}
                                disabled={!canEdit || saving}
                                title={isEnabled ? 'Disable this command' : 'Enable this command'}
                              >
                                {isEnabled ? 'Disable' : 'Enable'}
                              </button>
                            </div>
                          </div>
                        </summary>
                        <div style={{ marginTop: 10 }}>
                          <div className="admin-list-sub">
                            Command key: <code>{cmd.name}</code>
                          </div>
                          {cmd.subcommands && cmd.subcommands.length > 0 && (
                            <div className="admin-list-sub" style={{ marginTop: 8 }}>
                              {cmd.subcommands.map((sub) => `${sub.usage} — ${sub.description || 'No description'}`).join(' • ')}
                            </div>
                          )}
                        </div>
                      </details>
                    )
                  })
                )}
              </details>
            )
          })}
        </div>
      )}

      <AdminSaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        onSave={() => {
          void save()
        }}
      />
    </div>
  )
}
