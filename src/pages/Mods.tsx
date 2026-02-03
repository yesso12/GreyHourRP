import React, { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { ModCategory } from '../components/content'

export function Mods() {
  const [cats, setCats] = useState<ModCategory[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    fetchJson<ModCategory[]>('/content/mods.json')
      .then(setCats)
      .catch(() => setCats(null))
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return cats ?? []
    return (cats ?? []).map(c => ({
      ...c,
      items: c.items.filter(m =>
        (m.name ?? '').toLowerCase().includes(query) ||
        (m.note ?? '').toLowerCase().includes(query)
      )
    })).filter(c => c.items.length > 0)
  }, [cats, q])

  return (
    <div>
      <Section eyebrow="Modpack" title="Know what you’re stepping into.">
        <div className="p" style={{ maxWidth: 860 }}>
          Mods are listed here for transparency and smoother onboarding. Required mods are clearly marked.
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ display:'flex', gap: 10, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontWeight: 760 }}>Search mods</div>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Type a mod name…"
              style={{
                width: 'min(420px, 100%)',
                padding: '10px 12px',
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text)',
                outline: 'none'
              }}
            />
          </div>
          <div className="small" style={{ marginTop: 10 }}>
            Mods are managed via <span className="kbd">public/content/mods.json</span>.
          </div>
        </div>

        <div className="grid" style={{ marginTop: 14 }}>
          {filtered.map(cat => (
            <div key={cat.category} className="card">
              <div style={{ fontWeight: 820, letterSpacing:'-0.01em' }}>{cat.category}</div>
              <div className="hr" />
              <div style={{ display:'grid', gap: 10 }}>
                {cat.items.map(m => (
                  <div key={m.name} style={{
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '12px 12px',
                    background: 'rgba(0,0,0,0.10)'
                  }}>
                    <div style={{ display:'flex', gap: 10, alignItems:'baseline', justifyContent:'space-between', flexWrap:'wrap' }}>
                      <div style={{ fontWeight: 760 }}>{m.name}</div>
                      <div className="small">
                        {m.required ? 'Required' : 'Optional'}
                        {m.version ? ` • ${m.version}` : ''}
                      </div>
                    </div>
                    {m.note ? <div className="p" style={{ marginTop: 6 }}>{m.note}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
