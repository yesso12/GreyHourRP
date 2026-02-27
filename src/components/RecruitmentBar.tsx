import { useMemo } from 'react'
import { usePublicLive } from '../hooks/usePublicLive'
import { useDiscordInvite } from '../hooks/useDiscordInvite'

export function RecruitmentBar() {
  const liveState = usePublicLive()
  const discordInviteUrl = useDiscordInvite('global_recruitment_bar')

  const serverLabel = useMemo(() => {
    const status = liveState?.live?.gameServer.status ?? liveState?.serverStatus ?? 'offline'
    if (status === 'online') return 'Server live now'
    if (status === 'maintenance') return 'Server in maintenance'
    return 'Server currently offline'
  }, [liveState?.live?.gameServer.status, liveState?.serverStatus])

  const discordMembers = liveState?.live?.discord.members
  const readiness = liveState?.live?.readiness
  const readinessScore =
    Number(readiness?.gameServerApiReady) +
    Number(readiness?.discordApiReady) +
    Number(readiness?.webhooksReady)
  const readinessLabel =
    readinessScore >= 3 ? 'Ops ready' : readinessScore === 2 ? 'Ops stabilizing' : 'Ops syncing'

  return (
    <div className="recruitment-bar-wrap">
      <div className="container">
        <div className="recruitment-bar">
          <div className="recruitment-copy">
            <div className="recruitment-kicker">Player Intake Open</div>
            <div className="recruitment-title">Enter the Grey Hour tonight.</div>
            <div className="recruitment-meta">
              <span>{serverLabel}</span>
              <span>{readinessLabel}</span>
              <span>{typeof discordMembers === 'number' ? `${discordMembers} in Discord` : 'Active Discord hub'}</span>
            </div>
          </div>
          <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">
            Join Discord Now
          </a>
        </div>
      </div>
    </div>
  )
}
