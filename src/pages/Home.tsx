import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import logo from '../assets/logo.png'
import { StatusBadge } from '../components/StatusBadge'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { Transmission } from '../components/content'

export function Home() {
  const [tx, setTx] = useState<Transmission[] | null>(null)

  useEffect(() => {
    fetchJson<Transmission[]>('/content/transmissions.json')
      .then(setTx)
      .catch(() => setTx(null))
  }, [])

  return (
    <div>
      {/* HERO */}
      <div className="container" style={{ padding: '42px 0 26px 0' }}>
        <div className="grid grid-2" style={{ alignItems: 'center' }}>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <div className="badge" style={{ marginBottom: 14 }}>
              <span>Persistent Semi-Serious RP • PvPvE • Knox County</span>
            </div>

            <h1 className="h1">Grey Hour RP</h1>

            <p className="p" style={{ marginTop: 14, maxWidth: 660 }}>
              <span style={{ color: 'var(--accent2)' }}>
                When the world ended, time didn’t stop.
              </span>{' '}
              It slowed — just enough for people to decide who they really were.
            </p>

            <p className="p" style={{ marginTop: 10, maxWidth: 700 }}>
              Grey Hour RP is a persistent, semi-serious Project Zomboid roleplay
              server. There are no constant resets, no instant heroes, and no
              forgotten actions.
            </p>

            <p className="p" style={{ marginTop: 10, maxWidth: 700 }}>
              The world doesn’t revolve around you.
              <br />
              <em>It remembers you.</em>
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 20
              }}
            >
              <a
                className="btn btn-primary"
                href="https://discord.gg/e4d8YrcSt"
                target="_blank"
                rel="noreferrer"
              >
                Join the Survivors
              </a>
              <a className="btn" href="/how-to-join">
                How to Join
              </a>
              <a className="btn btn-ghost" href="/updates">
                Read the Updates
              </a>
            </div>

            <div style={{ marginTop: 18 }}>
              <StatusBadge />
            </div>
          </motion.div>

          {/* LOGO CARD */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.06 }}
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <div
              style={{
                width: 'min(460px, 90vw)',
                borderRadius: 28,
                border: '1px solid var(--border)',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.08))',
                padding: 18,
                boxShadow: 'var(--shadow)'
              }}
            >
              <img
                src={logo}
                alt="Grey Hour RP emblem"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block'
                }}
              />
              <div
                className="small"
                style={{ marginTop: 10, textAlign: 'center' }}
              >
                A symbol survivors recognize — and others fear.
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* PHILOSOPHY */}
      <Section eyebrow="The Philosophy" title="This isn’t a reset button.">
        <div className="grid grid-3" style={{ marginTop: 14 }}>
          {[
            {
              t: 'The world reacts to you',
              d: 'Your choices echo. Locations change. People remember who helped, who harmed, and who disappeared.'
            },
            {
              t: 'Violence has weight',
              d: 'Conflict is allowed — but it leaves witnesses, enemies, and consequences that don’t vanish.'
            },
            {
              t: 'Reputation matters',
              d: 'Trade, factions, alliances, and safe zones are shaped by what others believe about you.'
            }
          ].map((c) => (
            <div key={c.t} className="card">
              <div style={{ fontWeight: 760, letterSpacing: '-0.01em' }}>
                {c.t}
              </div>
              <div className="p" style={{ marginTop: 8 }}>
                {c.d}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* TRANSMISSION */}
      <Section eyebrow="Transmission" title="Transmission Intercepted">
        <div className="card" style={{ position: 'relative' }}>
          <div className="small" style={{ marginBottom: 8 }}>
            Updated by admins • Lives with the world
          </div>

          <div
            style={{
              fontSize: 18,
              lineHeight: 1.7,
              color: 'var(--muted)'
            }}
          >
            {(tx?.[0]?.body ?? [
              'If you’re hearing this… it’s still the Grey Hour.'
            ]).map((line, idx) => (
              <div
                key={idx}
                style={{ marginTop: line === '' ? 10 : 0 }}
              >
                {line}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10
            }}
          >
            <a
              className="btn btn-primary"
              href="https://discord.gg/e4d8YrcSt"
              target="_blank"
              rel="noreferrer"
            >
              Enter Discord
            </a>
            <a className="btn" href="/about">
              Learn the World
            </a>
            <a className="btn btn-ghost" href="/status">
              Server Status
            </a>
          </div>
        </div>
      </Section>

      {/* CULTURE FIT */}
      <Section eyebrow="Culture" title="Is Grey Hour RP right for you?">
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <div className="card">
            <div style={{ fontWeight: 760 }}>This world is for you if…</div>
            <ul className="p">
              <li>You enjoy slow-burn stories and earned trust.</li>
              <li>You accept loss as part of survival.</li>
              <li>You value reputation over stats.</li>
              <li>You want your character remembered.</li>
            </ul>
          </div>

          <div className="card">
            <div style={{ fontWeight: 760 }}>This world is not for you if…</div>
            <ul className="p">
              <li>You want instant power and fast resets.</li>
              <li>You treat death like a respawn timer.</li>
              <li>You play to win, not to live.</li>
              <li>You ignore consequences when nobody’s watching.</li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
  )
}
