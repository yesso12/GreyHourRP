import React from 'react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { Particles } from './Particles'
import { useTheme } from './useTheme'
import { useAmbientAudio } from './useAmbientAudio'

export function SiteShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  const audio = useAmbientAudio()

  return (
    <div className="noise">
      <div className="blood" aria-hidden="true" />
      <Particles />

      <Navbar
        onToggleTheme={theme.toggle}
        themeLabel={theme.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        onToggleAudio={() => audio.setEnabled(v => !v)}
        audioLabel={audio.enabled ? 'Audio: On' : (audio.available ? 'Audio: Off' : 'Audio: Add file')}
        audioAvailable={audio.available}
      />

      <main style={{ minHeight: 'calc(100vh - 220px)' }}>
        {children}
      </main>

      <Footer />
    </div>
  )
}
