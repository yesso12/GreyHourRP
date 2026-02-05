import { useEffect, useState } from 'react'
import { fetchJson } from './utils'
import type { ServerStatus } from '../types/content'

export function StatusBadge() {
  const [data, setData] = useState<ServerStatus | null>(null)

  useEffect(() => {
    const load = () => {
      fetchJson<ServerStatus>('/content/server-status.json')
        .then(setData)
        .catch(() => setData(null))
    }

    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  const status = data?.status ?? 'offline'

  const color =
    status === 'online'
      ? '#4ade80'
      : status === 'maintenance'
      ? '#facc15'
      : '#f87171'

  const label =
    status === 'online'
      ? 'Online'
      : status === 'maintenance'
      ? 'Maintenance'
      : 'Offline'

  return (
    <div
      title={data?.message}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        opacity: 0.85
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color
        }}
      />
      <span>{label}</span>
    </div>
  )
}
