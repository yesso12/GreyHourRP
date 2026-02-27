import { useEffect, useState } from 'react'
import type { ServerStatus } from '../../types/content'
import { loadServerStatus, saveContent } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

export function AdminServerStatus() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ServerStatus>({
    status: 'offline',
    message: ''
  })
  const statusTone = data.status === 'online' ? 'good' : data.status === 'maintenance' ? 'warn' : 'bad'
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadServerStatus()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  function update(patch: Partial<ServerStatus>) {
    setData(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveContent('server-status', data)
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
          <h1>Server Status</h1>
          <p className="admin-sub">Update the live status shown across the site.</p>
        </div>
      </div>

      {loading ? (
        <div className="admin-card">Loading status…</div>
      ) : (
        <div className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">Current Status</div>
            <div className={`admin-status ${statusTone}`}>
              <span className="admin-status-dot" />
              {data.status}
            </div>
          </div>
          <label className="admin-field">
            <span>Status</span>
            <select
              className="admin-input"
              value={data.status}
              onChange={e => update({ status: e.target.value as ServerStatus['status'] })}
            >
              <option value="online">Online</option>
              <option value="maintenance">Maintenance</option>
              <option value="offline">Offline</option>
            </select>
          </label>

          <label className="admin-field">
            <span>Message</span>
            <textarea
              className="admin-textarea"
              rows={4}
              value={data.message ?? ''}
              onChange={e => update({ message: e.target.value })}
            />
          </label>

          <div className="admin-hint">
            Saving status will automatically append a status history entry.
          </div>
        </div>
      )}

      <AdminSaveBar dirty={dirty} saving={saving} error={error} onSave={save} />
    </div>
  )
}
