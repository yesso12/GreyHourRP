type ItemLike = {
  code: string
  name?: string
  category?: string
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((k) => text.includes(k))
}

function uniq(parts: string[]) {
  return Array.from(new Set(parts)).filter(Boolean)
}

// Heuristic labels to reduce staff guesswork when spawning ammo/magazines.
// This is intentionally conservative: only add a "for X" label when we're pretty sure.
export function ammoOrMagazineHint(item: ItemLike): string | null {
  const code = String(item.code ?? '').trim()
  if (!code) return null

  const text = `${code} ${item.name ?? ''} ${item.category ?? ''}`.toLowerCase()

  const isMagazine = includesAny(text, ['magazine', 'clip']) || /(^|\.)([0-9a-z_]+)?clip\b/.test(text)
  const isAmmo = includesAny(text, ['ammo', 'bullet', 'bullets', 'round', 'rounds', 'shell', 'shells', 'cartridge'])

  if (!isMagazine && !isAmmo) return null

  const targets: string[] = []

  // Shotgun shells.
  if (includesAny(text, ['shotgun', 'shotgunshell', 'shotgun shell', 'shells'])) {
    // Avoid mislabeling generic "shell" (like a casing) by requiring shotgun-ish context.
    if (includesAny(text, ['shotgun', 'shotgunshell', 'shotgun shell'])) targets.push('Shotgun')
  }

  // Common calibers in vanilla and many weapon packs.
  if (includesAny(text, ['5.56', '5_56', '556', '556bullets', '556clip'])) targets.push('M16 / 5.56 Rifles')
  if (includesAny(text, ['0.308', '.308', '308', '308bullets'])) targets.push('Hunting Rifle / M14 (0.308)')
  if (includesAny(text, ['9mm', '9_mm', 'bullets9mm', '9mmclip'])) targets.push('9mm Pistols / SMGs')
  if (includesAny(text, ['.45', '0.45', '45acp', 'bullets45', '45clip'])) targets.push('.45 Pistols')
  if (includesAny(text, ['.44', '0.44', 'bullets44'])) targets.push('.44 Revolvers')
  if (includesAny(text, ['.38', '0.38', 'bullets38'])) targets.push('.38 Revolvers')
  if (includesAny(text, ['.357', '357', 'bullets357'])) targets.push('.357 Revolvers')
  if (includesAny(text, ['.223', '223', '223bullets'])) targets.push('.223 Rifles')
  if (includesAny(text, ['7.62', '7_62', '762'])) targets.push('7.62 Rifles')

  // Explicit weapon hints (mods often include these in item names/codes).
  if (includesAny(text, ['m16'])) targets.push('M16')
  if (includesAny(text, ['m14'])) targets.push('M14')
  if (includesAny(text, ['ak', 'ak47', 'kalash'])) targets.push('AK')

  const uniqueTargets = uniq(targets)
  if (uniqueTargets.length === 0) return isMagazine ? 'Magazine' : 'Ammo'

  return `${isMagazine ? 'Magazine' : 'Ammo'} for ${uniqueTargets.join(' / ')}`
}

export type CaliberKey =
  | 'shotgun'
  | '556'
  | '308'
  | '223'
  | '762'
  | '9mm'
  | '45'
  | '44'
  | '38'
  | '357'

export function inferCaliberKeys(item: ItemLike): CaliberKey[] {
  const code = String(item.code ?? '').trim()
  const text = `${code} ${item.name ?? ''} ${item.category ?? ''}`.toLowerCase()

  const keys: CaliberKey[] = []

  if (includesAny(text, ['shotgun', 'shotgunshell', 'shotgun shell'])) keys.push('shotgun')
  if (includesAny(text, ['5.56', '5_56', '556', '556bullets', '556clip'])) keys.push('556')
  if (includesAny(text, ['0.308', '.308', '308', '308bullets'])) keys.push('308')
  if (includesAny(text, ['.223', '223', '223bullets'])) keys.push('223')
  if (includesAny(text, ['7.62', '7_62', '762'])) keys.push('762')
  if (includesAny(text, ['9mm', '9_mm', 'bullets9mm', '9mmclip'])) keys.push('9mm')
  if (includesAny(text, ['.45', '0.45', '45acp', 'bullets45', '45clip'])) keys.push('45')
  if (includesAny(text, ['.44', '0.44', 'bullets44'])) keys.push('44')
  if (includesAny(text, ['.38', '0.38', 'bullets38'])) keys.push('38')
  if (includesAny(text, ['.357', '357', 'bullets357'])) keys.push('357')

  // Explicit weapon model -> caliber assumptions (vanilla + common packs).
  if (includesAny(text, ['m16', 'assault rifle'])) keys.push('556')
  if (includesAny(text, ['m14', 'hunting rifle'])) keys.push('308')

  return uniq(keys) as CaliberKey[]
}

export function isGunLike(item: ItemLike): boolean {
  const text = `${item.code} ${item.name ?? ''} ${item.category ?? ''}`.toLowerCase()
  return includesAny(text, ['pistol', 'revolver', 'rifle', 'shotgun', 'smg', 'firearm', 'weapon', 'gun', 'm16', 'm14', 'ak'])
}

export function isAmmoOrMagazineLike(item: ItemLike): boolean {
  const text = `${item.code} ${item.name ?? ''} ${item.category ?? ''}`.toLowerCase()
  return includesAny(text, ['ammo', 'bullet', 'bullets', 'round', 'rounds', 'shell', 'shells', 'magazine', 'clip', 'cartridge'])
}

export function relatedAmmoAndMagsForGun<T extends ItemLike>(gun: T, allItems: T[]): T[] {
  const keys = inferCaliberKeys(gun)
  if (keys.length === 0) return []
  return allItems
    .filter(isAmmoOrMagazineLike)
    .filter((it) => {
      const k = inferCaliberKeys(it)
      return k.some((x) => keys.includes(x))
    })
}

export function relatedGunsForAmmoOrMag<T extends ItemLike>(ammoOrMag: T, allItems: T[]): T[] {
  const keys = inferCaliberKeys(ammoOrMag)
  if (keys.length === 0) return []
  return allItems
    .filter(isGunLike)
    .filter((it) => {
      const k = inferCaliberKeys(it)
      return k.some((x) => keys.includes(x))
    })
}

function normalizeWords(text: string): string[] {
  const words = String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
  // Drop super-generic terms that create a lot of false matches.
  return words.filter((w) => !['base', 'weapon', 'gun', 'firearm', 'rifle', 'pistol', 'shotgun', 'smg'].includes(w))
}

export function inferGunTokens(item: ItemLike): string[] {
  const code = String(item.code ?? '').trim()
  const itemPart = code.includes('.') ? code.split('.', 2)[1] : code
  const words = normalizeWords(`${itemPart} ${item.name ?? ''}`)

  // Keep short-but-meaningful model tokens.
  const keep = words.filter((w) => w.length >= 3 || ['ak', 'm4', 'm9'].includes(w))
  return uniq(keep)
}

export function isWeaponAttachmentLike(item: ItemLike): boolean {
  const text = `${item.code} ${item.name ?? ''} ${item.category ?? ''}`.toLowerCase()
  if (includesAny(text, ['ammo', 'bullet', 'bullets', 'shell', 'shells', 'magazine', 'clip'])) return false

  return includesAny(text, [
    'scope',
    'sight',
    'reddot',
    'red dot',
    'holo',
    'holographic',
    'laser',
    'suppressor',
    'silencer',
    'muzzle',
    'compensator',
    'brake',
    'grip',
    'foregrip',
    'bipod',
    'stock',
    'strap',
    'sling',
    'choke',
    'tube',
    'rail',
    'mount',
    'weaponpart',
    'weapon part',
    'gunpart',
    'gun part'
  ])
}

export function relatedAttachmentsForGun<T extends ItemLike>(gun: T, allItems: T[]): T[] {
  const gunTokens = inferGunTokens(gun)
  const gunText = `${gun.code} ${gun.name ?? ''}`.toLowerCase()

  // Generic attachments should show for all guns.
  const isGeneric = (t: string) =>
    includesAny(t, ['laser', 'sling', 'strap', 'stock', 'scope', 'sight', 'red dot', 'holo', 'suppressor', 'silencer', 'muzzle', 'rail', 'mount'])

  return allItems
    .filter(isWeaponAttachmentLike)
    .filter((it) => {
      const t = `${it.code} ${it.name ?? ''} ${it.category ?? ''}`.toLowerCase()
      if (isGeneric(t)) return true
      if (gunTokens.length > 0 && gunTokens.some((tok) => t.includes(tok))) return true
      // Shotgun-specific parts.
      if (gunText.includes('shotgun') && includesAny(t, ['choke', 'tube'])) return true
      return false
    })
}

export function pickDefaultAmmoAndMagForGun<T extends ItemLike>(gun: T, allItems: T[]) {
  const related = relatedAmmoAndMagsForGun(gun, allItems)
  if (related.length === 0) return { ammo: null as T | null, magazine: null as T | null }

  const ammo = related.find((x) => /bullets|bullet|shells|shell|ammo|round/i.test(`${x.code} ${x.name ?? ''}`)) ?? null
  const magazine = related.find((x) => /magazine|clip/i.test(`${x.code} ${x.name ?? ''}`)) ?? null
  return { ammo, magazine }
}
