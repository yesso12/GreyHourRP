import { useEffect, useMemo, useState } from 'react'
import { AdminSaveBar } from '../../components/AdminSaveBar'
import type { Transmission } from '../../types/content'
import { loadTransmissions, saveContent } from '../api/client'

const CATEGORIES = ['World', 'Emergency', 'Admin', 'Faction', 'Rumor']

type Draft = Transmission & { bodyText: string }

function toDraft(t: Transmission): Draft {
  return { ...t, bodyText: t.body.join('\n') }
}

function fromDraft(d: Draft): Transmission {
  const body = d.bodyText.split('\n')
  const { bodyText, ...rest } = d
  return { ...rest, body }
}

function newId() {
  return (crypto as any)?.randomUUID?.() ?? `tx-${Date.now()}`
}

export function AdminTransmissions() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Draft[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadTransmissions()
      .then(data => setItems(data.map(toDraft)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...items]
      .filter(item =>
        q ? `${item.title} ${item.bodyText}`.toLowerCase().includes(q) : true
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [items, query])

  function updateItem(id: string, patch: Partial<Draft>) {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)))
    setDirty(true)
  }

  function addItem() {
    const today = new Date().toISOString().slice(0, 10)
    const draft: Draft = {
      id: newId(),
      title: 'New Transmission',
      date: today,
      category: 'World',
      pinned: false,
      body: [''],
      bodyText: ''
    }
    setItems(prev => [draft, ...prev])
    setDirty(true)
  }

  function removeItem(id: string) {
    if (!confirm('Delete this transmission? This cannot be undone.')) return
    setItems(prev => prev.filter(item => item.id !== id))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = items.map(fromDraft)
      await saveContent('transmissions', payload)
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
          <div className="admin-eyebrow">Content</div>
          <h1>Transmissions</h1>
          <p className="admin-sub">Story posts and broadcasts displayed on the public site.</p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addItem}>New transmission</button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <label className="admin-field">
          <span>Search</span>
          <input
            className="admin-input small"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title or body"
          />
        </label>
      </div>

      {loading ? (
        <div className="admin-card">Loading transmissions…</div>
      ) : (
        <div className="admin-list">
          {filtered.map(item => (
            <div key={item.id} className="admin-card">
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Title</span>
                  <input
                    className="admin-input"
                    value={item.title}
                    onChange={e => updateItem(item.id, { title: e.target.value })}
                  />
                </label>

                <label className="admin-field">
                  <span>Date</span>
                  <input
                    className="admin-input"
                    type="date"
                    value={item.date}
                    onChange={e => updateItem(item.id, { date: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Category</span>
                  <select
                    className="admin-input"
                    value={item.category ?? 'World'}
                    onChange={e => updateItem(item.id, { category: e.target.value })}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-field checkbox">
                  <input
                    type="checkbox"
                    checked={item.pinned ?? false}
                    onChange={e => updateItem(item.id, { pinned: e.target.checked })}
                  />
                  <span>Pin to top</span>
                </label>

                <div className="admin-field">
                  <span>Actions</span>
                  <button className="admin-btn danger" onClick={() => removeItem(item.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <label className="admin-field">
                <span>Body</span>
                <textarea
                  className="admin-textarea"
                  rows={8}
                  value={item.bodyText}
                  onChange={e => updateItem(item.id, { bodyText: e.target.value })}
                  placeholder="Each line becomes a paragraph. Leave blank lines to add spacing."
                />
              </label>
            </div>
          ))}
        </div>
      )}

      <AdminSaveBar dirty={dirty} saving={saving} error={error} onSave={save} />
    </div>
  )
}
