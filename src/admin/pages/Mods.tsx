import { useEffect, useMemo, useState } from 'react'
import type { ModItem } from '../../types/content'
import { loadMods, saveContent } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

function newId() {
  return (crypto as any)?.randomUUID?.() ?? `md-${Date.now()}`
}

export function AdminMods() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ModItem[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadMods()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  function updateItem(id: string, patch: Partial<ModItem>) {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)))
    setDirty(true)
  }

  function addItem() {
    const entry: ModItem = {
      id: newId(),
      name: 'New Mod',
      required: true,
      category: 'General',
      description: ''
    }
    setItems(prev => [entry, ...prev])
    setDirty(true)
  }

  function removeItem(id: string) {
    if (!confirm('Delete this mod entry?')) return
    setItems(prev => prev.filter(item => item.id !== id))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveContent('mods', items)
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(item =>
      `${item.name} ${item.category ?? ''} ${item.workshopId ?? ''}`.toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Content</div>
          <h1>Mods List</h1>
          <p className="admin-sub">Manage required and optional mods for the server.</p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addItem}>Add mod</button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <label className="admin-field">
          <span>Search</span>
          <input
            className="admin-input small"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search mods"
          />
        </label>
      </div>

      {loading ? (
        <div className="admin-card">Loading mods…</div>
      ) : (
        <div className="admin-list">
          {filtered.map(item => (
            <div key={item.id} className="admin-card">
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Name</span>
                  <input
                    className="admin-input"
                    value={item.name}
                    onChange={e => updateItem(item.id, { name: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Category</span>
                  <input
                    className="admin-input"
                    value={item.category ?? ''}
                    onChange={e => updateItem(item.id, { category: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Workshop ID</span>
                  <input
                    className="admin-input"
                    value={item.workshopId ?? ''}
                    onChange={e => updateItem(item.id, { workshopId: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Mod ID</span>
                  <input
                    className="admin-input"
                    value={item.modId ?? ''}
                    onChange={e => updateItem(item.id, { modId: e.target.value })}
                  />
                </label>
                <label className="admin-field checkbox">
                  <input
                    type="checkbox"
                    checked={item.required !== false}
                    onChange={e => updateItem(item.id, { required: e.target.checked })}
                  />
                  <span>Required</span>
                </label>
              </div>

              <label className="admin-field">
                <span>Description</span>
                <textarea
                  className="admin-textarea"
                  rows={3}
                  value={item.description ?? ''}
                  onChange={e => updateItem(item.id, { description: e.target.value })}
                />
              </label>

              <div className="admin-row">
                <button className="admin-btn danger" onClick={() => removeItem(item.id)}>
                  Remove mod
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
