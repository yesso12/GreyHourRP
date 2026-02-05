import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { UpdateItem } from '../types/content'

export function Updates() {
  const [items, setItems] = useState<UpdateItem[]>([])
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<UpdateItem[]>('/content/updates.json')
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter(u =>
        q.length === 0 ||
        u.title.toLowerCase().includes(q) ||
        u.body.join(' ').toLowerCase().includes(q)
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [items, query])

  const latest = filtered[0]
  const rest = filtered.slice(1)

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Signal Updates</span></div>
            <h1 className="hero-title">The world keeps moving.</h1>
            <div className="p" style={{ maxWidth: 820 }}>
              Grey Hour RP is actively maintained. Updates cover new content, balance passes, and world events.
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Search" title="Find a transmission update">
        <div className="card">
          <input
            className="input"
            placeholder="Search updates…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </Section>

      {latest && (
        <Section eyebrow="Latest" title={latest.title}>
          <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
            <div className="small">Latest Update • {latest.date}</div>
            <div style={{ marginTop: 12, lineHeight: 1.7 }}>
              {latest.body.map((line, i) => (
                <div key={i} style={{ marginTop: line === '' ? 10 : 0 }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section eyebrow="Archive" title="Update history">
        {rest.length === 0 && !latest && (
          <div className="card">
            <div className="small">No updates published yet.</div>
          </div>
        )}

        {rest.length > 0 && (
          <div className="timeline">
            {rest.map(u => {
              const isOpen = expanded === u.id
              return (
                <div key={u.id} className="timeline-item" onClick={() => setExpanded(isOpen ? null : u.id)}>
                  <div className="timeline-title">{u.title}</div>
                  <div className="small">{u.date}</div>
                  {isOpen && (
                    <div className="p" style={{ marginTop: 10 }}>
                      {u.body.map((line, i) => (
                        <div key={i} style={{ marginTop: line === '' ? 10 : 0 }}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
