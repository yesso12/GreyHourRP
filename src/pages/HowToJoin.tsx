import { Section } from '../components/Section'

const steps = [
  {
    t: 'Join Discord',
    d: 'Announcements, help, and world updates live here.'
  },
  {
    t: 'Read the Rules',
    d: 'We keep RP immersive and long-term. Know the expectations.'
  },
  {
    t: 'Install the Modpack',
    d: 'Curated for stability and story-first survival.'
  },
  {
    t: 'Enter the Grey Hour',
    d: 'Connect when the server is online and begin your story.'
  }
]

const ready = [
  'Project Zomboid installed and updated',
  'Modpack loaded and enabled',
  'A character concept with flaws and goals',
  'Microphone recommended (text RP still welcome)'
]

export function HowToJoin() {
  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Access Protocol</span></div>
            <h1 className="hero-title">How to enter the Grey Hour.</h1>
            <div className="p" style={{ maxWidth: 820 }}>
              There are no applications here — just expectations. If you’re ready to roleplay with consequence,
              you’re ready to join.
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Steps" title="Four steps to begin">
        <div className="join-grid" style={{ marginTop: 14 }}>
          {steps.map((step, index) => (
            <div key={step.t} className="join-step">
              <div className="small">STEP {index + 1}</div>
              <div style={{ fontWeight: 760, marginTop: 6 }}>{step.t}</div>
              <div className="p" style={{ marginTop: 8 }}>{step.d}</div>
              <div style={{ marginTop: 12 }}>
                {index === 0 && (
                  <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">
                    Join Discord
                  </a>
                )}
                {index === 1 && <a className="btn" href="/rules">View Rules</a>}
                {index === 2 && <a className="btn" href="/mods">View Mods</a>}
                {index === 3 && <a className="btn btn-ghost" href="/status">Check Status</a>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Ready Check" title="Before you connect">
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          {ready.map((item) => (
            <div key={item} className="card">
              <div style={{ fontWeight: 700 }}>{item}</div>
              <div className="small" style={{ marginTop: 6 }}>Make sure this is set before joining.</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="First Night" title="New player advice">
        <div className="callout">
          <div className="p" style={{ maxWidth: 720 }}>
            Take it slow. Listen more than you speak. Let people learn who your character is before trying to
            become important. The Grey Hour favors patience.
          </div>
          <div className="hero-actions" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href="/transmissions">Read transmissions</a>
            <a className="btn btn-ghost" href="/updates">View updates</a>
          </div>
        </div>
      </Section>
    </div>
  )
}
