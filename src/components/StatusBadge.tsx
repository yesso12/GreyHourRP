import React, { useEffect, useState } from 'react'
import { fetchJson } from './utils'
import type { ServerStatus } from './content'

const DOT: Record<ServerStatus['status'], string> = {
  online: '🟢',
  maintenance: '🔧',
  offline: '🔴'
}

const LABEL: Record<ServerStatus['status'], string> = {
  online: 'Server Online',
  maintenance: 'Under Construction',
  offline: 'Server Offline'
}

export function StatusBadge() {
  const [data, setData] = useState<ServerStatus | null>(null)

  useEffect(() => {
    fetchJson<ServerStatus>('/content/server-status.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) return null

  return (
    <div className="badge" style={{ gap: 10 }}>
      <span aria-hidden="true">{DOT[data.status]}</span>
      <div style={{ display:'flex', flexDirection:'column' }}>
        <span style={{ fontWeight: 720, letterSpacing: '-0.01em' }}>{LABEL[data.status]}</span>
        <span className="small" style={{ marginTop: 2 }}>{data.message}</span>
      </div>
    </div>
  )
}
