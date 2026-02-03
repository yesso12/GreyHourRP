import React from 'react'
import { Section } from '../components/Section'

export function About() {
  return (
    <div>
      <Section eyebrow="Grey Hour RP" title="A persistent world that remembers.">
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <div className="card">
            <div style={{ fontWeight: 760 }}>Server Type</div>
            <div className="p" style={{ marginTop: 8 }}>
              Persistent semi-serious roleplay with occasional wipes. PvPvE. Permadeath is dictated through roleplay — handled with respect and continuity.
            </div>
            <div className="hr" />
            <div style={{ fontWeight: 760 }}>Our promise</div>
            <div className="p" style={{ marginTop: 8 }}>
              The world doesn’t revolve around you — it reacts to you. Every story bleeds into the next. Every decision is a ripple.
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 760 }}>What makes Grey Hour different</div>
            <div className="p" style={{ marginTop: 8 }}>
              We build continuity. We observe more than we interfere. We protect the story — not outcomes.
            </div>
            <div className="hr" />
            <div style={{ fontWeight: 760 }}>Learnable RP</div>
            <div className="p" style={{ marginTop: 8 }}>
              No harsh gatekeeping. Roleplay standards can be learned and taught as the server progresses. We won’t be brutal about your experience level — we care about intent and consistency.
            </div>
          </div>
        </div>
      </Section>

      <Section eyebrow="A note from the world" title="There is no reset coming.">
        <div className="card">
          <div className="p" style={{ fontSize: 18 }}>
            People remember faces they no longer see. Look for order where none remains.
            Build factions out of fear, loyalty, or a sense of control.
          </div>
          <div className="p" style={{ marginTop: 10, fontSize: 18 }}>
            Habit is comfort — and risk. Adapt. Persevere. Follow the instincts that keep you alive.
            You never know which day may be your last.
          </div>
        </div>
      </Section>
    </div>
  )
}
