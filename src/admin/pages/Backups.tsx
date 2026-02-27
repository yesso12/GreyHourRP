import { useEffect, useState } from 'react'
import { listBackups, restoreBackup } from '../api/client'

const CONTENT = [
  { id: 'transmissions', label: 'Transmissions' },
  { id: 'updates', label: 'Updates' },
  { id: 'server-status', label: 'Server Status' },
  { id: 'status-history', label: 'Status History' },
  { id: 'mods', label: 'Mods' }
]

export function AdminBackups() {
  const [content, setContent] = useState(CONTENT[0].id)
  const [items, setItems] = useState<Array<{ file: string; size: number; modifiedUtc: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    listBackups(content)
      .then(setItems)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [content])

  async function restore(file: string) {
    if (!confirm(`Restore ${file}? A backup of current content will be created first.`)) return
    setError(null)
    try {
      await restoreBackup(content, file)
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Recovery</div>
          <h1>Backups</h1>
          <p className="admin-sub">Automatic backups are created before every write. Restore any previous version.</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-grid two">
          <label className="admin-field">
            <span>Content type</span>
            <select className="admin-input" value={content} onChange={e => setContent(e.target.value)}>
              {CONTENT.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <div className="admin-field">
            <span>Retention</span>
            <div className="admin-text">Stored on disk by timestamp.</div>
          </div>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-card">Loading backups…</div>
      ) : items.length === 0 ? (
        <div className="admin-card admin-empty">No backups available for this content yet.</div>
      ) : (
        <div className="admin-list" style={{ marginTop: 16 }}>
          {items.map(item => (
            <div key={item.file} className="admin-list-item">
              <div>
                <div className="admin-list-title">{item.file}</div>
                <div className="admin-list-sub">
                  {new Date(item.modifiedUtc).toLocaleString()} · {(item.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button className="admin-btn" onClick={() => restore(item.file)}>
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
