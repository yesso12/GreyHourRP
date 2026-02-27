import { useEffect, useMemo, useState } from 'react'
import type {
  ArcPhase,
  ArcPhaseStatus,
  StoryArc,
  StoryArcCollection,
  StoryArcStatus
} from '../../types/content'
import { loadStoryArcs, saveStoryArcs } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

const arcStatuses: Array<{ id: StoryArcStatus; label: string }> = [
  { id: 'planning', label: 'Planning' },
  { id: 'live', label: 'Live' },
  { id: 'paused', label: 'Paused' },
  { id: 'complete', label: 'Complete' }
]

const phaseStatuses: Array<{ id: ArcPhaseStatus; label: string }> = [
  { id: 'locked', label: 'Locked' },
  { id: 'active', label: 'Active' },
  { id: 'complete', label: 'Complete' }
]

function newId(prefix: string) {
  return (crypto as any)?.randomUUID?.() ?? `${prefix}-${Date.now()}`
}

function normalizePhase(row: Partial<ArcPhase>, index: number): ArcPhase {
  return {
    id: String(row.id ?? `phase-${index}`),
    name: String(row.name ?? 'Phase'),
    summary: row.summary ? String(row.summary) : '',
    status: (row.status ?? 'locked') as ArcPhaseStatus,
    startUtc: row.startUtc ? String(row.startUtc) : '',
    endUtc: row.endUtc ? String(row.endUtc) : '',
    objectives: Array.isArray(row.objectives) ? row.objectives.map(item => String(item)).filter(Boolean) : [],
    outcomes: Array.isArray(row.outcomes) ? row.outcomes.map(item => String(item)).filter(Boolean) : []
  }
}

function normalizeArc(row: Partial<StoryArc>, index: number): StoryArc {
  return {
    id: String(row.id ?? `arc-${index}`),
    title: String(row.title ?? 'New Arc'),
    status: (row.status ?? 'planning') as StoryArcStatus,
    summary: row.summary ? String(row.summary) : '',
    season: row.season ? String(row.season) : '',
    startUtc: row.startUtc ? String(row.startUtc) : '',
    endUtc: row.endUtc ? String(row.endUtc) : '',
    featured: Boolean(row.featured),
    phases: Array.isArray(row.phases) ? row.phases.map(normalizePhase) : [],
    factionsInvolved: Array.isArray(row.factionsInvolved)
      ? row.factionsInvolved.map(item => String(item)).filter(Boolean)
      : [],
    rewards: Array.isArray(row.rewards) ? row.rewards.map(item => String(item)).filter(Boolean) : []
  }
}

function defaultCollection(): StoryArcCollection {
  return {
    updatedUtc: new Date().toISOString(),
    notes: [],
    arcs: []
  }
}

export function AdminStoryArcs() {
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collection, setCollection] = useState<StoryArcCollection>(defaultCollection())
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadStoryArcs()
      .then((payload) => {
        const next: StoryArcCollection = {
          ...defaultCollection(),
          ...payload,
          arcs: (payload?.arcs ?? []).map(normalizeArc)
        }
        setCollection(next)
      })
      .catch(() => setCollection(defaultCollection()))
      .finally(() => setLoading(false))
  }, [])

  function updateRoot(patch: Partial<StoryArcCollection>) {
    setCollection(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  function updateArc(id: string, patch: Partial<StoryArc>) {
    setCollection(prev => ({
      ...prev,
      arcs: prev.arcs.map(item => (item.id === id ? { ...item, ...patch } : item))
    }))
    setDirty(true)
  }

  function updatePhase(arcId: string, phaseId: string, patch: Partial<ArcPhase>) {
    setCollection(prev => ({
      ...prev,
      arcs: prev.arcs.map(arc => {
        if (arc.id !== arcId) return arc
        return {
          ...arc,
          phases: arc.phases.map(phase => (phase.id === phaseId ? { ...phase, ...patch } : phase))
        }
      })
    }))
    setDirty(true)
  }

  function addArc() {
    const entry: StoryArc = normalizeArc({ id: newId('arc') }, collection.arcs.length)
    setCollection(prev => ({ ...prev, arcs: [entry, ...prev.arcs] }))
    setDirty(true)
  }

  function addPhase(arcId: string) {
    const phase: ArcPhase = normalizePhase({ id: newId('phase') }, 0)
    setCollection(prev => ({
      ...prev,
      arcs: prev.arcs.map(arc => (arc.id === arcId ? { ...arc, phases: [...arc.phases, phase] } : arc))
    }))
    setDirty(true)
  }

  function removeArc(id: string) {
    if (!confirm('Delete this arc?')) return
    setCollection(prev => ({ ...prev, arcs: prev.arcs.filter(item => item.id !== id) }))
    setDirty(true)
  }

  function removePhase(arcId: string, phaseId: string) {
    if (!confirm('Delete this phase?')) return
    setCollection(prev => ({
      ...prev,
      arcs: prev.arcs.map(arc =>
        arc.id === arcId ? { ...arc, phases: arc.phases.filter(phase => phase.id !== phaseId) } : arc
      )
    }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveStoryArcs({ ...collection, updatedUtc: new Date().toISOString() })
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return collection.arcs.filter(item => {
      if (!q) return true
      return `${item.title} ${item.season ?? ''} ${item.summary ?? ''}`.toLowerCase().includes(q)
    })
  }, [collection.arcs, query])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Story Engine</div>
          <h1>Seasonal Story Arcs</h1>
          <p className="admin-sub">
            Curate narrative arcs with phases, objectives, and outcomes.
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addArc}>Add arc</button>
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
              placeholder="Search arcs"
            />
          </label>
          <label className="admin-field">
            <span>Notes (comma-separated)</span>
            <input
              className="admin-input"
              value={(collection.notes ?? []).join(', ')}
              onChange={e => updateRoot({ notes: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ color: 'var(--bad)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-card">Loading story arcs…</div>
      ) : (
        <div className="admin-list">
          {filtered.map(arc => (
            <div key={arc.id} className="admin-card">
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Title</span>
                  <input
                    className="admin-input"
                    value={arc.title}
                    onChange={e => updateArc(arc.id, { title: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Season</span>
                  <input
                    className="admin-input"
                    value={arc.season ?? ''}
                    onChange={e => updateArc(arc.id, { season: e.target.value })}
                  />
                </label>
              </div>

              <label className="admin-field">
                <span>Summary</span>
                <textarea
                  className="admin-input"
                  rows={3}
                  value={arc.summary ?? ''}
                  onChange={e => updateArc(arc.id, { summary: e.target.value })}
                />
              </label>

              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Status</span>
                  <select
                    className="admin-input"
                    value={arc.status}
                    onChange={e => updateArc(arc.id, { status: e.target.value as StoryArcStatus })}
                  >
                    {arcStatuses.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Start UTC</span>
                  <input
                    className="admin-input"
                    value={arc.startUtc ?? ''}
                    onChange={e => updateArc(arc.id, { startUtc: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>End UTC</span>
                  <input
                    className="admin-input"
                    value={arc.endUtc ?? ''}
                    onChange={e => updateArc(arc.id, { endUtc: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Factions involved (comma-separated)</span>
                  <input
                    className="admin-input"
                    value={(arc.factionsInvolved ?? []).join(', ')}
                    onChange={e => updateArc(arc.id, { factionsInvolved: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  />
                </label>
                <label className="admin-field">
                  <span>Rewards (comma-separated)</span>
                  <input
                    className="admin-input"
                    value={(arc.rewards ?? []).join(', ')}
                    onChange={e => updateArc(arc.id, { rewards: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  />
                </label>
              </div>

              <label className="admin-field checkbox" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={arc.featured ?? false}
                  onChange={e => updateArc(arc.id, { featured: e.target.checked })}
                />
                <span>Featured</span>
              </label>

              <div className="admin-section" style={{ marginTop: 16 }}>
                <div className="admin-section-header">
                  <h2>Phases</h2>
                  <button className="admin-btn" onClick={() => addPhase(arc.id)}>Add phase</button>
                </div>
                {arc.phases.length === 0 ? (
                  <div className="admin-card admin-empty">No phases yet.</div>
                ) : (
                  <div className="admin-list">
                    {arc.phases.map(phase => (
                      <div key={phase.id} className="admin-card">
                        <div className="admin-grid two">
                          <label className="admin-field">
                            <span>Name</span>
                            <input
                              className="admin-input"
                              value={phase.name}
                              onChange={e => updatePhase(arc.id, phase.id, { name: e.target.value })}
                            />
                          </label>
                          <label className="admin-field">
                            <span>Status</span>
                            <select
                              className="admin-input"
                              value={phase.status}
                              onChange={e => updatePhase(arc.id, phase.id, { status: e.target.value as ArcPhaseStatus })}
                            >
                              {phaseStatuses.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="admin-field">
                          <span>Summary</span>
                          <textarea
                            className="admin-input"
                            rows={2}
                            value={phase.summary ?? ''}
                            onChange={e => updatePhase(arc.id, phase.id, { summary: e.target.value })}
                          />
                        </label>

                        <div className="admin-grid two">
                          <label className="admin-field">
                            <span>Start UTC</span>
                            <input
                              className="admin-input"
                              value={phase.startUtc ?? ''}
                              onChange={e => updatePhase(arc.id, phase.id, { startUtc: e.target.value })}
                            />
                          </label>
                          <label className="admin-field">
                            <span>End UTC</span>
                            <input
                              className="admin-input"
                              value={phase.endUtc ?? ''}
                              onChange={e => updatePhase(arc.id, phase.id, { endUtc: e.target.value })}
                            />
                          </label>
                        </div>

                        <div className="admin-grid two">
                          <label className="admin-field">
                            <span>Objectives (comma-separated)</span>
                            <input
                              className="admin-input"
                              value={(phase.objectives ?? []).join(', ')}
                              onChange={e => updatePhase(arc.id, phase.id, { objectives: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                            />
                          </label>
                          <label className="admin-field">
                            <span>Outcomes (comma-separated)</span>
                            <input
                              className="admin-input"
                              value={(phase.outcomes ?? []).join(', ')}
                              onChange={e => updatePhase(arc.id, phase.id, { outcomes: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                            />
                          </label>
                        </div>

                        <div className="admin-actions" style={{ justifyContent: 'flex-start' }}>
                          <button className="admin-btn ghost" onClick={() => removePhase(arc.id, phase.id)}>
                            Delete phase
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="admin-btn ghost" onClick={() => removeArc(arc.id)}>
                  Delete arc
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
