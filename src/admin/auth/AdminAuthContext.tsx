import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearAdminToken,
  getAdminToken,
  loginWithPassword,
  logoutRequest,
  me,
  ping,
  session,
  setAdminToken
} from '../api/client'

export type AdminIdentity = {
  user: string | null
  role: string | null
}

type AuthState = {
  checking: boolean
  loggedIn: boolean
  identity: AdminIdentity
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void | Promise<void>
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

  async function validate(token: string) {
    try {
      setAdminToken(token)
      await session()
      await ping()
      await refreshIdentity()
      return true
    } catch {
      clearAdminToken()
      return false
    }
  }

  async function login(username: string, password: string) {
    try {
      const auth = await loginWithPassword(username, password)
      if (!auth?.token) {
        setLoggedIn(false)
        return false
      }
      const ok = await validate(auth.token)
      setLoggedIn(ok)
      return ok
    } catch {
      setLoggedIn(false)
      return false
    }
  }

  async function logout() {
    try {
      await logoutRequest()
    } catch {
      // Best effort; clear local token regardless.
    }
    clearAdminToken()
    setLoggedIn(false)
    setIdentity({ user: null, role: null })
  }

  useEffect(() => {
    const token = getAdminToken()
    if (!token) {
      setChecking(false)
      return
    }

    validate(token)
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
