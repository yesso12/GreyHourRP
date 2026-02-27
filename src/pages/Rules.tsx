import { Section } from '../components/Section'
import { ConversionStrip } from '../components/ConversionStrip'
import { useDiscordInvite } from '../hooks/useDiscordInvite'

const rules = [
  {
    t: 'Stay In Character',
    d: 'Your decisions must come from what your character knows, not what you know as a player.'
  },
  {
    t: 'Value Your Life',
    d: 'Characters should fear death. Reckless behavior without motivation breaks immersion.'
  },
  {
    t: 'Conflict Must Make Sense',
    d: 'Violence and theft are allowed only when story-driven and proportional.'
  },
  {
    t: 'Respect the Persistent World',
    d: 'This world does not wipe. Destructive behavior without RP intent is not tolerated.'
  }
]

const violations = [
  'Meta-gaming or using external information',
  'Powergaming and unrealistic behavior',
  'Griefing without RP justification',
  'Exploiting bugs or mechanics',
  'Out-of-character harassment or toxicity',
  'Using death as a reset or escape'
]

export function Rules() {
  const discordInviteUrl = useDiscordInvite('rules_primary_cta')

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass" style={{ display: 'grid', gap: 10 }}>
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Code of Survival</span></div>
            <h1 className="hero-title">Rules that protect the story.</h1>
            <div className="p" style={{ maxWidth: 860 }}>
              Grey Hour RP is built to keep immersion intact and conflict meaningful. These rules exist to protect
              the long-term world, not to restrict creativity.
            </div>
            <div className="hero-actions" style={{ marginTop: 14 }}>
              <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">Join Discord</a>
              <a className="btn" href="/how-to-join">Start Here</a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '8px 0 0' }}>
        <div className="container">
          <ConversionStrip
            eyebrow="Rule-First Entry"
            title="Know the code, then move fast."
            body="Players who read the rules first integrate faster, avoid friction, and build better stories from day one."
            primary={{ label: 'Join Discord & Enter', href: discordInviteUrl, external: true }}
            secondary={{ label: 'How to Join', href: '/how-to-join' }}
          />
        </div>
      </section>

      <Section eyebrow="Core Principles" title="Play to live, not to win">
        <div className="rule-grid" style={{ marginTop: 14 }}>
          {rules.map((r) => (
            <div key={r.t} className="rule-card">
              <div style={{ fontWeight: 760 }}>{r.t}</div>
              <div className="p" style={{ marginTop: 8 }}>{r.d}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Not Allowed" title="Behaviors that break immersion">
        <div className="grid grid-3" style={{ marginTop: 14 }}>
          {violations.map((v) => (
            <div key={v} className="card">
              <div className="small">Violation</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Enforcement" title="How rules are applied">
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <div className="card">
            <div style={{ fontWeight: 760 }}>Measured Intervention</div>
            <div className="p" style={{ marginTop: 8 }}>
              Staff prioritize education, context, and preserving the story. Most issues are solved with guidance.
            </div>
          </div>
          <div className="card">
            <div style={{ fontWeight: 760 }}>Escalation When Needed</div>
            <div className="p" style={{ marginTop: 8 }}>
              Repeated or severe violations can lead to warnings, in-world consequences, or removal.
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Final Note" title="Survive with meaning">
        <div className="callout">
          <div className="p" style={{ maxWidth: 720 }}>
            Grey Hour RP is about living with consequences and letting the world remember you. If that’s your style,
            you’re already one of us.
          </div>
          <div className="hero-actions" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href="/how-to-join">Start here</a>
            <a className="btn btn-ghost" href={discordInviteUrl} target="_blank" rel="noreferrer">Open Discord</a>
          </div>
        </div>
      </Section>
    </div>
  )
}
