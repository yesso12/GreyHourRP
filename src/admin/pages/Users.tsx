import { useEffect, useMemo, useState } from 'react'
import { deleteUser, listUsers, saveUser } from '../api/client'
import type { AdminRole } from '../../types/content'

const ROLES: AdminRole[] = ['owner', 'editor', 'ops']

export function AdminUsers() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<Record<string, AdminRole>>({})
  const [newUser, setNewUser] = useState('')
  const [newRole, setNewRole] = useState<AdminRole>('editor')
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | AdminRole>('all')

  function load() {
    setLoading(true)
    listUsers()
      .then(setUsers)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function addUser() {
    if (!newUser.trim()) return
    setError(null)
    try {
      await saveUser(newUser.trim(), newRole)
      setNewUser('')
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  async function updateUser(user: string, role: AdminRole) {
    setError(null)
    try {
      await saveUser(user, role)
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  async function removeUser(user: string) {
    if (!confirm(`Remove ${user}?`)) return
    setError(null)
    try {
      await deleteUser(user)
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.entries(users)
      .filter(([user, role]) => (filter === 'all' ? true : role === filter))
      .filter(([user]) => (q ? user.toLowerCase().includes(q) : true))
  }, [users, query, filter])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Security</div>
          <h1>Users & Roles</h1>
          <p className="admin-sub">Assign roles to staff who already exist in nginx Basic Auth.</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-grid three">
          <label className="admin-field">
            <span>Username</span>
            <input
              className="admin-input"
              value={newUser}
              onChange={e => setNewUser(e.target.value)}
              placeholder="username"
            />
          </label>
          <label className="admin-field">
            <span>Role</span>
            <select
              className="admin-input"
              value={newRole}
              onChange={e => setNewRole(e.target.value as AdminRole)}
            >
              {ROLES.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <div className="admin-field">
            <span>Action</span>
            <button className="admin-btn" onClick={addUser}>Add user</button>
          </div>
        </div>
        <div className="admin-hint">Users must already exist in the nginx password file.</div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-grid three">
          <label className="admin-field">
            <span>Search</span>
            <input
              className="admin-input small"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search usernames"
            />
          </label>
          <label className="admin-field">
            <span>Filter</span>
            <select
              className="admin-input small"
              value={filter}
              onChange={e => setFilter(e.target.value as 'all' | AdminRole)}
            >
              <option value="all">All</option>
              <option value="owner">Owner</option>
              <option value="editor">Editor</option>
              <option value="ops">Ops</option>
            </select>
          </label>
          <div className="admin-field">
            <span>Total</span>
            <div className="admin-text">{entries.length} users</div>
          </div>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <div className="admin-card">Loading users…</div>
      ) : entries.length === 0 ? (
        <div className="admin-card">No users match your filters.</div>
      ) : (
        <div className="admin-table" style={{ marginTop: 16 }}>
          <div className="admin-table-row header">
            <div>User</div>
            <div>Role</div>
            <div>Actions</div>
          </div>
          {entries.map(([user, role]) => (
            <div key={user} className="admin-table-row">
              <div>
                <div style={{ fontWeight: 700 }}>{user}</div>
                <div className="small">Active in nginx basic auth</div>
              </div>
              <select
                className="admin-input small"
                value={role}
                onChange={e => updateUser(user, e.target.value as AdminRole)}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button className="admin-btn danger" onClick={() => removeUser(user)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
