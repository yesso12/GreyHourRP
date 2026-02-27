export type GunLoadoutItemKind = 'gun' | 'mag' | 'ammo' | 'attachment' | 'other'

export type GunLoadoutItem = {
  code: string
  qty: number
  kind?: GunLoadoutItemKind
}

export type GunLoadout = {
  id: string
  label: string
  gunCode: string
  items: GunLoadoutItem[]
}

export type GunLoadoutsContent = {
  updatedUtc?: string
  loadouts: GunLoadout[]
}

export type LoadoutPresetItem = { code: string; qty: number }
export type LoadoutPreset = { id: string; label: string; items: LoadoutPresetItem[] }

export type LoadoutPresetsContent = {
  updatedUtc?: string
  presets: LoadoutPreset[]
}

