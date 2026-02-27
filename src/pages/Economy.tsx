import { useEffect, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { EconomySnapshot, EconomyStatus } from '../types/content'

function upper(label: unknown, fallback = 'UNKNOWN') {
  if (typeof label === 'string' && label.trim()) return label.toUpperCase()
  if (label && typeof (label as any).toString === 'function') return (label as any).toString().toUpperCase()
  return fallback
}

function statusTone(status: EconomyStatus | undefined) {
  if (!status) return 'warn'
  if (status === 'stable') return 'good'
  if (status === 'flush') return 'good'
  if (status === 'scarce') return 'bad'
  return 'warn'
}

export function Economy() {
  const [data, setData] = useState<EconomySnapshot | null>(null)

  useEffect(() => {
    fetchJson<EconomySnapshot>('/content/economy-snapshot.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const updatedLabel = data?.updatedUtc ? new Date(data.updatedUtc).toLocaleString() : '—'

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <div className="glass" style={{ display: 'grid', gap: 10 }}>
            <div className="badge"><span style={{ color: 'var(--accent2)' }}>Economy</span></div>
            <h1 className="hero-title">Supply, demand, and scarcity.</h1>
            <div className="p" style={{ maxWidth: 860 }}>
              A pulse check on the in-world economy, updated by staff and field reports.
            </div>
            <div className="small">Last updated: {updatedLabel}</div>
          </div>
        </div>
      </section>

      <Section eyebrow="Snapshot" title="Market conditions">
        {!data ? (
          <div className="card">
            <div className="p">Economy data is staged. Check back after the next report.</div>
          </div>
        ) : (
          <div className="grid grid-2">
            <div className="card">
              <div className="faction-header">
                <div>
                  <div className="faction-title">Status</div>
                  <div className="small">{data.summary ?? 'No summary yet.'}</div>
                </div>
              <div className={`chip ${statusTone(data.status)}`}>
                {upper(data.status, 'UNKNOWN')}
              </div>
              </div>
              <div className="economy-meta">Price Index: {data.priceIndex ?? 100}</div>
              <div className="economy-meta">Scarcity Index: {data.scarcityIndex ?? 50}</div>
              {data.highlights?.length ? (
                <div className="economy-meta">Highlights: {data.highlights.join(', ')}</div>
              ) : null}
            </div>
            <div className="card">
              <div className="faction-title">Watchlist</div>
              {(data.watchlist ?? []).length === 0 ? (
                <div className="small" style={{ marginTop: 8 }}>No watchlist items.</div>
              ) : (
                <div className="economy-list">
                  {data.watchlist?.map((item, index) => (
                    <div key={`${item?.item ?? 'item'}-${index}`} className="economy-row">
                      <div>{item?.item ?? 'Unknown'}</div>
                      <div className={`chip ${statusTone(item?.status)}`}>
                        {upper(item?.status, 'UNKNOWN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section eyebrow="Categories" title="Category trends">
        {data?.categories?.length ? (
          <div className="grid grid-3">
            {data.categories.map(cat => (
              <div key={cat?.id ?? 'cat'} className="card">
                <div className="faction-title">{cat?.name ?? 'Untitled'}</div>
                <div className="economy-meta">Trend: {upper(cat?.trend ?? 'flat', 'FLAT')}</div>
                {cat?.note && <div className="small">{cat.note}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="p">No category data yet.</div>
          </div>
        )}
      </Section>
    </div>
  )
}
