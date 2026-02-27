import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { ConversionStrip } from '../components/ConversionStrip'
import { fetchJson } from '../components/utils'
import type { ModItem, ModsChangeLogPayload } from '../types/content'
import { useDiscordInvite } from '../hooks/useDiscordInvite'

type RequiredFilter = 'all' | 'required' | 'optional'

function uniq(arr: string[]) {
  return Array.from(new Set(arr)).filter(Boolean)
}

export function Mods() {
  const discordInviteUrl = useDiscordInvite('mods_primary_cta')
  const [items, setItems] = useState<ModItem[]>([])
  const [modsChangeEntries, setModsChangeEntries] = useState<ModsChangeLogPayload['entries']>([])
  const [modsChangeUpdatedUtc, setModsChangeUpdatedUtc] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [requiredFilter, setRequiredFilter] = useState<RequiredFilter>('all')
  const [category, setCategory] = useState<string>('All')
  const [compactView, setCompactView] = useState(true)

  useEffect(() => {
    fetchJson<ModItem[]>('/content/mods.json')
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  useEffect(() => {
    fetchJson<ModsChangeLogPayload>('/content/mods-change-log.json')
      .then(payload => {
        setModsChangeEntries(Array.isArray(payload?.entries) ? payload.entries : [])
        setModsChangeUpdatedUtc(payload?.updatedUtc)
      })
      .catch(() => {
        setModsChangeEntries([])
        setModsChangeUpdatedUtc(undefined)
      })
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

  async function copyText(_label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
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

  const workshopReq = buildWorkshopIds(requiredList)
  const workshopOpt = buildWorkshopIds(optionalList)

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
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">Join Discord & Get Setup Help</a>
              <a className="btn" href="/how-to-join">Start Join Flow</a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '8px 0 0' }}>
        <div className="container">
          <ConversionStrip
            eyebrow="Fast Onboarding"
            title="Install the pack, then enter a world that remembers."
            body="Need help with order, conflicts, or optional picks? Jump into Discord and staff will walk you in."
            primary={{ label: 'Open Discord Setup Help', href: discordInviteUrl, external: true }}
            secondary={{ label: 'Check Server Status', href: '/status' }}
          />
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

          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={compactView}
              onChange={e => setCompactView(e.target.checked)}
            />
            Compact view
          </label>
        </div>
      </Section>

      <Section eyebrow="List" title="Available mods">
        {filtered.length === 0 && (
          <div className="card">
            <div className="small">No mods match your filters.</div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {requiredList.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 760, marginBottom: 6 }}>Required mods ({requiredList.length})</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {requiredList.map(m => renderModCard(m, compactView, copyText))}
              </div>
            </div>
          )}

          {optionalList.length > 0 && (
            <details className="card" style={{ padding: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 760 }}>
                Optional mods ({optionalList.length})
              </summary>
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                {optionalList.map(m => renderModCard(m, compactView, copyText))}
              </div>
            </details>
          )}
        </div>
      </Section>

      <Section eyebrow="Changes" title="Recent add/remove history">
        <div className="card">
          {modsChangeEntries.length === 0 ? (
            <div className="small">No mod change history has been recorded yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="small">
                Showing latest {Math.min(10, modsChangeEntries.length)} changes
                {modsChangeUpdatedUtc ? ` • Updated ${new Date(modsChangeUpdatedUtc).toLocaleString()}` : ''}
              </div>
              {modsChangeEntries.slice(-10).reverse().map((entry, index) => {
                const addedWorkshop = entry.addedWorkshop ?? []
                const removedWorkshop = entry.removedWorkshop ?? []
                const addedMods = entry.addedMods ?? []
                const removedMods = entry.removedMods ?? []
                return (
                  <div key={`${entry.detectedUtc}-${index}`} className="card" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 760 }}>
                      {new Date(entry.detectedUtc).toLocaleString()}
                    </div>
                    <div className="small">
                      Added: {entry.addedTotal ?? (addedWorkshop.length + addedMods.length)}
                      {' • '}
                      Deleted: {entry.removedTotal ?? (removedWorkshop.length + removedMods.length)}
                      {entry.source ? ` • Source: ${entry.source}` : ''}
                    </div>
                    {(addedWorkshop.length > 0 || removedWorkshop.length > 0 || addedMods.length > 0 || removedMods.length > 0) && (
                      <div className="small" style={{ marginTop: 6 }}>
                        {addedWorkshop.length > 0 ? `+Workshop: ${addedWorkshop.join(', ')} ` : ''}
                        {removedWorkshop.length > 0 ? `-Workshop: ${removedWorkshop.join(', ')} ` : ''}
                        {addedMods.length > 0 ? `+Mods: ${addedMods.join(', ')} ` : ''}
                        {removedMods.length > 0 ? `-Mods: ${removedMods.join(', ')}` : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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

function renderModCard(
  m: ModItem,
  compactView: boolean,
  copyText: (label: string, text: string) => Promise<void>
) {
  const req = m.required !== false
  const cat = (m.category ?? 'General').trim()
  const steamUrl = m.workshopId
    ? `https://steamcommunity.com/sharedfiles/filedetails/?id=${encodeURIComponent(m.workshopId)}`
    : null

  const sourceLabel =
    m.source === 'server'
      ? 'Server'
      : m.source === 'manual'
      ? 'Manual'
      : null

  return (
    <div key={m.id} className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 760 }}>{m.name}</div>
          <div className="small">
            {cat} • {req ? 'REQUIRED' : 'OPTIONAL'}
            {sourceLabel ? ` • ${sourceLabel}` : ''}
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

      {!compactView && m.description?.trim() && (
        <div className="p" style={{ marginTop: 8 }}>
          {m.description}
        </div>
      )}
    </div>
  )
}
