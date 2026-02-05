import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import logo from '../assets/logo.png'
import { StatusBadge } from '../components/StatusBadge'
import { Section } from '../components/Section'
import type { Transmission } from '../types/content'
import { fetchJson } from '../components/utils'

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 }
}

export function Home() {
  const [spotlight, setSpotlight] = useState<Transmission | null>(null)

  useEffect(() => {
    fetchJson<Transmission[]>('/content/transmissions.json')
      .then((items) => {
        const pinned = items.find(t => t.pinned)
        if (pinned) setSpotlight(pinned)
      })
      .catch(() => {})
  }, [])

  const pillars = useMemo(() => (
    [
      {
        t: 'Grey Hour Protocol',
        d: 'A living world where decisions persist and reputation travels farther than bullets.'
      },
      {
        t: 'Project Zomboid Authenticity',
        d: 'Scarcity, consequences, and survival tension — tuned for roleplay, not arcade chaos.'
      },
      {
        t: 'Story Over Reset',
        d: 'No wipe culture. This server remembers. The past becomes your leverage — or your shadow.'
      },
      {
        t: 'Faction Heat',
        d: 'The power vacuum is real. Build coalitions, defend territory, or disappear quietly.'
      }
    ]
  ), [])

  const steps = useMemo(() => (
    [
      { t: 'Join Discord', d: 'Announcements, guides, and staff support are all centralized here.' },
      { t: 'Read the Rules', d: 'We keep roleplay respectful and immersive — no powergaming.' },
      { t: 'Install the Modpack', d: 'Our curated list keeps sessions stable and meaningful.' },
      { t: 'Make Your Move', d: 'Create a character and step into the Grey Hour.' }
    ]
  ), [])

  return (
    <div>
      <section className="hero">
        <div className="container hero-grid">
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="badge" style={{ marginBottom: 14 }}>
              <span style={{ color: 'var(--accent2)' }}>Grey Hour RP • Project Zomboid</span>
            </div>

            <h1 className="hero-title">When the sun fades, the story begins.</h1>

            <p className="hero-tagline" style={{ marginTop: 14 }}>
              Grey Hour RP is a persistent Project Zomboid roleplay world. Every event leaves a mark, every faction
              matters, and every survivor is remembered.
            </p>

            <div className="hero-actions">
              <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">
                Join the Grey Hour
              </a>
              <a className="btn" href="/how-to-join">How to Join</a>
              <a className="btn btn-ghost" href="/transmissions">Read Transmissions</a>
            </div>

            <div style={{ marginTop: 20 }}>
              <StatusBadge />
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <strong>Persistent World</strong>
                <div className="small">No wipes. The timeline continues.</div>
              </div>
              <div className="hero-stat">
                <strong>Faction Driven</strong>
                <div className="small">Alliances, betrayals, and evolving politics.</div>
              </div>
              <div className="hero-stat">
                <strong>Story-First</strong>
                <div className="small">RP intensity with real survival stakes.</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.12 }}
            style={{ display: 'grid', gap: 16 }}
          >
            <div className="logo-orb">
              <img src={logo} alt="Grey Hour RP emblem" />
            </div>
            <div className="glass" style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }}>Grey Hour Signal</div>
              <div className="small" style={{ marginTop: 6 }}>
                A permanent dusk. A broadcast you can’t ignore.
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Section eyebrow="The Grey Hour" title="A dusk that never ends.">
        <div className="signal-grid" style={{ marginTop: 14 }}>
          {pillars.map((p) => (
            <div key={p.t} className="signal-card">
              <div style={{ fontWeight: 760, marginBottom: 8 }}>{p.t}</div>
              <div className="p">{p.d}</div>
            </div>
          ))}
        </div>
      </Section>

      {spotlight && (
        <Section eyebrow="World State" title={spotlight.title}>
          <div className="card" style={{ border: '1px solid rgba(177,15,22,0.55)' }}>
            <div className="small" style={{ marginBottom: 8 }}>
              Pinned Transmission • {spotlight.date} • {(spotlight.category ?? 'World').toUpperCase()}
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.7 }}>
              {spotlight.body.map((line, i) => (
                <div key={i} style={{ marginTop: line ? 0 : 10 }}>
                  {line}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <a className="btn btn-ghost" href="/transmissions">View all transmissions →</a>
            </div>
          </div>
        </Section>
      )}

      <Section eyebrow="How It Works" title="Join the living timeline.">
        <div className="grid grid-4" style={{ marginTop: 14 }}>
          {steps.map((step, index) => (
            <div key={step.t} className="card">
              <div className="small" style={{ marginBottom: 8 }}>STEP {index + 1}</div>
              <div style={{ fontWeight: 760 }}>{step.t}</div>
              <div className="p" style={{ marginTop: 8 }}>{step.d}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Faction Pressure" title="Every survivor leaves a footprint.">
        <div className="grid grid-3" style={{ marginTop: 14 }}>
          {[
            {
              t: 'The Map Remembers',
              d: 'Safehouses, caches, and battlegrounds become landmarks in the Grey Hour.'
            },
            {
              t: 'The Dead Speak',
              d: 'Conflict has consequences. Reputation spreads faster than radio static.'
            },
            {
              t: 'Nothing Is Wiped',
              d: 'Your actions stick. The story accumulates, and history keeps score.'
            }
          ].map(c => (
            <div key={c.t} className="card">
              <div style={{ fontWeight: 760 }}>{c.t}</div>
              <div className="p" style={{ marginTop: 8 }}>{c.d}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Ready" title="Step into the Grey Hour.">
        <div className="callout">
          <div className="h2" style={{ marginBottom: 8 }}>Your story starts at sundown.</div>
          <div className="p" style={{ maxWidth: 680 }}>
            Grey Hour RP is curated for committed roleplayers who want a persistent Project Zomboid experience.
            Join the Discord, check the transmissions, and write your chapter.
          </div>
          <div className="hero-actions" style={{ marginTop: 18 }}>
            <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">
              Join the Discord
            </a>
            <a className="btn" href="/how-to-join">Get Started</a>
          </div>
        </div>
      </Section>
    </div>
  )
}
