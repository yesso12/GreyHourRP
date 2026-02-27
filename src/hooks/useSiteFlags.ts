import { useEffect, useState } from 'react'
import { fetchJson } from '../components/utils'
import type { SiteFlags } from '../types/content'

const DEFAULT_FLAGS: SiteFlags = {
  showMods: true,
  showUpdates: true,
  showEvents: true,
  showFactions: true,
  showDirectory: true,
  showDossiers: false,
  showEconomy: false,
  showLevels: true,
  showTransmissions: true,
  showDiscordPage: true,
  showHowToJoin: true,
  showStaff: true
}

export function useSiteFlags() {
  const [flags, setFlags] = useState<SiteFlags>(DEFAULT_FLAGS)

  useEffect(() => {
    let mounted = true
    fetchJson<SiteFlags>('/content/site-flags.json')
      .then((payload) => {
        if (!mounted) return
        setFlags({ ...DEFAULT_FLAGS, ...(payload ?? {}) })
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [])

  return flags
}
