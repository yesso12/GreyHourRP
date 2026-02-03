import React, { useEffect } from 'react'
import { Section } from '../components/Section'

export function Discord() {
  useEffect(() => {
    // Optional: redirect after a moment, but keep page usable.
    const t = setTimeout(() => {
      // comment out if you prefer no auto-redirect
      // window.location.href = 'https://discord.gg/e4d8YrcSt'
    }, 1200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div>
      <Section eyebrow="Community" title="Join the family.">
        <div className="card">
          <div className="p" style={{ fontSize: 18 }}>
            Grey Hour RP is built on continuity — not resets. If you want a place where your character can become part of the world’s memory, you’re in the right place.
          </div>
          <div style={{ marginTop: 14, display:'flex', flexWrap:'wrap', gap: 10 }}>
            <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">
              Open Discord Invite
            </a>
            <a className="btn" href="/how-to-join">How to Join</a>
          </div>
          <div className="small" style={{ marginTop: 12 }}>
            No harsh RP verification. Standards can be learned and taught as the world evolves.
          </div>
        </div>
      </Section>
    </div>
  )
}
