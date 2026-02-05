import { useEffect, useState } from 'react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { Particles } from './Particles'
import { useTheme } from './useTheme'
import { useAmbientAudio } from './useAmbientAudio'
import { fetchJson } from './utils'
import type { ServerStatus } from '../types/content'

export function SiteShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  const audio = useAmbientAudio()
  const [serverStatus, setServerStatus] = useState<ServerStatus['status']>('online')

  useEffect(() => {
    const load = () => {
      fetchJson<{ status: ServerStatus['status'] }>('/content/server-status.json')
        .then((d) => setServerStatus(d.status))
        .catch(() => setServerStatus('offline'))
    }

    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="noise">
      <div className="blood" aria-hidden="true" />
      <div className="hourglass-backdrop" aria-hidden="true" />
      <Particles />

      {serverStatus === 'maintenance' && (
        <div className="status-banner">
          Server is currently under maintenance. Progress is preserved.
        </div>
      )}

      <Navbar
        onToggleTheme={theme.toggle}
        themeLabel={theme.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        onToggleAudio={() => audio.setEnabled(v => !v)}
        audioLabel={
          audio.enabled
            ? 'Audio: On'
            : audio.available
            ? 'Audio: Off'
            : 'Audio: Add file'
        }
        audioAvailable={audio.available}
      />

      <main style={{ minHeight: 'calc(100vh - 220px)' }}>
        {children}
      </main>

      <Footer />
    </div>
  )
}
