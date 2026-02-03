import React, { useEffect, useState } from 'react'
import { Section } from '../components/Section'
import { fetchJson } from '../components/utils'
import type { ServerStatus } from '../components/content'

const MAP: Record<ServerStatus['status'], { icon: string; title: string; hint: string }> = {
  online: { icon: '🟢', title: 'Server Online', hint: 'Knox County is open. Your choices will echo.' },
  maintenance: { icon: '🔧', title: 'Under Construction', hint: 'The world is changing. Join Discord for live updates.' },
  offline: { icon: '🔴', title: 'Server Offline', hint: 'Not every silence is the end. Check back soon.' },
}

export function Status() {
  const [s, setS] = useState<ServerStatus | null>(null)

  useEffect(() => {
    fetchJson<ServerStatus>('/content/server-status.json')
      .then(setS)
      .catch(() => setS(null))
  }, [])

  return (
    <div>
      <Section eyebrow="Server Status" title="Know before you enter.">
        <div className="card">
          {s ? (
            <>
              <div className="badge" style={{ marginBottom: 12 }}>
                <span aria-hidden="true">{MAP[s.status].icon}</span>
                <span style={{ fontWeight: 820 }}>{MAP[s.status].title}</span>
              </div>
              <div className="p" style={{ fontSize: 18 }}>{s.message}</div>
              <div className="small" style={{ marginTop: 10 }}>{MAP[s.status].hint}</div>
              <div style={{ marginTop: 14, display:'flex', flexWrap:'wrap', gap: 10 }}>
                <a className="btn btn-primary" href="https://discord.gg/e4d8YrcSt" target="_blank" rel="noreferrer">Check Discord</a>
                <a className="btn" href="/updates">Updates</a>
                <a className="btn btn-ghost" href="/how-to-join">How to Join</a>
              </div>
              <div className="hr" />
              <div className="small">
                Admin control: edit <span className="kbd">public/content/server-status.json</span> and redeploy the site.
              </div>
            </>
          ) : (
            <div className="p">Status unavailable. Please check Discord.</div>
          )}
        </div>
      </Section>
    </div>
  )
}
