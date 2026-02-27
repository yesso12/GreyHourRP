import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { ShopItem } from '../types/content'

function uniq(arr: string[]) {
  return Array.from(new Set(arr)).filter(Boolean)
}

export function Directory() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')

  useEffect(() => {
    fetchJson<ShopItem[]>('/content/shops.json')
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const approved = useMemo(
    () => items.filter(s => (s.status ?? 'approved') === 'approved'),
    [items]
  )

  const categories = useMemo(() => {
    const cats = uniq(approved.map(s => (s.category ?? 'General').trim()))
    cats.sort((a, b) => a.localeCompare(b))
    return ['All', ...cats]
  }, [approved])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return approved.filter(s => {
      const cat = (s.category ?? 'General').trim()
      const matchesText =
        q.length === 0 ||
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q) ||
        (s.owner ?? '').toLowerCase().includes(q) ||
        (s.location ?? '').toLowerCase().includes(q)

      const matchesCategory = category === 'All' || cat === category
      return matchesText && matchesCategory
    })
  }, [approved, query, category])

  const featured = filtered.filter(s => s.featured)

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>In-Game Directory</span></div>
            <h1 className="hero-title">Local businesses, traders, and services.</h1>
            <div className="p" style={{ maxWidth: 820 }}>
              Verified in-game shops that keep Grey Hour RP moving. Want your store listed? Use
              the Discord command <strong>/shop store</strong> to request approval.
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Filters" title="Find a shop">
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Search name, owner, location, description…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />

          <select
            className="input"
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{ minWidth: 200 }}
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </Section>

      {featured.length > 0 && (
        <Section eyebrow="Featured" title="Spotlight services">
          <div style={{ display: 'grid', gap: 12 }}>
            {featured.map(item => (
              <div key={item.id} className="card" style={{ borderColor: 'var(--accent2)', boxShadow: '0 0 0 1px rgba(47, 230, 153, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 760 }}>{item.name}</div>
                    <div className="small">
                      {(item.category ?? 'General').trim()}
                      {item.owner ? ` • Owner: ${item.owner}` : ''}
                      {item.location ? ` • ${item.location}` : ''}
                    </div>
                  </div>
                  <div className="badge">
                    <span style={{ color: 'var(--accent2)' }}>Featured</span>
                  </div>
                </div>
                {item.description && (
                  <div className="p" style={{ marginTop: 8 }}>
                    {item.description}
                  </div>
                )}
                {item.contact && (
                  <div className="small" style={{ marginTop: 8 }}>Contact: {item.contact}</div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section eyebrow="Directory" title="All approved shops">
        {filtered.length === 0 ? (
          <div className="card">
            <div className="small">No approved shops match your filters yet.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map(item => (
              <div key={item.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 760 }}>{item.name}</div>
                    <div className="small">
                      {(item.category ?? 'General').trim()}
                      {item.owner ? ` • Owner: ${item.owner}` : ''}
                      {item.location ? ` • ${item.location}` : ''}
                    </div>
                  </div>
                  {item.featured && (
                    <div className="badge">
                      <span style={{ color: 'var(--accent2)' }}>Featured</span>
                    </div>
                  )}
                </div>
                {item.description && (
                  <div className="p" style={{ marginTop: 8 }}>
                    {item.description}
                  </div>
                )}
                {item.contact && (
                  <div className="small" style={{ marginTop: 8 }}>Contact: {item.contact}</div>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className="small" style={{ marginTop: 8 }}>
                    Tags: {item.tags.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
