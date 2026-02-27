const OIDC_STATE_KEY = 'ghrp_oidc_state'
const OIDC_VERIFIER_KEY = 'ghrp_oidc_verifier'

type OidcConfig = {
  issuer: string
  clientId: string
  redirectUri: string
  scope: string
  audience: string
}

type OidcDiscovery = {
  authorization_endpoint: string
  token_endpoint: string
}

function cfg(): OidcConfig {
  const issuer = (import.meta.env.VITE_OIDC_ISSUER as string | undefined)?.trim() ?? ''
  const clientId = (import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined)?.trim() ?? ''
  const redirectUri =
    (import.meta.env.VITE_OIDC_REDIRECT_URI as string | undefined)?.trim() ||
    `${window.location.origin}/admin/login`
  const scope =
    (import.meta.env.VITE_OIDC_SCOPE as string | undefined)?.trim() ||
    'openid profile email'
  const audience =
    (import.meta.env.VITE_OIDC_AUDIENCE as string | undefined)?.trim() ||
    ''

  return { issuer, clientId, redirectUri, scope, audience }
}

export function isOidcConfigured() {
  const c = cfg()
  return Boolean(c.issuer && c.clientId)
}

function b64UrlEncode(input: ArrayBuffer) {
  const bytes = new Uint8Array(input)
  let out = ''
  bytes.forEach((b) => {
    out += String.fromCharCode(b)
  })
  return btoa(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('')
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text)
  return crypto.subtle.digest('SHA-256', data)
}

async function discover(issuer: string): Promise<OidcDiscovery> {
  const base = issuer.replace(/\/+$/, '')
  const res = await fetch(`${base}/.well-known/openid-configuration`)
  if (!res.ok) {
    throw new Error(`OIDC discovery failed (${res.status})`)
  }
  return res.json() as Promise<OidcDiscovery>
}

export async function beginOidcLogin() {
  const c = cfg()
  if (!c.issuer || !c.clientId) {
    throw new Error('OIDC is not configured.')
  }

  const d = await discover(c.issuer)
  const state = randomString(48)
  const verifier = randomString(96)
  const challenge = b64UrlEncode(await sha256(verifier))

  sessionStorage.setItem(OIDC_STATE_KEY, state)
  sessionStorage.setItem(OIDC_VERIFIER_KEY, verifier)

  const url = new URL(d.authorization_endpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', c.clientId)
  url.searchParams.set('redirect_uri', c.redirectUri)
  url.searchParams.set('scope', c.scope)
  if (c.audience) {
    url.searchParams.set('audience', c.audience)
  }
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')

  window.location.assign(url.toString())
}

export async function exchangeOidcCode(code: string, state: string): Promise<string> {
  const c = cfg()
  const savedState = sessionStorage.getItem(OIDC_STATE_KEY)
  const verifier = sessionStorage.getItem(OIDC_VERIFIER_KEY)

  if (!savedState || savedState !== state) {
    throw new Error('OIDC state mismatch. Please try login again.')
  }
  if (!verifier) {
    throw new Error('OIDC verifier missing. Please try login again.')
  }

  const d = await discover(c.issuer)
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('client_id', c.clientId)
  body.set('code', code)
  body.set('redirect_uri', c.redirectUri)
  body.set('code_verifier', verifier)

  const res = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OIDC token exchange failed (${res.status}) ${text}`.trim())
  }

  const payload = await res.json() as { access_token?: string }
  const token = payload.access_token
  if (!token) {
    throw new Error('OIDC provider did not return an access token.')
  }

  sessionStorage.removeItem(OIDC_STATE_KEY)
  sessionStorage.removeItem(OIDC_VERIFIER_KEY)
  return token
}
