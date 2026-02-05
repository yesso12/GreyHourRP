import { Section } from '../components/Section'

type StaffMember = {
  name: string
  role: string
  description: string
}

const staff: StaffMember[] = [
  {
    name: 'Server Owner',
    role: 'Owner',
    description:
      'Maintains the vision, long-term direction, and final responsibility for the world.'
  },
  {
    name: 'Admin Team',
    role: 'Administrators',
    description:
      'Handle moderation, world continuity, and support when things go wrong.'
  },
  {
    name: 'Support Staff',
    role: 'Moderators',
    description:
      'Help resolve issues, answer questions, and keep interactions fair and immersive.'
  }
]

export function Staff() {
  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass">
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Caretakers</span></div>
            <h1 className="hero-title">The council behind the Grey Hour.</h1>
            <div className="p" style={{ maxWidth: 820 }}>
              Staff are here to protect immersion, fairness, and continuity — not to control outcomes.
            </div>
          </div>
        </div>
      </section>

      <Section eyebrow="Roles" title="How the team functions">
        <div className="staff-grid" style={{ marginTop: 14 }}>
          {staff.map((s) => (
            <div key={s.role} className="card">
              <div className="small">{s.name}</div>
              <div style={{ fontWeight: 760, marginTop: 6 }}>{s.role}</div>
              <div className="p" style={{ marginTop: 8 }}>{s.description}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Approach" title="How staff intervene">
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <div className="signal-card">
            <div style={{ fontWeight: 760 }}>Minimal Intervention</div>
            <div className="p" style={{ marginTop: 8 }}>
              Staff avoid interfering in player-driven stories unless rules, fairness, or server stability are at risk.
            </div>
          </div>
          <div className="signal-card">
            <div style={{ fontWeight: 760 }}>Transparency</div>
            <div className="p" style={{ marginTop: 8 }}>
              Major decisions, changes, and enforcement actions are explained whenever possible.
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Contact" title="Need help or clarification?">
        <div className="callout">
          <div className="p" style={{ maxWidth: 720 }}>
            The best way to reach staff is through Discord. Open a ticket or tag a moderator if you need help.
          </div>
          <div className="hero-actions" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">
              Contact Staff on Discord
            </a>
            <a className="btn btn-ghost" href="/rules">View rules</a>
          </div>
        </div>
      </Section>
    </div>
  )
}
