import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { StoryArc, StoryArcCollection } from '../types/content'

function arcTone(status: StoryArc['status']) {
  if (status === 'live') return 'good'
  if (status === 'complete') return 'good'
  if (status === 'paused') return 'warn'
  return 'warn'
}

export function StoryArcs() {
  const [data, setData] = useState<StoryArcCollection | null>(null)

  useEffect(() => {
    fetchJson<StoryArcCollection>('/content/story-arcs.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const arcs = data?.arcs ?? []
  const featured = useMemo(() => arcs.filter(item => item.featured), [arcs])
  const updatedLabel = data?.updatedUtc ? new Date(data.updatedUtc).toLocaleString() : '—'

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass" style={{ display: 'grid', gap: 10 }}>
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Story Engine</span></div>
            <h1 className="hero-title">Seasonal arcs that reshape the world.</h1>
            <div className="p" style={{ maxWidth: 860 }}>
              Each arc is a living thread with phases, objectives, and consequences.
            </div>
            <div className="small">Last updated: {updatedLabel}</div>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <Section eyebrow="Featured" title="Current focus">
          <div className="grid grid-2">
            {featured.map(arc => (
              <div key={arc.id} className="card">
                <div className="faction-header">
                  <div>
                    <div className="faction-title">{arc.title}</div>
                    <div className="small">{arc.season ?? 'Season'}</div>
                  </div>
                  <div className={`chip ${arcTone(arc.status)}`}>
                    {(arc.status ?? 'planning').toUpperCase()}
                  </div>
                </div>
                {arc.summary && (
                  <div className="p" style={{ marginTop: 8 }}>{arc.summary}</div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section eyebrow="Timeline" title="Arc phases">
        {arcs.length === 0 ? (
          <div className="card">
            <div className="p">No arcs published yet. The first season is assembling.</div>
          </div>
        ) : (
          <div className="arc-grid">
            {arcs.map(arc => (
              <div key={arc.id} className="card">
                <div className="faction-header">
                  <div>
                    <div className="faction-title">{arc.title}</div>
                    <div className="small">{arc.season ?? 'Season'}</div>
                  </div>
                  <div className={`chip ${arcTone(arc.status)}`}>
                    {(arc.status ?? 'planning').toUpperCase()}
                  </div>
                </div>
                {arc.summary && (
                  <div className="p" style={{ marginTop: 8 }}>{arc.summary}</div>
                )}
                <div className="arc-phase-list">
                  {arc.phases.map(phase => (
                    <div key={phase.id} className={`arc-phase ${phase.status}`}>
                      <div className="arc-phase-title">{phase.name}</div>
                      <div className="small">{phase.summary}</div>
                      {phase.objectives?.length ? (
                        <div className="arc-phase-meta">Objectives: {phase.objectives.join(', ')}</div>
                      ) : null}
                      {phase.outcomes?.length ? (
                        <div className="arc-phase-meta">Outcomes: {phase.outcomes.join(', ')}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
