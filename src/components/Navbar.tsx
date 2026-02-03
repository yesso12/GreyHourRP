import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import logo from '../assets/logo.png'

export function Navbar(props: {
  onToggleTheme: () => void
  themeLabel: string
  onToggleAudio: () => void
  audioLabel: string
  audioAvailable: boolean
}) {
  const loc = useLocation()
  const items = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/rules', label: 'Rules' },
    { to: '/how-to-join', label: 'How to Join' },
    { to: '/updates', label: 'Updates' },
    { to: '/mods', label: 'Mods' },
    { to: '/staff', label: 'Staff' },
    { to: '/status', label: 'Status' },
    { to: '/discord', label: 'Discord' },
  ]

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.10))',
        backdropFilter: 'blur(12px)'
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logo} alt="Grey Hour RP" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 750, letterSpacing: '-0.02em' }}>Grey Hour RP</span>
              <span className="small">Persistent semi-serious PvPvE roleplay</span>
            </div>
          </NavLink>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-ghost" onClick={props.onToggleAudio} title={props.audioAvailable ? 'Toggle ambient audio' : 'Add /public/audio/ambient.mp3 to enable'}>
              {props.audioLabel}
            </button>
            <button className="btn btn-ghost" onClick={props.onToggleTheme}>
              {props.themeLabel}
            </button>
            <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">
              Join Discord
            </a>
          </div>
        </div>

        <div className="container" style={{ paddingBottom: 12 }}>
          <div style={{
            display: 'flex',
            gap: 14,
            overflowX: 'auto',
            paddingBottom: 6
          }}>
            {items.map(it => (
              <NavLink
                key={it.to}
                to={it.to}
                style={({ isActive }) => ({
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: `1px solid ${isActive ? 'rgba(177,15,22,0.55)' : 'transparent'}`,
                  background: isActive ? 'rgba(177,15,22,0.10)' : 'transparent',
                  color: isActive ? 'var(--text)' : 'var(--muted)',
                  whiteSpace: 'nowrap'
                })}
              >
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
    </div>
  )
}
