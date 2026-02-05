import { useEffect } from 'react'
import { Section } from '../components/Section'

export function Discord() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = 'https://discord.gg/e4d8YrcSt'
    }, 4000)

    return () => clearTimeout(t)
  }, [])

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Signal Relay</span></div>
            <h1 className="hero-title">Open the channel.</h1>
            <div className="p" style={{ maxWidth: 820 }}>
              The Grey Hour Discord is your mission control: announcements, status updates, and community support.
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Transmission" title="Join the Grey Hour network">
        <div className="callout" style={{ textAlign: 'center' }}>
          <div className="p">
            You’ll be redirected automatically in a few seconds.
            If not, use the button below.
          </div>

          <div style={{ marginTop: 18 }}>
            <a
              className="btn btn-primary"
              href="https://discord.gg/e4d8YrcSt"
              target="_blank"
              rel="noreferrer"
            >
              Open Discord
            </a>
          </div>
        </div>
      </Section>
    </div>
  )
}
