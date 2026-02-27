import { useEffect, useMemo, useState } from 'react'
import type { EventCalendar, EventItem, EventStatus } from '../../types/content'
import { loadEventCalendar, saveEventCalendar } from '../api/client'
import { AdminSaveBar } from '../../components/AdminSaveBar'

const statusOptions: Array<{ id: EventStatus; label: string }> = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'open', label: 'Open' },
  { id: 'full', label: 'Full' },
  { id: 'complete', label: 'Complete' },
  { id: 'canceled', label: 'Canceled' }
]

function newId() {
  return (crypto as any)?.randomUUID?.() ?? `event-${Date.now()}`
}

function normalizeEvent(row: Partial<EventItem>, index: number): EventItem {
  return {
    id: String(row.id ?? `event-${index}`),
    title: String(row.title ?? 'New Event'),
    status: (row.status ?? 'scheduled') as EventStatus,
    summary: row.summary ? String(row.summary) : '',
    location: row.location ? String(row.location) : '',
    startUtc: row.startUtc ? String(row.startUtc) : new Date().toISOString(),
    endUtc: row.endUtc ? String(row.endUtc) : '',
    capacity: typeof row.capacity === 'number' ? row.capacity : 0,
    waitlistEnabled: Boolean(row.waitlistEnabled),
    factionId: row.factionId ? String(row.factionId) : '',
    tags: Array.isArray(row.tags) ? row.tags.map(item => String(item)).filter(Boolean) : [],
    host: row.host ? String(row.host) : '',
    link: row.link ? String(row.link) : '',
    createdUtc: row.createdUtc ? String(row.createdUtc) : ''
  }
}

function defaultCalendar(): EventCalendar {
  return {
    updatedUtc: new Date().toISOString(),
    timezone: 'UTC',
    notes: [],
    events: []
  }
}

export function AdminEvents() {
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendar, setCalendar] = useState<EventCalendar>(defaultCalendar())
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('all')

  useEffect(() => {
    loadEventCalendar()
      .then((payload) => {
        const next: EventCalendar = {
          ...defaultCalendar(),
          ...payload,
          events: (payload?.events ?? []).map(normalizeEvent)
        }
        setCalendar(next)
      })
      .catch(() => setCalendar(defaultCalendar()))
      .finally(() => setLoading(false))
  }, [])

  function updateRoot(patch: Partial<EventCalendar>) {
    setCalendar(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }

  function updateEvent(id: string, patch: Partial<EventItem>) {
    setCalendar(prev => ({
      ...prev,
      events: prev.events.map(item => (item.id === id ? { ...item, ...patch } : item))
    }))
    setDirty(true)
  }

  function addEvent() {
    const now = new Date().toISOString()
    const entry: EventItem = normalizeEvent({ id: newId(), createdUtc: now, startUtc: now }, calendar.events.length)
    setCalendar(prev => ({ ...prev, events: [entry, ...prev.events] }))
    setDirty(true)
  }

  function removeEvent(id: string) {
    if (!confirm('Delete this event?')) return
    setCalendar(prev => ({ ...prev, events: prev.events.filter(item => item.id !== id) }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveEventCalendar({ ...calendar, updatedUtc: new Date().toISOString() })
      setDirty(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return calendar.events.filter(item => {
      const matchesText =
        !q || `${item.title} ${item.location ?? ''} ${item.summary ?? ''}`.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      return matchesText && matchesStatus
    })
  }, [calendar.events, query, statusFilter])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Live Ops</div>
          <h1>Event Calendar</h1>
          <p className="admin-sub">
            Publish in-world events with RSVPs, capacity, and faction tie-ins.
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" onClick={addEvent}>Add event</button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-grid three">
          <label className="admin-field">
            <span>Search</span>
            <input
              className="admin-input small"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search events"
            />
          </label>
          <label className="admin-field">
            <span>Status</span>
            <select
              className="admin-input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as EventStatus | 'all')}
            >
              <option value="all">All</option>
              {statusOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Timezone label</span>
            <input
              className="admin-input"
              value={calendar.timezone ?? 'UTC'}
              onChange={e => updateRoot({ timezone: e.target.value })}
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
        <div className="admin-card">Loading events…</div>
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
                    onChange={e => updateEvent(item.id, { title: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Status</span>
                  <select
                    className="admin-input"
                    value={item.status}
                    onChange={e => updateEvent(item.id, { status: e.target.value as EventStatus })}
                  >
                    {statusOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="admin-field">
                <span>Summary</span>
                <textarea
                  className="admin-input"
                  rows={3}
                  value={item.summary ?? ''}
                  onChange={e => updateEvent(item.id, { summary: e.target.value })}
                />
              </label>

              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Location</span>
                  <input
                    className="admin-input"
                    value={item.location ?? ''}
                    onChange={e => updateEvent(item.id, { location: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Host</span>
                  <input
                    className="admin-input"
                    value={item.host ?? ''}
                    onChange={e => updateEvent(item.id, { host: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Faction ID</span>
                  <input
                    className="admin-input"
                    value={item.factionId ?? ''}
                    onChange={e => updateEvent(item.id, { factionId: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-grid three">
                <label className="admin-field">
                  <span>Start UTC</span>
                  <input
                    className="admin-input"
                    value={item.startUtc}
                    onChange={e => updateEvent(item.id, { startUtc: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>End UTC</span>
                  <input
                    className="admin-input"
                    value={item.endUtc ?? ''}
                    onChange={e => updateEvent(item.id, { endUtc: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Capacity</span>
                  <input
                    className="admin-input"
                    type="number"
                    value={item.capacity ?? 0}
                    onChange={e => updateEvent(item.id, { capacity: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="admin-grid two">
                <label className="admin-field checkbox" style={{ alignSelf: 'end' }}>
                  <input
                    type="checkbox"
                    checked={item.waitlistEnabled ?? false}
                    onChange={e => updateEvent(item.id, { waitlistEnabled: e.target.checked })}
                  />
                  <span>Waitlist enabled</span>
                </label>
                <label className="admin-field">
                  <span>Tags (comma-separated)</span>
                  <input
                    className="admin-input"
                    value={(item.tags ?? []).join(', ')}
                    onChange={e => updateEvent(item.id, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  />
                </label>
              </div>

              <label className="admin-field">
                <span>External link (optional)</span>
                <input
                  className="admin-input"
                  value={item.link ?? ''}
                  onChange={e => updateEvent(item.id, { link: e.target.value })}
                />
              </label>

              <div className="admin-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="admin-btn ghost" onClick={() => removeEvent(item.id)}>
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
