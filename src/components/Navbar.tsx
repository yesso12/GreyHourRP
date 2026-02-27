import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import logo from '../assets/logo.png'
import { StatusBadge } from './StatusBadge'
import { useDiscordInvite } from '../hooks/useDiscordInvite'
import type { SiteFlags } from '../types/content'

export function Navbar(props: {
  onToggleTheme: () => void
  themeLabel: string
  onToggleAudio: () => void
  audioEnabled: boolean
  audioAvailable: boolean
  audioMode: 'file' | 'synth' | 'off'
  audioPreset: string
  audioPresets: Array<{ id: string; label: string }>
  onAudioPresetChange: (preset: string) => void
  volume: number
  onVolumeChange: (value: number) => void
  sfxEnabled: boolean
  onToggleSfx: () => void
  onUiClick: () => void
  serverStatus?: 'online' | 'offline' | 'maintenance'
  discordOnline?: boolean | null
  discordMembers?: number | null
  siteFlags?: SiteFlags
}) {
  const loc = useLocation()
  const [showAudioPanel, setShowAudioPanel] = useState(false)
  const discordInviteUrl = useDiscordInvite('nav_join_button')

  const allItems = [
    { to: '/', label: 'Start' },
    { to: '/about', label: 'Lore' },
    { to: '/directory', label: 'Find Groups' },
    { to: '/status', label: 'Server Live?' },
    { to: '/discord', label: 'Ops Hub' },
    { to: '/updates', label: 'Patch Notes' },
    { to: '/events', label: 'Ops Calendar' },
    { to: '/factions', label: 'Power Map' },
    { to: '/mods', label: 'Loadout' },
    { to: '/rules', label: 'Rulebook' },
    { to: '/how-to-join', label: 'Join Now' },
    { to: '/transmissions', label: 'Intel Feed' }
  ]
  const items = allItems.filter((item) => {
    const f = props.siteFlags
    if (!f) return true
    if (item.to === '/mods') return f.showMods !== false
    if (item.to === '/updates') return f.showUpdates !== false
    if (item.to === '/events') return f.showEvents !== false
    if (item.to === '/factions') return f.showFactions !== false
    if (item.to === '/directory') return f.showDirectory !== false
    if (item.to === '/dossiers') return f.showDossiers === true
    if (item.to === '/economy') return f.showEconomy === true
    if (item.to === '/levels') return f.showLevels !== false
    if (item.to === '/how-to-join') return f.showHowToJoin !== false
    if (item.to === '/discord') return f.showDiscordPage !== false
    if (item.to === '/transmissions') return f.showTransmissions !== false
    if (item.to === '/staff') return f.showStaff !== false
    return true
  })

  const serverPulse =
    props.serverStatus === 'online'
      ? 'good'
      : props.serverStatus === 'maintenance'
      ? 'warn'
      : 'bad'

  const discordPulse =
    props.discordOnline == null
      ? 'warn'
      : props.discordOnline
      ? 'good'
      : 'bad'

  return (
    <div className="nav-shell">
      <div className="nav-top">
        <div className="container nav-top-inner">
          <NavLink to="/" className="nav-brand" onClick={props.onUiClick}>
            <img src={logo} alt="Grey Hour RP" />
            <div>
              <div className="nav-title">Grey Hour RP</div>
              <div className="nav-sub">Persistent semi-serious PvPvE roleplay</div>
            </div>
          </NavLink>

          <div className="nav-actions">
            <StatusBadge />

            <div className="audio-wrap">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  props.onUiClick()
                  setShowAudioPanel(v => !v)
                }}
                title="Sound controls"
              >
                Sound: {props.audioEnabled ? 'On' : 'Off'}
              </button>

              {showAudioPanel && (
                <div className="audio-panel">
                  <div className="audio-row">
                    <span>Ambient</span>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        props.onUiClick()
                        props.onToggleAudio()
                      }}
                    >
                      {props.audioEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>

                  <div className="audio-meta">
                    Source: {props.audioMode === 'file' ? 'Audio file' : props.audioMode === 'synth' ? 'Synth fallback' : 'Off'}
                    {!props.audioAvailable && ' (add matching preset files under /public/audio/)'}
                  </div>

                  <label className="audio-slider-label" htmlFor="ambient-preset">Theme Preset</label>
                  <select
                    id="ambient-preset"
                    className="audio-select"
                    value={props.audioPreset}
                    onChange={(e) => props.onAudioPresetChange(e.currentTarget.value)}
                  >
                    {props.audioPresets.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>

                  <div className="audio-row" style={{ marginTop: 10 }}>
                    <span>UI Effects</span>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        props.onUiClick()
                        props.onToggleSfx()
                      }}
                    >
                      {props.sfxEnabled ? 'On' : 'Off'}
                    </button>
                  </div>

                  <label className="audio-slider-label" htmlFor="ambient-volume">Volume</label>
                  <input
                    id="ambient-volume"
                    className="audio-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(props.volume * 100)}
                    onChange={(e) => props.onVolumeChange(Number(e.currentTarget.value) / 100)}
                  />
                </div>
              )}
            </div>

            <button
              className="btn btn-ghost"
              onClick={() => {
                props.onUiClick()
                props.onToggleTheme()
              }}
            >
              {props.themeLabel}
            </button>
            <NavLink className="btn btn-ghost" to="/admin-access" onClick={props.onUiClick}>
              Admin Login
            </NavLink>
            <a
              className="btn btn-primary"
              href={discordInviteUrl}
              target="_blank"
              rel="noreferrer"
              onClick={props.onUiClick}
            >
              Join Discord
            </a>
            <div className="nav-trust" aria-label="Trust indicators">
              <span className="nav-trust-item">Staff moderated daily</span>
              <span className="nav-trust-item">Persistent no-wipe world</span>
              <span className="nav-trust-item">Live ops + active events</span>
            </div>
          </div>
        </div>
      </div>

      <div className="nav-links">
        <div className="container nav-links-inner">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
              onClick={props.onUiClick}
            >
              {it.to === '/status' && (
                <span
                  className={`pulse-dot ${serverPulse}`}
                  title={`Server: ${props.serverStatus ?? 'unknown'}`}
                />
              )}
              {it.to === '/discord' && (
                <span
                  className={`pulse-dot ${discordPulse}`}
                  title={
                    typeof props.discordMembers === 'number'
                      ? `Discord: ${props.discordOnline ? 'online' : 'offline'} • ${props.discordMembers} members`
                      : `Discord: ${props.discordOnline ? 'online' : 'offline'}`
                  }
                />
              )}
              {it.label}
            </NavLink>
          ))}
        </div>

        <motion.div
          key={loc.pathname}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="hr"
          style={{ marginTop: 10, marginBottom: 6 }}
        />
      </div>
    </div>
  )
}
