import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { DossierCollection, PlayerDossier } from '../types/content'

function statusTone(status: PlayerDossier['status']) {
  if (status === 'approved') return 'good'
  if (status === 'denied') return 'bad'
  return 'warn'
}

export function Dossiers() {
  const [data, setData] = useState<DossierCollection | null>(null)

  useEffect(() => {
    fetchJson<DossierCollection>('/content/player-dossiers.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const dossiers = useMemo(
    () => (data?.dossiers ?? []).filter(item => item.status === 'approved'),
    [data]
  )
  const updatedLabel = data?.updatedUtc ? new Date(data.updatedUtc).toLocaleString() : '—'

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass" style={{ display: 'grid', gap: 10 }}>
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Player Records</span></div>
            <h1 className="hero-title">Dossiers that shape reputation.</h1>
            <div className="p" style={{ maxWidth: 860 }}>
              Approved character dossiers appear here with reputation and legacy notes.
            </div>
            <div className="small">Last updated: {updatedLabel}</div>
          </div>
        </div>
      </section>

      <Section eyebrow="Roster" title="Approved dossiers">
        {dossiers.length === 0 ? (
          <div className="card">
            <div className="p">No dossiers published yet. Check back after the next approval cycle.</div>
          </div>
        ) : (
          <div className="grid grid-2">
            {dossiers.map(dossier => (
              <div key={dossier.id} className="card">
                <div className="faction-header">
                  <div>
                    <div className="faction-title">{dossier.characterName}</div>
                    <div className="small">{dossier.handle ? `Handle: ${dossier.handle}` : 'Handle: Unknown'}</div>
                  </div>
                  <div className={`chip ${statusTone(dossier.status)}`}>
                    {(dossier.status ?? 'pending').toUpperCase()}
                  </div>
                </div>
                {dossier.backstory && (
                  <div className="p" style={{ marginTop: 8 }}>{dossier.backstory}</div>
                )}
                <div className="dossier-meta">Faction: {dossier.factionId ?? 'Independent'}</div>
                <div className="dossier-meta">Reputation: {dossier.reputation ?? 0}</div>
                <div className="dossier-meta">Commendations: {dossier.commendations ?? 0}</div>
                <div className="dossier-meta">Warnings: {dossier.warnings ?? 0}</div>
                {dossier.goals?.length ? (
                  <div className="dossier-meta">Goals: {dossier.goals.join(', ')}</div>
                ) : null}
                {dossier.tags?.length ? (
                  <div className="dossier-meta">Tags: {dossier.tags.join(', ')}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
