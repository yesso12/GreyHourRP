import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { ConversionStrip } from '../components/ConversionStrip'
import { fetchJson } from '../components/utils'
import type { EventCalendar, EventItem } from '../types/content'
import { useDiscordInvite } from '../hooks/useDiscordInvite'

function statusTone(status: EventItem['status']) {
  if (status === 'open') return 'good'
  if (status === 'full') return 'warn'
  if (status === 'canceled') return 'bad'
  if (status === 'complete') return 'good'
  return 'warn'
}

export function Events() {
  const discordInviteUrl = useDiscordInvite('events_primary_cta')
  const [data, setData] = useState<EventCalendar | null>(null)

  useEffect(() => {
    fetchJson<EventCalendar>('/content/event-calendar.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const events = useMemo(() => (data?.events ?? []).slice().sort((a, b) => {
    return new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime()
  }), [data])
  const updatedLabel = data?.updatedUtc ? new Date(data.updatedUtc).toLocaleString() : '—'

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass" style={{ display: 'grid', gap: 10 }}>
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Live Ops</span></div>
            <h1 className="hero-title">Events that move the timeline.</h1>
            <div className="p" style={{ maxWidth: 860 }}>
              RSVP windows, capacity, and faction-aligned operations.
            </div>
            <div className="small">Last updated: {updatedLabel}</div>
            <div className="hero-actions" style={{ marginTop: 14 }}>
              <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">Join Discord for RSVP Calls</a>
              <a className="btn" href="/how-to-join">Enter the Server</a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '8px 0 0' }}>
        <div className="container">
          <ConversionStrip
            eyebrow="Operation Window"
            title="Events are where reputations are made."
            body="Most players get traction by showing up to organized ops early. Join Discord and claim your slot when calls go out."
            primary={{ label: 'Open Discord Ops', href: discordInviteUrl, external: true }}
            secondary={{ label: 'Read Rules First', href: '/rules' }}
          />
        </div>
      </section>

      <Section eyebrow="Calendar" title="Upcoming operations">
        {events.length === 0 ? (
          <div className="card">
            <div className="p">No events posted yet. Check back for mission calls.</div>
          </div>
        ) : (
          <div className="event-grid">
            {events.map(event => (
              <div key={event.id} className="card">
                <div className="faction-header">
                  <div>
                    <div className="faction-title">{event.title}</div>
                    <div className="small">{event.location ?? 'Location TBD'}</div>
                  </div>
                  <div className={`chip ${statusTone(event.status)}`}>
                    {event.status.toUpperCase()}
                  </div>
                </div>
                {event.summary && (
                  <div className="p" style={{ marginTop: 8 }}>{event.summary}</div>
                )}
                <div className="event-meta">Start: {new Date(event.startUtc).toLocaleString()}</div>
                {event.endUtc ? (
                  <div className="event-meta">End: {new Date(event.endUtc).toLocaleString()}</div>
                ) : null}
                <div className="event-meta">Faction: {event.factionId ?? 'Open'}</div>
                <div className="event-meta">Capacity: {event.capacity ?? 0}</div>
                {event.tags?.length ? (
                  <div className="event-meta">Tags: {event.tags.join(', ')}</div>
                ) : null}
                {event.link ? (
                  <div style={{ marginTop: 10 }}>
                    <a className="btn btn-ghost" href={event.link} target="_blank" rel="noreferrer">
                      RSVP Details
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="Ready" title="Get in before the roster fills">
        <div className="callout">
          <div className="p" style={{ maxWidth: 720 }}>
            Capacity events fill quickly. Keep Discord open and jump when the ping lands.
          </div>
          <div className="hero-actions" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">Join Discord Now</a>
            <a className="btn btn-ghost" href="/status">Check Server Status</a>
          </div>
        </div>
      </Section>
    </div>
  )
}
