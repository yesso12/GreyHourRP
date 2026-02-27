import { useEffect, useState } from 'react'
import type { StatusHistoryItem } from '../../types/content'
import { loadStatusHistory, saveContent } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

function newId() {
  return (crypto as any)?.randomUUID?.() ?? `sh-${Date.now()}`
}

function normalizeItem(input: Partial<StatusHistoryItem>): StatusHistoryItem {
  const fallbackDate = new Date().toISOString()
  const parsed = input.dateUtc ? new Date(input.dateUtc) : null
  const dateUtc = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : fallbackDate
  const status = input.status === 'online' || input.status === 'offline' || input.status === 'maintenance'
    ? input.status
    : 'maintenance'
  return {
    id: input.id && input.id.trim() ? input.id : newId(),
    dateUtc,
    status,
    message: input.message ?? ''
  }
}

function toDateInputValue(dateUtc: string) {
  const d = new Date(dateUtc)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16)
  return d.toISOString().slice(0, 16)
}

export function AdminStatusHistory() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<StatusHistoryItem[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStatusHistory()
      .then(data => setItems((data ?? []).map(normalizeItem)))
      .finally(() => setLoading(false))
  }, [])

  function updateItem(id: string, patch: Partial<StatusHistoryItem>) {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)))
    setDirty(true)
  }

  function addItem() {
    const now = new Date().toISOString()
    const entry: StatusHistoryItem = {
      id: newId(),
      dateUtc: now,
      status: 'maintenance',
      message: ''
    }
    setItems(prev => [entry, ...prev])
    setDirty(true)
  }

  function removeItem(id: string) {
    if (!confirm('Delete this status entry?')) return
    setItems(prev => prev.filter(item => item.id !== id))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveContent('status-history', items)
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
          <div className="admin-eyebrow">Operations</div>
          <h1>Status History</h1>
          <p className="admin-sub">Manual overrides and historical record entries.</p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addItem}>Add entry</button>
        </div>
      </div>

      {loading ? (
        <div className="admin-card">Loading history…</div>
      ) : (
        <div className="admin-list">
          {items.map(item => (
            <div key={item.id} className="admin-card">
              <div className="admin-grid two">
                <label className="admin-field">
                  <span>Status</span>
                  <select
                    className="admin-input"
                    value={item.status}
                    onChange={e => updateItem(item.id, { status: e.target.value as StatusHistoryItem['status'] })}
                  >
                    <option value="online">Online</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="offline">Offline</option>
                  </select>
                </label>

                <label className="admin-field">
                  <span>Date (UTC)</span>
                  <input
                    className="admin-input"
                    type="datetime-local"
                    value={toDateInputValue(item.dateUtc)}
                    onChange={e => {
                      const dt = new Date(e.target.value)
                      if (Number.isNaN(dt.getTime())) return
                      updateItem(item.id, { dateUtc: dt.toISOString() })
                    }}
                  />
                </label>
              </div>

              <label className="admin-field">
                <span>Message</span>
                <textarea
                  className="admin-textarea"
                  rows={3}
                  value={item.message ?? ''}
                  onChange={e => updateItem(item.id, { message: e.target.value })}
                />
              </label>

              <div className="admin-row">
                <button className="admin-btn danger" onClick={() => removeItem(item.id)}>Delete entry</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminSaveBar dirty={dirty} saving={saving} error={error} onSave={save} />
    </div>
  )
}
