import { getContent, saveContent } from './client'
import { normalizeGunLoadoutsContent, normalizeLoadoutPresetsContent } from '../lib/contentNormalize'
import type { GunLoadoutsContent, LoadoutPresetsContent } from '../../types/adminContent'

export async function loadGunLoadouts() {
  const raw = await getContent<unknown>('gun-loadouts')
  return normalizeGunLoadoutsContent(raw)
}

export async function saveGunLoadouts(data: GunLoadoutsContent) {
  return saveContent('gun-loadouts', data)
}

export async function loadLoadoutPresets() {
  const raw = await getContent<unknown>('loadout-presets')
  return normalizeLoadoutPresetsContent(raw)
}

export async function saveLoadoutPresets(data: LoadoutPresetsContent) {
  return saveContent('loadout-presets', data)
}

