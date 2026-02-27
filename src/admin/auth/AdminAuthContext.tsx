import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearAdminSession,
  getAdminBasic,
  getAdminOidcToken,
  me,
  ping,
  setAdminBasic
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
  loginWithOidcToken: (token: string) => Promise<boolean>
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

  async function validateCurrentSession() {
    try {
      await ping()
      await refreshIdentity()
      return true
    } catch {
      return false
    }
  }

  async function validate(username: string, password: string) {
    try {
      setAdminBasic(username, password)
      return await validateCurrentSession()
    } catch {
      clearAdminSession()
      return false
    }
  }

  async function login(username: string, password: string) {
    const ok = await validate(username, password)
    setLoggedIn(ok)
    return ok
  }

  async function loginWithOidcToken(_token: string) {
    const ok = await validateCurrentSession()
    if (!ok) clearAdminSession()
    setLoggedIn(ok)
    return ok
  }

  function logout() {
    clearAdminSession()
    setLoggedIn(false)
    setIdentity({ user: null, role: null })
  }

  useEffect(() => {
    const oidcToken = getAdminOidcToken()
    if (oidcToken) {
      validateCurrentSession()
        .then(ok => {
          if (!ok) clearAdminSession()
          setLoggedIn(ok)
        })
        .finally(() => setChecking(false))
      return
    }

    const creds = getAdminBasic()
    if (!creds) {
      setChecking(false)
      return
    }

    validate(creds.username, creds.password)
      .then(ok => setLoggedIn(ok))
      .finally(() => setChecking(false))
  }, [])

  const canAccess = useMemo(() => {
    return (section: string) => {
      const role = identity.role
      if (!role) return false
      if (role === 'owner') return true

      if (role === 'editor') return ['dashboard', 'updates', 'activity', 'server-control', 'loadouts', 'governance', 'item-codes', 'discord', 'discord-routing', 'ops'].includes(section)
      if (role === 'ops') return ['dashboard', 'activity', 'server-control', 'loadouts', 'governance', 'item-codes', 'ops', 'discord', 'discord-routing'].includes(section)
      return false
    }
  }, [identity.role])

  return (
    <AdminAuthContext.Provider
      value={{ checking, loggedIn, identity, login, loginWithOidcToken, logout, canAccess }}
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
