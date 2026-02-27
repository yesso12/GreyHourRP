import type {
  GunLoadout,
  GunLoadoutItem,
  GunLoadoutsContent,
  GunLoadoutItemKind,
  LoadoutPreset,
  LoadoutPresetsContent
} from '../../types/adminContent'

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function asQty(value: unknown) {
  const n = Number(value)
  return Math.max(1, Math.floor(Number.isFinite(n) ? n : 1))
}

export function normalizeLoadoutPresets(input: unknown): LoadoutPreset[] {
  const presets = Array.isArray((input as any)?.presets)
    ? (input as any).presets
    : (Array.isArray(input) ? input : [])

  return (presets as any[])
    .map((row) => ({
      id: asString(row?.id),
      label: asString(row?.label),
      items: Array.isArray(row?.items)
        ? (row.items as any[])
          .map((it) => ({
            code: asString(it?.code),
            qty: asQty(it?.qty ?? it?.count ?? 1)
          }))
          .filter((it) => it.code.length > 0)
        : []
    }))
    .filter((row) => row.id.length > 0 && row.label.length > 0 && row.items.length > 0)
}

export function normalizeLoadoutPresetsContent(input: unknown): LoadoutPresetsContent {
  const updatedUtc = asString((input as any)?.updatedUtc) || undefined
  return { updatedUtc, presets: normalizeLoadoutPresets(input) }
}

export function normalizeGunLoadouts(input: unknown): GunLoadout[] {
  const loadouts = Array.isArray((input as any)?.loadouts)
    ? (input as any).loadouts
    : (Array.isArray(input) ? input : [])

  return (loadouts as any[])
    .map((row) => {
      const items: GunLoadoutItem[] = Array.isArray(row?.items)
        ? (row.items as any[])
          .map((it) => ({
            code: asString(it?.code),
            qty: asQty(it?.qty ?? it?.count ?? 1),
            kind: (() => {
              const raw = asString(it?.kind).toLowerCase()
              const allowed: GunLoadoutItemKind[] = ['gun', 'mag', 'ammo', 'attachment', 'other']
              return (allowed as string[]).includes(raw) ? (raw as GunLoadoutItemKind) : undefined
            })()
          }))
          .filter((it) => it.code.length > 0)
        : []

      return {
        id: asString(row?.id),
        label: asString(row?.label),
        gunCode: asString(row?.gunCode),
        items
      } satisfies GunLoadout
    })
    .filter((row) => row.id.length > 0 && row.label.length > 0 && row.gunCode.length > 0 && row.items.length > 0)
}

export function normalizeGunLoadoutsContent(input: unknown): GunLoadoutsContent {
  const updatedUtc = asString((input as any)?.updatedUtc) || undefined
  return { updatedUtc, loadouts: normalizeGunLoadouts(input) }
}
