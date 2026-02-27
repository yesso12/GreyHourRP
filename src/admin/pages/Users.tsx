import { useEffect, useMemo, useState } from 'react'
import {
  createUserResetTicket,
  deleteUser,
  listUserResetTickets,
  listUsers,
  revokeUserResetTicket,
  saveUser,
  type ActiveResetTicket
} from '../api/client'
import type { AdminRole, AdminUserMap } from '../../types/content'

const ROLES: AdminRole[] = ['owner', 'editor', 'ops']

export function AdminUsers() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUserMap>({})
  const [newUser, setNewUser] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<AdminRole>('editor')
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | AdminRole>('all')
  const [passwordEdits, setPasswordEdits] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [resetTicket, setResetTicket] = useState<null | {
    user: string
    ticketId: string
    code: string
    expiresUtc: string
  }>(null)
  const [showResetCode, setShowResetCode] = useState(false)
  const [ticketsByUser, setTicketsByUser] = useState<Record<string, ActiveResetTicket[]>>({})
  const [ticketsOpenByUser, setTicketsOpenByUser] = useState<Record<string, boolean>>({})
  const [nowTick, setNowTick] = useState(Date.now())

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

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  async function addUser() {
    if (!newUser.trim() || !newPassword.trim()) return
    setError(null)
    try {
      await saveUser(newUser.trim(), newRole, newPassword)
      setNewUser('')
      setNewPassword('')
      setNotice(`Created user ${newUser.trim()}.`)
      setTimeout(() => setNotice(null), 2500)
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  async function updateUser(user: string, role: AdminRole) {
    setError(null)
    try {
      await saveUser(user, role)
      setNotice(`Updated role for ${user}.`)
      setTimeout(() => setNotice(null), 2500)
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
      setNotice(`Removed user ${user}.`)
      setTimeout(() => setNotice(null), 2500)
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  async function resetPassword(user: string) {
    const password = (passwordEdits[user] ?? '').trim()
    if (!password) return
    setError(null)
    try {
      await saveUser(user, users[user].role, password)
      setPasswordEdits(prev => ({ ...prev, [user]: '' }))
      setNotice(`Password updated for ${user}.`)
      setTimeout(() => setNotice(null), 2500)
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  async function issueResetTicket(user: string) {
    setError(null)
    try {
      const ticket = await createUserResetTicket(user, 15)
      setResetTicket(ticket)
      setShowResetCode(false)
      setNotice(`Issued reset ticket for ${user}.`)
      setTimeout(() => setNotice(null), 2500)
      await refreshUserTickets(user)
    } catch (err) {
      setError(String(err))
    }
  }

  async function refreshUserTickets(user: string) {
    try {
      const items = await listUserResetTickets(user)
      setTicketsByUser(prev => ({ ...prev, [user]: items }))
    } catch (err) {
      setError(String(err))
    }
  }

  async function toggleUserTickets(user: string) {
    const open = !(ticketsOpenByUser[user] ?? false)
    setTicketsOpenByUser(prev => ({ ...prev, [user]: open }))
    if (open) await refreshUserTickets(user)
  }

  async function revokeTicket(user: string, ticketId: string) {
    if (!confirm(`Revoke ticket ${ticketId} for ${user}?`)) return
    setError(null)
    try {
      await revokeUserResetTicket(user, ticketId)
      await refreshUserTickets(user)
      setNotice(`Revoked ticket ${ticketId}.`)
      setTimeout(() => setNotice(null), 2500)
    } catch (err) {
      setError(String(err))
    }
  }

  function expiryText(iso: string) {
    const ms = new Date(iso).getTime() - nowTick
    if (!Number.isFinite(ms)) return 'Unknown expiry'
    if (ms <= 0) return 'Expired'
    const total = Math.floor(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}m ${String(s).padStart(2, '0')}s`
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`${label} copied.`)
      setTimeout(() => setNotice(null), 2000)
    } catch {
      setError(`Could not copy ${label}.`)
    }
  }

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.entries(users as AdminUserMap)
      .filter(([, row]) => (filter === 'all' ? true : row.role === filter))
      .filter(([user]) => (q ? user.toLowerCase().includes(q) : true))
  }, [users, query, filter])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Security</div>
          <h1>Users & Roles</h1>
          <p className="admin-sub">Create and manage admin login accounts with roles and passwords.</p>
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
            <span>Password</span>
            <input
              className="admin-input"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="min 10 chars"
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
          <div className="admin-field" style={{ gridColumn: '1 / -1' }}>
            <span>Action</span>
            <button className="admin-btn" onClick={addUser}>Add user</button>
          </div>
        </div>
        <div className="admin-hint">This creates login access directly in the admin API credential store.</div>
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
      {notice && <div className="admin-notice success">{notice}</div>}
      {resetTicket && (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-card-header">
            <div>
              <div className="admin-card-eyebrow">Security</div>
              <div className="admin-card-title">Recovery Ticket</div>
            </div>
          </div>
          <div className="admin-text">User: {resetTicket.user}</div>
          <div className="admin-row" style={{ justifyContent: 'flex-start', marginTop: 6 }}>
            <div className="admin-text">Ticket ID: {resetTicket.ticketId}</div>
            <button className="admin-btn" onClick={() => copy(resetTicket.ticketId, 'Ticket ID')}>Copy ID</button>
          </div>
          <div className="admin-row" style={{ justifyContent: 'flex-start', marginTop: 6 }}>
            <div className="admin-text">
              Recovery Code: {showResetCode ? resetTicket.code : '••••••••••••'}
            </div>
            <button className="admin-btn" onClick={() => setShowResetCode(v => !v)}>
              {showResetCode ? 'Mask' : 'Show'}
            </button>
            <button className="admin-btn" onClick={() => copy(resetTicket.code, 'Recovery code')}>Copy Code</button>
          </div>
          <div className="admin-hint">
            Expires: {new Date(resetTicket.expiresUtc).toLocaleString()} ({expiryText(resetTicket.expiresUtc)}).
            Share this securely with the user one time only.
          </div>
          <div className="admin-row">
            <button className="admin-btn" onClick={() => setResetTicket(null)}>Hide</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="admin-card">Loading users…</div>
      ) : entries.length === 0 ? (
        <div className="admin-card admin-empty">No users match your filters.</div>
      ) : (
        <div className="admin-table" style={{ marginTop: 16 }}>
          <div className="admin-table-row header">
            <div>User</div>
            <div>Role</div>
            <div>Password</div>
            <div>Actions</div>
          </div>
          {entries.map(([user, info]) => (
            <div key={user} className="admin-table-row">
              <div>
                <div style={{ fontWeight: 700 }}>{user}</div>
                <div className="small">
                  {info.hasPassword ? 'Password set' : 'No password set'}
                </div>
              </div>
              <select
                className="admin-input small"
                value={info.role}
                onChange={e => updateUser(user, e.target.value as AdminRole)}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <input
                className="admin-input small"
                type="password"
                value={passwordEdits[user] ?? ''}
                onChange={e => setPasswordEdits(prev => ({ ...prev, [user]: e.target.value }))}
                placeholder="new password"
              />
              <div className="admin-row" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
                <button className="admin-btn" onClick={() => resetPassword(user)} disabled={!(passwordEdits[user] ?? '').trim()}>
                  Set Password
                </button>
                <button className="admin-btn" onClick={() => issueResetTicket(user)}>
                  Issue Reset Ticket
                </button>
                <button className="admin-btn" onClick={() => toggleUserTickets(user)}>
                  {(ticketsOpenByUser[user] ?? false) ? 'Hide Tickets' : 'View Tickets'}
                </button>
                <button className="admin-btn danger" onClick={() => removeUser(user)}>
                  Remove
                </button>
              </div>
              {(ticketsOpenByUser[user] ?? false) && (
                <div style={{ gridColumn: '1 / -1' }}>
                  {(ticketsByUser[user] ?? []).length === 0 ? (
                    <div className="admin-hint admin-empty">No active reset tickets.</div>
                  ) : (
                    <div className="admin-list">
                      {(ticketsByUser[user] ?? []).map(ticket => (
                        <div key={ticket.ticketId} className="admin-list-item">
                          <div>
                            <div className="admin-list-title">{ticket.ticketId}</div>
                            <div className="admin-list-sub">
                              Created {new Date(ticket.createdUtc).toLocaleString()} by {ticket.createdBy}
                            </div>
                            <div className="admin-list-sub">
                              Expires in {expiryText(ticket.expiresUtc)}
                            </div>
                          </div>
                          <div className="admin-row" style={{ marginTop: 0 }}>
                            <button className="admin-btn" onClick={() => copy(ticket.ticketId, 'Ticket ID')}>
                              Copy ID
                            </button>
                            <button className="admin-btn danger" onClick={() => revokeTicket(user, ticket.ticketId)}>
                              Revoke
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
