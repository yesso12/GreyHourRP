import { useEffect, useMemo, useState } from 'react'
import { getContent } from '../api/client'
import { ammoOrMagazineHint } from '../../lib/itemHints'

type ItemRow = {
  code: string
  name: string
  category?: string
}

type ItemCatalogPayload = {
  items?: Array<{ code?: string; name?: string; category?: string }>
}

function safeCopy(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const input = document.createElement('textarea')
  input.value = text
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  input.remove()
  return Promise.resolve()
}

export function AdminItemCodes() {
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ItemRow[]>([])
  const [playerName, setPlayerName] = useState('playername')
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    getContent<ItemCatalogPayload>('items-catalog')
      .then((payload) => {
        const mapped = (payload.items ?? [])
          .map((x) => ({
            code: String(x.code ?? '').trim(),
            name: String(x.name ?? '').trim(),
            category: x.category ? String(x.category).trim() : ''
          }))
          .filter((x) => x.code && x.name)
          .sort((a, b) => a.code.localeCompare(b.code))
        setItems(mapped)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((x) =>
      x.code.toLowerCase().includes(q)
      || x.name.toLowerCase().includes(q)
      || String(x.category ?? '').toLowerCase().includes(q)
    )
  }, [items, query])

  async function copyCode(code: string) {
    await safeCopy(code)
    setCopied(`Copied code: ${code}`)
    setTimeout(() => setCopied(''), 1800)
  }

  async function copyCommand(code: string) {
    const cmd = `additem \"${playerName || 'playername'}\" \"${code}\" 1`
    await safeCopy(cmd)
    setCopied(`Copied command: ${cmd}`)
    setTimeout(() => setCopied(''), 2400)
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Easy Tools</div>
          <h1>All Item Codes</h1>
          <p className="admin-sub">Search any item and copy code or ready-to-run command.</p>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 14 }}>
        <div className="admin-grid two">
          <label className="admin-field">
            <span>Search by item name, code, or category</span>
            <input
              className="admin-input"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Example: Base.WaterBottleFull or axe"
            />
          </label>
          <label className="admin-field">
            <span>Player Name for command copy</span>
            <input
              className="admin-input"
              value={playerName}
              onChange={(e) => setPlayerName(e.currentTarget.value)}
              placeholder="playername"
            />
          </label>
        </div>
        <div className="admin-card-sub" style={{ marginTop: 8 }}>
          Showing {filtered.length} of {items.length} items.
        </div>
      </div>

      {loading && <div className="admin-notice">Loading item codes...</div>}
      {error && <div className="admin-notice warn">{error}</div>}
      {copied && <div className="admin-notice success">{copied}</div>}

      <div className="admin-list">
        {filtered.slice(0, 1500).map((item) => {
          const hint = ammoOrMagazineHint(item)
          return (
            <div key={item.code} className="admin-list-item">
              <div>
                <div className="admin-list-title">{item.name}</div>
                <div className="admin-list-sub">
                  {item.code}
                  {hint ? ` • ${hint}` : ''}
                  {item.category ? ` • ${item.category}` : ''}
                </div>
              </div>
              <div className="admin-list-actions">
                <button className="admin-btn" onClick={() => void copyCode(item.code)}>Copy Code</button>
                <button className="admin-btn" onClick={() => void copyCommand(item.code)}>Copy Command</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
