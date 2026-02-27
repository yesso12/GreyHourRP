import { useEffect, useMemo, useState } from 'react'
import type { DossierCollection, DossierStatus, PlayerDossier } from '../../types/content'
import { loadDossiers, saveDossiers } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

const statusOptions: Array<{ id: DossierStatus; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'denied', label: 'Denied' }
]

function newId() {
  return (crypto as any)?.randomUUID?.() ?? `dossier-${Date.now()}`
}

function normalizeDossier(row: Partial<PlayerDossier>, index: number): PlayerDossier {
  return {
    id: String(row.id ?? `dossier-${index}`),
    characterName: String(row.characterName ?? 'New Survivor'),
    handle: row.handle ? String(row.handle) : '',
    factionId: row.factionId ? String(row.factionId) : '',
    backstory: row.backstory ? String(row.backstory) : '',
    goals: Array.isArray(row.goals) ? row.goals.map(item => String(item)).filter(Boolean) : [],
    status: (row.status ?? 'pending') as DossierStatus,
    reputation: typeof row.reputation === 'number' ? row.reputation : 0,
    commendations: typeof row.commendations === 'number' ? row.commendations : 0,
    warnings: typeof row.warnings === 'number' ? row.warnings : 0,
    lastSeenUtc: row.lastSeenUtc ? String(row.lastSeenUtc) : '',
    tags: Array.isArray(row.tags) ? row.tags.map(item => String(item)).filter(Boolean) : [],
    requestedBy: row.requestedBy ? String(row.requestedBy) : '',
    requestedFrom: row.requestedFrom ? String(row.requestedFrom) : '',
    createdUtc: row.createdUtc ? String(row.createdUtc) : '',
    approvedUtc: row.approvedUtc ? String(row.approvedUtc) : '',
    deniedUtc: row.deniedUtc ? String(row.deniedUtc) : '',
    notes: row.notes ? String(row.notes) : ''
  }
}

function defaultCollection(): DossierCollection {
  return {
    updatedUtc: new Date().toISOString(),
    notes: [],
    dossiers: []
  }
}

export function AdminDossiers() {
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collection, setCollection] = useState<DossierCollection>(defaultCollection())
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<DossierStatus | 'all'>('all')

  useEffect(() => {
    loadDossiers()
      .then((payload) => {
        const next: DossierCollection = {
          ...defaultCollection(),
          ...payload,
          dossiers: (payload?.dossiers ?? []).map(normalizeDossier)
        }
        setCollection(next)
      })
      .catch(() => setCollection(defaultCollection()))
      .finally(() => setLoading(false))
  }, [])

  function updateRoot(patch: Partial<DossierCollection>) {
    setCollection(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  function updateDossier(id: string, patch: Partial<PlayerDossier>) {
    setCollection(prev => ({
      ...prev,
      dossiers: prev.dossiers.map(item => (item.id === id ? { ...item, ...patch } : item))
    }))
    setDirty(true)
  }

  function addDossier() {
    const now = new Date().toISOString()
    const entry: PlayerDossier = normalizeDossier({ id: newId(), createdUtc: now }, collection.dossiers.length)
    setCollection(prev => ({ ...prev, dossiers: [entry, ...prev.dossiers] }))
    setDirty(true)
  }

  function removeDossier(id: string) {
    if (!confirm('Delete this dossier?')) return
    setCollection(prev => ({ ...prev, dossiers: prev.dossiers.filter(item => item.id !== id) }))
    setDirty(true)
  }

  function setStatus(id: string, status: DossierStatus) {
    const now = new Date().toISOString()
    const patch: Partial<PlayerDossier> = { status }
    if (status === 'approved') {
      patch.approvedUtc = now
      patch.deniedUtc = ''
    }
    if (status === 'denied') {
      patch.deniedUtc = now
      patch.approvedUtc = ''
    }
    updateDossier(id, patch)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveDossiers({ ...collection, updatedUtc: new Date().toISOString() })
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return collection.dossiers.filter(item => {
      const matchesText =
        !q ||
        `${item.characterName} ${item.handle ?? ''} ${item.factionId ?? ''}`.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      return matchesText && matchesStatus
    })
  }, [collection.dossiers, query, statusFilter])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Player Records</div>
          <h1>Player Dossiers</h1>
          <p className="admin-sub">
            Track character records, reputation, and approvals across the server.
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addDossier}>Add dossier</button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-grid two">
          <label className="admin-field">
            <span>Search</span>
            <input
              className="admin-input small"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, handle, faction"
            />
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select
              className="admin-input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as DossierStatus | 'all')}
            >
              <option value="all">All</option>
              {statusOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ color: 'var(--bad)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-card">Loading dossiers…</div>
      ) : (
        <div className="admin-list">
          {filtered.map(item => (
            <div key={item.id} className="admin-card">
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Character name</span>
                  <input
                    className="admin-input"
                    value={item.characterName}
                    onChange={e => updateDossier(item.id, { characterName: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Handle</span>
                  <input
                    className="admin-input"
                    value={item.handle ?? ''}
                    onChange={e => updateDossier(item.id, { handle: e.target.value })}
                  />
                </label>
              </div>

              <label className="admin-field">
                <span>Backstory</span>
                <textarea
                  className="admin-input"
                  rows={3}
                  value={item.backstory ?? ''}
                  onChange={e => updateDossier(item.id, { backstory: e.target.value })}
                />
              </label>

              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Status</span>
                  <select
                    className="admin-input"
                    value={item.status}
                    onChange={e => setStatus(item.id, e.target.value as DossierStatus)}
                  >
                    {statusOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Faction ID</span>
                  <input
                    className="admin-input"
                    value={item.factionId ?? ''}
                    onChange={e => updateDossier(item.id, { factionId: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Last seen UTC</span>
                  <input
                    className="admin-input"
                    value={item.lastSeenUtc ?? ''}
                    onChange={e => updateDossier(item.id, { lastSeenUtc: e.target.value })}
                    placeholder="2026-02-05T18:30:00Z"
                  />
                </label>
              </div>

              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Reputation</span>
                  <input
                    className="admin-input"
                    type="number"
                    value={item.reputation ?? 0}
                    onChange={e => updateDossier(item.id, { reputation: Number(e.target.value) })}
                  />
                </label>
                <label className="admin-field">
                  <span>Commendations</span>
                  <input
                    className="admin-input"
                    type="number"
                    value={item.commendations ?? 0}
                    onChange={e => updateDossier(item.id, { commendations: Number(e.target.value) })}
                  />
                </label>
                <label className="admin-field">
                  <span>Warnings</span>
                  <input
                    className="admin-input"
                    type="number"
                    value={item.warnings ?? 0}
                    onChange={e => updateDossier(item.id, { warnings: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Goals (comma-separated)</span>
                  <input
                    className="admin-input"
                    value={(item.goals ?? []).join(', ')}
                    onChange={e => updateDossier(item.id, { goals: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  />
                </label>
                <label className="admin-field">
                  <span>Tags (comma-separated)</span>
                  <input
                    className="admin-input"
                    value={(item.tags ?? []).join(', ')}
                    onChange={e => updateDossier(item.id, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  />
                </label>
              </div>

              <label className="admin-field">
                <span>Notes</span>
                <input
                  className="admin-input"
                  value={item.notes ?? ''}
                  onChange={e => updateDossier(item.id, { notes: e.target.value })}
                />
              </label>

              <div className="admin-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="admin-btn" onClick={() => setStatus(item.id, 'approved')}>
                  Approve
                </button>
                <button className="admin-btn" onClick={() => setStatus(item.id, 'denied')}>
                  Deny
                </button>
                <button className="admin-btn ghost" onClick={() => setStatus(item.id, 'pending')}>
                  Reset to Pending
                </button>
                <button className="admin-btn ghost" onClick={() => removeDossier(item.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminSaveBar dirty={dirty} saving={saving} error={error} onSave={save} />
    </div>
  )
}
