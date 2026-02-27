import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PublicLiveSnapshot, ServerStatus } from '../types/content'
import { loadPublicLiveSnapshot } from '../api/liveClient'

type PublicLiveContextValue = {
  live: PublicLiveSnapshot | null
  loading: boolean
  refreshing: boolean
  error: string | null
  checkedAt: string | null
  serverStatus: ServerStatus['status']
  refresh: () => Promise<void>
}

const PublicLiveContext = createContext<PublicLiveContextValue | null>(null)

export function PublicLiveProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<PublicLiveSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [serverStatus, setServerStatus] = useState<ServerStatus['status']>('online')

  const runRefresh = useCallback(async (background: boolean) => {
    if (background) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const snapshot = await loadPublicLiveSnapshot()
      setLive(snapshot)
      setServerStatus(snapshot.gameServer.status)
      setError(null)
      setCheckedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setServerStatus('offline')
      setError(err instanceof Error ? err.message : String(err))
      setCheckedAt(new Date().toLocaleTimeString())
    } finally {
      if (background) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const runInitial = async () => {
      if (!mounted) return
      await runRefresh(false)
    }
    runInitial()

    const id = window.setInterval(() => {
      if (!mounted) return
      runRefresh(true).catch(() => {})
    }, 45000)

    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [runRefresh])

  const value = useMemo<PublicLiveContextValue>(
    () => ({
      live,
      loading,
      refreshing,
      error,
      checkedAt,
      serverStatus,
      refresh: () => runRefresh(true)
    }),
    [checkedAt, error, live, loading, refreshing, runRefresh, serverStatus]
  )

  return <PublicLiveContext.Provider value={value}>{children}</PublicLiveContext.Provider>
}

export function usePublicLive() {
  return useContext(PublicLiveContext)
}

