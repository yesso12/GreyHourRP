import { useEffect, useMemo, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { LevelBoard } from '../types/content'

const fallback: LevelBoard = { updatedUtc: new Date().toISOString(), entries: [] }

function fmtDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function Levels() {
  const [board, setBoard] = useState<LevelBoard>(fallback)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchJson<LevelBoard>('/content/level-board.json')
      .then((data) => {
        if (!mounted) return
        setBoard(data && Array.isArray(data.entries) ? data : fallback)
      })
      .catch(() => {
        if (!mounted) return
        setBoard(fallback)
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return board.entries
    return board.entries.filter((entry) => entry.userId.toLowerCase().includes(q))
  }, [board.entries, query])

  return (
    <div>
      <Section eyebrow="Progression" title="Survivor Levels">
        <p className="lead">
          Community XP is tracked from in-server chat and voice. The board below refreshes automatically from Discord.
        </p>
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-row">
            <div className="panel-label">Last sync</div>
            <div className="panel-value">{fmtDate(board.updatedUtc)}</div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Leaderboard" title="Top Survivors">
        <div className="filters" style={{ marginBottom: 14 }}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by Discord user ID"
          />
          <div className="meta">Showing {entries.length} survivors</div>
        </div>

        {loading ? (
          <div className="card">Loading levels…</div>
        ) : entries.length === 0 ? (
          <div className="card">No level data yet.</div>
        ) : (
          <div className="grid" style={{ gap: 16 }}>
            {entries.slice(0, 200).map((entry, idx) => (
              <div key={entry.userId} className="card">
                <div className="card-title">Rank #{idx + 1}</div>
                <div className="card-sub">User ID: {entry.userId}</div>
                <div className="card-meta">Level {entry.level} • {entry.xp} XP</div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
