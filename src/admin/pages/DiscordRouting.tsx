import { useEffect, useMemo, useState } from 'react'
import type { DiscordOpsSettings, FactionChannelMap, FactionTerritoryState } from '../../types/content'
import {
  loadDiscordOpsSettings,
  loadFactionChannelMap,
  saveDiscordOpsSettings,
  saveFactionChannelMap,
  loadFactionTerritory
} from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

function defaultOps(): DiscordOpsSettings {
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

function defaultMap(): FactionChannelMap {
  return {
    updatedUtc: new Date().toISOString(),
    mappings: {}
  }
}

export function AdminDiscordRouting() {
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ops, setOps] = useState<DiscordOpsSettings>(defaultOps())
  const [map, setMap] = useState<FactionChannelMap>(defaultMap())
  const [factions, setFactions] = useState<FactionTerritoryState | null>(null)
  const [query, setQuery] = useState('')
  const [mentionFilter, setMentionFilter] = useState('')
  const [newMentionId, setNewMentionId] = useState('')
  const [onlyMapped, setOnlyMapped] = useState(false)

  useEffect(() => {
    Promise.all([loadDiscordOpsSettings(), loadFactionChannelMap(), loadFactionTerritory().catch(() => null)])
      .then(([opsData, mapData, factionData]) => {
        setOps({ ...defaultOps(), ...opsData })
        setMap({ ...defaultMap(), ...mapData })
        setFactions(factionData)
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  function updateOps(patch: Partial<DiscordOpsSettings>) {
    setOps(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  function updateMap(factionId: string, channelId: string) {
    setMap(prev => ({
      ...prev,
      mappings: { ...prev.mappings, [factionId]: channelId }
    }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await Promise.all([
        saveDiscordOpsSettings({ ...ops, updatedUtc: new Date().toISOString() }),
        saveFactionChannelMap({ ...map, updatedUtc: new Date().toISOString() })
      ])
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const factionRows = useMemo(() => {
    let rows = factions?.factions ?? []
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(f => `${f.name} ${f.id}`.toLowerCase().includes(q))
    }
    if (onlyMapped) {
      rows = rows.filter(f => Boolean(map.mappings?.[f.id]))
    }
    return rows
  }, [factions, query, map.mappings, onlyMapped])

  const mentionIds = useMemo(() => {
    const rows = ops.mentionAllowedChannelIds ?? []
    const q = mentionFilter.trim()
    if (!q) return rows
    return rows.filter(id => id.includes(q))
  }, [ops.mentionAllowedChannelIds, mentionFilter])

  function addMentionId() {
    const id = newMentionId.trim()
    if (!id) return
    if ((ops.mentionAllowedChannelIds ?? []).includes(id)) return
    updateOps({ mentionAllowedChannelIds: [...(ops.mentionAllowedChannelIds ?? []), id] })
    setNewMentionId('')
  }

  function removeMentionId(id: string) {
    updateOps({ mentionAllowedChannelIds: (ops.mentionAllowedChannelIds ?? []).filter(x => x !== id) })
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Discord Routing</div>
          <h1>Discord Ops Settings</h1>
          <p className="admin-sub">Quiet hours, mention safety, staff digest, and faction channel routing.</p>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ color: 'var(--bad)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-card">Loading Discord settings…</div>
      ) : (
        <>
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-section-header">
              <h2>Quiet Hours</h2>
            </div>
            <div className="admin-grid three">
              <label className="admin-field checkbox" style={{ alignSelf: 'end' }}>
                <input
                  type="checkbox"
                  checked={ops.quietHoursEnabled}
                  onChange={e => updateOps({ quietHoursEnabled: e.target.checked })}
                />
                <span>Enable quiet hours</span>
              </label>
              <label className="admin-field">
                <span>Start UTC (HH:MM)</span>
                <input
                  className="admin-input"
                  value={ops.quietHoursStartUtc}
                  onChange={e => updateOps({ quietHoursStartUtc: e.target.value })}
                  placeholder="23:00"
                />
              </label>
              <label className="admin-field">
                <span>End UTC (HH:MM)</span>
                <input
                  className="admin-input"
                  value={ops.quietHoursEndUtc}
                  onChange={e => updateOps({ quietHoursEndUtc: e.target.value })}
                  placeholder="08:00"
                />
              </label>
            </div>
          </div>

          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-section-header">
              <h2>Mentions + Digest</h2>
            </div>
            <div className="admin-grid two">
              <label className="admin-field">
                <span>Staff digest channel ID</span>
                <input
                  className="admin-input"
                  value={ops.staffDigestChannelId ?? ''}
                  onChange={e => updateOps({ staffDigestChannelId: e.target.value })}
                />
              </label>
            </div>
            <div className="admin-grid two" style={{ marginTop: 12 }}>
              <label className="admin-field">
                <span>Staff digest time UTC (HH:MM)</span>
                <input
                  className="admin-input"
                  value={ops.staffDigestTimeUtc ?? '17:30'}
                  onChange={e => updateOps({ staffDigestTimeUtc: e.target.value })}
                />
              </label>
            </div>
            <div className="admin-card" style={{ marginTop: 12 }}>
              <div className="admin-card-eyebrow">Mention Allowlist</div>
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Filter IDs</span>
                  <input
                    className="admin-input"
                    value={mentionFilter}
                    onChange={(e) => setMentionFilter(e.target.value)}
                    placeholder="Search channel ID"
                  />
                </label>
                <label className="admin-field">
                  <span>Add channel ID</span>
                  <div className="admin-row" style={{ marginTop: 6 }}>
                    <input
                      className="admin-input"
                      value={newMentionId}
                      onChange={(e) => setNewMentionId(e.target.value)}
                      placeholder="1234567890"
                    />
                    <button className="admin-btn" onClick={addMentionId}>Add</button>
                  </div>
                </label>
              </div>
              <div className="admin-list" style={{ marginTop: 12 }}>
                {mentionIds.length === 0 ? (
                  <div className="admin-card admin-empty">No channels allow mentions.</div>
                ) : (
                  mentionIds.map(id => (
                    <div key={id} className="admin-card">
                      <div className="admin-row" style={{ marginTop: 0, justifyContent: 'space-between' }}>
                        <div className="admin-card-sub">{id}</div>
                        <button className="admin-btn ghost" onClick={() => removeMentionId(id)}>Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Faction Channel Routing</h2>
            </div>
            <div className="admin-card" style={{ marginBottom: 12 }}>
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Search</span>
                  <input
                    className="admin-input small"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search faction name or ID"
                  />
                </label>
                <label className="admin-field checkbox" style={{ alignSelf: 'end' }}>
                  <input
                    type="checkbox"
                    checked={onlyMapped}
                    onChange={(e) => setOnlyMapped(e.target.checked)}
                  />
                  <span>Show mapped only</span>
                </label>
              </div>
            </div>
            {factionRows.length === 0 ? (
              <div className="admin-card admin-empty">No factions found yet. Add factions first.</div>
            ) : (
              <div className="admin-list">
                {factionRows.map(faction => (
                  <div key={faction.id} className="admin-card" id={`faction-${faction.id}`}>
                    <div className="admin-grid two">
                      <div>
                        <div className="admin-card-title">{faction.name}</div>
                        <div className="admin-card-sub">ID: {faction.id}</div>
                      </div>
                      <label className="admin-field">
                        <span>Discord channel ID</span>
                        <input
                          className="admin-input"
                          value={map.mappings?.[faction.id] ?? ''}
                          onChange={e => updateMap(faction.id, e.target.value)}
                          placeholder="1234567890"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <AdminSaveBar dirty={dirty} saving={saving} error={error} onSave={save} />
    </div>
  )
}
