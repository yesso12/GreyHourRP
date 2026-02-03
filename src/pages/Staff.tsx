import React, { useEffect, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { StaffMember } from '../components/content'

export function Staff() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null)

  useEffect(() => {
    fetchJson<StaffMember[]>('/content/staff.json')
      .then(setStaff)
      .catch(() => setStaff(null))
  }, [])

  return (
    <div>
      <Section eyebrow="Caretakers" title="Those who maintain the world.">
        <div className="p" style={{ maxWidth: 820 }}>
          We protect continuity. We observe more than we interfere. We keep the world alive — not predictable.
        </div>

        <div className="grid grid-2" style={{ marginTop: 14 }}>
          {(staff ?? []).map(s => (
            <div key={s.name} className="card">
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap: 12 }}>
                <div style={{ fontWeight: 780 }}>{s.name}</div>
                {s.handle ? <div className="small">{s.handle}</div> : null}
              </div>
              {s.bio ? <div className="p" style={{ marginTop: 8 }}>{s.bio}</div> : null}
            </div>
          ))}
        </div>

        <div className="hr" />
        <div className="card">
          <div style={{ fontWeight: 760 }}>Want to help build continuity?</div>
          <div className="p" style={{ marginTop: 8 }}>
            Reach out in Discord if you’re interested in events, faction writing, or community leadership.
          </div>
          <div style={{ marginTop: 12 }}>
            <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">Message in Discord</a>
          </div>
        </div>
      </Section>
    </div>
  )
}
