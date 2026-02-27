import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchJson } from '../components/utils'

const FALLBACK_INVITE = 'https://discord.gg/wCUJckSk3s'
let cachedInviteUrl = FALLBACK_INVITE
let inviteLoaded = false
let invitePromise: Promise<string> | null = null

type SiteSettingsPayload = {
  discordInviteUrl?: string
}

function sanitizePath(pathname: string) {
  return pathname.replace(/^\/+/, '').replace(/\/+/g, '_') || 'home'
}

export function useDiscordInvite(placement?: string) {
  const [inviteUrl, setInviteUrl] = useState(cachedInviteUrl)
  const location = useLocation()

  useEffect(() => {
    let mounted = true
    if (inviteLoaded) {
      setInviteUrl(cachedInviteUrl)
      return () => {
        mounted = false
      }
    }

    if (!invitePromise) {
      invitePromise = fetchJson<SiteSettingsPayload>('/content/site-settings.json')
        .then((payload) => {
          const next = String(payload.discordInviteUrl ?? '').trim()
          if (next) {
            cachedInviteUrl = next
          }
          inviteLoaded = true
          return cachedInviteUrl
        })
        .catch(() => {
          inviteLoaded = true
          return cachedInviteUrl
        })
    }

    invitePromise.then((resolved) => {
      if (!mounted) return
      setInviteUrl(resolved)
    })

    return () => {
      mounted = false
    }
  }, [])

  return useMemo(() => {
    try {
      const url = new URL(inviteUrl)
      const path = sanitizePath(location.pathname)
      url.searchParams.set('utm_source', 'greyhourrp_site')
      url.searchParams.set('utm_medium', 'website')
      url.searchParams.set('utm_campaign', 'player_recruitment')
      url.searchParams.set('utm_term', path)
      if (placement) {
        url.searchParams.set('utm_content', placement)
      } else {
        url.searchParams.set('utm_content', `route_${path}`)
      }
      return url.toString()
    } catch {
      return inviteUrl
    }
  }, [inviteUrl, location.pathname, placement])
}
