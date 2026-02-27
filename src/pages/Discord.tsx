import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { ConversionStrip } from '../components/ConversionStrip'
import type { DiscordChannelCommandDoc, DiscordCommandDoc } from '../types/content'
import { fetchJson } from '../components/utils'
import { useDiscordInvite } from '../hooks/useDiscordInvite'
import { usePublicLive } from '../hooks/usePublicLive'

function statusTone(status: string) {
  if (status === 'online') return '#4ade80'
  if (status === 'maintenance') return '#facc15'
  return '#f87171'
}

export function Discord() {
  const discordInviteUrl = useDiscordInvite('discord_page_primary_cta')
  const liveState = usePublicLive()
  const [commands, setCommands] = useState<DiscordCommandDoc | null>(null)
  const [commandQuery, setCommandQuery] = useState('')
  const [channelCommands, setChannelCommands] = useState<DiscordChannelCommandDoc | null>(null)
  const [channelQuery, setChannelQuery] = useState('')

  useEffect(() => {
    fetchJson<DiscordCommandDoc>('/content/discord-commands.json')
      .then(setCommands)
      .catch(() => setCommands(null))
  }, [])

  useEffect(() => {
    fetchJson<DiscordChannelCommandDoc>('/content/discord-channel-commands.json')
      .then(setChannelCommands)
      .catch(() => setChannelCommands(null))
  }, [])

  const game = liveState?.live?.gameServer
  const discord = liveState?.live?.discord
  const readiness = liveState?.live?.readiness

  const readinessLabel = useMemo(() => {
    if (!readiness) return 'Unknown'
    const score = Number(readiness.gameServerApiReady) + Number(readiness.discordApiReady) + Number(readiness.webhooksReady)
    if (score >= 3) return 'Ready'
    if (score === 2) return 'Nearly Ready'
    if (score === 1) return 'In Progress'
    return 'Pending'
  }, [readiness])

  const readinessTone = readinessLabel === 'Ready' ? 'good' : readinessLabel === 'Nearly Ready' ? 'warn' : readinessLabel === 'In Progress' ? 'warn' : 'bad'
  const updatedGame = game?.updatedUtc ? new Date(game.updatedUtc).toLocaleTimeString() : 'unknown'
  const updatedDiscord = discord?.updatedUtc ? new Date(discord.updatedUtc).toLocaleTimeString() : 'unknown'
  const showSkeleton = Boolean(liveState?.loading && !liveState?.live)
  const publicCommands = useMemo(() => {
    const list = commands?.commands ?? []
    const q = commandQuery.trim().toLowerCase()
    return list
      .filter(cmd => cmd.permission === 'public')
      .filter(cmd => {
        if (!q) return true
        const hay = `${cmd.name} ${cmd.description} ${(cmd.subcommands ?? []).map(s => `${s.name} ${s.description}`).join(' ')}`.toLowerCase()
        return hay.includes(q)
      })
  }, [commands, commandQuery])

  const publicChannelCommands = useMemo(() => {
    const list = channelCommands?.channels ?? []
    const q = channelQuery.trim().toLowerCase()
    return list
      .map((channel) => ({
        ...channel,
        commands: (channel.commands ?? []).filter(cmd => cmd.permission === 'public')
      }))
      .filter((channel) => channel.commands.length > 0)
      .filter((channel) => {
        if (!q) return true
        const hay = `${channel.name} ${channel.parentName ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
  }, [channelCommands, channelQuery])

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Signal Relay</span></div>
            <h1 className="hero-title">Discord Command Center</h1>
            <div className="p" style={{ maxWidth: 840 }}>
              Join the command network for alerts, support, faction comms, and in-world coordination.
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">Open Discord</a>
              <a className="btn btn-ghost" href="/status">Server Status</a>
              <a className="btn btn-ghost" href="/updates">Latest Updates</a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '8px 0 0' }}>
        <div className="container">
          <ConversionStrip
            eyebrow="Command Network"
            title="Most players start here."
            body="If you want momentum on day one, join Discord first. You get announcements, help, and direct access to the live community."
            primary={{ label: 'Join Discord Now', href: discordInviteUrl, external: true }}
            secondary={{ label: 'How to Join', href: '/how-to-join' }}
          />
        </div>
      </section>

      <Section eyebrow="Live Feed" title="Realtime Surface">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div className={`chip ${readinessTone}`}>Service Health: {readinessLabel}</div>
          <button className="btn" onClick={() => liveState?.refresh()} disabled={liveState?.loading || liveState?.refreshing}>
            {liveState?.refreshing ? 'Refreshing…' : 'Retry'}
          </button>
        </div>
        {liveState?.error && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(248,113,113,0.45)' }}>
            <div className="p">Live endpoints failed to respond. Showing last known data where possible.</div>
            <div className="small" style={{ marginTop: 6 }}>{liveState.error}</div>
          </div>
        )}
        <div className="grid grid-4">
          {showSkeleton ? (
            <>
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="card">
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-value" />
                  <div className="skeleton skeleton-line" />
                  <div className="skeleton skeleton-line" />
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="card">
                <div className="small">Game Server</div>
                <div style={{ fontWeight: 800, fontSize: 24, color: statusTone(game?.status ?? 'offline'), marginTop: 6 }}>
                  {game?.status?.toUpperCase() ?? 'OFFLINE'}
                </div>
                <div className="p" style={{ marginTop: 8 }}>
                  {liveState?.loading ? 'Loading…' : `Queue ${game?.queue ?? 0} • Capacity ${game?.maxPlayers ?? 0}`}
                </div>
                <div className="small" style={{ marginTop: 6 }}>Updated: {liveState?.loading ? '—' : updatedGame}</div>
              </div>
              <div className="card">
                <div className="small">Discord Ops</div>
                <div style={{ fontWeight: 800, fontSize: 24, color: discord?.online ? '#4ade80' : '#f87171', marginTop: 6 }}>
                  {discord?.online ? 'ONLINE' : 'OFFLINE'}
                </div>
                <div className="p" style={{ marginTop: 8 }}>
                  {liveState?.loading ? 'Loading…' : `${discord?.members ?? 0} members • ${discord?.activeTickets ?? 0} active tickets`}
                </div>
                <div className="small" style={{ marginTop: 6 }}>Updated: {liveState?.loading ? '—' : updatedDiscord}</div>
              </div>
              <div className="card">
                <div className="small">Community Health</div>
                <div style={{ fontWeight: 800, fontSize: 24, marginTop: 6 }}>{readinessLabel}</div>
                <div className="p" style={{ marginTop: 8 }}>
                  {liveState?.loading ? 'Loading…' : `${discord?.activeTickets ?? 0} open tickets • ${discord?.openModcalls ?? 0} mod calls`}
                </div>
              </div>
              <div className="card">
                <div className="small">Updated</div>
                <div style={{ fontWeight: 800, fontSize: 18, marginTop: 6 }}>
                  {liveState?.loading ? 'Loading…' : new Date(game?.updatedUtc ?? Date.now()).toLocaleTimeString()}
                </div>
                <div className="p" style={{ marginTop: 8 }}>
                  Auto-refresh every 45 seconds.
                </div>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section eyebrow="Player Toolkit" title="Discord Commands You Can Use">
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <input
            className="input"
            placeholder="Search commands..."
            value={commandQuery}
            onChange={(e) => setCommandQuery(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <div className="small">
            {publicCommands.length} commands shown
          </div>
        </div>
        <div className="grid grid-3">
          {publicCommands.map((cmd) => (
            <div className="card" key={cmd.name}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{`/${cmd.name}`}</div>
                <div className="chip good">Public</div>
              </div>
              <div className="small" style={{ marginTop: 6 }}>{cmd.description}</div>
              {cmd.subcommands && cmd.subcommands.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="small" style={{ fontWeight: 700 }}>Subcommands</div>
                  {cmd.subcommands.map((sub) => (
                    <div key={`${cmd.name}-${sub.name}`} className="small" style={{ marginTop: 6 }}>
                      <span style={{ fontWeight: 600 }}>{sub.usage}</span>
                      {sub.description ? ` — ${sub.description}` : ''}
                    </div>
                  ))}
                </div>
              )}
              {(!cmd.subcommands || cmd.subcommands.length === 0) && (
                <div className="small" style={{ marginTop: 8 }}>
                  Use: <span style={{ fontWeight: 600 }}>{cmd.usage}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {!publicCommands.length && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="p">No public commands match that search yet.</div>
          </div>
        )}
        <div className="small" style={{ marginTop: 12 }}>
          Some channels have tighter rules. If a command fails, check the channel guide or ask staff in Support.
        </div>
      </Section>

      <Section eyebrow="Channel Intel" title="Commands By Channel">
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <input
            className="input"
            placeholder="Search channels..."
            value={channelQuery}
            onChange={(e) => setChannelQuery(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <div className="small">{publicChannelCommands.length} channels with commands</div>
        </div>
        <div className="grid grid-3">
          {publicChannelCommands.map((channel) => (
            <div className="card" key={channel.id}>
              <div style={{ fontWeight: 700 }}>#{channel.name}</div>
              {channel.parentName && (
                <div className="small" style={{ marginTop: 4 }}>{channel.parentName}</div>
              )}
              <div style={{ marginTop: 10 }}>
                {channel.commands.map((cmd) => (
                  <div key={`${channel.id}-${cmd.usage}`} className="small" style={{ marginTop: 6 }}>
                    <span style={{ fontWeight: 600 }}>{cmd.usage}</span>
                    {cmd.description ? ` — ${cmd.description}` : ''}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!publicChannelCommands.length && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="p">No channel-specific public commands found yet.</div>
          </div>
        )}
        <div className="small" style={{ marginTop: 12 }}>
          If a command isn’t listed, the channel is likely read-only or chat-only. Staff can open more commands if needed.
        </div>
      </Section>
    </div>
  )
}
