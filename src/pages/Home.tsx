import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import logo from '../assets/logo.png'
import { StatusBadge } from '../components/StatusBadge'
import { Section } from '../components/Section'
import type { HomeMedia, Transmission } from '../types/content'
import { fetchJson } from '../components/utils'
import { useDiscordInvite } from '../hooks/useDiscordInvite'
import { usePublicLive } from '../hooks/usePublicLive'

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 }
}

const listWrap = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.06
    }
  }
}

const listItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 }
}

export function Home() {
  const discordInviteUrl = useDiscordInvite('home_primary_cta')
  const [spotlight, setSpotlight] = useState<Transmission | null>(null)
  const [homeMedia, setHomeMedia] = useState<HomeMedia | null>(null)
  const liveState = usePublicLive()

  useEffect(() => {
    fetchJson<Transmission[]>('/content/transmissions.json')
      .then((items) => {
        const pinned = items.find(t => t.pinned)
        if (pinned) setSpotlight(pinned)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchJson<HomeMedia>('/content/homepage-media.json')
      .then((media) => setHomeMedia(media))
      .catch(() => setHomeMedia(null))
  }, [])

  function toEmbedUrl(rawUrl: string) {
    const url = rawUrl.trim()
    if (!url) return null
    try {
      const u = new URL(url)
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname.startsWith('/shorts/')) {
          const id = u.pathname.split('/').filter(Boolean).pop()
          return id ? `https://www.youtube.com/embed/${id}` : null
        }
        const id = u.searchParams.get('v')
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
      if (u.hostname === 'youtu.be') {
        const id = u.pathname.replace('/', '').trim()
        return id ? `https://www.youtube.com/embed/${id}` : null
      }
      if (u.hostname.includes('vimeo.com')) {
        const id = u.pathname.split('/').filter(Boolean).pop()
        return id ? `https://player.vimeo.com/video/${id}` : null
      }
    } catch {
      return null
    }
    return null
  }

  function isDirectVideo(url: string) {
    return /\.(mp4|webm|ogg)(\?|$)/i.test(url)
  }

  const homeVideoUrl = homeMedia?.videoUrl ?? ''
  const homeEmbedUrl = useMemo(() => toEmbedUrl(homeVideoUrl), [homeVideoUrl])
  const homeDirectVideo = useMemo(() => isDirectVideo(homeVideoUrl), [homeVideoUrl])

  const liveServer = liveState?.live?.gameServer
  const liveDiscord = liveState?.live?.discord
  const serverLabel =
    liveServer?.status === 'online'
      ? 'Online'
      : liveServer?.status === 'maintenance'
      ? 'Maintenance'
      : 'Offline'
  const serverPulse =
    liveServer?.status === 'online'
      ? 'good'
      : liveServer?.status === 'maintenance'
      ? 'warn'
      : 'bad'
  const discordPulse =
    liveDiscord?.online == null ? 'warn' : liveDiscord.online ? 'good' : 'bad'
  const readiness = liveState?.live?.readiness
  const readinessScore =
    Number(readiness?.gameServerApiReady) +
    Number(readiness?.discordApiReady) +
    Number(readiness?.webhooksReady)
  const readinessLabel =
    readinessScore >= 3
      ? 'Ready'
      : readinessScore === 2
      ? 'Nearly Ready'
      : readinessScore === 1
      ? 'In Progress'
      : 'Pending'
  const readinessTone =
    readinessLabel === 'Ready'
      ? 'good'
      : readinessLabel === 'Nearly Ready'
      ? 'warn'
      : readinessLabel === 'In Progress'
      ? 'warn'
      : 'bad'
  const gameUpdated = liveState?.live?.gameServer.updatedUtc
    ? new Date(liveState.live.gameServer.updatedUtc).toLocaleTimeString()
    : '—'
  const discordUpdated = liveState?.live?.discord.updatedUtc
    ? new Date(liveState.live.discord.updatedUtc).toLocaleTimeString()
    : '—'

  const pillars = useMemo(() => (
    [
      {
        t: 'Grey Hour Protocol',
        d: 'A living world where decisions persist and reputation travels farther than bullets.'
      },
      {
        t: 'Project Zomboid Authenticity',
        d: 'Scarcity, consequences, and survival tension - tuned for roleplay, not arcade chaos.'
      },
      {
        t: 'Story Over Reset',
        d: 'No wipe culture. This server remembers. The past becomes your leverage - or your shadow.'
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
      { t: 'Read the Rules', d: 'We keep roleplay respectful and immersive - no powergaming.' },
      { t: 'Install the Modpack', d: 'Our curated list keeps sessions stable and meaningful.' },
      { t: 'Make Your Move', d: 'Create a character and step into the Grey Hour.' }
    ]
  ), [])

  return (
    <div className="home-page">
      <section className="hero">
        <div className="container hero-grid">
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="badge" style={{ marginBottom: 14 }}>
              <span style={{ color: 'var(--accent2)' }}>Grey Hour RP - Project Zomboid</span>
            </div>

            <h1 className="hero-title">When the sun fades, the story begins.</h1>

            <p className="hero-tagline" style={{ marginTop: 14 }}>
              Grey Hour RP is a persistent Project Zomboid roleplay world. Every event leaves a mark, every faction
              matters, and every survivor is remembered.
            </p>
            <div className="hero-proof">
              <span className="hero-proof-item">No-wipe persistent world</span>
              <span className="hero-proof-item">Faction-led power shifts</span>
              <span className="hero-proof-item">High-stakes roleplay survival</span>
            </div>
            <div className="hero-proof" style={{ marginTop: 8 }}>
              <span className="hero-proof-item">Active moderation</span>
              <span className="hero-proof-item">Automated health checks</span>
              <span className="hero-proof-item">Live community ops</span>
            </div>

            <div className="hero-actions">
              <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">
                Join the Grey Hour
              </a>
              <a className="btn" href="/how-to-join">How to Join</a>
              <a className="btn btn-ghost" href="/transmissions">Read Transmissions</a>
            </div>

            <div style={{ marginTop: 20 }}>
              <StatusBadge />
            </div>

            <div className="pulse-row" style={{ marginTop: 12 }}>
              <div className="pulse-chip">
                <span className={`pulse-dot ${serverPulse}`} />
                <span>Server: {serverLabel}</span>
              </div>
              <div className="pulse-chip">
                <span className={`pulse-dot ${discordPulse}`} />
                <span>Discord: {liveDiscord?.online ? 'Online' : 'Offline'}</span>
                <span className="pulse-meta-inline">
                  {typeof liveDiscord?.members === 'number' ? `${liveDiscord.members} members` : '—'}
                </span>
              </div>
            </div>

            <motion.div
              className="hero-stats"
              variants={listWrap}
              initial="hidden"
              animate="show"
            >
              <motion.div className="hero-stat" variants={listItem}>
                <strong>Persistent World</strong>
                <div className="small">No wipes. The timeline continues.</div>
              </motion.div>
              <motion.div className="hero-stat" variants={listItem}>
                <strong>Faction Driven</strong>
                <div className="small">Alliances, betrayals, and evolving politics.</div>
              </motion.div>
              <motion.div className="hero-stat" variants={listItem}>
                <strong>Story-First</strong>
                <div className="small">RP intensity with real survival stakes.</div>
              </motion.div>
            </motion.div>
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
            <motion.div
              className="glass"
              style={{ textAlign: 'center' }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div style={{ fontWeight: 700 }}>Grey Hour Signal</div>
              <div className="small" style={{ marginTop: 6 }}>
                A permanent dusk. A broadcast you can&apos;t ignore.
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Section eyebrow="The Grey Hour" title="A dusk that never ends.">
        <motion.div
          className="signal-grid"
          style={{ marginTop: 14 }}
          variants={listWrap}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {pillars.map((p) => (
            <motion.div key={p.t} className="signal-card" variants={listItem}>
              <div style={{ fontWeight: 760, marginBottom: 8 }}>{p.t}</div>
              <div className="p">{p.d}</div>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {spotlight && (
        <Section eyebrow="World State" title={spotlight.title}>
          <div className="card" style={{ border: '1px solid rgba(177,15,22,0.55)' }}>
            <div className="small" style={{ marginBottom: 8 }}>
              Pinned Transmission - {spotlight.date} - {(spotlight.category ?? 'World').toUpperCase()}
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.7 }}>
              {spotlight.body.map((line, i) => (
                <div key={i} style={{ marginTop: line ? 0 : 10 }}>
                  {line}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <a className="btn btn-ghost" href="/transmissions">View all transmissions -&gt;</a>
            </div>
          </div>
        </Section>
      )}

      {homeMedia?.enabled && homeMedia.videoUrl?.trim() && (
        <Section eyebrow="Gameplay" title={homeMedia.title || 'Gameplay Trailer'}>
          <div className="card">
            {homeMedia.description && (
              <div className="p" style={{ marginBottom: 14 }}>{homeMedia.description}</div>
            )}

            {homeEmbedUrl ? (
              <div className="home-video-frame">
                <iframe
                  src={homeEmbedUrl}
                  title="Grey Hour RP gameplay trailer"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : homeDirectVideo ? (
              <div className="home-video-frame">
                <video src={homeMedia.videoUrl} controls playsInline />
              </div>
            ) : (
              <div className="small">Video URL format not supported.</div>
            )}

            {!!homeMedia.ctaLabel && !!homeMedia.ctaUrl && (
              <div style={{ marginTop: 14 }}>
                <a className="btn btn-primary" href={homeMedia.ctaUrl} target="_blank" rel="noreferrer">
                  {homeMedia.ctaLabel}
                </a>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section eyebrow="How It Works" title="Join the living timeline.">
        <motion.div
          className="grid grid-4"
          style={{ marginTop: 14 }}
          variants={listWrap}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {steps.map((step, index) => (
            <motion.div key={step.t} className="card" variants={listItem}>
              <div className="small" style={{ marginBottom: 8 }}>STEP {index + 1}</div>
              <div style={{ fontWeight: 760 }}>{step.t}</div>
              <div className="p" style={{ marginTop: 8 }}>{step.d}</div>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      <Section eyebrow="Faction Pressure" title="Every survivor leaves a footprint.">
        <motion.div
          className="grid grid-3"
          style={{ marginTop: 14 }}
          variants={listWrap}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
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
            <motion.div key={c.t} className="card" variants={listItem}>
              <div style={{ fontWeight: 760 }}>{c.t}</div>
              <div className="p" style={{ marginTop: 8 }}>{c.d}</div>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      <Section eyebrow="Live Ops" title="Server and Discord pulse">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div className={`chip ${readinessTone}`}>Service Health: {readinessLabel}</div>
          <button className="btn" onClick={() => liveState?.refresh()} disabled={liveState?.loading || liveState?.refreshing}>
            {liveState?.refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {liveState?.checkedAt && (
            <div className="small">Last checked: {liveState.checkedAt}</div>
          )}
        </div>
        {liveState?.error && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(248,113,113,0.45)' }}>
            <div className="p">Live endpoints are not responding. Showing last known data.</div>
            <div className="small" style={{ marginTop: 6 }}>{liveState.error}</div>
          </div>
        )}
        <div className="grid grid-4">
          <div className="card pulse-card">
            <div className="pulse-header">
              <span className={`pulse-dot ${serverPulse}`} />
              <div>
                <div className="small">Server</div>
                <div style={{ fontWeight: 760, marginTop: 6, fontSize: 22 }}>
                  {serverLabel.toUpperCase()}
                </div>
              </div>
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              Capacity: {liveState?.live?.gameServer.maxPlayers ?? 0}
            </div>
            <div className="small" style={{ marginTop: 6 }}>Updated: {gameUpdated}</div>
          </div>
          <div className="card pulse-card">
            <div className="small">Queue</div>
            <div style={{ fontWeight: 760, marginTop: 6, fontSize: 22 }}>
              {liveState?.live?.gameServer.queue ?? 0}
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              Waiting to connect
            </div>
          </div>
          <div className="card pulse-card">
            <div className="pulse-header">
              <span className={`pulse-dot ${discordPulse}`} />
              <div>
                <div className="small">Discord</div>
                <div style={{ fontWeight: 760, marginTop: 6, fontSize: 22 }}>
                  {liveState?.live?.discord.online ? 'ONLINE' : 'OFFLINE'}
                </div>
              </div>
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              {(liveState?.live?.discord.members ?? 0)} members
            </div>
            <div className="small" style={{ marginTop: 6 }}>Updated: {discordUpdated}</div>
          </div>
          <div className="card pulse-card">
            <div className="small">Community</div>
            <div style={{ fontWeight: 760, marginTop: 6, fontSize: 22 }}>
              {liveState?.live?.discord.activeTickets ?? 0}
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              Active support tickets
            </div>
          </div>
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
            <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">
              Join the Discord
            </a>
            <a className="btn" href="/how-to-join">Get Started</a>
          </div>
        </div>
      </Section>

    </div>
  )
}
