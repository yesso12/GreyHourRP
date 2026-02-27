import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { Faction, FactionTerritoryState, GroupEntry, GroupRegistry, TerritoryPoint } from '../types/content'

function factionById(factions: Faction[], id?: string) {
  if (!id) return null
  return factions.find(item => item.id === id) ?? null
}

function territoryTone(status: TerritoryPoint['status']) {
  if (status === 'controlled') return 'good'
  if (status === 'contested') return 'warn'
  if (status === 'lost') return 'bad'
  return 'neutral'
}

export function Factions() {
  const [data, setData] = useState<FactionTerritoryState | null>(null)
  const [groups, setGroups] = useState<GroupRegistry | null>(null)

  useEffect(() => {
    fetchJson<FactionTerritoryState>('/content/factions-territory.json')
      .then(setData)
      .catch(() => setData(null))
    fetchJson<GroupRegistry>('/content/group-registry.json')
      .then(setGroups)
      .catch(() => setGroups(null))
  }, [])

  const factions = data?.factions ?? []
  const territories = data?.territories ?? []
  const featured = useMemo(() => factions.filter(f => f.featured), [factions])
  const updatedLabel = data?.updatedUtc ? new Date(data.updatedUtc).toLocaleString() : '—'
  const groupList = groups?.groups ?? []
  const playerFactions = useMemo(() => groupList.filter(group => group.type === 'faction'), [groupList])
  const playerShops = useMemo(() => groupList.filter(group => group.type === 'shop'), [groupList])

  function renderGroupCard(group: GroupEntry) {
    return (
      <div key={group.id} className="card">
        <div className="faction-header">
          <div>
            <div className="faction-title">{group.name}</div>
            <div className="small">{group.tagline || 'Survivor-run group'}</div>
          </div>
          <div className="chip" style={{ background: group.color ?? 'var(--surface-2)', color: 'var(--text)' }}>
            {group.type.toUpperCase()}
          </div>
        </div>
        {group.details && <div className="p" style={{ marginTop: 8 }}>{group.details}</div>}
        <div className="faction-meta">Members: {group.memberIds?.length ?? 0}</div>
      </div>
    )
  }

  return (
    <div className="factions-page">
      <section className="page-hero">
        <div className="container">
          <div className="glass" style={{ display: 'grid', gap: 10 }}>
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>World State</span></div>
            <h1 className="hero-title">Factions shape the map.</h1>
            <div className="p" style={{ maxWidth: 860 }}>
              Territory control updates as conflicts unfold. Watch alliances form, borders move, and legends rise.
            </div>
            <div className="small">Last updated: {updatedLabel}</div>
          </div>
        </div>
      </section>

      <Section eyebrow="Territory Map" title="Control, conflict, and fallout">
        {!data?.mapUrl ? (
          <div className="card">
            <div className="p">
              Map data is staged. Once the territory image is published, faction control points will display here.
            </div>
          </div>
        ) : (
          <div className="territory-map card territory-map-retro">
            <img src={data.mapUrl} alt={data.mapAlt ?? 'Territory map'} />
            {territories.map(point => {
              const faction = factionById(factions, point.factionId)
              const tone = territoryTone(point.status)
              return (
                <div
                  key={point.id}
                  className={`territory-marker ${tone}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%`, borderColor: faction?.color ?? undefined }}
                >
                  <span className="territory-dot" style={{ background: faction?.color ?? undefined }} />
                  <div>
                    <div className="territory-name">{point.name}</div>
                    <div className="territory-meta">
                      {point.status.toUpperCase()}
                      {faction?.name ? ` • ${faction.name}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
            {data.mapAttribution && (
              <div className="territory-attrib small">{data.mapAttribution}</div>
            )}
          </div>
        )}

        {data?.notes?.length ? (
          <div className="note-row" style={{ marginTop: 12 }}>
            {data.notes.map((note, index) => (
              <div key={`${note}-${index}`} className="chip">{note}</div>
            ))}
          </div>
        ) : null}
      </Section>

      {featured.length > 0 && (
        <Section eyebrow="Featured" title="Key power blocs">
          <div className="grid grid-3">
            {featured.map(faction => (
              <div key={faction.id} className="card faction-dossier-card">
                <div className="faction-header">
                  <div>
                    <div className="faction-title">{faction.icon ? `${faction.icon} ` : ''}{faction.name}</div>
                    <div className="small">{faction.tagline}</div>
                  </div>
                  <div className={`chip ${faction.status === 'active' ? 'good' : faction.status === 'dormant' ? 'warn' : 'bad'}`}>
                    {(faction.status ?? 'active').toUpperCase()}
                  </div>
                </div>
                {faction.description && (
                  <div className="p" style={{ marginTop: 8 }}>{faction.description}</div>
                )}
                <div className="faction-meta">
                  {faction.leader ? `Leader: ${faction.leader}` : 'Leader: Unknown'}
                </div>
                <div className="faction-meta">
                  {faction.headquarters ? `HQ: ${faction.headquarters}` : 'HQ: Unknown'}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section eyebrow="Roster" title="Every faction in the Grey Hour">
        {factions.length === 0 ? (
          <div className="card">
            <div className="p">Factions are being curated right now. Check back soon for the first roster drop.</div>
          </div>
        ) : (
          <div className="grid grid-2">
            {factions.map(faction => (
              <div key={faction.id} className="card faction-dossier-card">
                <div className="faction-header">
                  <div>
                    <div className="faction-title">{faction.icon ? `${faction.icon} ` : ''}{faction.name}</div>
                    <div className="small">{faction.tagline}</div>
                  </div>
                  <div className={`chip ${faction.status === 'active' ? 'good' : faction.status === 'dormant' ? 'warn' : 'bad'}`}>
                    {(faction.status ?? 'active').toUpperCase()}
                  </div>
                </div>
                {faction.description && (
                  <div className="p" style={{ marginTop: 8 }}>{faction.description}</div>
                )}
                <div className="faction-meta">Leader: {faction.leader ?? 'Unknown'}</div>
                <div className="faction-meta">HQ: {faction.headquarters ?? 'Unknown'}</div>
                <div className="faction-meta">Members: {faction.members ?? 0}</div>
                <div className="faction-meta">Reputation: {faction.reputation ?? 0}</div>
                {faction.allies?.length ? (
                  <div className="faction-meta">Allies: {faction.allies.join(', ')}</div>
                ) : null}
                {faction.rivals?.length ? (
                  <div className="faction-meta">Rivals: {faction.rivals.join(', ')}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="Player Factions" title="Survivor-run crews">
        {playerFactions.length === 0 ? (
          <div className="card">
            <div className="p">No player factions have been approved yet.</div>
          </div>
        ) : (
          <div className="grid grid-2">
            {playerFactions.map(renderGroupCard)}
          </div>
        )}
      </Section>

      <Section eyebrow="Shops" title="Player-run services">
        {playerShops.length === 0 ? (
          <div className="card">
            <div className="p">No player shops have been approved yet.</div>
          </div>
        ) : (
          <div className="grid grid-2">
            {playerShops.map(renderGroupCard)}
          </div>
        )}
      </Section>
    </div>
  )
}
