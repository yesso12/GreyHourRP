import React, { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { UpdateItem } from '../components/content'

function pill(type: UpdateItem['type']) {
  const map: Record<UpdateItem['type'], string> = {
    Update: '🟢 Update',
    Hotfix: '🔴 Hotfix',
    Balance: '🟡 Balance',
    Event: '🔵 Event',
  }
  return map[type]
}

export function Updates() {
  const [items, setItems] = useState<UpdateItem[] | null>(null)

  useEffect(() => {
    fetchJson<UpdateItem[]>('/content/updates.json')
      .then(setItems)
      .catch(() => setItems(null))
  }, [])

  const sorted = useMemo(() => {
    return (items ?? []).slice().sort((a, b) => b.date.localeCompare(a.date))
  }, [items])

  return (
    <div>
      <Section eyebrow="Changelog" title="Server updates that keep the world honest.">
        <div className="p" style={{ maxWidth: 860 }}>
          This log is how we keep continuity visible. Nothing changes silently. If the world shifts, you’ll see it here.
        </div>

        <div className="grid" style={{ marginTop: 14 }}>
          {sorted.map(u => (
            <div key={u.id} className="card">
              <div style={{ display:'flex', flexWrap:'wrap', gap: 10, alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', gap: 10, alignItems:'center', flexWrap:'wrap' }}>
                  <div className="badge">{pill(u.type)}</div>
                  <div className="small">{u.date}{u.version ? ` • ${u.version}` : ''}</div>
                </div>
                <div className="small" style={{ opacity: 0.85 }}>Grey Hour RP</div>
              </div>

              <div style={{ fontWeight: 800, marginTop: 10, letterSpacing:'-0.01em' }}>{u.title}</div>
              <ul className="p" style={{ marginTop: 10 }}>
                {u.items.map((it, idx) => <li key={idx}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="hr" />
        <div className="card">
          <div style={{ fontWeight: 760 }}>Admin note</div>
          <div className="p" style={{ marginTop: 8 }}>
            Updates are managed via <span className="kbd">public/content/updates.json</span>. No backend required.
          </div>
        </div>
      </Section>
    </div>
  )
}
