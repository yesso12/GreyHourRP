import React from 'react'
import { useDiscordInvite } from '../hooks/useDiscordInvite'
import { usePublicLive } from '../hooks/usePublicLive'

export function Footer() {
  const discordInviteUrl = useDiscordInvite('footer_primary_cta')
  const liveState = usePublicLive()

  return (
    <div className="container" style={{ padding: '30px 0 46px 0' }}>
      <div className="footer-intake">
        <div>
          <div className="small" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>Final Call</div>
          <div style={{ fontWeight: 760, fontSize: 22, marginTop: 4 }}>Ready to survive the Grey Hour?</div>
          <div className="small" style={{ marginTop: 6 }}>
            {(liveState?.live?.gameServer.status ?? liveState?.serverStatus) === 'online' ? 'Server is live now' : 'Next session window is forming'}
            {' • '}
            {typeof liveState?.live?.discord.members === 'number' ? `${liveState.live.discord.members} in Discord` : 'Active Discord operations'}
          </div>
        </div>
        <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">
          Join Discord
        </a>
      </div>

      <div className="hr" />
      <div style={{ display:'flex', flexWrap:'wrap', gap: 12, alignItems:'center', justifyContent:'space-between' }}>
        <div className="small">
          © {new Date().getFullYear()} Grey Hour RP • Persistent semi-serious RP • PvPvE
        </div>
        <div className="small">
          <span style={{ opacity: 0.9 }}>Someone will remember you here.</span>
        </div>
        <div className="small" style={{ width: '100%' }}>
          Ambient soundtrack credits (licensed):{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Modest_Mussorgsky_-_night_on_bald_mountain.ogg" target="_blank" rel="noreferrer">
            Night on Bald Mountain
          </a>{' '}
          (Public domain),{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Liszt_Totentanz.ogg" target="_blank" rel="noreferrer">
            Liszt Totentanz
          </a>{' '}
          (Public domain),{' '}
          <a href="https://commons.wikimedia.org/wiki/File:ICBSA_Verdi_-_Messa_da_requiem_parte_03,_Dies_irae.ogg" target="_blank" rel="noreferrer">
            Verdi Requiem - Dies Irae
          </a>{' '}
          (Public domain),{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Funeral_March_Chopin_Op_72_2.ogg" target="_blank" rel="noreferrer">
            Chopin Funeral March
          </a>{' '}
          (CC0),{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Musopen_-_In_the_Hall_Of_The_Mountain_King.ogg" target="_blank" rel="noreferrer">
            In the Hall of the Mountain King
          </a>{' '}
          (Public domain),{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Dies.irae.ogg" target="_blank" rel="noreferrer">
            Dies Irae
          </a>{' '}
          (Public domain).
        </div>
      </div>
    </div>
  )
}
