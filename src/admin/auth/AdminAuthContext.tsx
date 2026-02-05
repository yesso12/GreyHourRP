import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { clearAdminKey, getAdminKey, me, ping, setAdminKey } from '../api/client'

export type AdminIdentity = {
  user: string | null
  role: string | null
}

type AuthState = {
  checking: boolean
  loggedIn: boolean
  identity: AdminIdentity
  login: (key: string) => Promise<boolean>
  logout: () => void
  canAccess: (section: string) => boolean
}

const AdminAuthContext = createContext<AuthState | null>(null)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [identity, setIdentity] = useState<AdminIdentity>({
    user: null,
    role: null
  })

  async function refreshIdentity() {
    const info = await me()
    setIdentity({ user: info.user ?? null, role: info.role ?? null })
  }

  async function validate(key: string) {
    try {
      setAdminKey(key)
      await ping()
      await refreshIdentity()
      return true
    } catch {
      clearAdminKey()
      return false
    }
  }

  async function login(key: string) {
    const ok = await validate(key)
    setLoggedIn(ok)
    return ok
  }

  function logout() {
    clearAdminKey()
    setLoggedIn(false)
    setIdentity({ user: null, role: null })
  }

  useEffect(() => {
    const key = getAdminKey()
    if (!key) {
      setChecking(false)
      return
    }

    validate(key)
      .then(ok => setLoggedIn(ok))
      .finally(() => setChecking(false))
  }, [])

  const canAccess = useMemo(() => {
    return (section: string) => {
      const role = identity.role
      if (!role) return false
      if (role === 'owner') return true

      if (role === 'editor') return ['transmissions', 'updates', 'dashboard', 'activity', 'discord'].includes(section)
      if (role === 'ops') return ['server-status', 'status-history', 'mods', 'dashboard', 'activity'].includes(section)
      return false
    }
  }, [identity.role])

  return (
    <AdminAuthContext.Provider
      value={{ checking, loggedIn, identity, login, logout, canAccess }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used inside provider')
  return ctx
}
