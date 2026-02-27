import { useEffect, useState } from 'react'
import type { EconomySnapshot, EconomyStatus } from '../../types/content'
import { loadEconomySnapshot, saveEconomySnapshot } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

const statusOptions: Array<{ id: EconomyStatus; label: string }> = [
  { id: 'stable', label: 'Stable' },
  { id: 'volatile', label: 'Volatile' },
  { id: 'scarce', label: 'Scarce' },
  { id: 'flush', label: 'Flush' }
]

function newId() {
  return (crypto as any)?.randomUUID?.() ?? `cat-${Date.now()}`
}

function defaultSnapshot(): EconomySnapshot {
  return {
    updatedUtc: new Date().toISOString(),
    status: 'stable',
    summary: '',
    priceIndex: 100,
    scarcityIndex: 50,
    highlights: [],
    categories: [],
    watchlist: []
  }
}

export function AdminEconomy() {
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<EconomySnapshot>(defaultSnapshot())

  useEffect(() => {
    loadEconomySnapshot()
      .then((payload) => setData({ ...defaultSnapshot(), ...payload }))
      .catch(() => setData(defaultSnapshot()))
      .finally(() => setLoading(false))
  }, [])

  function update(patch: Partial<EconomySnapshot>) {
    setData(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  function updateCategory(index: number, patch: Partial<{ id: string; name: string; trend: 'up' | 'down' | 'flat'; note?: string }>) {
    setData(prev => ({
      ...prev,
      categories: (prev.categories ?? []).map((item, i) => (i === index ? { ...item, ...patch } : item))
    }))
    setDirty(true)
  }

  function updateWatch(index: number, patch: Partial<{ item: string; status: EconomyStatus; note?: string }>) {
    setData(prev => ({
      ...prev,
      watchlist: (prev.watchlist ?? []).map((item, i) => (i === index ? { ...item, ...patch } : item))
    }))
    setDirty(true)
  }

  function addCategory() {
    const next = { id: newId(), name: 'Supplies', trend: 'flat' as const, note: '' }
    update({ categories: [next, ...(data.categories ?? [])] })
  }

  function addWatch() {
    const next = { item: 'Fuel', status: 'stable' as EconomyStatus, note: '' }
    update({ watchlist: [next, ...(data.watchlist ?? [])] })
  }

  function removeCategory(index: number) {
    if (!confirm('Delete this category?')) return
    update({ categories: (data.categories ?? []).filter((_, i) => i !== index) })
  }

  function removeWatch(index: number) {
    if (!confirm('Delete this watch item?')) return
    update({ watchlist: (data.watchlist ?? []).filter((_, i) => i !== index) })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveEconomySnapshot({ ...data, updatedUtc: new Date().toISOString() })
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Economy</div>
          <h1>Economy Snapshot</h1>
          <p className="admin-sub">
            Summarize market conditions, scarcity, and watchlist items.
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addCategory}>Add category</button>
          <button className="admin-btn" onClick={addWatch}>Add watch item</button>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ color: 'var(--bad)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-card">Loading economy snapshot…</div>
      ) : (
        <>
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-grid three">
              <label className="admin-field">
                <span>Status</span>
                <select
                  className="admin-input"
                  value={data.status}
                  onChange={e => update({ status: e.target.value as EconomyStatus })}
                >
                  {statusOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Price index</span>
                <input
                  className="admin-input"
                  type="number"
                  value={data.priceIndex ?? 100}
                  onChange={e => update({ priceIndex: Number(e.target.value) })}
                />
              </label>
              <label className="admin-field">
                <span>Scarcity index</span>
                <input
                  className="admin-input"
                  type="number"
                  value={data.scarcityIndex ?? 50}
                  onChange={e => update({ scarcityIndex: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="admin-field">
              <span>Summary</span>
              <textarea
                className="admin-input"
                rows={3}
                value={data.summary ?? ''}
                onChange={e => update({ summary: e.target.value })}
              />
            </label>
            <label className="admin-field">
              <span>Highlights (comma-separated)</span>
              <input
                className="admin-input"
                value={(data.highlights ?? []).join(', ')}
                onChange={e => update({ highlights: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
              />
            </label>
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Categories</h2>
            </div>
            <div className="admin-list">
              {(data.categories ?? []).map((item, index) => (
                <div key={item.id} className="admin-card">
                  <div className="admin-grid three">
                    <label className="admin-field">
                      <span>Name</span>
                      <input
                        className="admin-input"
                        value={item.name}
                        onChange={e => updateCategory(index, { name: e.target.value })}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Trend</span>
                      <select
                        className="admin-input"
                        value={item.trend}
                        onChange={e => updateCategory(index, { trend: e.target.value as 'up' | 'down' | 'flat' })}
                      >
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                        <option value="flat">Flat</option>
                      </select>
                    </label>
                    <label className="admin-field">
                      <span>Note</span>
                      <input
                        className="admin-input"
                        value={item.note ?? ''}
                        onChange={e => updateCategory(index, { note: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="admin-actions" style={{ justifyContent: 'flex-start' }}>
                    <button className="admin-btn ghost" onClick={() => removeCategory(index)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Watchlist</h2>
            </div>
            <div className="admin-list">
              {(data.watchlist ?? []).map((item, index) => (
                <div key={`${item.item}-${index}`} className="admin-card">
                  <div className="admin-grid three">
                    <label className="admin-field">
                      <span>Item</span>
                      <input
                        className="admin-input"
                        value={item.item}
                        onChange={e => updateWatch(index, { item: e.target.value })}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Status</span>
                      <select
                        className="admin-input"
                        value={item.status}
                        onChange={e => updateWatch(index, { status: e.target.value as EconomyStatus })}
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-field">
                      <span>Note</span>
                      <input
                        className="admin-input"
                        value={item.note ?? ''}
                        onChange={e => updateWatch(index, { note: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="admin-actions" style={{ justifyContent: 'flex-start' }}>
                    <button className="admin-btn ghost" onClick={() => removeWatch(index)}>
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
