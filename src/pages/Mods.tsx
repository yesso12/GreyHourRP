import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { ModItem } from '../types/content'

type RequiredFilter = 'all' | 'required' | 'optional'

function uniq(arr: string[]) {
  return Array.from(new Set(arr)).filter(Boolean)
}

export function Mods() {
  const [items, setItems] = useState<ModItem[]>([])
  const [query, setQuery] = useState('')
  const [requiredFilter, setRequiredFilter] = useState<RequiredFilter>('all')
  const [category, setCategory] = useState<string>('All')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<ModItem[]>('/content/mods.json')
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const categories = useMemo(() => {
    const cats = uniq(items.map(m => (m.category ?? 'General').trim()))
    cats.sort((a, b) => a.localeCompare(b))
    return ['All', ...cats]
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return items.filter(m => {
      const cat = (m.category ?? 'General').trim()
      const req = m.required !== false

      const matchesText =
        q.length === 0 ||
        m.name.toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.workshopId ?? '').toLowerCase().includes(q) ||
        (m.modId ?? '').toLowerCase().includes(q)

      const matchesRequired =
        requiredFilter === 'all' ||
        (requiredFilter === 'required' && req) ||
        (requiredFilter === 'optional' && !req)

      const matchesCategory = category === 'All' || cat === category

      return matchesText && matchesRequired && matchesCategory
    })
  }, [items, query, requiredFilter, category])

  const requiredCount = useMemo(() => items.filter(m => m.required !== false).length, [items])
  const optionalCount = useMemo(() => items.filter(m => m.required === false).length, [items])

  function flashCopied(label: string) {
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1400)
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      flashCopied(label)
    } catch {
      alert('Copy failed (browser blocked clipboard). You can select + copy manually.')
    }
  }

  function buildWorkshopIds(list: ModItem[]) {
    return uniq(list.map(m => (m.workshopId ?? '').trim())).join(';')
  }

  function buildModIds(list: ModItem[]) {
    return uniq(list.map(m => (m.modId ?? '').trim())).join(';')
  }

  const requiredList = filtered.filter(m => m.required !== false)
  const optionalList = filtered.filter(m => m.required === false)

  const workshopAll = buildWorkshopIds(filtered)
  const workshopReq = buildWorkshopIds(requiredList)
  const workshopOpt = buildWorkshopIds(optionalList)

  const modIdsAll = buildModIds(filtered)
  const modIdsReq = buildModIds(requiredList)
  const modIdsOpt = buildModIds(optionalList)

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Armory Loadout</span></div>
            <h1 className="hero-title">The Grey Hour modpack.</h1>
            <div className="p" style={{ maxWidth: 820 }}>
              Curated for stability, realism, and long-term survival RP. Required mods keep everyone on the same page.
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Filters" title="Find the right modules">
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Search mods (name, description, workshop id)…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />

          <select
            className="input"
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{ minWidth: 180 }}
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="input"
            value={requiredFilter}
            onChange={e => setRequiredFilter(e.target.value as RequiredFilter)}
            style={{ minWidth: 160 }}
          >
            <option value="all">All</option>
            <option value="required">Required</option>
            <option value="optional">Optional</option>
          </select>
        </div>
      </Section>

      <Section eyebrow="Copy" title="Export your loadout">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 760 }}>Copy Strings</div>
              <div className="small">
                {filtered.length} shown • {requiredCount} required • {optionalCount} optional
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => copyText('Workshop IDs', workshopAll)}>
                Copy Workshop IDs
              </button>
              {modIdsAll && (
                <button className="btn btn-ghost" onClick={() => copyText('Mod IDs', modIdsAll)}>
                  Copy Mod IDs
                </button>
              )}
            </div>
          </div>

          <div className="hr" />

          <div className="small" style={{ marginBottom: 8 }}>
            Workshop IDs (filtered):
          </div>
          <div className="card" style={{ padding: 12, overflowX: 'auto' }}>
            <code>{workshopAll || '(none found)'}</code>
          </div>

          {modIdsAll && (
            <>
              <div className="small" style={{ marginTop: 12, marginBottom: 8 }}>
                Mod IDs (filtered):
              </div>
              <div className="card" style={{ padding: 12, overflowX: 'auto' }}>
                <code>{modIdsAll}</code>
              </div>
            </>
          )}

          {copied && (
            <div className="small" style={{ marginTop: 10 }}>
              Copied {copied}
            </div>
          )}
        </div>
      </Section>

      <Section eyebrow="List" title="Available mods">
        {filtered.length === 0 && (
          <div className="card">
            <div className="small">No mods match your filters.</div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(m => {
            const req = m.required !== false
            const cat = (m.category ?? 'General').trim()
            const steamUrl = m.workshopId
              ? `https://steamcommunity.com/sharedfiles/filedetails/?id=${encodeURIComponent(m.workshopId)}`
              : null

            return (
              <div key={m.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 760 }}>{m.name}</div>
                    <div className="small">
                      {cat} • {req ? 'REQUIRED' : 'OPTIONAL'}
                      {m.workshopId ? ` • Workshop: ${m.workshopId}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {steamUrl && (
                      <a className="btn btn-ghost" href={steamUrl} target="_blank" rel="noreferrer">
                        View on Steam
                      </a>
                    )}
                    {m.workshopId && (
                      <button className="btn btn-ghost" onClick={() => copyText('Workshop ID', m.workshopId!)}>
                        Copy ID
                      </button>
                    )}
                  </div>
                </div>

                {m.description?.trim() && (
                  <div className="p" style={{ marginTop: 10 }}>
                    {m.description}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {(workshopReq || workshopOpt) && (
        <Section eyebrow="Quick Split" title="Required vs optional">
          <div className="card">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => copyText('Required Workshop IDs', workshopReq)}>
                Copy Required IDs
              </button>
              <button className="btn btn-ghost" onClick={() => copyText('Optional Workshop IDs', workshopOpt)}>
                Copy Optional IDs
              </button>

              {modIdsReq && (
                <button className="btn" onClick={() => copyText('Required Mod IDs', modIdsReq)}>
                  Copy Required Mod IDs
                </button>
              )}
              {modIdsOpt && (
                <button className="btn btn-ghost" onClick={() => copyText('Optional Mod IDs', modIdsOpt)}>
                  Copy Optional Mod IDs
                </button>
              )}
            </div>
          </div>
        </Section>
      )}
    </div>
  )
}
