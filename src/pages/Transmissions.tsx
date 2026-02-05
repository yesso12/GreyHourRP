import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { Transmission } from '../types/content'

const CATEGORIES = [
  'All',
  'World',
  'Emergency',
  'Admin',
  'Faction',
  'Rumor'
]

export function Transmissions() {
  const [items, setItems] = useState<Transmission[]>([])
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchJson<Transmission[]>('/content/transmissions.json')
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return items
      .filter(t => {
        const catOk = category === 'All' || (t.category ?? 'World') === category
        if (!q) return catOk

        const text = `${t.title} ${t.body.join(' ')}`.toLowerCase()
        return catOk && text.includes(q)
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.date.localeCompare(a.date)
      })
  }, [items, category, query])

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Archive Signal</span></div>
            <h1 className="hero-title">Transmissions from the dusk.</h1>
            <div className="p" style={{ maxWidth: 820 }}>
              Intelligence briefs, world broadcasts, and faction updates recorded across the Grey Hour.
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Filters" title="Sort the archive">
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`btn ${category === c ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}

          <input
            className="input"
            placeholder="Search transmissions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ marginLeft: 'auto', minWidth: 220 }}
          />
        </div>
      </Section>

      <Section eyebrow="Archive" title="Broadcast history">
        {filtered.length === 0 && (
          <div className="small">No transmissions match your search.</div>
        )}

        {filtered.map(t => (
          <div
            key={t.id}
            className="card"
            style={{
              marginBottom: 16,
              border: t.pinned ? '1px solid rgba(177,15,22,0.55)' : undefined
            }}
          >
            <div className="small" style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              {t.pinned && (
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  PINNED
                </span>
              )}
              <span>
                {t.date} • {(t.category ?? 'World').toUpperCase()}
              </span>
            </div>

            <div style={{ fontWeight: 760, fontSize: 18 }}>{t.title}</div>

            <div style={{ marginTop: 10, lineHeight: 1.7 }}>
              {t.body.map((line, i) => (
                <div key={i} style={{ marginTop: line ? 0 : 10 }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </div>
  )
}
