import { useEffect, useMemo, useState } from 'react'
import type { ShopItem, ShopStatus } from '../../types/content'
import { getContent, saveContent } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

function newId() {
  return (crypto as any)?.randomUUID?.() ?? `shop-${Date.now()}`
}

const statusOptions: Array<{ id: ShopStatus; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'denied', label: 'Denied' }
]

function normalizeItem(item: Partial<ShopItem>, index: number): ShopItem {
  return {
    id: String(item.id ?? `shop-${index}`),
    name: String(item.name ?? 'New Shop'),
    category: String(item.category ?? 'General'),
    description: String(item.description ?? ''),
    owner: item.owner ? String(item.owner) : '',
    location: item.location ? String(item.location) : '',
    contact: item.contact ? String(item.contact) : '',
    status: (item.status ?? 'pending') as ShopStatus,
    featured: Boolean(item.featured),
    tags: Array.isArray(item.tags) ? item.tags.map(t => String(t)).filter(Boolean) : [],
    createdUtc: item.createdUtc ? String(item.createdUtc) : '',
    approvedUtc: item.approvedUtc ? String(item.approvedUtc) : '',
    deniedUtc: item.deniedUtc ? String(item.deniedUtc) : '',
    requestedBy: item.requestedBy ? String(item.requestedBy) : '',
    requestedFrom: item.requestedFrom ? String(item.requestedFrom) : '',
    source: item.source ?? 'manual',
    notes: item.notes ? String(item.notes) : ''
  }
}

export function AdminShops() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ShopItem[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ShopStatus | 'all'>('all')

  useEffect(() => {
    getContent<ShopItem[]>('shops')
      .then((rows) => {
        const normalized = (rows ?? []).map((row, index) => normalizeItem(row, index))
        setItems(normalized)
      })
      .finally(() => setLoading(false))
  }, [])

  function updateItem(id: string, patch: Partial<ShopItem>) {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)))
    setDirty(true)
  }

  function addItem() {
    const now = new Date().toISOString()
    const entry: ShopItem = {
      id: newId(),
      name: 'New Shop',
      category: 'General',
      description: '',
      status: 'pending',
      createdUtc: now,
      source: 'manual'
    }
    setItems(prev => [entry, ...prev])
    setDirty(true)
  }

  function removeItem(id: string) {
    if (!confirm('Delete this shop listing?')) return
    setItems(prev => prev.filter(item => item.id !== id))
    setDirty(true)
  }

  function setStatus(id: string, status: ShopStatus) {
    const now = new Date().toISOString()
    const patch: Partial<ShopItem> = { status }
    if (status === 'approved') {
      patch.approvedUtc = now
      patch.deniedUtc = ''
    }
    if (status === 'denied') {
      patch.deniedUtc = now
      patch.approvedUtc = ''
    }
    updateItem(id, patch)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveContent('shops', items)
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      const matchesText =
        !q ||
        `${item.name} ${item.category} ${item.description} ${item.owner ?? ''} ${item.location ?? ''}`.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      return matchesText && matchesStatus
    })
  }, [items, query, statusFilter])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Content</div>
          <h1>In-Game Shops</h1>
          <p className="admin-sub">
            Approved shops publish automatically to the public Directory page. Pending requests come from Discord.
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addItem}>Add shop</button>
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
              placeholder="Search shops"
            />
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select
              className="admin-input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ShopStatus | 'all')}
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
        <div className="admin-card">Loading shops…</div>
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
                    value={item.category}
                    onChange={e => updateItem(item.id, { category: e.target.value })}
                  />
                </label>
              </div>

              <label className="admin-field">
                <span>Description</span>
                <textarea
                  className="admin-input"
                  rows={3}
                  value={item.description}
                  onChange={e => updateItem(item.id, { description: e.target.value })}
                />
              </label>

              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Owner</span>
                  <input
                    className="admin-input"
                    value={item.owner ?? ''}
                    onChange={e => updateItem(item.id, { owner: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Location</span>
                  <input
                    className="admin-input"
                    value={item.location ?? ''}
                    onChange={e => updateItem(item.id, { location: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Contact</span>
                  <input
                    className="admin-input"
                    value={item.contact ?? ''}
                    onChange={e => updateItem(item.id, { contact: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Status</span>
                  <select
                    className="admin-input"
                    value={item.status}
                    onChange={e => setStatus(item.id, e.target.value as ShopStatus)}
                  >
                    {statusOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field checkbox" style={{ alignSelf: 'end' }}>
                  <input
                    type="checkbox"
                    checked={item.featured ?? false}
                    onChange={e => updateItem(item.id, { featured: e.target.checked })}
                  />
                  <span>Featured</span>
                </label>
                <label className="admin-field">
                  <span>Tags (comma-separated)</span>
                  <input
                    className="admin-input"
                    value={(item.tags ?? []).join(', ')}
                    onChange={e => updateItem(item.id, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  />
                </label>
              </div>

              <label className="admin-field">
                <span>Notes</span>
                <input
                  className="admin-input"
                  value={item.notes ?? ''}
                  onChange={e => updateItem(item.id, { notes: e.target.value })}
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
                <button className="admin-btn ghost" onClick={() => removeItem(item.id)}>
                  Delete
                </button>
              </div>

              <div className="small" style={{ marginTop: 8 }}>
                Source: {item.source ?? 'manual'}{item.requestedBy ? ` • Requested By: ${item.requestedBy}` : ''}{item.createdUtc ? ` • Created: ${item.createdUtc}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminSaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
      />
    </div>
  )
}
