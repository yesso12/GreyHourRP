import React from 'react'
import { Section } from '../components/Section'

export function HowToJoin() {
  return (
    <div>
      <Section eyebrow="Onboarding" title="Enter the Grey Hour.">
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <div className="card">
            <div style={{ fontWeight: 760 }}>1) Join Discord</div>
            <div className="p" style={{ marginTop: 8 }}>
              That’s where announcements, updates, and community decisions live.
            </div>
            <div style={{ marginTop: 12 }}>
              <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">Open Discord</a>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 760 }}>2) Learn the standards</div>
            <div className="p" style={{ marginTop: 8 }}>
              No harsh verification. If you’re new to RP, you can learn as the world teaches you.
            </div>
            <div style={{ marginTop: 12 }}>
              <a className="btn" href="/rules">Read Rules</a>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 760 }}>3) Install the modpack</div>
            <div className="p" style={{ marginTop: 8 }}>
              Keep it painless: our mods list is organized and updated.
            </div>
            <div style={{ marginTop: 12 }}>
              <a className="btn" href="/mods">View Mods</a>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 760 }}>4) Step into Knox County</div>
            <div className="p" style={{ marginTop: 8 }}>
              The world is persistent. Your entry point is not. Make it count.
            </div>
            <div style={{ marginTop: 12 }}>
              <a className="btn btn-ghost" href="/status">Check Status</a>
            </div>
          </div>
        </div>

        <div className="hr" />
        <div className="card">
          <div style={{ fontWeight: 760 }}>Tip</div>
          <div className="p" style={{ marginTop: 8 }}>
            Don’t try to be the hero on day one. Listen. Watch. Let people learn your face. That’s how reputation starts.
          </div>
        </div>
      </Section>
    </div>
  )
}
