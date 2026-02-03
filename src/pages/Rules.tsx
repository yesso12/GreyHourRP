import React, { useEffect, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { Rule } from '../components/content'

export function Rules() {
  const [rules, setRules] = useState<Rule[] | null>(null)

  useEffect(() => {
    fetchJson<Rule[]>('/content/rules.json')
      .then(setRules)
      .catch(() => setRules(null))
  }, [])

  return (
    <div>
      <Section eyebrow="Standards" title="Rules that protect the story.">
        <div className="p" style={{ maxWidth: 820 }}>
          These aren’t here to police fun — they exist to protect continuity, reputation, and the feeling that the world is real.
        </div>

        <div className="grid grid-2" style={{ marginTop: 14 }}>
          {(rules ?? []).map(r => (
            <div key={r.title} className="card">
              <div style={{ fontWeight: 760 }}>{r.title}</div>
              <div className="p" style={{ marginTop: 8 }}>{r.body}</div>
            </div>
          ))}
        </div>

        <div className="hr" />
        <div className="card">
          <div style={{ fontWeight: 760 }}>Questions?</div>
          <div className="p" style={{ marginTop: 8 }}>
            If you’re unsure how to handle a situation in-character, ask in Discord. We’d rather teach standards than punish mistakes.
          </div>
          <div style={{ marginTop: 12 }}>
            <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">Ask in Discord</a>
          </div>
        </div>
      </Section>
    </div>
  )
}
