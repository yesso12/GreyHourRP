import { useEffect, useMemo, useState } from 'react'
import type {
  Faction,
  FactionStatus,
  FactionTerritoryState,
  TerritoryPoint,
  TerritoryStatus
} from '../../types/content'
import { loadFactionTerritory, saveFactionTerritory } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

const factionStatuses: Array<{ id: FactionStatus; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'dormant', label: 'Dormant' },
  { id: 'defunct', label: 'Defunct' }
]

const territoryStatuses: Array<{ id: TerritoryStatus; label: string }> = [
  { id: 'controlled', label: 'Controlled' },
  { id: 'contested', label: 'Contested' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'lost', label: 'Lost' }
]

function newId(prefix: string) {
  return (crypto as any)?.randomUUID?.() ?? `${prefix}-${Date.now()}`
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

function normalizeFaction(row: Partial<Faction>, index: number): Faction {
  return {
    id: String(row.id ?? `faction-${index}`),
    name: String(row.name ?? 'New Faction'),
    tagline: row.tagline ? String(row.tagline) : '',
    description: row.description ? String(row.description) : '',
    status: (row.status ?? 'active') as FactionStatus,
    color: row.color ? String(row.color) : '#b10f16',
    icon: row.icon ? String(row.icon) : '',
    leader: row.leader ? String(row.leader) : '',
    headquarters: row.headquarters ? String(row.headquarters) : '',
    members: typeof row.members === 'number' ? row.members : 0,
    reputation: typeof row.reputation === 'number' ? row.reputation : 0,
    foundedUtc: row.foundedUtc ? String(row.foundedUtc) : '',
    allies: Array.isArray(row.allies) ? row.allies.map(item => String(item)).filter(Boolean) : [],
    rivals: Array.isArray(row.rivals) ? row.rivals.map(item => String(item)).filter(Boolean) : [],
    featured: Boolean(row.featured)
  }
}

function normalizeTerritory(row: Partial<TerritoryPoint>, index: number): TerritoryPoint {
  return {
    id: String(row.id ?? `territory-${index}`),
    name: String(row.name ?? 'New Territory'),
    x: clampPercent(typeof row.x === 'number' ? row.x : 50),
    y: clampPercent(typeof row.y === 'number' ? row.y : 50),
    status: (row.status ?? 'neutral') as TerritoryStatus,
    factionId: row.factionId ? String(row.factionId) : '',
    region: row.region ? String(row.region) : '',
    description: row.description ? String(row.description) : '',
    lastConflictUtc: row.lastConflictUtc ? String(row.lastConflictUtc) : '',
    tags: Array.isArray(row.tags) ? row.tags.map(item => String(item)).filter(Boolean) : []
  }
}

function defaultState(): FactionTerritoryState {
  return {
    updatedUtc: new Date().toISOString(),
    mapUrl: '',
    mapAlt: 'Project Zomboid region map',
    mapAttribution: '',
    notes: [],
    factions: [],
    territories: []
  }
}

export function AdminFactions() {
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FactionTerritoryState>(defaultState())
  const [factionQuery, setFactionQuery] = useState('')
  const [territoryQuery, setTerritoryQuery] = useState('')
  const [territoryStatus, setTerritoryStatus] = useState<TerritoryStatus | 'all'>('all')
  const [territoryFaction, setTerritoryFaction] = useState<string>('all')

  useEffect(() => {
    loadFactionTerritory()
      .then((payload) => {
        const normalized: FactionTerritoryState = {
          ...defaultState(),
          ...payload,
          factions: (payload?.factions ?? []).map(normalizeFaction),
          territories: (payload?.territories ?? []).map(normalizeTerritory)
        }
        setData(normalized)
      })
      .catch(() => setData(defaultState()))
      .finally(() => setLoading(false))
  }, [])

  function updateRoot(patch: Partial<FactionTerritoryState>) {
    setData(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  function updateFaction(id: string, patch: Partial<Faction>) {
    setData(prev => ({
      ...prev,
      factions: prev.factions.map(item => (item.id === id ? { ...item, ...patch } : item))
    }))
    setDirty(true)
  }

  function updateTerritory(id: string, patch: Partial<TerritoryPoint>) {
    setData(prev => ({
      ...prev,
      territories: prev.territories.map(item => (item.id === id ? { ...item, ...patch } : item))
    }))
    setDirty(true)
  }

  function addFaction() {
    const entry: Faction = normalizeFaction({ id: newId('faction') }, data.factions.length)
    setData(prev => ({ ...prev, factions: [entry, ...prev.factions] }))
    setDirty(true)
  }

  function addTerritory() {
    const entry: TerritoryPoint = normalizeTerritory({ id: newId('territory') }, data.territories.length)
    setData(prev => ({ ...prev, territories: [entry, ...prev.territories] }))
    setDirty(true)
  }

  function removeFaction(id: string) {
    if (!confirm('Delete this faction?')) return
    setData(prev => ({
      ...prev,
      factions: prev.factions.filter(item => item.id !== id)
    }))
    setDirty(true)
  }

  function removeTerritory(id: string) {
    if (!confirm('Delete this territory?')) return
    setData(prev => ({
      ...prev,
      territories: prev.territories.filter(item => item.id !== id)
    }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveFactionTerritory({
        ...data,
        updatedUtc: new Date().toISOString()
      })
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const factionOptions = useMemo(
    () => [{ id: 'all', label: 'All factions' }, ...data.factions.map(item => ({ id: item.id, label: item.name }))],
    [data.factions]
  )

  const filteredFactions = useMemo(() => {
    const q = factionQuery.trim().toLowerCase()
    return data.factions.filter(item => {
      if (!q) return true
      return `${item.name} ${item.tagline ?? ''} ${item.leader ?? ''} ${item.headquarters ?? ''}`.toLowerCase().includes(q)
    })
  }, [data.factions, factionQuery])

  const filteredTerritories = useMemo(() => {
    const q = territoryQuery.trim().toLowerCase()
    return data.territories.filter(item => {
      const matchesText =
        !q ||
        `${item.name} ${item.region ?? ''} ${item.description ?? ''}`.toLowerCase().includes(q)
      const matchesStatus = territoryStatus === 'all' || item.status === territoryStatus
      const matchesFaction = territoryFaction === 'all' || item.factionId === territoryFaction
      return matchesText && matchesStatus && matchesFaction
    })
  }, [data.territories, territoryQuery, territoryStatus, territoryFaction])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">World State</div>
          <h1>Factions & Territory</h1>
          <p className="admin-sub">
            Map the living world. This powers the public territory page and future API integrations.
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addFaction}>Add faction</button>
          <button className="admin-btn" onClick={addTerritory}>Add territory</button>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ color: 'var(--bad)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-grid two">
          <label className="admin-field">
            <span>Map image URL</span>
            <input
              className="admin-input"
              value={data.mapUrl ?? ''}
              onChange={e => updateRoot({ mapUrl: e.target.value })}
              placeholder="https://..."
            />
          </label>
          <label className="admin-field">
            <span>Map attribution (optional)</span>
            <input
              className="admin-input"
              value={data.mapAttribution ?? ''}
              onChange={e => updateRoot({ mapAttribution: e.target.value })}
              placeholder="Map source / credits"
            />
          </label>
        </div>
        <div className="admin-grid two" style={{ marginTop: 12 }}>
          <label className="admin-field">
            <span>Map alt text</span>
            <input
              className="admin-input"
              value={data.mapAlt ?? ''}
              onChange={e => updateRoot({ mapAlt: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span>Notes (comma-separated)</span>
            <input
              className="admin-input"
              value={(data.notes ?? []).join(', ')}
              onChange={e => updateRoot({ notes: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="admin-card">Loading factions and territories…</div>
      ) : (
        <>
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Factions</h2>
            </div>
            <div className="admin-card" style={{ marginBottom: 12 }}>
              <label className="admin-field">
                <span>Search</span>
                <input
                  className="admin-input small"
                  value={factionQuery}
                  onChange={e => setFactionQuery(e.target.value)}
                  placeholder="Search faction name, leader, HQ"
                />
              </label>
            </div>
            <div className="admin-list">
              {filteredFactions.map(item => (
                <div key={item.id} className="admin-card">
                  <div className="admin-grid two">
                    <label className="admin-field">
                      <span>Name</span>
                      <input
                        className="admin-input"
                        value={item.name}
                        onChange={e => updateFaction(item.id, { name: e.target.value })}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Tagline</span>
                      <input
                        className="admin-input"
                        value={item.tagline ?? ''}
                        onChange={e => updateFaction(item.id, { tagline: e.target.value })}
                      />
                    </label>
                  </div>

                  <label className="admin-field">
                    <span>Description</span>
                    <textarea
                      className="admin-input"
                      rows={3}
                      value={item.description ?? ''}
                      onChange={e => updateFaction(item.id, { description: e.target.value })}
                    />
                  </label>

                  <div className="admin-grid three">
                    <label className="admin-field">
                      <span>Status</span>
                      <select
                        className="admin-input"
                        value={item.status ?? 'active'}
                        onChange={e => updateFaction(item.id, { status: e.target.value as FactionStatus })}
                      >
                        {factionStatuses.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-field">
                      <span>Color</span>
                      <input
                        className="admin-input"
                        value={item.color ?? ''}
                        onChange={e => updateFaction(item.id, { color: e.target.value })}
                        placeholder="#b10f16"
                      />
                    </label>
                    <label className="admin-field">
                      <span>Icon (URL or emoji)</span>
                      <input
                        className="admin-input"
                        value={item.icon ?? ''}
                        onChange={e => updateFaction(item.id, { icon: e.target.value })}
                      />
                    </label>
                  </div>

                  <div className="admin-grid three">
                    <label className="admin-field">
                      <span>Leader</span>
                      <input
                        className="admin-input"
                        value={item.leader ?? ''}
                        onChange={e => updateFaction(item.id, { leader: e.target.value })}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Headquarters</span>
                      <input
                        className="admin-input"
                        value={item.headquarters ?? ''}
                        onChange={e => updateFaction(item.id, { headquarters: e.target.value })}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Founded UTC</span>
                      <input
                        className="admin-input"
                        value={item.foundedUtc ?? ''}
                        onChange={e => updateFaction(item.id, { foundedUtc: e.target.value })}
                        placeholder="2025-09-12T18:00:00Z"
                      />
                    </label>
                  </div>

                  <div className="admin-grid three">
                    <label className="admin-field">
                      <span>Members</span>
                      <input
                        className="admin-input"
                        type="number"
                        value={item.members ?? 0}
                        onChange={e => updateFaction(item.id, { members: Number(e.target.value) })}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Reputation</span>
                      <input
                        className="admin-input"
                        type="number"
                        value={item.reputation ?? 0}
                        onChange={e => updateFaction(item.id, { reputation: Number(e.target.value) })}
                      />
                    </label>
                    <label className="admin-field checkbox" style={{ alignSelf: 'end' }}>
                      <input
                        type="checkbox"
                        checked={item.featured ?? false}
                        onChange={e => updateFaction(item.id, { featured: e.target.checked })}
                      />
                      <span>Featured</span>
                    </label>
                  </div>

                  <div className="admin-grid two">
                    <label className="admin-field">
                      <span>Allies (comma-separated)</span>
                      <input
                        className="admin-input"
                        value={(item.allies ?? []).join(', ')}
                        onChange={e => updateFaction(item.id, { allies: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Rivals (comma-separated)</span>
                      <input
                        className="admin-input"
                        value={(item.rivals ?? []).join(', ')}
                        onChange={e => updateFaction(item.id, { rivals: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                      />
                    </label>
                  </div>

                  <div className="admin-actions" style={{ justifyContent: 'flex-start' }}>
                    <button className="admin-btn ghost" onClick={() => removeFaction(item.id)}>
                      Delete
                    </button>
                    <a className="admin-btn" href={`/admin/discord-routing#faction-${encodeURIComponent(item.id)}`}>
                      Discord Routing
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Territory Points</h2>
            </div>
            <div className="admin-card" style={{ marginBottom: 12 }}>
              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Search</span>
                  <input
                    className="admin-input small"
                    value={territoryQuery}
                    onChange={e => setTerritoryQuery(e.target.value)}
                    placeholder="Search territory name or region"
                  />
                </label>
                <label className="admin-field">
                  <span>Status</span>
                  <select
                    className="admin-input"
                    value={territoryStatus}
                    onChange={e => setTerritoryStatus(e.target.value as TerritoryStatus | 'all')}
                  >
                    <option value="all">All</option>
                    {territoryStatuses.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Faction</span>
                  <select
                    className="admin-input"
                    value={territoryFaction}
                    onChange={e => setTerritoryFaction(e.target.value)}
                  >
                    {factionOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="admin-list">
              {filteredTerritories.map(item => (
                <div key={item.id} className="admin-card">
                  <div className="admin-grid two">
                    <label className="admin-field">
                      <span>Name</span>
                      <input
                        className="admin-input"
                        value={item.name}
                        onChange={e => updateTerritory(item.id, { name: e.target.value })}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Region</span>
                      <input
                        className="admin-input"
                        value={item.region ?? ''}
                        onChange={e => updateTerritory(item.id, { region: e.target.value })}
                      />
                    </label>
                  </div>

                  <label className="admin-field">
                    <span>Description</span>
                    <textarea
                      className="admin-input"
                      rows={2}
                      value={item.description ?? ''}
                      onChange={e => updateTerritory(item.id, { description: e.target.value })}
                    />
                  </label>

                  <div className="admin-grid four">
                    <label className="admin-field">
                      <span>Status</span>
                      <select
                        className="admin-input"
                        value={item.status}
                        onChange={e => updateTerritory(item.id, { status: e.target.value as TerritoryStatus })}
                      >
                        {territoryStatuses.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-field">
                      <span>Faction ID</span>
                      <input
                        className="admin-input"
                        value={item.factionId ?? ''}
                        onChange={e => updateTerritory(item.id, { factionId: e.target.value })}
                        placeholder="faction id"
                      />
                    </label>
                    <label className="admin-field">
                      <span>X (% from left)</span>
                      <input
                        className="admin-input"
                        type="number"
                        value={item.x}
                        onChange={e => updateTerritory(item.id, { x: clampPercent(Number(e.target.value)) })}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Y (% from top)</span>
                      <input
                        className="admin-input"
                        type="number"
                        value={item.y}
                        onChange={e => updateTerritory(item.id, { y: clampPercent(Number(e.target.value)) })}
                      />
                    </label>
                  </div>

                  <div className="admin-grid two">
                    <label className="admin-field">
                      <span>Last conflict UTC</span>
                      <input
                        className="admin-input"
                        value={item.lastConflictUtc ?? ''}
                        onChange={e => updateTerritory(item.id, { lastConflictUtc: e.target.value })}
                        placeholder="2025-09-12T18:00:00Z"
                      />
                    </label>
                    <label className="admin-field">
                      <span>Tags (comma-separated)</span>
                      <input
                        className="admin-input"
                        value={(item.tags ?? []).join(', ')}
                        onChange={e => updateTerritory(item.id, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                      />
                    </label>
                  </div>

                  <div className="admin-actions" style={{ justifyContent: 'flex-start' }}>
                    <button className="admin-btn ghost" onClick={() => removeTerritory(item.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <AdminSaveBar dirty={dirty} saving={saving} error={error} onSave={save} />
    </div>
  )
}
