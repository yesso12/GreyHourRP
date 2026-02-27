import { useMemo } from 'react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { RecruitmentBar } from './RecruitmentBar'
import { useTheme } from './useTheme'
import { useAmbientAudio } from './useAmbientAudio'
import type { SiteFlags } from '../types/content'
import { PublicLiveProvider, usePublicLive } from '../hooks/usePublicLive'

function SiteShellBody({ children, siteFlags }: { children: React.ReactNode; siteFlags?: SiteFlags }) {
  const theme = useTheme()
  const audio = useAmbientAudio()
  const liveState = usePublicLive()

  const audioModeLabel = useMemo(() => {
    if (!audio.enabled) return 'off'
    return audio.mode
  }, [audio.enabled, audio.mode])

  return (
    <div className="noise">
      <div className="blood" aria-hidden="true" />
      <div className="hourglass-backdrop" aria-hidden="true" />

      {liveState?.serverStatus === 'maintenance' && (
        <div className="status-banner">
          Server is currently under maintenance. Progress is preserved.
        </div>
      )}

      <Navbar
        onToggleTheme={theme.toggle}
        themeLabel={theme.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        onToggleAudio={() => audio.setEnabled(v => !v)}
        audioEnabled={audio.enabled}
        audioAvailable={audio.available}
        audioMode={audioModeLabel}
        audioPreset={audio.preset}
        audioPresets={audio.presets.map(p => ({ id: p.id, label: p.label }))}
        onAudioPresetChange={(next) => audio.setPreset(next as typeof audio.preset)}
        volume={audio.volume}
        onVolumeChange={audio.setVolume}
        sfxEnabled={audio.sfxEnabled}
        onToggleSfx={() => audio.setSfxEnabled(v => !v)}
        onUiClick={audio.playUiClick}
        serverStatus={liveState?.live?.gameServer.status ?? liveState?.serverStatus ?? 'offline'}
        discordOnline={liveState?.live?.discord.online ?? null}
        discordMembers={liveState?.live?.discord.members ?? null}
        siteFlags={siteFlags}
      />
      <RecruitmentBar />

      <main style={{ minHeight: 'calc(100vh - 220px)' }}>
        {children}
      </main>

      <Footer />
    </div>
  )
}

export function SiteShell({ children, siteFlags }: { children: React.ReactNode; siteFlags?: SiteFlags }) {
  return (
    <PublicLiveProvider>
      <SiteShellBody siteFlags={siteFlags}>{children}</SiteShellBody>
    </PublicLiveProvider>
  )
}
