export type ServerStatus = {
  status: 'online' | 'maintenance' | 'offline'
  message: string
  lastUpdated: string
}

export type Transmission = {
  id: string
  date: string
  title: string
  body: string[]
  tag?: string
}

export type UpdateItem = {
  id: string
  date: string
  type: 'Update' | 'Hotfix' | 'Balance' | 'Event'
  version?: string
  title: string
  items: string[]
}

export type ModItem = {
  name: string
  version?: string
  required?: boolean
  note?: string
}

export type ModCategory = {
  category: string
  items: ModItem[]
}

export type StaffMember = {
  name: string
  handle?: string
  bio?: string
}

export type Rule = {
  title: string
  body: string
}
