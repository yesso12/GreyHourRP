import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import logo from '../assets/logo.png'
import { StatusBadge } from './StatusBadge'

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
    { to: '/transmissions', label: 'Transmissions' },
    { to: '/mods', label: 'Mods' },
    { to: '/staff', label: 'Staff' },
    { to: '/status', label: 'Status' },
    { to: '/discord', label: 'Discord' }
  ]

  return (
    <div className="nav-shell">
      <div className="nav-top">
        <div className="container nav-top-inner">
          <NavLink to="/" className="nav-brand">
            <img src={logo} alt="Grey Hour RP" />
            <div>
              <div className="nav-title">Grey Hour RP</div>
              <div className="nav-sub">Persistent semi-serious PvPvE roleplay</div>
            </div>
          </NavLink>

          <div className="nav-actions">
            <StatusBadge />
            <a className="btn btn-ghost" href="/admin">
              Admin
            </a>
            <button
              className="btn btn-ghost"
              onClick={props.onToggleAudio}
              title={
                props.audioAvailable
                  ? 'Toggle ambient audio'
                  : 'Add /public/audio/ambient.mp3 to enable'
              }
            >
              {props.audioLabel}
            </button>
            <button className="btn btn-ghost" onClick={props.onToggleTheme}>
              {props.themeLabel}
            </button>
            <a
              className="btn btn-primary"
              href="https://discord.gg/e4d8YrcSt"
              target="_blank"
              rel="noreferrer"
            >
              Join Discord
            </a>
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
  )
}
