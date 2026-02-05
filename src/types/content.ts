export type Transmission = {
  id: string
  date: string
  title: string
  body: string[]
  category?: string
  pinned?: boolean
}

export type UpdateItem = {
  id: string
  date: string
  title: string
  body: string[]
}

export type ServerStatus = {
  status: 'online' | 'offline' | 'maintenance'
  message?: string
  updatedUtc?: string
}

export type StatusHistoryItem = {
  id: string
  dateUtc: string
  status: 'online' | 'offline' | 'maintenance'
  message?: string | null
}

export type ModItem = {
  id: string
  name: string
  workshopId?: string
  modId?: string
  category?: string
  required?: boolean
  description?: string
}

export type AdminRole = 'owner' | 'editor' | 'ops'

export type AdminUserMap = Record<string, AdminRole>
