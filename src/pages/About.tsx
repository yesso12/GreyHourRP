import { Section } from '../components/Section'
import { ConversionStrip } from '../components/ConversionStrip'
import logo from '../assets/logo.png'
import { useDiscordInvite } from '../hooks/useDiscordInvite'

export function About() {
  const discordInviteUrl = useDiscordInvite('about_primary_cta')

  return (
    <div>
      <section className="page-hero">
        <div className="container" style={{ display: 'grid', gap: 18 }}>
          <div className="glass" style={{ display: 'grid', gap: 12 }}>
            <div className="badge">
              <span style={{ color: 'var(--accent2)' }}>Grey Hour Lore</span>
            </div>
            <h1 className="hero-title">The silence before the fall.</h1>
            <div className="p" style={{ maxWidth: 860 }}>
              Day One didn’t end with screams or firestorms. It ended with silence.
              Phones lost signal before anyone understood why, emergency broadcasts
              looped half-finished warnings, and the sky hung in a strange, unmoving haze.
              People were told to stay inside, to wait for help, to trust that order
              would return by morning. It never did.
            </div>
            <div className="hero-actions" style={{ marginTop: 14 }}>
              <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">Join Discord</a>
              <a className="btn" href="/how-to-join">Enter the Server</a>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <img src={logo} alt="Grey Hour RP emblem" style={{ width: 96, height: 96 }} />
            <div>
              <div style={{ fontWeight: 760 }}>The Grey Hour</div>
              <div className="small">The moment the world balanced between what it was and what it would become.</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '8px 0 0' }}>
        <div className="container">
          <ConversionStrip
            eyebrow="Your Chapter"
            title="The world is written by who shows up."
            body="If this setting matches your style, move now. Join Discord, pick your first direction, and enter the Grey Hour."
            primary={{ label: 'Join Discord Now', href: discordInviteUrl, external: true }}
            secondary={{ label: 'How to Join', href: '/how-to-join' }}
          />
        </div>
      </section>

      <Section eyebrow="The Fall" title="When the world slipped into dusk">
        <div className="lore-columns">
          <div className="lore-block">
            <div className="p">
              By dusk, neighbors stopped answering doors. By midnight, the dead began to walk — slowly at first,
              confused, almost human. Those early hours became known as the Grey Hour: the moment when the world
              balanced between what it was and what it would become.
            </div>
          </div>
          <div className="lore-block">
            <div className="p">
              Weeks passed, then months. Governments collapsed behind sealed bunkers and unanswered commands.
              Cities rotted from the inside out as fires burned unchecked and streets filled with bodies that
              refused to stay down.
            </div>
          </div>
          <div className="lore-block">
            <div className="p">
              The infection spread faster than any cure, turning hospitals into slaughterhouses and evacuation
              routes into mass graves. Survivors learned quickly that noise meant death, trust was dangerous, and
              daylight offered no safety.
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Now" title="Life in the Grey Hour">
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <div className="signal-card">
            <div style={{ fontWeight: 760 }}>Fragments of order</div>
            <div className="p" style={{ marginTop: 8 }}>
              The old rules — laws, money, morality — faded like static on a dead radio. The world exists in fragments
              now, and every faction writes its own code.
            </div>
          </div>
          <div className="signal-card">
            <div style={{ fontWeight: 760 }}>Survival with a memory</div>
            <div className="p" style={{ marginTop: 8 }}>
              Every decision carries weight. Every stranger could be a threat. Every dawn feels borrowed.
              Hope hasn’t died — but it is quieter now.
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="The Timeline" title="How the Grey Hour unfolded">
        <div className="timeline">
          <div className="timeline-item">
            <div className="timeline-title">Hour 0</div>
            <div className="small">Emergency broadcasts stall. Signals die. Doors close.</div>
          </div>
          <div className="timeline-item">
            <div className="timeline-title">Hour 6</div>
            <div className="small">Movement in the streets. The first infected are seen.</div>
          </div>
          <div className="timeline-item">
            <div className="timeline-title">Week 1</div>
            <div className="small">Hospitals fall. Evac routes become mass graves.</div>
          </div>
          <div className="timeline-item">
            <div className="timeline-title">Month 1</div>
            <div className="small">Factions emerge. The world fractures.</div>
          </div>
          <div className="timeline-item">
            <div className="timeline-title">Now</div>
            <div className="small">The Grey Hour never ended. The story is yours.</div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Join" title="Write your chapter in the Grey Hour">
        <div className="callout">
          <div className="p" style={{ maxWidth: 720 }}>
            This is not the end of the world. It is the brutal aftermath. If you want your decisions to carry weight
            and your character to matter, the Grey Hour is waiting.
          </div>
          <div className="hero-actions" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href={discordInviteUrl} target="_blank" rel="noreferrer">Join Discord & Start</a>
            <a className="btn btn-ghost" href="/rules">Read the rules</a>
          </div>
        </div>
      </Section>
    </div>
  )
}
