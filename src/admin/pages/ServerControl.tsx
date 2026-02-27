import { useEffect, useMemo, useRef, useState } from 'react'
import {
  acknowledgeItemLoss,
  appendOpsLog,
  getContent,
  getGamePlayersWithSource,
  getGameMapStreets,
  getItemLossWatch,
  getServerConsoleDiagnostics,
  getServerControlConsole,
  getServerControlResources,
  getServerControlStatus,
  validateItemCode,
  pollServerConsole,
  runGameServerCommand,
  runGameQuickAction,
  sendServerCommand,
  sendServerPower,
  syncItemCatalog,
  type ServerControlPowerSignal
} from '../api/client'
import {
  loadGunLoadouts as apiLoadGunLoadouts,
  loadLoadoutPresets as apiLoadLoadoutPresets,
  saveGunLoadouts as apiSaveGunLoadouts,
  saveLoadoutPresets as apiSaveLoadoutPresets
} from '../api/contentClient'
import {
  ammoOrMagazineHint,
  isAmmoOrMagazineLike,
  isGunLike,
  inferGunTokens,
  pickDefaultAmmoAndMagForGun,
  relatedAttachmentsForGun,
  relatedAmmoAndMagsForGun,
  relatedGunsForAmmoOrMag
} from '../../lib/itemHints'
import type { GunLoadout, GunLoadoutItem, GunLoadoutsContent, LoadoutPreset, LoadoutPresetsContent } from '../../types/adminContent'
import { normalizeLoadoutPresetsContent } from '../lib/contentNormalize'

// Admin page for real-time Project Zomboid server controls via Pterodactyl Client API.
type ConsoleLine = {
  ts: string
  text: string
  tone?: 'normal' | 'warn' | 'error' | 'info'
}

type ItemCatalogPayload = {
  items?: Array<{
    code?: string
    name?: string
    category?: string
    sourceModId?: string
    sourceWorkshopId?: string
  }>
}

type ItemGroup =
  | 'all'
  | 'guns'
  | 'ammo'
  | 'medical'
  | 'food'
  | 'electrical'
  | 'communications'
  | 'car_parts'
  | 'building'
  | 'tools'
  | 'clothing'
  | 'other'

type CatalogItem = {
  code: string
  name: string
  category?: string
  sourceModId?: string
  sourceWorkshopId?: string
}

type ServerModRow = {
  modId?: string
  workshopId?: string
  source?: string
  required?: boolean
}

type GiveFailureDetails = {
  time: string
  player: string
  requestedCode: string
  triedCandidates: string[]
  triedCommands: string[]
  lastResponseText: string
}

type BulkGrantFailure = { code: string; qty: number; error: string }

type ItemValidation = {
  time: string
  code: string
  inCatalog: boolean
  active: boolean
  kind?: string
  caliberKeys?: string[]
  reasons?: string[]
  sourceModId?: string
  sourceWorkshopId?: string
}
type PlayerPosition = { name: string; raw: string; x?: number; y?: number; z?: number }
type RolePresetItem = { code: string; qty: number }
type DraftRolePresetItem = { code: string; qty: number; enabled: boolean }
type RolePreset = { id: string; label: string; items: RolePresetItem[] }
type MapSourceId = 'b42map' | 'pz-official' | 'map-six'
type PositionFeedSourceId = 'live' | 'test'
type PlayerTracePoint = { name: string; x: number; y: number; z?: number; timeUtc: string }
type StreetPoint = { name: string; x: number; y: number; samples?: number }
type ItemType =
  | 'all'
  | 'pistol'
  | 'rifle'
  | 'shotgun'
  | 'smg'
  | 'melee'
  | 'ammo'
  | 'magazine'
  | 'engine'
  | 'tire'
  | 'brake'
  | 'suspension'
  | 'electrical'
  | 'body'
  | 'construction'
  | 'metalwork'
  | 'woodwork'
  | 'consumable'
  | 'general'
type GiveMode = 'presets' | 'manual'
type QtyProfileId = 'single' | 'squad' | 'unit' | 'stockpile'
type PresetBundle = { id: string; label: string; presetIds: string[] }

const ITEM_GROUP_OPTIONS: Array<{ value: ItemGroup; label: string }> = [
  { value: 'all', label: 'All Items' },
  { value: 'guns', label: 'Guns' },
  { value: 'ammo', label: 'Ammo' },
  { value: 'medical', label: 'Medical' },
  { value: 'food', label: 'Food' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'communications', label: 'Communications' },
  { value: 'car_parts', label: 'Car Parts' },
  { value: 'building', label: 'Building' },
  { value: 'tools', label: 'Tools' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'other', label: 'Other' }
]

const BUILTIN_ROLE_PRESETS: RolePreset[] = [
  {
    id: 'police',
    label: 'Police Officer',
    items: [
      { code: 'Base.Pistol', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 60 },
      { code: 'Base.Nightstick', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 },
      { code: 'Base.Bandage', qty: 4 }
    ]
  },
  {
    id: 'interrogator',
    label: 'Interrogator (Auto List)',
    items: [
      { code: 'Base.Notebook', qty: 3 },
      { code: 'Base.Clipboard', qty: 2 },
      { code: 'Base.Pen', qty: 4 },
      { code: 'Base.BluePen', qty: 2 },
      { code: 'Base.RedPen', qty: 2 },
      { code: 'Base.Pencil', qty: 3 },
      { code: 'Base.WalkieTalkie3', qty: 1 },
      { code: 'Base.HamRadio1', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 },
      { code: 'Base.FlashLight_AngleHead', qty: 1 },
      { code: 'Base.Lighter', qty: 1 },
      { code: 'Base.Rope', qty: 1 },
      { code: 'Base.SheetRope', qty: 1 },
      { code: 'Base.CameraExpensive', qty: 1 },
      { code: 'Base.Bag_Police', qty: 1 }
    ]
  },
  {
    id: 'military',
    label: 'Military',
    items: [
      { code: 'Base.M16', qty: 1 },
      { code: 'Base.556Clip', qty: 4 },
      { code: 'Base.556Bullets', qty: 120 },
      { code: 'Base.HuntingKnife', qty: 1 },
      { code: 'Base.FirstAidKit', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 }
    ]
  },
  {
    id: 'dustin-vale',
    label: 'Dustin Vale (M16 Kit)',
    items: [
      { code: 'Base.M16', qty: 1 },
      { code: 'Base.556Clip', qty: 4 },
      { code: 'Base.556Bullets', qty: 120 }
    ]
  },
  {
    id: 'military-advanced',
    label: 'Advanced Military',
    items: [
      { code: 'Base.AssaultRifle', qty: 1 },
      { code: 'Base.AssaultRifle2', qty: 1 },
      { code: 'Base.556Bullets', qty: 360 },
      { code: 'Base.556Clip', qty: 8 },
      { code: 'Base.HuntingRifle', qty: 1 },
      { code: 'Base.308Bullets', qty: 120 },
      { code: 'Base.Pistol3', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 180 },
      { code: 'Base.9mmClip', qty: 8 },
      { code: 'Base.Vest_BulletArmy', qty: 1 },
      { code: 'Base.Hat_PeakedCapArmy', qty: 1 },
      { code: 'Base.HolsterDouble', qty: 1 },
      { code: 'Base.Bag_Military', qty: 1 },
      { code: 'Base.Bag_AmmoBox', qty: 2 },
      { code: 'Base.FirstAidKit_Military', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 1 }
    ]
  },
  {
    id: 'swat',
    label: 'SWAT (Armored Assault)',
    items: [
      { code: 'Base.AssaultRifle2', qty: 1 },
      { code: 'Base.Shotgun', qty: 1 },
      { code: 'Base.Pistol2', qty: 1 },
      { code: 'Base.556Bullets', qty: 220 },
      { code: 'Base.556Clip', qty: 6 },
      { code: 'Base.ShotgunShells', qty: 120 },
      { code: 'Base.Bullets9mm', qty: 120 },
      { code: 'Base.9mmClip', qty: 6 },
      { code: 'Base.Vest_BulletPolice', qty: 1 },
      { code: 'Base.Hat_RiotHelmet', qty: 1 },
      { code: 'Base.HolsterShoulder', qty: 1 },
      { code: 'Base.Kneepad_Left_Tactical', qty: 1 },
      { code: 'Base.Kneepad_Right_Tactical', qty: 1 },
      { code: 'Base.ElbowPad_Left_Tactical', qty: 1 },
      { code: 'Base.ElbowPad_Right_Tactical', qty: 1 },
      { code: 'Base.Gloves_LeatherGlovesBlack', qty: 1 },
      { code: 'Base.Bag_Police', qty: 1 },
      { code: 'Base.Bag_AmmoBox_9mm', qty: 1 },
      { code: 'Base.FirstAidKit_Military', qty: 1 },
      { code: 'Base.FlashLight_AngleHead', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 1 }
    ]
  },
  {
    id: 'cia-tactical',
    label: 'CIA Tactical',
    items: [
      { code: 'Base.Pistol3', qty: 1 },
      { code: 'Base.Pistol2', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 240 },
      { code: 'Base.9mmClip', qty: 10 },
      { code: 'Base.AssaultRifle', qty: 1 },
      { code: 'Base.556Bullets', qty: 180 },
      { code: 'Base.556Clip', qty: 5 },
      { code: 'Base.Vest_BulletArmy', qty: 1 },
      { code: 'Base.Hat_SPHhelmet', qty: 1 },
      { code: 'Base.HolsterShoulder', qty: 1 },
      { code: 'Base.Bag_Military', qty: 1 },
      { code: 'Base.Bag_AmmoBox_9mm', qty: 1 },
      { code: 'Base.FirstAidKit_Military', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 1 }
    ]
  },
  {
    id: 'eod-bomb-tech',
    label: 'EOD / Bomb Tech',
    items: [
      { code: 'Base.Shotgun', qty: 1 },
      { code: 'Base.ShotgunShells', qty: 100 },
      { code: 'Base.Pistol2', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 120 },
      { code: 'Base.9mmClip', qty: 4 },
      { code: 'Base.Vest_BulletArmy', qty: 1 },
      { code: 'Base.Hat_SPHhelmet', qty: 1 },
      { code: 'Base.Bag_Military', qty: 1 },
      { code: 'Base.BlowTorch', qty: 1 },
      { code: 'Base.WeldingMask', qty: 1 },
      { code: 'Base.PropaneTank', qty: 1 },
      { code: 'Base.Screwdriver', qty: 1 },
      { code: 'Base.Wrench', qty: 1 },
      { code: 'Base.MetalBar', qty: 8 },
      { code: 'Base.SheetMetal', qty: 6 },
      { code: 'Base.FirstAidKit_Military', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 1 }
    ]
  },
  {
    id: 'sniper-recon',
    label: 'Sniper / Recon',
    items: [
      { code: 'Base.HuntingRifle', qty: 1 },
      { code: 'Base.VarmintRifle', qty: 1 },
      { code: 'Base.308Bullets', qty: 120 },
      { code: 'Base.Pistol3', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 100 },
      { code: 'Base.9mmClip', qty: 4 },
      { code: 'Base.Vest_BulletArmy', qty: 1 },
      { code: 'Base.HolsterShoulder', qty: 1 },
      { code: 'Base.Bag_RifleCaseGreen', qty: 1 },
      { code: 'Base.Bag_AmmoBox_308', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 },
      { code: 'Base.CanteenMilitary', qty: 1 },
      { code: 'Base.FirstAidKit_Military', qty: 1 }
    ]
  },
  {
    id: 'heavy-breacher',
    label: 'Heavy Breacher',
    items: [
      { code: 'Base.Shotgun', qty: 1 },
      { code: 'Base.ShotgunShells', qty: 180 },
      { code: 'Base.AssaultRifle2', qty: 1 },
      { code: 'Base.556Bullets', qty: 180 },
      { code: 'Base.556Clip', qty: 5 },
      { code: 'Base.Pistol2', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 120 },
      { code: 'Base.9mmClip', qty: 4 },
      { code: 'Base.Vest_BulletPolice', qty: 1 },
      { code: 'Base.Hat_RiotHelmet', qty: 1 },
      { code: 'Base.Kneepad_Left_Tactical', qty: 1 },
      { code: 'Base.Kneepad_Right_Tactical', qty: 1 },
      { code: 'Base.Gloves_LeatherGlovesBlack', qty: 1 },
      { code: 'Base.Crowbar', qty: 1 },
      { code: 'Base.Hammer', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 1 },
      { code: 'Base.FirstAidKit_Military', qty: 1 }
    ]
  },
  {
    id: 'combat-medic',
    label: 'Combat Medic',
    items: [
      { code: 'Base.AssaultRifle', qty: 1 },
      { code: 'Base.556Bullets', qty: 180 },
      { code: 'Base.556Clip', qty: 5 },
      { code: 'Base.Pistol3', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 120 },
      { code: 'Base.9mmClip', qty: 5 },
      { code: 'Base.Vest_BulletArmy', qty: 1 },
      { code: 'Base.Bag_MedicalBag', qty: 1 },
      { code: 'Base.FirstAidKit_Military', qty: 2 },
      { code: 'Base.Bandage', qty: 20 },
      { code: 'Base.Disinfectant', qty: 3 },
      { code: 'Base.SutureNeedle', qty: 8 },
      { code: 'Base.Tweezers', qty: 2 },
      { code: 'Base.Splint', qty: 4 },
      { code: 'Base.Antibiotics', qty: 2 },
      { code: 'Base.Pills', qty: 2 },
      { code: 'Base.WalkieTalkie3', qty: 1 }
    ]
  },
  {
    id: 'pilot-transport',
    label: 'Pilot / Transport',
    items: [
      { code: 'Base.Pistol2', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 90 },
      { code: 'Base.9mmClip', qty: 3 },
      { code: 'Base.Vest_BulletCivilian', qty: 1 },
      { code: 'Base.Bag_Military', qty: 1 },
      { code: 'Base.PetrolCan', qty: 3 },
      { code: 'Base.CarBatteryCharger', qty: 1 },
      { code: 'Base.BatteryBox', qty: 2 },
      { code: 'Base.Wrench', qty: 1 },
      { code: 'Base.Screwdriver', qty: 1 },
      { code: 'Base.HamRadio1', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 },
      { code: 'Base.FirstAidKit_Military', qty: 1 },
      { code: 'Base.WaterBottle', qty: 2 }
    ]
  },
  {
    id: 'mechanized-infantry',
    label: 'Mechanized Infantry',
    items: [
      { code: 'Base.AssaultRifle2', qty: 1 },
      { code: 'Base.556Bullets', qty: 260 },
      { code: 'Base.556Clip', qty: 6 },
      { code: 'Base.Pistol2', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 120 },
      { code: 'Base.9mmClip', qty: 4 },
      { code: 'Base.Vest_BulletArmy', qty: 1 },
      { code: 'Base.Hat_PeakedCapArmy', qty: 1 },
      { code: 'Base.Bag_Military', qty: 1 },
      { code: 'Base.Wrench', qty: 1 },
      { code: 'Base.Screwdriver', qty: 1 },
      { code: 'Base.CarBatteryCharger', qty: 1 },
      { code: 'Base.BatteryBox', qty: 2 },
      { code: 'Base.PetrolCan', qty: 2 },
      { code: 'Base.FirstAidKit_Military', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 1 }
    ]
  },
  {
    id: 'checkpoint-officer',
    label: 'Checkpoint Officer',
    items: [
      { code: 'Base.Pistol', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 120 },
      { code: 'Base.9mmClip', qty: 5 },
      { code: 'Base.Shotgun', qty: 1 },
      { code: 'Base.ShotgunShells', qty: 60 },
      { code: 'Base.Nightstick', qty: 1 },
      { code: 'Base.Vest_BulletPolice', qty: 1 },
      { code: 'Base.Hat_Police', qty: 1 },
      { code: 'Base.Bag_Police', qty: 1 },
      { code: 'Base.Notebook', qty: 2 },
      { code: 'Base.Clipboard', qty: 1 },
      { code: 'Base.Pen', qty: 2 },
      { code: 'Base.KeyRing_SecurityPass', qty: 1 },
      { code: 'Base.Padlock', qty: 2 },
      { code: 'Base.WalkieTalkie3', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 }
    ]
  },
  {
    id: 'undercover',
    label: 'Undercover',
    items: [
      { code: 'Base.Pistol3', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 90 },
      { code: 'Base.9mmClip', qty: 4 },
      { code: 'Base.HolsterShoulder', qty: 1 },
      { code: 'Base.Vest_BulletCivilian', qty: 1 },
      { code: 'Base.Bag_Satchel_Mail', qty: 1 },
      { code: 'Base.Notebook', qty: 1 },
      { code: 'Base.Pen', qty: 2 },
      { code: 'Base.WalkieTalkie3', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 },
      { code: 'Base.FirstAidKit', qty: 1 },
      { code: 'Base.WaterBottle', qty: 1 }
    ]
  },
  {
    id: 'hostage-rescue',
    label: 'Hostage Rescue',
    items: [
      { code: 'Base.AssaultRifle2', qty: 1 },
      { code: 'Base.556Bullets', qty: 240 },
      { code: 'Base.556Clip', qty: 6 },
      { code: 'Base.Shotgun', qty: 1 },
      { code: 'Base.ShotgunShells', qty: 100 },
      { code: 'Base.Pistol2', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 120 },
      { code: 'Base.9mmClip', qty: 4 },
      { code: 'Base.Vest_BulletPolice', qty: 1 },
      { code: 'Base.Hat_RiotHelmet', qty: 1 },
      { code: 'Base.Gloves_LeatherGlovesBlack', qty: 1 },
      { code: 'Base.Crowbar', qty: 1 },
      { code: 'Base.FirstAidKit_Military', qty: 1 },
      { code: 'Base.Bandage', qty: 8 },
      { code: 'Base.WalkieTalkie3', qty: 1 },
      { code: 'Base.FlashLight_AngleHead', qty: 1 }
    ]
  },
  {
    id: 'rapid-response-cache',
    label: 'Rapid Response Cache',
    items: [
      { code: 'Base.Bag_AmmoBox', qty: 2 },
      { code: 'Base.Bag_AmmoBox_9mm', qty: 2 },
      { code: 'Base.Bag_AmmoBox_ShotgunShells', qty: 2 },
      { code: 'Base.Bullets9mm', qty: 240 },
      { code: 'Base.9mmClip', qty: 8 },
      { code: 'Base.ShotgunShells', qty: 160 },
      { code: 'Base.BandageBox', qty: 4 },
      { code: 'Base.Disinfectant', qty: 3 },
      { code: 'Base.WaterBottle', qty: 12 },
      { code: 'Base.Bag_FoodCanned', qty: 4 },
      { code: 'Base.CannedSoup', qty: 12 },
      { code: 'Base.HandTorch', qty: 4 },
      { code: 'Base.WalkieTalkie3', qty: 3 },
      { code: 'Base.PetrolCan', qty: 2 },
      { code: 'Base.BatteryBox', qty: 2 }
    ]
  },
  {
    id: 'night-operations',
    label: 'Night Operations',
    items: [
      { code: 'Base.AssaultRifle', qty: 1 },
      { code: 'Base.556Bullets', qty: 180 },
      { code: 'Base.556Clip', qty: 5 },
      { code: 'Base.Pistol2', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 120 },
      { code: 'Base.9mmClip', qty: 4 },
      { code: 'Base.Vest_BulletArmy', qty: 1 },
      { code: 'Base.Hat_SPHhelmet', qty: 1 },
      { code: 'Base.KATTAJ1_TacticalFlashlight', qty: 1 },
      { code: 'Base.HandTorch', qty: 2 },
      { code: 'Base.FlashLight_AngleHead', qty: 1 },
      { code: 'Base.BatteryBox', qty: 3 },
      { code: 'Base.WalkieTalkie3', qty: 1 },
      { code: 'Base.HamRadio1', qty: 1 },
      { code: 'Base.FirstAidKit_Military', qty: 1 },
      { code: 'Base.WaterBottle', qty: 2 }
    ]
  },
  {
    id: 'civil-affairs-security',
    label: 'Civil Affairs / Gov Security',
    items: [
      { code: 'Base.Pistol', qty: 1 },
      { code: 'Base.Bullets9mm', qty: 90 },
      { code: 'Base.9mmClip', qty: 4 },
      { code: 'Base.Vest_BulletPolice', qty: 1 },
      { code: 'Base.Hat_Police', qty: 1 },
      { code: 'Base.Bag_Police', qty: 1 },
      { code: 'Base.Notebook', qty: 3 },
      { code: 'Base.Clipboard', qty: 2 },
      { code: 'Base.Pen', qty: 4 },
      { code: 'Base.KeyRing_SecurityPass', qty: 2 },
      { code: 'Base.HamRadio1', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 2 },
      { code: 'Base.FirstAidKit', qty: 1 },
      { code: 'Base.Padlock', qty: 2 },
      { code: 'Base.CombinationPadlock', qty: 1 },
      { code: 'Base.HandTorch', qty: 1 }
    ]
  },
  {
    id: 'jail-inmate-basic',
    label: 'Jail Inmate Basic (Daily)',
    items: [
      { code: 'Base.WaterBottle', qty: 2 },
      { code: 'Base.Bag_FoodSnacks', qty: 1 },
      { code: 'Base.CannedSoup', qty: 1 },
      { code: 'Base.CannedSardines', qty: 1 }
    ]
  },
  {
    id: 'jail-commissary',
    label: 'Jail Snack + Water (Safe)',
    items: [
      { code: 'Base.WaterBottle', qty: 2 },
      { code: 'Base.Bag_FoodSnacks', qty: 1 },
      { code: 'Base.CannedCornedBeef', qty: 1 },
      { code: 'Base.CannedSoup', qty: 1 },
      { code: 'Base.CannedSardines', qty: 1 }
    ]
  },
  {
    id: 'jail-medical-watch',
    label: 'Jail Medical Watch',
    items: [
      { code: 'Base.WaterBottle', qty: 2 },
      { code: 'Base.Bandage', qty: 6 },
      { code: 'Base.Disinfectant', qty: 1 },
      { code: 'Base.Pills', qty: 1 },
      { code: 'Base.CannedSoup', qty: 2 },
      { code: 'Base.CannedMilk', qty: 1 }
    ]
  },
  {
    id: 'storage-food-water',
    label: 'Storage: Food + Water',
    items: [
      { code: 'Base.Bag_FoodCanned', qty: 12 },
      { code: 'Base.CannedSoup', qty: 30 },
      { code: 'Base.CannedSardines', qty: 24 },
      { code: 'Base.CannedCornedBeef', qty: 20 },
      { code: 'Base.CannedMilk', qty: 20 },
      { code: 'Base.WaterBottle', qty: 36 },
      { code: 'Base.PopBottle', qty: 12 }
    ]
  },
  {
    id: 'storage-medical',
    label: 'Storage: Medical Stock',
    items: [
      { code: 'Base.FirstAidKit_Military', qty: 6 },
      { code: 'Base.Bag_MedicalBag', qty: 6 },
      { code: 'Base.BandageBox', qty: 14 },
      { code: 'Base.Bandage', qty: 80 },
      { code: 'Base.AlcoholWipes', qty: 30 },
      { code: 'Base.Disinfectant', qty: 10 },
      { code: 'Base.SutureNeedle', qty: 24 },
      { code: 'Base.SutureNeedleHolder', qty: 4 },
      { code: 'Base.Tweezers', qty: 8 },
      { code: 'Base.Splint', qty: 14 },
      { code: 'Base.Antibiotics', qty: 10 },
      { code: 'Base.Pills', qty: 12 }
    ]
  },
  {
    id: 'storage-armory',
    label: 'Storage: Armory Reserve',
    items: [
      { code: 'Base.Bag_WeaponBag', qty: 4 },
      { code: 'Base.Bag_AmmoBox', qty: 8 },
      { code: 'Base.Bag_AmmoBox_9mm', qty: 8 },
      { code: 'Base.Bag_AmmoBox_ShotgunShells', qty: 8 },
      { code: 'Base.Bullets9mm', qty: 600 },
      { code: 'Base.9mmClip', qty: 20 },
      { code: 'Base.556Bullets', qty: 600 },
      { code: 'Base.556Clip', qty: 20 },
      { code: 'Base.ShotgunShells', qty: 400 },
      { code: 'Base.Vest_BulletPolice', qty: 6 },
      { code: 'Base.Hat_RiotHelmet', qty: 6 }
    ]
  },
  {
    id: 'storage-building',
    label: 'Storage: Building Materials',
    items: [
      { code: 'Base.NailsCarton', qty: 10 },
      { code: 'Base.NailsBox', qty: 24 },
      { code: 'Base.Plank', qty: 160 },
      { code: 'Base.SheetMetal', qty: 40 },
      { code: 'Base.MetalBar', qty: 40 },
      { code: 'Base.Wire', qty: 24 },
      { code: 'Base.ElectricWire', qty: 24 },
      { code: 'Base.Hammer', qty: 4 },
      { code: 'Base.Saw', qty: 4 },
      { code: 'Base.Screwdriver', qty: 4 },
      { code: 'Base.Wrench', qty: 4 }
    ]
  },
  {
    id: 'storage-power-utilities',
    label: 'Storage: Power + Utilities',
    items: [
      { code: 'Base.PetrolCan', qty: 10 },
      { code: 'Base.PropaneTank', qty: 6 },
      { code: 'Base.Propane_Refill', qty: 10 },
      { code: 'Base.CarBatteryCharger', qty: 3 },
      { code: 'Base.BatteryBox', qty: 8 },
      { code: 'Base.Battery', qty: 20 },
      { code: 'Base.LightBulbBox', qty: 12 },
      { code: 'Base.LightBulb', qty: 20 },
      { code: 'Base.HandTorch', qty: 8 },
      { code: 'Base.FlashLight_AngleHead', qty: 4 }
    ]
  },
  {
    id: 'politician',
    label: 'Politician',
    items: [
      { code: 'Base.Notebook', qty: 1 },
      { code: 'Base.Pen', qty: 2 },
      { code: 'Base.CigarettePack', qty: 1 },
      { code: 'Base.Lighter', qty: 1 },
      { code: 'Base.WaterBottleFull', qty: 1 }
    ]
  },
  {
    id: 'electrician',
    label: 'Electrician',
    items: [
      { code: 'Base.Screwdriver', qty: 1 },
      { code: 'Base.Wrench', qty: 1 },
      { code: 'Base.Battery', qty: 2 },
      { code: 'Base.LightBulb', qty: 4 },
      { code: 'Base.ElectronicsScrap', qty: 8 }
    ]
  },
  {
    id: 'electrical-grid-core',
    label: 'Electrical: Grid Core',
    items: [
      { code: 'Base.ElectricWire', qty: 24 },
      { code: 'Base.Wire', qty: 24 },
      { code: 'Base.BatteryBox', qty: 8 },
      { code: 'Base.Battery', qty: 24 },
      { code: 'Base.CarBatteryCharger', qty: 3 },
      { code: 'Base.LightBulbBox', qty: 12 },
      { code: 'Base.LightBulb', qty: 24 },
      { code: 'Base.Screwdriver', qty: 4 },
      { code: 'Base.Wrench', qty: 4 },
      { code: 'Base.MetalPipe', qty: 16 },
      { code: 'Base.MetalworkingPliers', qty: 3 },
      { code: 'Base.HandTorch', qty: 4 }
    ]
  },
  {
    id: 'electrical-generation-fuel',
    label: 'Electrical: Generation + Fuel',
    items: [
      { code: 'Base.PetrolCan', qty: 12 },
      { code: 'Base.PropaneTank', qty: 8 },
      { code: 'Base.Propane_Refill', qty: 12 },
      { code: 'Base.Lantern_Propane', qty: 6 },
      { code: 'Base.CarBatteryCharger', qty: 2 },
      { code: 'Base.BatteryBox', qty: 6 },
      { code: 'Base.Battery', qty: 20 },
      { code: 'Base.LightBulbBox', qty: 10 },
      { code: 'Base.ElectricWire', qty: 16 },
      { code: 'Base.Wire', qty: 16 }
    ]
  },
  {
    id: 'electrical-control-room',
    label: 'Electrical: Control Room + Comms',
    items: [
      { code: 'Base.HamRadio1', qty: 2 },
      { code: 'Base.HamRadio2', qty: 1 },
      { code: 'Base.ManPackRadio', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 6 },
      { code: 'Base.RadioBlack', qty: 2 },
      { code: 'Base.RadioRed', qty: 2 },
      { code: 'Base.Notebook', qty: 8 },
      { code: 'Base.Clipboard', qty: 4 },
      { code: 'Base.Pen', qty: 8 },
      { code: 'Base.KeyRing_SecurityPass', qty: 2 },
      { code: 'Base.HandTorch', qty: 4 },
      { code: 'Base.FlashLight_AngleHead', qty: 2 }
    ]
  },
  {
    id: 'electrical-maintenance-heavy',
    label: 'Electrical: Maintenance Heavy',
    items: [
      { code: 'Base.Screwdriver', qty: 6 },
      { code: 'Base.Wrench', qty: 6 },
      { code: 'Base.MetalworkingPliers', qty: 4 },
      { code: 'Base.Hammer', qty: 4 },
      { code: 'Base.SheetMetalSnips', qty: 4 },
      { code: 'Base.SheetMetal', qty: 30 },
      { code: 'Base.MetalPipe', qty: 24 },
      { code: 'Base.Wire', qty: 24 },
      { code: 'Base.ElectricWire', qty: 24 },
      { code: 'Base.ElectronicsScrap', qty: 30 },
      { code: 'Base.BatteryBox', qty: 6 },
      { code: 'Base.Battery', qty: 18 }
    ]
  },
  {
    id: 'electrical-future-expansion',
    label: 'Electrical: Future Expansion Base',
    items: [
      { code: 'Base.ElectricWire', qty: 40 },
      { code: 'Base.Wire', qty: 40 },
      { code: 'Base.BatteryBox', qty: 10 },
      { code: 'Base.Battery', qty: 30 },
      { code: 'Base.LightBulbBox', qty: 14 },
      { code: 'Base.LightBulb', qty: 30 },
      { code: 'Base.ElectronicsScrap', qty: 40 },
      { code: 'Base.Screwdriver', qty: 6 },
      { code: 'Base.Wrench', qty: 6 },
      { code: 'Base.MetalworkingPliers', qty: 4 },
      { code: 'Base.SheetMetal', qty: 24 },
      { code: 'Base.MetalPipe', qty: 20 }
    ]
  },
  {
    id: 'communications-field-team',
    label: 'Comms: Field Team',
    items: [
      { code: 'Base.WalkieTalkie3', qty: 6 },
      { code: 'Base.RadioBlack', qty: 2 },
      { code: 'Base.BatteryBox', qty: 3 },
      { code: 'Base.Battery', qty: 12 },
      { code: 'Base.HandTorch', qty: 3 },
      { code: 'Base.Notebook', qty: 4 },
      { code: 'Base.Pen', qty: 4 }
    ]
  },
  {
    id: 'communications-command-center',
    label: 'Comms: Command Center',
    items: [
      { code: 'Base.HamRadio1', qty: 2 },
      { code: 'Base.HamRadio2', qty: 1 },
      { code: 'Base.ManPackRadio', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 8 },
      { code: 'Base.RadioBlack', qty: 3 },
      { code: 'Base.RadioRed', qty: 3 },
      { code: 'Base.BatteryBox', qty: 5 },
      { code: 'Base.Battery', qty: 20 },
      { code: 'Base.Notebook', qty: 8 },
      { code: 'Base.Clipboard', qty: 4 },
      { code: 'Base.Pen', qty: 8 },
      { code: 'Base.KeyRing_SecurityPass', qty: 2 }
    ]
  },
  {
    id: 'communications-relay-maintenance',
    label: 'Comms: Relay Maintenance',
    items: [
      { code: 'Base.WalkieTalkie3', qty: 4 },
      { code: 'Base.HamRadio1', qty: 1 },
      { code: 'Base.BatteryBox', qty: 4 },
      { code: 'Base.Battery', qty: 16 },
      { code: 'Base.ElectricWire', qty: 16 },
      { code: 'Base.Wire', qty: 16 },
      { code: 'Base.Screwdriver', qty: 3 },
      { code: 'Base.Wrench', qty: 3 },
      { code: 'Base.MetalworkingPliers', qty: 2 },
      { code: 'Base.ElectronicsScrap', qty: 20 },
      { code: 'Base.FlashLight_AngleHead', qty: 2 }
    ]
  },
  {
    id: 'antenna-tower-foundation',
    label: 'Antenna Tower: Foundation',
    items: [
      { code: 'Base.SheetMetal', qty: 40 },
      { code: 'Base.MetalBar', qty: 40 },
      { code: 'Base.MetalPipe', qty: 30 },
      { code: 'Base.Wire', qty: 30 },
      { code: 'Base.ElectricWire', qty: 30 },
      { code: 'Base.SheetMetalSnips', qty: 4 },
      { code: 'Base.MetalworkingPliers', qty: 4 },
      { code: 'Base.BlowTorch', qty: 3 },
      { code: 'Base.WeldingMask', qty: 3 },
      { code: 'Base.PropaneTank', qty: 4 },
      { code: 'Base.Hammer', qty: 4 },
      { code: 'Base.Screwdriver', qty: 4 },
      { code: 'Base.Wrench', qty: 4 }
    ]
  },
  {
    id: 'antenna-tower-power-comms',
    label: 'Antenna Tower: Power + Comms',
    items: [
      { code: 'Base.HamRadio1', qty: 2 },
      { code: 'Base.HamRadio2', qty: 1 },
      { code: 'Base.ManPackRadio', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 8 },
      { code: 'Base.RadioBlack', qty: 2 },
      { code: 'Base.RadioRed', qty: 2 },
      { code: 'Base.BatteryBox', qty: 8 },
      { code: 'Base.Battery', qty: 24 },
      { code: 'Base.CarBatteryCharger', qty: 2 },
      { code: 'Base.PetrolCan', qty: 6 },
      { code: 'Base.Lantern_Propane', qty: 4 },
      { code: 'Base.LightBulbBox', qty: 8 },
      { code: 'Base.Notebook', qty: 6 },
      { code: 'Base.Clipboard', qty: 3 },
      { code: 'Base.Pen', qty: 6 }
    ]
  },
  {
    id: 'antenna-tower-mod-expansion-ready',
    label: 'Antenna Tower: Mod Expansion Ready',
    items: [
      { code: 'Base.ElectronicsScrap', qty: 40 },
      { code: 'Base.Wire', qty: 40 },
      { code: 'Base.ElectricWire', qty: 40 },
      { code: 'Base.BatteryBox', qty: 10 },
      { code: 'Base.Battery', qty: 30 },
      { code: 'Base.MetalPipe', qty: 24 },
      { code: 'Base.SheetMetal', qty: 30 },
      { code: 'Base.MetalBar', qty: 30 },
      { code: 'Base.Screwdriver', qty: 5 },
      { code: 'Base.Wrench', qty: 5 },
      { code: 'Base.MetalworkingPliers', qty: 4 },
      { code: 'Base.HandTorch', qty: 4 },
      { code: 'Base.FlashLight_AngleHead', qty: 3 },
      { code: 'Base.KeyRing_SecurityPass', qty: 2 }
    ]
  },
  {
    id: 'firefighter',
    label: 'Firefighter',
    items: [
      { code: 'Base.Axe', qty: 1 },
      { code: 'Base.HandAxe', qty: 1 },
      { code: 'Base.Bandage', qty: 6 },
      { code: 'Base.Disinfectant', qty: 1 },
      { code: 'Base.WaterBottleFull', qty: 2 }
    ]
  },
  {
    id: 'carpenter',
    label: 'Carpenter',
    items: [
      { code: 'Base.Hammer', qty: 1 },
      { code: 'Base.Saw', qty: 1 },
      { code: 'Base.NailsBox', qty: 4 },
      { code: 'Base.Plank', qty: 8 },
      { code: 'Base.Woodglue', qty: 1 }
    ]
  },
  {
    id: 'mechanic',
    label: 'Mechanic',
    items: [
      { code: 'Base.Wrench', qty: 1 },
      { code: 'Base.LugWrench', qty: 1 },
      { code: 'Base.Jack', qty: 1 },
      { code: 'Base.TirePump', qty: 1 },
      { code: 'Base.Screwdriver', qty: 1 },
      { code: 'Base.CarBatteryCharger', qty: 1 },
      { code: 'Base.EngineParts', qty: 6 },
      { code: 'Base.CarBattery1', qty: 1 },
      { code: 'Base.OilFilter', qty: 2 },
      { code: 'Base.EmptyPetrolCan', qty: 1 }
    ]
  },
  {
    id: 'mobile-mechanic',
    label: 'Mobile Mechanic (Roadside Repair)',
    items: [
      { code: 'Base.Bag_DuffelBag', qty: 1 },
      { code: 'Base.Wrench', qty: 1 },
      { code: 'Base.LugWrench', qty: 1 },
      { code: 'Base.Jack', qty: 1 },
      { code: 'Base.TirePump', qty: 1 },
      { code: 'Base.Screwdriver', qty: 1 },
      { code: 'Base.CarBatteryCharger', qty: 1 },
      { code: 'Base.EmptyPetrolCan', qty: 1 },
      { code: 'Base.EngineParts', qty: 4 },
      { code: 'Base.CarBattery1', qty: 1 },
      { code: 'Base.OilFilter', qty: 1 },
      { code: 'Base.DuctTape', qty: 2 }
    ]
  },
  {
    id: 'butcher',
    label: 'Butcher',
    items: [
      { code: 'Base.MeatCleaver', qty: 1 },
      { code: 'Base.KitchenKnife', qty: 1 },
      { code: 'Base.HuntingKnife', qty: 1 },
      { code: 'Base.CuttingBoardPlastic', qty: 1 },
      { code: 'Base.RollingPin', qty: 1 },
      { code: 'Base.Apron_White', qty: 1 },
      { code: 'Base.Gloves_LeatherGloves', qty: 1 },
      { code: 'Base.Salt', qty: 2 },
      { code: 'Base.Pepper', qty: 2 },
      { code: 'Base.Garbagebag', qty: 2 }
    ]
  },
  {
    id: 'cook',
    label: 'Cook',
    items: [
      { code: 'Base.FryingPan', qty: 1 },
      { code: 'Base.Saucepan', qty: 1 },
      { code: 'Base.CookingPot', qty: 1 },
      { code: 'Base.KitchenKnife', qty: 1 },
      { code: 'Base.CanOpener', qty: 1 },
      { code: 'Base.WaterBottleFull', qty: 2 },
      { code: 'Base.Salt', qty: 2 },
      { code: 'Base.Pepper', qty: 2 },
      { code: 'Base.Spoon', qty: 2 },
      { code: 'Base.Bowl', qty: 2 }
    ]
  },
  {
    id: 'doctor',
    label: 'Doctor (Full Medical Kit)',
    items: [
      { code: 'Base.FirstAidKit', qty: 1 },
      { code: 'Base.SutureNeedle', qty: 8 },
      { code: 'Base.SutureNeedleHolder', qty: 2 },
      { code: 'Base.Tweezers', qty: 2 },
      { code: 'Base.AlcoholWipes', qty: 12 },
      { code: 'Base.Disinfectant', qty: 3 },
      { code: 'Base.Bandage', qty: 20 },
      { code: 'Base.CottonBalls', qty: 8 },
      { code: 'Base.Splint', qty: 4 },
      { code: 'Base.Antibiotics', qty: 2 },
      { code: 'Base.Pills', qty: 2 },
      { code: 'Base.ScissorsBluntMedical', qty: 1 },
      { code: 'Base.Gloves_Surgical', qty: 2 },
      { code: 'Base.Hat_SurgicalMask', qty: 2 }
    ]
  },
  {
    id: 'field-medic',
    label: 'Field Medic (Light)',
    items: [
      { code: 'Base.FirstAidKit_Camping', qty: 1 },
      { code: 'Base.Bandage', qty: 12 },
      { code: 'Base.AlcoholWipes', qty: 8 },
      { code: 'Base.Disinfectant', qty: 1 },
      { code: 'Base.Tweezers', qty: 1 },
      { code: 'Base.Splint', qty: 2 },
      { code: 'Base.Pills', qty: 1 },
      { code: 'Base.WaterBottleFull', qty: 1 }
    ]
  },
  {
    id: 'surgery',
    label: 'Surgery (Advanced)',
    items: [
      { code: 'Base.FirstAidKit_Military', qty: 1 },
      { code: 'Base.SutureNeedle', qty: 12 },
      { code: 'Base.SutureNeedleHolder', qty: 2 },
      { code: 'Base.Tweezers', qty: 2 },
      { code: 'Base.Scalpel', qty: 2 },
      { code: 'Base.ScissorsBluntMedical', qty: 1 },
      { code: 'Base.AlcoholWipes', qty: 16 },
      { code: 'Base.Disinfectant', qty: 3 },
      { code: 'Base.CottonBalls', qty: 12 },
      { code: 'Base.Bandage', qty: 24 },
      { code: 'Base.Splint', qty: 4 },
      { code: 'Base.Antibiotics', qty: 2 },
      { code: 'Base.Gloves_Surgical', qty: 3 },
      { code: 'Base.Hat_SurgicalMask', qty: 3 }
    ]
  },
  {
    id: 'medical-facility-buildout',
    label: 'Medical Facility Buildout (Structure)',
    items: [
      { code: 'Base.Hammer', qty: 4 },
      { code: 'Base.Saw', qty: 3 },
      { code: 'Base.GardenSaw', qty: 2 },
      { code: 'Base.NailsCarton', qty: 6 },
      { code: 'Base.NailsBox', qty: 16 },
      { code: 'Base.Plank', qty: 90 },
      { code: 'Base.Woodglue', qty: 10 },
      { code: 'Base.SheetMetal', qty: 30 },
      { code: 'Base.MetalBar', qty: 30 },
      { code: 'Base.BlowTorch', qty: 2 },
      { code: 'Base.WeldingMask', qty: 2 },
      { code: 'Base.PropaneTank', qty: 3 },
      { code: 'Base.Wire', qty: 18 },
      { code: 'Base.ElectricWire', qty: 18 },
      { code: 'Base.LightBulbBox', qty: 8 },
      { code: 'Base.Padlock', qty: 8 },
      { code: 'Base.CombinationPadlock', qty: 6 },
      { code: 'Base.Doorknob', qty: 6 },
      { code: 'Base.HomeAlarm', qty: 4 }
    ]
  },
  {
    id: 'medical-facility-operations',
    label: 'Medical Facility Operations (Full Stock)',
    items: [
      { code: 'Base.FirstAidKit_Military', qty: 4 },
      { code: 'Base.Bag_MedicalBag', qty: 4 },
      { code: 'Base.BandageBox', qty: 12 },
      { code: 'Base.Bandage', qty: 60 },
      { code: 'Base.AlcoholWipes', qty: 24 },
      { code: 'Base.Disinfectant', qty: 8 },
      { code: 'Base.SutureNeedle', qty: 20 },
      { code: 'Base.SutureNeedleHolder', qty: 4 },
      { code: 'Base.Tweezers', qty: 6 },
      { code: 'Base.Scalpel', qty: 4 },
      { code: 'Base.ScissorsBluntMedical', qty: 3 },
      { code: 'Base.CottonBalls', qty: 24 },
      { code: 'Base.Splint', qty: 12 },
      { code: 'Base.Antibiotics', qty: 8 },
      { code: 'Base.Pills', qty: 10 },
      { code: 'Base.Gloves_Surgical', qty: 8 },
      { code: 'Base.Hat_SurgicalMask', qty: 8 },
      { code: 'Base.WaterBottle', qty: 16 },
      { code: 'Base.CannedSoup', qty: 20 },
      { code: 'Base.CannedMilk', qty: 12 },
      { code: 'Base.CannedCornedBeef', qty: 12 },
      { code: 'Base.Bag_FoodCanned', qty: 6 },
      { code: 'Base.HandTorch', qty: 6 },
      { code: 'Base.FlashLight_AngleHead', qty: 3 },
      { code: 'Base.WalkieTalkie3', qty: 4 },
      { code: 'Base.HamRadio1', qty: 1 },
      { code: 'Base.PetrolCan', qty: 4 },
      { code: 'Base.CarBatteryCharger', qty: 2 },
      { code: 'Base.BatteryBox', qty: 3 }
    ]
  },
  {
    id: 'townhall-security',
    label: 'Town Hall Security (Doors + Windows)',
    items: [
      { code: 'Base.Padlock', qty: 8 },
      { code: 'Base.CombinationPadlock', qty: 6 },
      { code: 'Base.Doorknob', qty: 4 },
      { code: 'Base.Hammer', qty: 2 },
      { code: 'Base.Screwdriver', qty: 2 },
      { code: 'Base.Wrench', qty: 2 },
      { code: 'Base.NailsBox', qty: 12 },
      { code: 'Base.Plank', qty: 40 },
      { code: 'Base.SheetMetal', qty: 16 },
      { code: 'Base.MetalBar', qty: 20 },
      { code: 'Base.BlowTorch', qty: 2 },
      { code: 'Base.WeldingMask', qty: 2 },
      { code: 'Base.PropaneTank', qty: 2 },
      { code: 'Base.BarbedWire', qty: 8 },
      { code: 'Base.Wire', qty: 10 }
    ]
  },
  {
    id: 'window-hardening',
    label: 'Window Hardening Kit',
    items: [
      { code: 'Base.SheetMetal', qty: 24 },
      { code: 'Base.MetalBar', qty: 24 },
      { code: 'Base.NailsBox', qty: 10 },
      { code: 'Base.Plank', qty: 30 },
      { code: 'Base.Hammer', qty: 2 },
      { code: 'Base.Screwdriver', qty: 2 },
      { code: 'Base.BlowTorch', qty: 1 },
      { code: 'Base.WeldingMask', qty: 1 },
      { code: 'Base.PropaneTank', qty: 1 },
      { code: 'Base.Wire', qty: 8 },
      { code: 'Base.BarbedWire', qty: 6 }
    ]
  },
  {
    id: 'townhall-command',
    label: 'Town Hall Command Core',
    items: [
      { code: 'Base.Notebook', qty: 12 },
      { code: 'Base.Clipboard', qty: 6 },
      { code: 'Base.Pen', qty: 12 },
      { code: 'Base.BluePen', qty: 6 },
      { code: 'Base.RedPen', qty: 6 },
      { code: 'Base.Pencil', qty: 12 },
      { code: 'Base.KeyRing', qty: 4 },
      { code: 'Base.KeyRing_SecurityPass', qty: 4 },
      { code: 'Base.HamRadio1', qty: 2 },
      { code: 'Base.HamRadio2', qty: 1 },
      { code: 'Base.ManPackRadio', qty: 1 },
      { code: 'Base.WalkieTalkie3', qty: 6 },
      { code: 'Base.HomeAlarm', qty: 4 },
      { code: 'Base.HandTorch', qty: 8 },
      { code: 'Base.FlashLight_AngleHead', qty: 4 }
    ]
  },
  {
    id: 'townhall-power-utilities',
    label: 'Town Hall Utilities + Power',
    items: [
      { code: 'Base.PetrolCan', qty: 8 },
      { code: 'Base.PropaneTank', qty: 4 },
      { code: 'Base.Propane_Refill', qty: 8 },
      { code: 'Base.Lantern_Propane', qty: 4 },
      { code: 'Base.CarBatteryCharger', qty: 2 },
      { code: 'Base.BatteryBox', qty: 4 },
      { code: 'Base.Battery', qty: 12 },
      { code: 'Base.LightBulbBox', qty: 8 },
      { code: 'Base.LightBulb', qty: 12 },
      { code: 'Base.ElectricWire', qty: 16 },
      { code: 'Base.Wire', qty: 16 },
      { code: 'Base.Screwdriver', qty: 3 },
      { code: 'Base.Wrench', qty: 3 },
      { code: 'Base.MetalPipe', qty: 12 }
    ]
  },
  {
    id: 'townhall-buildout',
    label: 'Town Hall Buildout (Expansion)',
    items: [
      { code: 'Base.Hammer', qty: 4 },
      { code: 'Base.Saw', qty: 4 },
      { code: 'Base.GardenSaw', qty: 2 },
      { code: 'Base.NailsCarton', qty: 6 },
      { code: 'Base.NailsBox', qty: 16 },
      { code: 'Base.Plank', qty: 80 },
      { code: 'Base.Woodglue', qty: 8 },
      { code: 'Base.SheetMetal', qty: 24 },
      { code: 'Base.MetalBar', qty: 24 },
      { code: 'Base.SheetMetalSnips', qty: 2 },
      { code: 'Base.MetalworkingPliers', qty: 2 },
      { code: 'Base.BlowTorch', qty: 2 },
      { code: 'Base.WeldingMask', qty: 2 },
      { code: 'Base.Crowbar', qty: 2 },
      { code: 'Base.Sledgehammer', qty: 1 }
    ]
  },
  {
    id: 'townhall-defense-armory',
    label: 'Town Hall Defense Armory',
    items: [
      { code: 'Base.Pistol', qty: 6 },
      { code: 'Base.Bullets9mm', qty: 300 },
      { code: 'Base.9mmClip', qty: 12 },
      { code: 'Base.Shotgun', qty: 4 },
      { code: 'Base.DoubleBarrelShotgun', qty: 2 },
      { code: 'Base.ShotgunShells', qty: 200 },
      { code: 'Base.Axe', qty: 4 },
      { code: 'Base.Crowbar', qty: 6 },
      { code: 'Base.HandTorch', qty: 8 },
      { code: 'Base.Bag_WeaponBag', qty: 2 },
      { code: 'Base.Bag_AmmoBox', qty: 4 },
      { code: 'Base.Bag_AmmoBox_9mm', qty: 4 },
      { code: 'Base.Bag_AmmoBox_ShotgunShells', qty: 4 }
    ]
  },
  {
    id: 'townhall-emergency-relief',
    label: 'Town Hall Emergency Relief Cache',
    items: [
      { code: 'Base.FirstAidKit', qty: 4 },
      { code: 'Base.Bandage', qty: 40 },
      { code: 'Base.Disinfectant', qty: 8 },
      { code: 'Base.WaterBottleFull', qty: 24 },
      { code: 'Base.Bag_FoodCanned', qty: 8 },
      { code: 'Base.CannedSoup', qty: 16 },
      { code: 'Base.CannedSardines', qty: 16 },
      { code: 'Base.CannedCornedBeef', qty: 12 },
      { code: 'Base.CannedMilk', qty: 12 },
      { code: 'Base.Dogfood', qty: 8 },
      { code: 'Base.CatFoodBag', qty: 4 },
      { code: 'Base.Bag_MedicalBag', qty: 2 }
    ]
  },
  {
    id: 'townhall-perimeter',
    label: 'Town Hall Perimeter Control',
    items: [
      { code: 'Base.Padlock', qty: 12 },
      { code: 'Base.CombinationPadlock', qty: 10 },
      { code: 'Base.Doorknob', qty: 6 },
      { code: 'Base.HomeAlarm', qty: 6 },
      { code: 'Base.BarbedWire', qty: 16 },
      { code: 'Base.Wire', qty: 20 },
      { code: 'Base.RopeStack', qty: 8 },
      { code: 'Base.SheetRope', qty: 8 },
      { code: 'Base.EmptySandbag', qty: 16 },
      { code: 'Base.Gravelbag', qty: 10 },
      { code: 'Base.Sandbag', qty: 10 },
      { code: 'Base.Plank', qty: 40 },
      { code: 'Base.NailsBox', qty: 12 },
      { code: 'Base.SheetMetal', qty: 16 },
      { code: 'Base.MetalBar', qty: 16 }
    ]
  }
]

function humanizeItemNameFromCode(code: string): string {
  const safe = String(code ?? '').trim()
  if (!safe) return 'Unknown Item'
  const part = safe.includes('.') ? safe.split('.', 2)[1] : safe
  const withSpaces = part
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  return withSpaces || part
}

function effectiveItemName(item: Pick<CatalogItem, 'code' | 'name'>): string {
  const current = String(item.name ?? '').trim()
  const fallback = humanizeItemNameFromCode(item.code)
  if (!current) return fallback

  // If the catalog name looks truncated/mangled, use the code-humanized name for display/search.
  const currentNorm = current.replace(/\s+/g, '').toLowerCase()
  const fallbackNorm = fallback.replace(/\s+/g, '').toLowerCase()
  const shouldRepair = fallbackNorm.length > 0 && currentNorm.length > 0 && currentNorm.length <= fallbackNorm.length - 2

  return shouldRepair ? fallback : current
}

function includesAny(input: string, keywords: string[]) {
  return keywords.some((keyword) => input.includes(keyword))
}

function rolePresetSection(preset: RolePreset): string {
  const id = preset.id.toLowerCase()
  const advancedLoadoutIds = new Set([
    'military-advanced',
    'swat',
    'cia-tactical',
    'eod-bomb-tech',
    'sniper-recon',
    'heavy-breacher',
    'combat-medic',
    'mechanized-infantry',
    'hostage-rescue',
    'rapid-response-cache',
    'night-operations',
    'civil-affairs-security'
  ])
  if (id.startsWith('custom-')) return 'Custom'
  if (advancedLoadoutIds.has(id)) return 'Advanced Loadouts'
  if (id.startsWith('antenna-')) return 'Antenna / Towers'
  if (id.startsWith('communications-')) return 'Communications'
  if (id.startsWith('jail-')) return 'Corrections'
  if (id.startsWith('electrical-') || id === 'electrician') return 'Electrical Infrastructure'
  if (id.startsWith('storage-')) return 'Storage'
  if (id.startsWith('townhall') || id === 'window-hardening') return 'Town Hall'
  if (id === 'doctor' || id === 'field-medic' || id === 'surgery' || id.startsWith('medical-facility')) return 'Medical'
  if (id === 'police' || id === 'interrogator' || id === 'military' || id === 'firefighter' || id === 'checkpoint-officer' || id === 'undercover') return 'Public Safety'
  if (id === 'electrician' || id === 'carpenter' || id === 'mechanic' || id === 'mobile-mechanic' || id === 'butcher' || id === 'cook') return 'Trades'
  if (id === 'politician') return 'Government'
  return 'General'
}

const QTY_PROFILES: Array<{ id: QtyProfileId; label: string; multiplier: number }> = [
  { id: 'single', label: 'Single x1', multiplier: 1 },
  { id: 'squad', label: 'Squad x3', multiplier: 3 },
  { id: 'unit', label: 'Unit x6', multiplier: 6 },
  { id: 'stockpile', label: 'Stockpile x12', multiplier: 12 }
]

const PRESET_BUNDLES: PresetBundle[] = [
  { id: 'townhall-startup', label: 'Town Hall Startup', presetIds: ['townhall-command', 'townhall-security', 'townhall-power-utilities', 'townhall-emergency-relief'] },
  { id: 'jail-daily', label: 'Jail Daily Supply', presetIds: ['jail-inmate-basic', 'jail-commissary', 'jail-medical-watch'] },
  { id: 'medical-full', label: 'Medical Facility Full', presetIds: ['medical-facility-buildout', 'medical-facility-operations', 'doctor'] },
  { id: 'response-cache', label: 'Rapid Response Cache', presetIds: ['rapid-response-cache', 'storage-medical', 'storage-food-water'] },
  { id: 'trades-field-team', label: 'Trades Field Team', presetIds: ['mechanic', 'mobile-mechanic', 'butcher', 'cook', 'carpenter', 'electrician'] },
  { id: 'electrical-starter', label: 'Electrical Infrastructure Starter', presetIds: ['electrician', 'electrical-grid-core', 'electrical-generation-fuel', 'electrical-control-room'] },
  { id: 'communications-network', label: 'Communications Network Starter', presetIds: ['communications-field-team', 'communications-command-center', 'communications-relay-maintenance'] },
  { id: 'antenna-tower-starter', label: 'Antenna Tower Starter', presetIds: ['antenna-tower-foundation', 'antenna-tower-power-comms', 'antenna-tower-mod-expansion-ready'] }
]

function inferItemGroup(item: { code: string; name: string; category?: string }): ItemGroup {
  const text = `${item.code} ${item.name} ${item.category ?? ''}`.toLowerCase()

  // Prioritize electrical/comms infra first so mod items with generic tags don't fall into "other".
  if (includesAny(text, ['walkietalkie', 'walkie', 'hamradio', 'radio', 'antenna', 'tower', 'transceiver', 'relay', 'signal', 'keyring_securitypass'])) return 'communications'
  if (includesAny(text, ['electric', 'battery', 'generator', 'wire', 'circuit', 'switch', 'relay', 'fuse', 'transformer', 'inverter', 'solar', 'panel', 'lightbulb', 'light bulb', 'lantern'])) return 'electrical'

  if (includesAny(text, ['pistol', 'rifle', 'shotgun', 'revolver', 'smg', 'firearm', 'weapon', 'gun', 'm16'])) return 'guns'
  if (includesAny(text, ['ammo', 'bullet', 'round', 'shell', 'magazine', 'cartridge'])) return 'ammo'
  if (includesAny(text, ['bandage', 'med', 'medical', 'firstaid', 'first aid', 'pill', 'antibiotic', 'painkiller', 'suture', 'disinfect'])) return 'medical'
  if (includesAny(text, ['food', 'drink', 'water', 'canned', 'meat', 'bread', 'snack', 'fruit', 'vegetable', 'cook', 'kitchen'])) return 'food'
  if (includesAny(text, ['padlock', 'lock', 'doorknob', 'barbed', 'alarm', 'sheetmetal', 'sheet metal', 'sandbag', 'barricade', 'fortif', 'wire', 'metalbar'])) return 'building'
  if (includesAny(text, ['engine', 'vehicle', 'car', 'tire', 'tyre', 'brake', 'battery', 'muffler', 'suspension', 'hood', 'trunk', 'radiator', 'windshield', 'wheel'])) return 'car_parts'
  if (includesAny(text, ['wall', 'floor', 'roof', 'concrete', 'brick', 'plank', 'nail', 'screw', 'metal', 'sheet', 'pipe', 'build', 'construction'])) return 'building'
  if (includesAny(text, ['hammer', 'saw', 'wrench', 'screwdriver', 'axe', 'shovel', 'crowbar', 'tool', 'blowtorch', 'welding', 'pliers', 'snips'])) return 'tools'
  if (includesAny(text, ['shirt', 'pants', 'jacket', 'helmet', 'vest', 'shoe', 'glove', 'mask', 'clothing'])) return 'clothing'
  return 'other'
}

function normalizeCategory(category?: string) {
  const value = (category ?? '').trim()
  return value || 'Uncategorized'
}

function inferItemType(item: CatalogItem): ItemType {
  const text = `${item.code} ${item.name} ${item.category ?? ''}`.toLowerCase()
  const group = inferItemGroup(item)

  if (group === 'guns') {
    if (includesAny(text, ['pistol', 'revolver'])) return 'pistol'
    if (includesAny(text, ['rifle', 'm16', 'ak', 'sniper'])) return 'rifle'
    if (includesAny(text, ['shotgun'])) return 'shotgun'
    if (includesAny(text, ['smg', 'submachine'])) return 'smg'
    if (includesAny(text, ['axe', 'bat', 'knife', 'machete', 'spear', 'crowbar'])) return 'melee'
    return 'general'
  }

  if (group === 'ammo') {
    if (includesAny(text, ['mag', 'magazine', 'clip'])) return 'magazine'
    return 'ammo'
  }

  if (group === 'car_parts') {
    if (includesAny(text, ['engine', 'radiator', 'muffler'])) return 'engine'
    if (includesAny(text, ['tire', 'tyre', 'wheel'])) return 'tire'
    if (includesAny(text, ['brake'])) return 'brake'
    if (includesAny(text, ['suspension', 'shock'])) return 'suspension'
    if (includesAny(text, ['battery', 'alternator', 'light', 'headlight', 'electrical', 'spark'])) return 'electrical'
    if (includesAny(text, ['door', 'hood', 'trunk', 'window', 'windshield', 'body', 'seat'])) return 'body'
    return 'general'
  }

  if (group === 'building') {
    if (includesAny(text, ['metal', 'sheet', 'weld', 'bar'])) return 'metalwork'
    if (includesAny(text, ['plank', 'wood', 'nail', 'saw'])) return 'woodwork'
    return 'construction'
  }

  if (group === 'medical' || group === 'food') return 'consumable'
  return 'general'
}

function labelForType(value: ItemType) {
  return {
    all: 'All Types',
    pistol: 'Pistol',
    rifle: 'Rifle',
    shotgun: 'Shotgun',
    smg: 'SMG',
    melee: 'Melee',
    ammo: 'Ammo',
    magazine: 'Magazine',
    engine: 'Engine',
    tire: 'Tire',
    brake: 'Brake',
    suspension: 'Suspension',
    electrical: 'Electrical',
    body: 'Body',
    construction: 'Construction',
    metalwork: 'Metalwork',
    woodwork: 'Woodwork',
    consumable: 'Consumable',
    general: 'General'
  }[value]
}

function toRolePreset(preset: LoadoutPreset): RolePreset {
  return {
    id: String(preset.id ?? '').trim(),
    label: String(preset.label ?? '').trim(),
    items: Array.isArray(preset.items)
      ? preset.items.map((it) => ({ code: String(it.code ?? '').trim(), qty: Math.max(1, Math.floor(Number(it.qty) || 1)) }))
        .filter((it) => it.code.length > 0)
      : []
  }
}

function toLoadoutPreset(preset: RolePreset): LoadoutPreset {
  return {
    id: String(preset.id ?? '').trim(),
    label: String(preset.label ?? '').trim(),
    items: Array.isArray(preset.items)
      ? preset.items.map((it) => ({ code: String(it.code ?? '').trim(), qty: Math.max(1, Math.floor(Number(it.qty) || 1)) }))
        .filter((it) => it.code.length > 0)
      : []
  }
}

type DebugScenarioKey =
  | 'general_startup'
  | 'server_not_starting'
  | 'mods_not_working'
  | 'items_missing'
  | 'players_cannot_join'
  | 'high_memory_or_lag'
  | 'console_spam_error'
  | 'web_console_connection'

const DEBUG_SCENARIOS: Record<DebugScenarioKey, { title: string; steps: string[] }> = {
  general_startup: {
    title: 'I am not sure what is wrong (safe default)',
    steps: [
      'Click Refresh Health.',
      'Click Sync Status + Mods.',
      'Click Sync Item Catalog.',
      'Click Run Safe Auto-Fix.',
      'Click Panel Restart.',
      'Wait 2-3 minutes, then click Refresh Health again.'
    ]
  },
  server_not_starting: {
    title: 'Server will not start or keeps stopping',
    steps: [
      'Click Refresh Health and read Auto Issue Detector.',
      'Click Sync Status + Mods.',
      'Click Run Safe Auto-Fix.',
      'Click Panel Restart.',
      'If still offline, disable the newest mod and restart.'
    ]
  },
  mods_not_working: {
    title: 'Mods are not loading correctly',
    steps: [
      'Click Sync Status + Mods.',
      'Click Check Mods Need Update.',
      'Click Run Safe Auto-Fix.',
      'Click Panel Restart.',
      'Re-check Auto Issue Detector for mod/workshop errors.'
    ]
  },
  items_missing: {
    title: 'Item codes are missing',
    steps: [
      'Click Sync Status + Mods.',
      'Click Sync Item Catalog.',
      'Wait 1-2 minutes.',
      'Click Sync Item Catalog again.',
      'Check item list count and search again.'
    ]
  },
  players_cannot_join: {
    title: 'Players cannot join server',
    steps: [
      'Confirm server status is ONLINE.',
      'Click Sync Status + Mods.',
      'Click Check Mods Need Update.',
      'Click Panel Restart.',
      'If still failing, remove the newest mod and retest.'
    ]
  },
  high_memory_or_lag: {
    title: 'High memory usage or severe lag',
    steps: [
      'Check memory usage card in this page.',
      'Click Panel Restart for immediate recovery.',
      'Reduce heavy map/vehicle mods.',
      'Watch memory for 10-15 minutes.',
      'If still high, increase memory limit in panel.'
    ]
  },
  console_spam_error: {
    title: 'Console is spamming errors',
    steps: [
      'Read first issue in Auto Issue Detector.',
      'Use Run buttons shown for that issue.',
      'Click Run Safe Auto-Fix.',
      'Click Panel Restart.',
      'Disable mod that keeps appearing in repeated errors.'
    ]
  },
  web_console_connection: {
    title: 'Website console says socket closed/error',
    steps: [
      'Wait 5-10 seconds for auto-reconnect.',
      'Click Refresh Health.',
      'If still failing, click Panel Restart.',
      'Hard refresh browser (Ctrl+F5).',
      'Use polling output until websocket recovers.'
    ]
  }
}

function fmtBytes(value?: number) {
  if (!value || value < 0) return 'n/a'
  const gb = value / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = value / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function fmtUptime(ms?: number) {
  if (!ms || ms < 0) return 'n/a'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}h ${m}m ${s}s`
}

function nowTs() {
  return new Date().toLocaleTimeString()
}

function classifyLine(text: string): ConsoleLine['tone'] {
  const lower = text.toLowerCase()
  if (lower.includes('error') || lower.includes('exception')) return 'error'
  if (lower.includes('warn')) return 'warn'
  if (lower.includes('connected') || lower.includes('auth')) return 'info'
  return 'normal'
}

function toWebSocketUrl(urlOrPath: string) {
  if (urlOrPath.startsWith('ws://') || urlOrPath.startsWith('wss://')) return urlOrPath
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  if (urlOrPath.startsWith('/')) return `${proto}//${window.location.host}${urlOrPath}`
  return `${proto}//${window.location.host}/${urlOrPath}`
}

function extractCoordinates(raw: string): { x?: number; y?: number; z?: number } {
  const text = (raw ?? '').trim()
  if (!text) return {}

  const xyz = text.match(/\bx\s*[:=]\s*(-?\d+(?:\.\d+)?)\b.*\by\s*[:=]\s*(-?\d+(?:\.\d+)?)\b(?:.*\bz\s*[:=]\s*(-?\d+(?:\.\d+)?)\b)?/i)
  if (xyz) {
    return {
      x: Number(xyz[1]),
      y: Number(xyz[2]),
      z: xyz[3] != null ? Number(xyz[3]) : undefined
    }
  }

  const tuple = text.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*(-?\d+(?:\.\d+)?)\s*)?\)/)
  if (tuple) {
    return {
      x: Number(tuple[1]),
      y: Number(tuple[2]),
      z: tuple[3] != null ? Number(tuple[3]) : undefined
    }
  }

  return {}
}

function sanitizeConsoleArg(value: string) {
  return (value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim()
}

function extractPayloadText(payload: unknown): string {
  if (!payload) return ''
  if (typeof payload === 'string') return payload
  if (typeof payload !== 'object') return String(payload)
  const obj = payload as Record<string, unknown>
  const direct = [obj.response, obj.message, obj.output, obj.raw]
    .find((v) => typeof v === 'string' && (v as string).trim().length > 0)
  if (typeof direct === 'string') return direct
  try {
    return JSON.stringify(payload)
  } catch {
    return String(payload)
  }
}

function safeCopy(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const input = document.createElement('textarea')
  input.value = text
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  input.remove()
  return Promise.resolve()
}

function responseLooksFailed(text: string) {
  if (!text) return false
  const lower = text.toLowerCase()
  return [
    'unknown command',
    'unknown item',
    'no such item',
    'can\'t find',
    'cannot find',
    'player not found',
    'failed',
    'error'
  ].some((term) => lower.includes(term))
}

function isUnknownItemText(text: string) {
  const lower = (text ?? '').toLowerCase()
  return lower.includes('unknown item') || lower.includes('no such item') || lower.includes("can't find")
}

function codeCandidates(code: string) {
  const raw = (code ?? '').trim()
  if (!raw) return []
  const lower = raw.toLowerCase()
  const list = [raw]
  if (lower === 'base.waterbottlefull') list.push('Base.WaterBottle')
  if (lower === 'base.waterbottle') list.push('Base.WaterBottleFull')
  return Array.from(new Set(list))
}

function slugPresetName(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'custom'
}

function buildB42MapUrl(x?: number, y?: number) {
  if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) return 'https://b42map.com'
  return `https://b42map.com?${Math.round(x)}x${Math.round(y)}`
}

const MAP_SOURCES: Array<{ id: MapSourceId; label: string }> = [
  { id: 'b42map', label: 'B42Map (Build 42 community)' },
  { id: 'pz-official', label: 'Official PZ Map' },
  { id: 'map-six', label: 'Map.Six backup' }
]

function buildMapUrl(source: MapSourceId, x?: number, y?: number) {
  if (source === 'b42map') return buildB42MapUrl(x, y)
  if (source === 'pz-official') return 'https://map.projectzomboid.com'
  return 'https://map.six.ph'
}

type AdminServerControlProps = {
  mode?: 'full' | 'loadouts'
}

export function AdminServerControl({ mode = 'full' }: AdminServerControlProps) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'running' | 'offline' | 'starting' | 'stopping' | 'unknown'>('unknown')
  const [serverName, setServerName] = useState<string>('Project Zomboid')
  const [nodeName, setNodeName] = useState<string>('n/a')
  const [allocation, setAllocation] = useState<string>('n/a')
  const [cpu, setCpu] = useState<number | undefined>(undefined)
  const [memoryBytes, setMemoryBytes] = useState<number | undefined>(undefined)
  const [diskBytes, setDiskBytes] = useState<number | undefined>(undefined)
  const [uptimeMs, setUptimeMs] = useState<number | undefined>(undefined)
  const [lastRefresh, setLastRefresh] = useState<string>('')
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [command, setCommand] = useState('')
  const [powerAction, setPowerAction] = useState<ServerControlPowerSignal>('restart')
  const [commandPreset, setCommandPreset] = useState<string>('save')
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [consoleIssues, setConsoleIssues] = useState<Array<{
    id: string
    severity: 'info' | 'warn' | 'error'
    title: string
    meaning: string
    evidence?: string
    fixSteps: string[]
    recommendedCommands: string[]
    recommendedAction?: string
  }>>([])
  const [issuesScannedLines, setIssuesScannedLines] = useState(0)
  const [issuesGeneratedAt, setIssuesGeneratedAt] = useState<string>('')
  const [consoleMode, setConsoleMode] = useState<'websocket' | 'polling'>('websocket')
  const [consoleCursor, setConsoleCursor] = useState(0)
  const [players, setPlayers] = useState<string[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [manualPlayer, setManualPlayer] = useState('')
  const [playerPositions, setPlayerPositions] = useState<PlayerPosition[]>([])
  const [playerPositionsUpdatedAt, setPlayerPositionsUpdatedAt] = useState<string>('')
  const [playerFeedCommand, setPlayerFeedCommand] = useState<string>('players')
  const [playerFeedSource, setPlayerFeedSource] = useState<string>('unknown')
  const [positionsFeedSource, setPositionsFeedSource] = useState<PositionFeedSourceId>('live')
  const [playerFeedHasCoords, setPlayerFeedHasCoords] = useState<boolean>(false)
  const [playerFeedResponseSnippet, setPlayerFeedResponseSnippet] = useState<string>('')
  const [playerFeedAttempts, setPlayerFeedAttempts] = useState<Array<{ command: string; ok: boolean; players: number; hasCoordinates: boolean }>>([])
  const [traceEnabled, setTraceEnabled] = useState(true)
  const [traceWindowHours, setTraceWindowHours] = useState<number>(36)
  const [tracePlayerName, setTracePlayerName] = useState<string>('')
  const [playerTrace, setPlayerTrace] = useState<PlayerTracePoint[]>([])
  const [streets, setStreets] = useState<StreetPoint[]>([])
  const [streetQuery, setStreetQuery] = useState('')
  const [streetLoading, setStreetLoading] = useState(false)
  const [streetError, setStreetError] = useState('')
  const [mapSource, setMapSource] = useState<MapSourceId>('b42map')
  const [mapUrl, setMapUrl] = useState(buildMapUrl('b42map'))
  const [mapFallbackIndex, setMapFallbackIndex] = useState(0)
  const [mapFollowLive, setMapFollowLive] = useState(false)
  const [itemQuery, setItemQuery] = useState('')
  const [itemGroup, setItemGroup] = useState<ItemGroup>('all')
  const [itemCategory, setItemCategory] = useState('all')
  const [itemType, setItemType] = useState<ItemType>('all')
  const [giveMode, setGiveMode] = useState<GiveMode>('presets')
  const [itemResultLimit, setItemResultLimit] = useState<number>(250)
  const [rolePresetId, setRolePresetId] = useState<string>(BUILTIN_ROLE_PRESETS[0]?.id ?? 'police')
  const [qtyProfile, setQtyProfile] = useState<QtyProfileId>('single')
  const [presetQuery, setPresetQuery] = useState('')
  const [presetSection, setPresetSection] = useState<string>('all')
  const [customPresetName, setCustomPresetName] = useState('')
  const [customPresets, setCustomPresets] = useState<RolePreset[]>([])
  const [pinnedPresetIds, setPinnedPresetIds] = useState<string[]>([])
  const [recentPresetIds, setRecentPresetIds] = useState<string[]>([])
  const [storedDraftItems, setStoredDraftItems] = useState<DraftRolePresetItem[]>([])
  const [storedDraftLabel, setStoredDraftLabel] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [itemQty, setItemQty] = useState(1)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [includeInactiveItems, setIncludeInactiveItems] = useState(false)
  const [activeModIds, setActiveModIds] = useState<string[]>([])
  const [activeWorkshopIds, setActiveWorkshopIds] = useState<string[]>([])
  const [gunLoadouts, setGunLoadouts] = useState<GunLoadout[]>([])
  const [gunLoadoutsUpdatedUtc, setGunLoadoutsUpdatedUtc] = useState<string | undefined>(undefined)
  const [baseRolePresets, setBaseRolePresets] = useState<RolePreset[]>(BUILTIN_ROLE_PRESETS)
  const [loadoutPresetsUpdatedUtc, setLoadoutPresetsUpdatedUtc] = useState<string | undefined>(undefined)
  const [loadoutPresetsJson, setLoadoutPresetsJson] = useState<string>('')
  const [presetDraftItems, setPresetDraftItems] = useState<DraftRolePresetItem[]>([])
  const [invalidItemCodes, setInvalidItemCodes] = useState<string[]>([])
  const [lastGiveFailure, setLastGiveFailure] = useState<GiveFailureDetails | null>(null)
  const [itemValidation, setItemValidation] = useState<ItemValidation | null>(null)
  const [lastBulkFailures, setLastBulkFailures] = useState<BulkGrantFailure[]>([])
  const [bulkProgress, setBulkProgress] = useState<{
    label: string
    current: number
    total: number
    ok: number
    fail: number
    currentCode?: string
  } | null>(null)
  const [debugScenario, setDebugScenario] = useState<DebugScenarioKey>('general_startup')
  const [assistantStatus, setAssistantStatus] = useState('')
  const [lossRows, setLossRows] = useState<Array<{
    id: string
    timeUtc: string
    source: string
    reason: string
    removedCodes: string[]
    removedCount: number
    acknowledged?: boolean
    acknowledgedBy?: string
    acknowledgedUtc?: string
  }>>([])

  const socketRef = useRef<WebSocket | null>(null)
  const pingRef = useRef<number | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const stoppedRef = useRef(false)
  const logsRef = useRef<HTMLDivElement | null>(null)
  const pollRef = useRef<number | null>(null)
  const socketErrorStreakRef = useRef(0)
  const reconnectCountRef = useRef(0)
  const consoleModeRef = useRef<'websocket' | 'polling'>('websocket')
  const consoleCursorRef = useRef(0)
  const issuesRefreshRef = useRef<number | null>(null)
  const positionsFeedSourceRef = useRef<PositionFeedSourceId>('live')
  const importPresetsRef = useRef<HTMLInputElement | null>(null)

  const statusTone = useMemo(() => {
    if (status === 'running') return 'good'
    if (status === 'offline') return 'bad'
    if (status === 'starting' || status === 'stopping') return 'warn'
    return ''
  }, [status])

  const statusLabel = useMemo(() => {
    if (status === 'running') return 'ONLINE'
    if (status === 'offline') return 'OFFLINE'
    if (status === 'starting') return 'STARTING'
    if (status === 'stopping') return 'STOPPING'
    return 'UNKNOWN'
  }, [status])

  function pushLine(text: string, tone?: ConsoleLine['tone']) {
    setConsoleLines(prev => {
      const next = [...prev, { ts: nowTs(), text, tone: tone ?? classifyLine(text) }]
      return next.slice(-800)
    })
  }

  function powerConfirmMessage(signal: ServerControlPowerSignal) {
    if (signal === 'restart') return 'Restart server now? Players will reconnect shortly.'
    if (signal === 'stop') return 'Stop server now? It will go offline until started again.'
    if (signal === 'start') return 'Start server now?'
    return 'Emergency KILL will force stop immediately. Continue?'
  }

  async function logConsoleHealth(message: string, payload?: unknown) {
    try {
      await appendOpsLog([{ timeUtc: new Date().toISOString(), message, payload }])
    } catch {
      // non-blocking
    }
  }

  async function refresh() {
    try {
      const [s, r] = await Promise.all([getServerControlStatus(), getServerControlResources()])
      if (s.ok) {
        const state = (s.data?.state ?? 'unknown').toLowerCase()
        setStatus(
          state === 'running' || state === 'offline' || state === 'starting' || state === 'stopping'
            ? state
            : 'unknown'
        )
        setServerName(s.data?.name ?? 'Project Zomboid')
        setNodeName(s.data?.node ?? 'n/a')
        setAllocation(s.data?.primaryAllocation ?? 'n/a')
      }
      if (r.ok) {
        setCpu(r.data?.cpuAbsolute)
        setMemoryBytes(r.data?.memoryBytes)
        setDiskBytes(r.data?.diskBytes)
        setUptimeMs(r.data?.uptimeMs)
      }
      setLastRefresh(nowTs())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function connectConsole() {
    try {
      const info = await getServerControlConsole()
      const proxyUrl = info.proxy?.url
      const socketUrl = proxyUrl ? toWebSocketUrl(proxyUrl) : info.connection?.socket
      const token = info.connection?.token
      const usingProxy = Boolean(proxyUrl)
      if (!socketUrl || (!usingProxy && !token)) {
        pushLine('Console websocket connection info unavailable.', 'warn')
        return
      }

      socketRef.current?.close()
      const ws = new WebSocket(socketUrl)
      socketRef.current = ws

      ws.onopen = () => {
        socketErrorStreakRef.current = 0
        if (usingProxy) {
          pushLine('Console proxy socket connected.', 'info')
        } else {
          ws.send(JSON.stringify({ event: 'auth', args: [token] }))
          pushLine('Console socket connected.', 'info')
        }
        setConsoleMode('websocket')
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data ?? '{}')) as { event?: string; args?: unknown[] }
          const payload = msg.args?.[0]
          if (msg.event === 'console output' && typeof payload === 'string') {
            pushLine(payload)
          }
          if (msg.event === 'status' && typeof payload === 'string') {
            const next = payload.toLowerCase()
            if (next === 'running' || next === 'offline' || next === 'starting' || next === 'stopping') {
              setStatus(next)
            }
            pushLine(`Server state changed: ${payload}`, 'info')
          }
          if (msg.event === 'token expiring') {
            pushLine('Console token expiring, reconnecting...', 'warn')
            void connectConsole()
          }
          if (msg.event === 'token expired') {
            pushLine('Console token expired, reconnecting...', 'warn')
            void connectConsole()
          }
        } catch {
          pushLine(String(event.data ?? ''), 'normal')
        }
      }

      ws.onerror = () => {
        socketErrorStreakRef.current += 1
        reconnectCountRef.current += 1
        pushLine('Console socket error. Retrying soon...', 'error')
        if (socketErrorStreakRef.current >= 3) {
          setConsoleMode('polling')
          void logConsoleHealth('server-console.websocket.degraded', {
            socketErrors: socketErrorStreakRef.current,
            reconnects: reconnectCountRef.current
          })
        }
        if (!stoppedRef.current && !reconnectRef.current) {
          reconnectRef.current = window.setTimeout(() => {
            reconnectRef.current = null
            void connectConsole()
          }, 350)
        }
      }

      ws.onclose = () => {
        pushLine('Console socket closed.', 'warn')
        if (!stoppedRef.current && !reconnectRef.current) {
          reconnectRef.current = window.setTimeout(() => {
            reconnectRef.current = null
            void connectConsole()
          }, 350)
        }
      }
    } catch (err) {
      socketErrorStreakRef.current += 1
      pushLine(`Console setup failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
      if (socketErrorStreakRef.current >= 3) setConsoleMode('polling')
      if (!stoppedRef.current && !reconnectRef.current) {
        reconnectRef.current = window.setTimeout(() => {
          reconnectRef.current = null
          void connectConsole()
        }, 350)
      }
    }
  }

  async function runPower(signal: ServerControlPowerSignal) {
    if (!confirm(powerConfirmMessage(signal))) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      await sendServerPower(signal)
      setResult(`Power signal sent: ${signal}`)
      pushLine(`Power signal queued: ${signal}`, 'info')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function selectedCommand() {
    if (commandPreset === '__custom') return command.trim()
    return commandPreset
  }

  function selectedPlayerName() {
    if (selectedPlayer === '__manual') return manualPlayer.trim()
    return selectedPlayer.trim()
  }

  async function runCommand() {
    const text = selectedCommand()
    if (!text) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      await sendServerCommand(text)
      setResult(`Command sent: ${text}`)
      pushLine(`> ${text}`, 'info')
      if (commandPreset === '__custom') setCommand('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function pollConsoleOnce() {
    try {
      const result = await pollServerConsole(consoleCursorRef.current, 60)
      if (result.lines.length > 0) {
        setConsoleLines(prev => {
          const mapped = result.lines.map((text) => ({ ts: nowTs(), text, tone: classifyLine(text) as ConsoleLine['tone'] }))
          return [...prev, ...mapped].slice(-800)
        })
      }
      setConsoleCursor(result.cursor)
      consoleCursorRef.current = result.cursor
    } catch (err) {
      pushLine(`Console poll failed: ${err instanceof Error ? err.message : String(err)}`, 'warn')
    }
  }

  async function refreshConsoleDiagnostics() {
    try {
      const diag = await getServerConsoleDiagnostics(1400)
      setConsoleIssues(diag.issues ?? [])
      setIssuesScannedLines(diag.scannedLines ?? 0)
      setIssuesGeneratedAt(diag.generatedAtUtc ?? '')
    } catch {
      // non-blocking
    }
  }

  async function runIssueCommand(commandText: string) {
    const command = commandText.trim()
    if (!command) return
    setBusy(true)
    setError('')
    setResult('')
    try {
      await sendServerCommand(command)
      setResult(`Diagnostic command sent: ${command}`)
      pushLine(`> ${command}`, 'info')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function runQuickAction(action:
    | 'refresh'
    | 'sync_mods'
    | 'sync_items'
    | 'safe_fix'
    | 'panel_restart'
    | 'check_mods_update'
  ) {
    const actionLabel = action === 'refresh'
      ? 'Refresh Health'
      : action === 'sync_mods'
        ? 'Sync Status + Mods'
        : action === 'sync_items'
          ? 'Sync Item Catalog'
          : action === 'safe_fix'
            ? 'Run Safe Auto-Fix'
            : action === 'panel_restart'
              ? 'Panel Restart'
              : 'Check Mods Need Update'

    setBusy(true)
    setError('')
    setResult('')
    setAssistantStatus(`Running: ${actionLabel}...`)
    pushLine(`[${nowTs()}] Running: ${actionLabel}`, 'info')
    try {
      const response = action === 'sync_items'
        ? await syncItemCatalog().then((r) => ({
          ok: !!r.ok,
          action,
          message: `Item catalog sync complete. Items: ${r.items ?? 'n/a'}, Mods: ${r.mods ?? 'n/a'}.`,
          result: r as unknown as Record<string, unknown>
        }))
        : await runGameQuickAction(action)

      if (response.ok) {
        setResult(response.message ?? 'Action completed.')
        if (action === 'sync_items') {
          const resultObj = (response.result ?? {}) as Record<string, unknown>
          const items = resultObj.items != null ? String(resultObj.items) : 'n/a'
          const mods = resultObj.mods != null ? String(resultObj.mods) : 'n/a'
          const added = resultObj.added != null ? String(resultObj.added) : 'n/a'
          const updated = resultObj.updated != null ? String(resultObj.updated) : 'n/a'
          setAssistantStatus(`Done: ${actionLabel}. Items=${items}, Mods=${mods}, Added=${added}, Updated=${updated}`)
        } else {
          setAssistantStatus(`Done: ${actionLabel}`)
        }
        if (action === 'check_mods_update') pushLine('> checkModsNeedUpdate', 'info')
        if (action === 'panel_restart') pushLine('Panel restart requested.', 'info')
      } else {
        setError(response.message ?? 'Action failed.')
        setAssistantStatus(`Failed: ${actionLabel}`)
      }
      if (action === 'refresh' || action === 'sync_mods' || action === 'sync_items' || action === 'safe_fix' || action === 'panel_restart') {
        await Promise.all([refresh(), refreshConsoleDiagnostics(), refreshPlayersAndItems()])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setAssistantStatus(`Failed: ${actionLabel}`)
    } finally {
      setBusy(false)
    }
  }

  async function refreshPlayersOnly() {
    try {
      const playerRes = await getGamePlayersWithSource(positionsFeedSourceRef.current)
      setPlayerFeedCommand(String(playerRes.command ?? 'players'))
      setPlayerFeedSource(String(playerRes.coordinateSource ?? 'players-command'))
      setPlayerFeedHasCoords(Boolean(playerRes.hasCoordinates))
      setPlayerFeedResponseSnippet(String(playerRes.response ?? '').slice(0, 180))
      setPlayerFeedAttempts((playerRes.attemptedCommands ?? []).map((row) => ({
        command: String(row.command ?? ''),
        ok: Boolean(row.ok),
        players: Number(row.players ?? 0),
        hasCoordinates: Boolean(row.hasCoordinates)
      })))
      const playerEntries = (playerRes.players ?? []).map((entry) => {
        const name = String(entry.name ?? '').trim()
        const raw = String(entry.raw ?? '').trim()
        const directX = entry.x != null ? Number(entry.x) : undefined
        const directY = entry.y != null ? Number(entry.y) : undefined
        const directZ = entry.z != null ? Number(entry.z) : undefined
        const fallback = extractCoordinates(raw)
        const coords = {
          x: Number.isFinite(directX as number) ? directX : fallback.x,
          y: Number.isFinite(directY as number) ? directY : fallback.y,
          z: Number.isFinite(directZ as number) ? directZ : fallback.z
        }
        return {
          name: name || raw || 'Unknown',
          raw,
          ...coords
        } as PlayerPosition
      })
      setPlayerPositions(playerEntries)
      setPlayerPositionsUpdatedAt(new Date().toLocaleTimeString())
      if (traceEnabled) {
        setPlayerTrace(prev => {
          const nowIso = new Date().toISOString()
          const incoming: PlayerTracePoint[] = playerEntries
            .filter((entry) => entry.x != null && entry.y != null)
            .map((entry) => ({
              name: entry.name,
              x: entry.x as number,
              y: entry.y as number,
              z: entry.z,
              timeUtc: nowIso
            }))

          const combined = [...prev, ...incoming]
          const cutoff = Date.now() - 72 * 60 * 60 * 1000
          const trimmed = combined.filter((point) => new Date(point.timeUtc).getTime() >= cutoff)

          // Collapse consecutive duplicates for same player.
          const deduped: PlayerTracePoint[] = []
          for (const point of trimmed) {
            const last = deduped[deduped.length - 1]
            if (
              last
              && last.name === point.name
              && last.x === point.x
              && last.y === point.y
              && (last.z ?? -9999) === (point.z ?? -9999)
            ) {
              continue
            }
            deduped.push(point)
          }
          return deduped
        })
      }
      if (mapFollowLive && playerEntries.length > 0) {
        const withCoords = playerEntries.find((entry) => entry.x != null && entry.y != null)
        if (withCoords) setMapUrl(buildMapUrl(mapSource, withCoords.x, withCoords.y))
      }

      const nextPlayers = playerEntries
        .map((entry) => entry.name)
        .filter((name) => !!name)
      setPlayers(nextPlayers)
      if (nextPlayers.length > 0) {
        setSelectedPlayer((prev) => (prev ? prev : nextPlayers[0]))
      }
    } catch {
      setPlayerFeedHasCoords(false)
      setPlayerFeedSource('error')
      setPlayerFeedAttempts([])
      // non-blocking
    }
  }

  async function refreshPlayersAndItems() {
    await refreshPlayersOnly()
    try {
      const [itemCatalog, modsPayload] = await Promise.all([
        getContent<ItemCatalogPayload>('items-catalog'),
        getContent<unknown>('mods').catch(() => [])
      ])

      const serverMods = Array.isArray(modsPayload) ? (modsPayload as ServerModRow[]) : []
      const activeModIdSet = new Set(
        serverMods
          .filter((row) => String(row?.source ?? '').toLowerCase() === 'server')
          .map((row) => String(row?.modId ?? '').trim())
          .filter(Boolean)
      )
      const activeWorkshopIdSet = new Set(
        serverMods
          .filter((row) => String(row?.source ?? '').toLowerCase() === 'server')
          .map((row) => String(row?.workshopId ?? '').trim())
          .filter(Boolean)
      )
      setActiveModIds(Array.from(activeModIdSet.values()).sort((a, b) => a.localeCompare(b)))
      setActiveWorkshopIds(Array.from(activeWorkshopIdSet.values()).sort((a, b) => a.localeCompare(b)))

      const mappedItems = (itemCatalog.items ?? [])
        .map((x) => {
          const code = String(x.code ?? '').trim()
          const name = String(x.name ?? '').trim()
          const category = String(x.category ?? '').trim()
          const sourceModId = String(x.sourceModId ?? '').trim()
          const sourceWorkshopId = String(x.sourceWorkshopId ?? '').trim()
          return {
            code,
            name,
            category,
            sourceModId: sourceModId || undefined,
            sourceWorkshopId: sourceWorkshopId || undefined
          }
        })
        .filter((x) => x.code && x.name)
        .filter((x) => {
          if (includeInactiveItems) return true
          if (activeModIdSet.size === 0 && activeWorkshopIdSet.size === 0) return true
          // Only show items that should be spawnable on the live server. This prevents the UI from
          // listing items from installed-but-not-enabled mods which would fail with "Unknown item".
          const module = x.code.includes('.') ? x.code.split('.', 2)[0] : ''
          if (!module || module.toLowerCase() === 'base') return true
          if (x.sourceModId && activeModIdSet.has(x.sourceModId)) return true
          if (activeModIdSet.has(module)) return true
          if (x.sourceWorkshopId && activeWorkshopIdSet.has(x.sourceWorkshopId)) return true
          return false
        })
        .sort((a, b) => a.code.localeCompare(b.code))

      setItems(mappedItems)
      if ((!itemCode || !mappedItems.some((x) => x.code === itemCode)) && mappedItems.length > 0) setItemCode(mappedItems[0].code)
    } catch {
      setItems([])
    }

    try {
      const lossWatch = await getItemLossWatch(30).catch(() => ({ ok: true, rows: [] as Array<{
        id: string
        timeUtc: string
        source: string
        reason: string
        removedCodes: string[]
        removedCount: number
        acknowledged?: boolean
        acknowledgedBy?: string
        acknowledgedUtc?: string
      }> }))
      setLossRows(lossWatch.rows ?? [])
    } catch {
      setLossRows([])
    }
  }

  useEffect(() => {
    // When staff toggles inactive items, re-fetch so the item list reflects the current server mod list.
    void refreshPlayersAndItems()
  }, [includeInactiveItems])

  useEffect(() => {
    // Load saved gun loadouts from admin content.
    void (async () => {
      try {
        const payload = await apiLoadGunLoadouts()
        setGunLoadouts(payload.loadouts ?? [])
        setGunLoadoutsUpdatedUtc(payload.updatedUtc)
      } catch {
        setGunLoadouts([])
        setGunLoadoutsUpdatedUtc(undefined)
      }
    })()
  }, [])

  useEffect(() => {
    // Load loadout preset library from content (editable without redeploy).
    void (async () => {
      try {
        const payload = await apiLoadLoadoutPresets()
        const presets = payload.presets ?? []
        if (presets.length > 0) setBaseRolePresets(presets.map(toRolePreset))
        setLoadoutPresetsUpdatedUtc(payload.updatedUtc)
        setLoadoutPresetsJson(JSON.stringify(payload, null, 2))
      } catch {
        setLoadoutPresetsUpdatedUtc(undefined)
        setLoadoutPresetsJson('')
        // Keep built-in presets as fallback.
      }
    })()
  }, [])

  async function giveItemToPlayer() {
    const player = selectedPlayerName()
    const code = itemCode.trim()
    const qty = Math.max(1, Math.floor(itemQty || 1))
    if (!player || !code) {
      setError('Select player and item first.')
      return
    }
    if (includeInactiveItems && isItemFromInactiveMod(code)) {
      const ok = confirm(`"${code}" looks like it comes from a mod that is not enabled on the live server.\n\nGiving it will likely fail with "Unknown item". Continue anyway?`)
      if (!ok) return
    }
    try {
      const v = await validateItemCode(code)
      if (v.ok && (!v.inCatalog || v.active === false)) {
        const reasons = (v.reasons ?? []).join(', ') || 'unknown'
        const ok = confirm(`Validation warning for "${code}":\n- inCatalog: ${v.inCatalog ? 'yes' : 'no'}\n- active: ${v.active ? 'yes' : 'no'}\n- reasons: ${reasons}\n\nContinue anyway?`)
        if (!ok) return
      }
    } catch {
      // Non-blocking: validation is best-effort, give should still work.
    }

    setBusy(true)
    setError('')
    setResult('')
    setLastGiveFailure(null)
    try {
      const sent = await sendAddItemCommand(player, code, qty)
      setResult(`Item grant sent (${sent.mode}): ${player} -> ${code} x${qty}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function sendAddItemCommand(player: string, code: string, qty: number) {
    const safePlayer = sanitizeConsoleArg(player)
    const candidates = codeCandidates(code)
    let lastErr = ''
    const triedCommands: string[] = []
    const triedCandidates: string[] = []
    let lastResponseText = ''
    for (const candidate of candidates) {
      triedCandidates.push(candidate)
      const safeCode = sanitizeConsoleArg(candidate)
      const variants = [
        `additem "${safePlayer}" "${safeCode}" ${qty}`,
        `additem "${safePlayer}" ${safeCode} ${qty}`,
        `/additem "${safePlayer}" ${safeCode} ${qty}`
      ]

      for (const cmd of variants) {
        triedCommands.push(cmd)
        try {
          try {
            const response = await runGameServerCommand(cmd)
            const text = extractPayloadText(response.payload)
            if (responseLooksFailed(text)) {
              lastResponseText = text
              lastErr = `Command failed: ${cmd}\n${text}`.slice(0, 1600)
              continue
            }
            pushLine(`> ${cmd}`, 'info')
            return { mode: 'game-control', command: cmd }
          } catch {
            await sendServerCommand(cmd)
            pushLine(`> ${cmd}`, 'info')
            return { mode: 'panel-console', command: cmd }
          }
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err)
        }
      }
    }

    setLastGiveFailure({
      time: new Date().toLocaleString(),
      player,
      requestedCode: code,
      triedCandidates,
      triedCommands: triedCommands.slice(-12),
      lastResponseText: lastResponseText.slice(0, 1200)
    })
    throw new Error(lastErr || 'Failed to send additem command.')
  }

  const allRolePresets = useMemo(
    () => [...baseRolePresets, ...customPresets].sort((a, b) => a.label.localeCompare(b.label)),
    [baseRolePresets, customPresets]
  )
  const selectedRolePreset = useMemo(
    () => allRolePresets.find((preset) => preset.id === rolePresetId) ?? allRolePresets[0],
    [allRolePresets, rolePresetId]
  )
  const removedItemCodes = useMemo(() => {
    const set = new Set<string>()
    for (const row of lossRows) {
      for (const code of row.removedCodes ?? []) {
        const normalized = String(code ?? '').trim()
        if (normalized) set.add(normalized)
      }
    }
    return set
  }, [lossRows])
  const unavailableItemCodes = useMemo(() => {
    const set = new Set<string>()
    for (const code of invalidItemCodes) {
      const normalized = String(code ?? '').trim()
      if (normalized) set.add(normalized)
    }
    for (const code of removedItemCodes) set.add(code)
    return set
  }, [invalidItemCodes, removedItemCodes])
  const rolePresetGroups = useMemo(() => {
    const presetsById = new Map<string, RolePreset>(allRolePresets.map((preset) => [preset.id, preset]))
    const grouped = new Map<string, RolePreset[]>()
    const pinnedSet = new Set(pinnedPresetIds)
    const recentSet = new Set(recentPresetIds)
    const recent: RolePreset[] = []
    const pinned: RolePreset[] = []
    for (const id of recentPresetIds) {
      const preset = presetsById.get(id)
      if (preset) recent.push(preset)
    }
    for (const preset of allRolePresets) {
      if (recentSet.has(preset.id)) continue
      if (pinnedSet.has(preset.id)) {
        pinned.push(preset)
        continue
      }
      const section = rolePresetSection(preset)
      const current = grouped.get(section) ?? []
      current.push(preset)
      grouped.set(section, current)
    }
    const rows = Array.from(grouped.entries())
      .map(([section, presets]) => ({
        section,
        presets: presets.slice().sort((a, b) => a.label.localeCompare(b.label))
      }))
      .sort((a, b) => a.section.localeCompare(b.section))
    if (recent.length > 0) {
      rows.unshift({
        section: 'Recent',
        presets: recent
      })
    }
    if (pinned.length > 0) {
      rows.unshift({
        section: 'Pinned',
        presets: pinned.slice().sort((a, b) => a.label.localeCompare(b.label))
      })
    }
    return rows
  }, [allRolePresets, pinnedPresetIds, recentPresetIds])
  const rolePresetSections = useMemo(
    () => rolePresetGroups.map((group) => group.section),
    [rolePresetGroups]
  )
  const sortedPresetBundles = useMemo(
    () => PRESET_BUNDLES.slice().sort((a, b) => a.label.localeCompare(b.label)),
    []
  )
  const filteredRolePresetGroups = useMemo(() => {
    const q = presetQuery.trim().toLowerCase()
    return rolePresetGroups
      .map((group) => {
        if (presetSection !== 'all' && group.section !== presetSection) return { ...group, presets: [] as RolePreset[] }
        const presets = group.presets.filter((preset) => {
          if (!q) return true
          const hay = `${preset.label} ${preset.id} ${group.section}`.toLowerCase()
          return hay.includes(q)
        })
        return { ...group, presets }
      })
      .filter((group) => group.presets.length > 0)
  }, [rolePresetGroups, presetSection, presetQuery])
  const filteredPresetIds = useMemo(() => {
    const set = new Set<string>()
    for (const group of filteredRolePresetGroups) {
      for (const preset of group.presets) set.add(preset.id)
    }
    return set
  }, [filteredRolePresetGroups])
  const flattenedFilteredPresets = useMemo(
    () => filteredRolePresetGroups
      .flatMap((group) => group.presets.map((preset) => ({ preset, section: group.section })))
      .sort((a, b) => a.preset.label.localeCompare(b.preset.label)),
    [filteredRolePresetGroups]
  )
  const presetSectionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const group of rolePresetGroups) {
      counts.set(group.section, group.presets.length)
    }
    return counts
  }, [rolePresetGroups])
  const qtyMultiplier = useMemo(
    () => QTY_PROFILES.find((p) => p.id === qtyProfile)?.multiplier ?? 1,
    [qtyProfile]
  )
  const draftTotals = useMemo(() => {
    const unique = presetDraftItems.length
    const selected = presetDraftItems.filter((item) => item.enabled !== false)
    const selectedUnique = selected.length
    const baseQty = selected.reduce((sum, item) => sum + Math.max(1, Math.floor(item.qty || 1)), 0)
    const scaledQty = selected.reduce((sum, item) => sum + Math.max(1, Math.floor((item.qty || 1) * qtyMultiplier)), 0)
    return { unique, selectedUnique, baseQty, scaledQty }
  }, [presetDraftItems, qtyMultiplier])
  const itemCodeSet = useMemo(
    () => new Set(items.map((item) => item.code)),
    [items]
  )
  const missingDraftCodes = useMemo(
    () => presetDraftItems
      .filter((item) => item.enabled !== false)
      .map((item) => String(item.code ?? '').trim())
      .filter((code) => !!code && !itemCodeSet.has(code)),
    [presetDraftItems, itemCodeSet]
  )
  const selectedPlayerValue = selectedPlayerName()
  const selectedPlayerOnline = useMemo(
    () => !!selectedPlayerValue && players.includes(selectedPlayerValue),
    [players, selectedPlayerValue]
  )
  const largeGrantWarning = draftTotals.scaledQty >= 1000
  const givingPreviewItems = useMemo(
    () => presetDraftItems
      .filter((item) => item.enabled !== false)
      .map((item) => ({
        code: String(item.code ?? '').trim(),
        qty: Math.max(1, Math.floor(item.qty || 1)),
        scaledQty: Math.max(1, Math.floor((item.qty || 1) * qtyMultiplier))
      }))
      .filter((item) => item.code.length > 0),
    [presetDraftItems, qtyMultiplier]
  )
  const itemByCode = useMemo(() => {
    const map = new Map<string, CatalogItem>()
    for (const item of items) map.set(item.code, item)
    return map
  }, [items])
  const previewGroupBreakdown = useMemo(() => {
    const counts = new Map<ItemGroup, number>()
    for (const item of givingPreviewItems) {
      const catalog = itemByCode.get(item.code)
      const group = catalog ? inferItemGroup(catalog) : 'other'
      counts.set(group, (counts.get(group) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [givingPreviewItems, itemByCode])

  async function grantPresetToPlayer(preset: RolePreset) {
    const player = selectedPlayerName()
    if (!player || !preset) {
      setError('Select player and role preset first.')
      return
    }
    const draftItems = presetDraftItems
      .filter((item) => item.enabled !== false)
      .map((item) => ({ code: String(item.code ?? '').trim(), qty: Math.max(1, Math.floor(item.qty || 1)) }))
      .filter((item) => item.code.length > 0)
    if (draftItems.length === 0) {
      setError('No enabled items to grant. Select at least one item.')
      return
    }

    const preview = draftItems
      .slice(0, 12)
      .map((item) => `${item.code} x${Math.max(1, Math.floor(item.qty * qtyMultiplier))}`)
      .join('\n')
    const overflow = draftItems.length > 12 ? `\n...and ${draftItems.length - 12} more` : ''
    const approved = confirm(`Grant preset "${preset.label}" to ${player}?\nItems: ${draftItems.length} • Scale: x${qtyMultiplier}\n\n${preview}${overflow}`)
    if (!approved) return

    setBusy(true)
    setError('')
    setResult('')
    setLastBulkFailures([])
    setBulkProgress({ label: `Grant preset: ${preset.label}`, current: 0, total: draftItems.length, ok: 0, fail: 0 })
    let okCount = 0
    let failCount = 0
    const failures: BulkGrantFailure[] = []
    try {
      for (let i = 0; i < draftItems.length; i++) {
        const item = draftItems[i]
        const qty = Math.max(1, Math.floor((item.qty || 1) * qtyMultiplier))
        try {
          setBulkProgress({ label: `Grant preset: ${preset.label}`, current: i + 1, total: draftItems.length, ok: okCount, fail: failCount, currentCode: item.code })
          await sendAddItemCommand(player, item.code, qty)
          okCount++
          setBulkProgress({ label: `Grant preset: ${preset.label}`, current: i + 1, total: draftItems.length, ok: okCount, fail: failCount, currentCode: item.code })
        } catch (err) {
          failCount++
          failures.push({ code: item.code, qty, error: err instanceof Error ? err.message : String(err) })
          setBulkProgress({ label: `Grant preset: ${preset.label}`, current: i + 1, total: draftItems.length, ok: okCount, fail: failCount, currentCode: item.code })
        }
      }
      setRecentPresetIds((prev) => [preset.id, ...prev.filter((id) => id !== preset.id)].slice(0, 10))
      setLastBulkFailures(failures)
      setResult(`Preset grant complete (${preset.label}) for ${player}: ${okCount} succeeded, ${failCount} failed.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBulkProgress(null)
      setBusy(false)
    }
  }

  async function grantRolePresetToPlayer() {
    const preset = selectedRolePreset
    if (!preset) {
      setError('Select player and role preset first.')
      return
    }
    await grantPresetToPlayer(preset)
  }

  async function grantPresetBundle(bundle: PresetBundle) {
    const player = selectedPlayerName()
    if (!player) {
      setError('Select player first.')
      return
    }
    const presets = bundle.presetIds
      .map((id) => allRolePresets.find((preset) => preset.id === id))
      .filter((preset): preset is RolePreset => Boolean(preset))
    if (presets.length === 0) {
      setError('Bundle has no available presets.')
      return
    }

    const approved = confirm(`Grant bundle "${bundle.label}" (${presets.length} presets) to ${player}? Scale: x${qtyMultiplier}`)
    if (!approved) return

    setBusy(true)
    setError('')
    setResult('')
    setLastBulkFailures([])
    let okCount = 0
    let failCount = 0
    const failures: BulkGrantFailure[] = []
    try {
      const totalItems = presets.reduce((sum, p) => sum + (p?.items?.length ?? 0), 0)
      let index = 0
      setBulkProgress({ label: `Grant bundle: ${bundle.label}`, current: 0, total: totalItems, ok: 0, fail: 0 })
      for (const preset of presets) {
        setRecentPresetIds((prev) => [preset.id, ...prev.filter((id) => id !== preset.id)].slice(0, 10))
        for (const item of preset.items) {
          const qty = Math.max(1, Math.floor((item.qty || 1) * qtyMultiplier))
          try {
            index++
            setBulkProgress({ label: `Grant bundle: ${bundle.label}`, current: index, total: totalItems, ok: okCount, fail: failCount, currentCode: item.code })
            await sendAddItemCommand(player, item.code, qty)
            okCount++
            setBulkProgress({ label: `Grant bundle: ${bundle.label}`, current: index, total: totalItems, ok: okCount, fail: failCount, currentCode: item.code })
          } catch (err) {
            failCount++
            failures.push({ code: item.code, qty, error: err instanceof Error ? err.message : String(err) })
            setBulkProgress({ label: `Grant bundle: ${bundle.label}`, current: index, total: totalItems, ok: okCount, fail: failCount, currentCode: item.code })
          }
        }
      }
      setLastBulkFailures(failures)
      setResult(`Bundle grant complete (${bundle.label}) for ${player}: ${okCount} succeeded, ${failCount} failed.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBulkProgress(null)
      setBusy(false)
    }
  }

  function togglePinnedPreset(id: string) {
    setPinnedPresetIds(prev => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function moveDraftItem(index: number, direction: -1 | 1) {
    setPresetDraftItems((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = prev.slice()
      const temp = next[index]
      next[index] = next[target]
      next[target] = temp
      return next
    })
  }

  function applyDraftRowAction(index: number, action: string) {
    if (!action) return
    if (action === 'up') {
      moveDraftItem(index, -1)
      return
    }
    if (action === 'down') {
      moveDraftItem(index, 1)
      return
    }
    if (action === 'use') {
      const row = presetDraftItems[index]
      if (!row) return
      setItemCode(row.code)
      setItemQty(Math.max(1, Math.floor(row.qty || 1)))
      return
    }
    if (action === 'remove') {
      setPresetDraftItems((prev) => prev.filter((_, rowIdx) => rowIdx !== index))
    }
  }

  function setAllDraftItemsEnabled(enabled: boolean) {
    setPresetDraftItems((prev) => prev.map((row) => ({ ...row, enabled })))
  }

  function addManualItemToDraft() {
    const code = String(itemCode ?? '').trim()
    const qty = Math.max(1, Math.floor(itemQty || 1))
    if (!code) {
      setError('Choose an item code first.')
      return
    }
    setPresetDraftItems((prev) => {
      const idx = prev.findIndex((row) => row.code === code)
      if (idx >= 0) {
        const next = prev.slice()
        next[idx] = { ...next[idx], qty: Math.max(1, Math.floor((next[idx].qty || 1) + qty)), enabled: true }
        return next
      }
      return [...prev, { code, qty, enabled: true }]
    })
    setResult(`Added to preset draft: ${code} x${qty}`)
  }

  function safeAddToDraft(code: string, qty: number) {
    const normalized = String(code ?? '').trim()
    const amount = Math.max(1, Math.floor(qty || 1))
    if (!normalized) return
    setPresetDraftItems((prev) => {
      const idx = prev.findIndex((row) => row.code === normalized)
      if (idx >= 0) {
        const next = prev.slice()
        next[idx] = { ...next[idx], qty: Math.max(1, Math.floor((next[idx].qty || 1) + amount)), enabled: true }
        return next
      }
      return [...prev, { code: normalized, qty: amount, enabled: true }]
    })
  }

  async function retryLastBulkFailures() {
    const player = selectedPlayerName()
    if (!player) {
      setError('Select a player first before retrying failures.')
      return
    }
    if (lastBulkFailures.length === 0) {
      setError('No bulk failures to retry.')
      return
    }

    const failures = lastBulkFailures.slice(0, 500)
    setBusy(true)
    setError('')
    setResult('')
    const nextFailures: BulkGrantFailure[] = []
    let okCount = 0
    let failCount = 0
    try {
      setBulkProgress({ label: 'Retry failed items', current: 0, total: failures.length, ok: 0, fail: 0 })
      for (let i = 0; i < failures.length; i++) {
        const row = failures[i]
        setBulkProgress({ label: 'Retry failed items', current: i + 1, total: failures.length, ok: okCount, fail: failCount, currentCode: row.code })
        try {
          await sendAddItemCommand(player, row.code, row.qty)
          okCount++
        } catch (err) {
          failCount++
          nextFailures.push({ code: row.code, qty: row.qty, error: err instanceof Error ? err.message : String(err) })
        }
        setBulkProgress({ label: 'Retry failed items', current: i + 1, total: failures.length, ok: okCount, fail: failCount, currentCode: row.code })
      }
      setLastBulkFailures(nextFailures)
      setResult(`Retry complete for ${player}: ${okCount} succeeded, ${failCount} failed.`)
    } finally {
      setBulkProgress(null)
      setBusy(false)
    }
  }

  async function copyBulkFailures() {
    if (lastBulkFailures.length === 0) {
      setError('No bulk failures to copy.')
      return
    }
    const text = lastBulkFailures.map((x) => `${x.code},${x.qty}`).join('\n')
    await safeCopy(text)
    setResult(`Copied ${lastBulkFailures.length} failed codes to clipboard (code,qty).`)
  }

  function isItemFromInactiveMod(code: string) {
    const item = items.find((x) => x.code === code)
    if (!item) return false
    const module = item.code.includes('.') ? item.code.split('.', 2)[0] : ''
    if (!module || module.toLowerCase() === 'base') return false
    const activeModSet = new Set(activeModIds)
    const activeWorkshopSet = new Set(activeWorkshopIds)
    if (item.sourceModId && activeModSet.has(item.sourceModId)) return false
    if (activeModSet.has(module)) return false
    if (item.sourceWorkshopId && activeWorkshopSet.has(item.sourceWorkshopId)) return false
    // If we can't determine active mods, don't call it inactive.
    if (activeModSet.size === 0 && activeWorkshopSet.size === 0) return false
    return true
  }

  async function persistGunLoadouts(next: GunLoadout[]) {
    const payload: GunLoadoutsContent = { updatedUtc: new Date().toISOString(), loadouts: next }
    await apiSaveGunLoadouts(payload)
    setGunLoadouts(next)
    setGunLoadoutsUpdatedUtc(payload.updatedUtc)
    setResult(`Saved gun loadouts: ${next.length}`)
  }

  async function reloadLoadoutPresets() {
    try {
      const payload = await apiLoadLoadoutPresets()
      if (payload.presets.length > 0) setBaseRolePresets(payload.presets.map(toRolePreset))
      setLoadoutPresetsUpdatedUtc(payload.updatedUtc)
      setLoadoutPresetsJson(JSON.stringify(payload, null, 2))
      setResult(`Loaded loadout presets: ${payload.presets.length}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveLoadoutPresetsFromJson() {
    try {
      const raw = loadoutPresetsJson.trim()
      if (!raw) {
        setError('Loadout presets JSON is empty.')
        return
      }
      const parsed = JSON.parse(raw)
      const normalized = normalizeLoadoutPresetsContent(parsed)
      const payload: LoadoutPresetsContent = { updatedUtc: new Date().toISOString(), presets: normalized.presets }
      await apiSaveLoadoutPresets(payload)
      setBaseRolePresets(payload.presets.length > 0 ? payload.presets.map(toRolePreset) : BUILTIN_ROLE_PRESETS)
      setLoadoutPresetsUpdatedUtc(payload.updatedUtc)
      setLoadoutPresetsJson(JSON.stringify(payload, null, 2))
      setResult(`Saved loadout presets: ${payload.presets.length}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveBuiltinPresetsToContent() {
    if (!confirm('Overwrite loadout-presets content with the built-in presets?')) return
    const payload: LoadoutPresetsContent = { updatedUtc: new Date().toISOString(), presets: BUILTIN_ROLE_PRESETS.map(toLoadoutPreset) }
    await apiSaveLoadoutPresets(payload)
    setBaseRolePresets(BUILTIN_ROLE_PRESETS)
    setLoadoutPresetsUpdatedUtc(payload.updatedUtc)
    setLoadoutPresetsJson(JSON.stringify(payload, null, 2))
    setResult(`Saved built-in presets to content: ${BUILTIN_ROLE_PRESETS.length}`)
  }

  async function validateSelectedItem() {
    const code = itemCode.trim()
    if (!code) {
      setError('Pick an item code first.')
      return
    }
    try {
      const v = await validateItemCode(code)
      if (!v.ok) throw new Error('Validation failed.')
      setItemValidation({
        time: new Date().toLocaleString(),
        code,
        inCatalog: Boolean(v.inCatalog),
        active: Boolean(v.active),
        kind: v.kind,
        caliberKeys: v.caliberKeys ?? [],
        reasons: v.reasons ?? [],
        sourceModId: v.sourceModId,
        sourceWorkshopId: v.sourceWorkshopId
      })
      setResult(`Validated: ${code}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function upsertGunLoadoutFromCurrentSelection() {
    if (!selectedGunForHelper) {
      setError('Pick a gun first.')
      return
    }
    const gun = selectedGunForHelper
    const defaults = gunHelperDefaults

    const baseItems: GunLoadoutItem[] = [{ code: gun.code, qty: 1, kind: 'gun' }]
    if (defaults.magazine) baseItems.push({ code: defaults.magazine.code, qty: 4, kind: 'mag' })
    if (defaults.ammo) baseItems.push({ code: defaults.ammo.code, qty: 120, kind: 'ammo' })

    // Keep attachments conservative: take a few top generic/token-matched parts.
    const gunTokens = inferGunTokens(gun)
    const scored = gunHelperAttachments
      .map((a) => {
        const t = `${a.code} ${a.name ?? ''}`.toLowerCase()
        const tokenHits = gunTokens.filter((tok) => t.includes(tok)).length
        const generic = ['scope', 'sight', 'laser', 'suppressor', 'silencer', 'muzzle', 'grip', 'sling', 'strap', 'rail', 'mount']
          .some((k) => t.includes(k))
        const score = tokenHits * 10 + (generic ? 2 : 0)
        return { a, score }
      })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 6)
      .map((x) => ({ code: x.a.code, qty: 1, kind: 'attachment' as const }))

    const items = [...baseItems, ...scored]
    const existing = gunLoadouts.find((x) => x.gunCode === gun.code)
    const id = existing?.id ?? `gun-${gun.code.replace(/[^A-Za-z0-9_.-]+/g, '-').toLowerCase()}`
    const label = existing?.label ?? gun.name
    const nextRow: GunLoadout = { id, label, gunCode: gun.code, items }
    const next = [nextRow, ...gunLoadouts.filter((x) => x.id !== id && x.gunCode !== gun.code)]
    await persistGunLoadouts(next)
  }

  async function renameCurrentGunLoadout(label: string) {
    if (!currentGunLoadout) return
    const nextLabel = label.trim()
    if (!nextLabel) {
      setError('Label cannot be empty.')
      return
    }
    const next = gunLoadouts.map((x) => x.id === currentGunLoadout.id ? { ...x, label: nextLabel } : x)
    await persistGunLoadouts(next)
  }

  async function deleteCurrentGunLoadout() {
    if (!currentGunLoadout) return
    if (!confirm(`Delete saved gun loadout recipe "${currentGunLoadout.label}"?`)) return
    const next = gunLoadouts.filter((x) => x.id !== currentGunLoadout.id)
    await persistGunLoadouts(next)
  }

  async function addItemToCurrentGunLoadout(code: string, qty: number, kind?: GunLoadoutItem['kind']) {
    if (!currentGunLoadout) return
    const normalized = String(code ?? '').trim()
    const amount = Math.max(1, Math.floor(qty || 1))
    if (!normalized) return
    const existing = currentGunLoadout.items?.find((x) => x.code === normalized)
    const items = existing
      ? currentGunLoadout.items.map((x) => x.code === normalized ? { ...x, qty: x.qty + amount } : x)
      : [...(currentGunLoadout.items ?? []), { code: normalized, qty: amount, kind }]
    const next = gunLoadouts.map((x) => x.id === currentGunLoadout.id ? { ...x, items } : x)
    await persistGunLoadouts(next)
  }

  async function removeItemFromCurrentGunLoadout(code: string) {
    if (!currentGunLoadout) return
    const normalized = String(code ?? '').trim()
    const items = (currentGunLoadout.items ?? []).filter((x) => x.code !== normalized)
    const next = gunLoadouts.map((x) => x.id === currentGunLoadout.id ? { ...x, items } : x)
    await persistGunLoadouts(next)
  }

  function addGunLoadoutToDraft(loadout: GunLoadout) {
    for (const it of loadout.items ?? []) safeAddToDraft(it.code, it.qty)
    setResult(`Added loadout to draft: ${loadout.label}`)
  }

  function stashCurrentDraft() {
    if (presetDraftItems.length === 0) {
      setError('Draft is empty. Add items before storing.')
      return
    }
    const snapshot = presetDraftItems
      .map((row) => ({
        code: String(row.code ?? '').trim(),
        qty: Math.max(1, Math.floor(row.qty || 1)),
        enabled: row.enabled !== false
      }))
      .filter((row) => row.code.length > 0)
    if (snapshot.length === 0) {
      setError('Draft has no valid items to store.')
      return
    }
    setStoredDraftItems(snapshot)
    setStoredDraftLabel(selectedRolePreset?.label ?? 'Stored Draft')
    setResult(`Stored loadout draft (${snapshot.length} items).`)
  }

  function restoreStashedDraft() {
    if (storedDraftItems.length === 0) {
      setError('No stored draft available.')
      return
    }
    setPresetDraftItems(storedDraftItems.map((row) => ({ code: row.code, qty: row.qty, enabled: row.enabled !== false })))
    setResult(`Restored stored loadout draft (${storedDraftItems.length} items).`)
  }

  function clearCurrentDraft() {
    setPresetDraftItems([])
    setResult('Cleared current loadout draft.')
  }

  function saveDraftAsCustomPreset() {
    const name = customPresetName.trim()
    if (!name) {
      setError('Enter a custom preset name first.')
      return
    }
    if (presetDraftItems.length === 0) {
      setError('Draft is empty. Add items before saving.')
      return
    }
    const baseId = `custom-${slugPresetName(name)}`
    const id = `${baseId}-${Date.now().toString().slice(-6)}`
    const items = presetDraftItems
      .filter((row) => row.enabled !== false)
      .map((row) => ({ code: String(row.code ?? '').trim(), qty: Math.max(1, Math.floor(row.qty || 1)) }))
      .filter((row) => row.code.length > 0)
    const nextPreset: RolePreset = { id, label: name, items }
    setCustomPresets((prev) => [nextPreset, ...prev.filter((row) => row.id !== id)])
    setRolePresetId(id)
    setResult(`Saved custom preset: ${name}`)
  }

  function deleteSelectedCustomPreset() {
    const preset = selectedRolePreset
    if (!preset || !preset.id.startsWith('custom-')) return
    if (!confirm(`Delete custom preset "${preset.label}"?`)) return
    setCustomPresets((prev) => prev.filter((row) => row.id !== preset.id))
    setPinnedPresetIds((prev) => prev.filter((id) => id !== preset.id))
    setRolePresetId(baseRolePresets[0]?.id ?? '')
    setResult(`Deleted custom preset: ${preset.label}`)
  }

  function exportCustomPresets() {
    if (customPresets.length === 0) {
      setError('No custom presets to export.')
      return
    }
    try {
      const payload = {
        version: 1,
        exportedUtc: new Date().toISOString(),
        presets: customPresets
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ghrp-custom-presets-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setResult(`Exported ${customPresets.length} custom presets.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onImportCustomPresetsFile(file: File | null) {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const source = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.presets)
          ? parsed.presets
          : []
      if (!Array.isArray(source) || source.length === 0) {
        setError('Import file has no presets.')
        return
      }
      const imported = source
        .map((row: any) => ({
          id: String(row?.id ?? '').trim(),
          label: String(row?.label ?? '').trim(),
          items: Array.isArray(row?.items)
            ? row.items
              .map((item: any) => ({
                code: String(item?.code ?? '').trim(),
                qty: Math.max(1, Math.floor(Number(item?.qty) || 1))
              }))
              .filter((item: RolePresetItem) => item.code.length > 0)
            : []
        }))
        .filter((row: RolePreset) => row.label.length > 0 && row.items.length > 0)
        .map((row: RolePreset) => {
          const id = row.id.startsWith('custom-') ? row.id : `custom-${slugPresetName(row.label)}-${Date.now().toString().slice(-6)}`
          return { ...row, id }
        })
      if (imported.length === 0) {
        setError('No valid presets found in import file.')
        return
      }

      setCustomPresets((prev) => {
        const merged = [...prev]
        for (const preset of imported) {
          const idx = merged.findIndex((x) => x.id === preset.id)
          if (idx >= 0) merged[idx] = preset
          else merged.push(preset)
        }
        return merged
      })
      setResult(`Imported ${imported.length} custom presets.`)
      setError('')
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function ackLoss(id: string) {
    try {
      await acknowledgeItemLoss(id)
      await refreshPlayersAndItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function reimburseLossRow(row: {
    id: string
    timeUtc: string
    source: string
    reason: string
    removedCodes: string[]
    removedCount: number
    acknowledged?: boolean
    acknowledgedBy?: string
    acknowledgedUtc?: string
  }) {
    if (row.source !== 'item-catalog-sync') {
      setError('Reimbursement is locked to update-sync loss events only.')
      return
    }

    const player = selectedPlayerName()
    if (!player) {
      setError('Select a player first before reimbursing.')
      return
    }

    const qty = Math.max(1, Math.floor(itemQty || 1))
    const codes = row.removedCodes.filter((x) => !!x).slice(0, 100)
    if (codes.length === 0) {
      setError('This loss event has no item codes to reimburse.')
      return
    }

    const approved = confirm(`Reimburse ${codes.length} item codes to ${player} (qty ${qty} each)?`)
    if (!approved) return

    setBusy(true)
    setError('')
    setResult('')
    setLastBulkFailures([])
    let okCount = 0
    let failCount = 0
    const failures: BulkGrantFailure[] = []
    try {
      setBulkProgress({ label: 'Reimburse loss event', current: 0, total: codes.length, ok: 0, fail: 0 })
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i]
        try {
          setBulkProgress({ label: 'Reimburse loss event', current: i + 1, total: codes.length, ok: okCount, fail: failCount, currentCode: code })
          await sendAddItemCommand(player, code, qty)
          okCount++
          setBulkProgress({ label: 'Reimburse loss event', current: i + 1, total: codes.length, ok: okCount, fail: failCount, currentCode: code })
        } catch (err) {
          failCount++
          failures.push({ code, qty, error: err instanceof Error ? err.message : String(err) })
          setBulkProgress({ label: 'Reimburse loss event', current: i + 1, total: codes.length, ok: okCount, fail: failCount, currentCode: code })
        }
      }
      setLastBulkFailures(failures)
      setResult(`Reimbursement complete for ${player}: ${okCount} succeeded, ${failCount} failed.`)
      if (okCount > 0) {
        await acknowledgeItemLoss(row.id).catch(() => {})
        await refreshPlayersAndItems()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBulkProgress(null)
      setBusy(false)
    }
  }

  useEffect(() => {
    let mounted = true
    stoppedRef.current = false

    async function bootstrap() {
      setLoading(true)
      setError('')
      await refresh()
      await connectConsole()
      await refreshConsoleDiagnostics()
      await refreshPlayersAndItems()
      await refreshStreets()
      if (mounted) {
        setLoading(false)
      }
    }

    void bootstrap()
    const poll = window.setInterval(() => {
      void refresh()
    }, 1500)
    const playersPoll = window.setInterval(() => {
      void refreshPlayersOnly()
    }, 5000)
    pingRef.current = window.setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ event: 'send stats', args: [] }))
      }
    }, 2000)
    pollRef.current = window.setInterval(() => {
      if (consoleModeRef.current === 'polling') void pollConsoleOnce()
    }, 600)
    issuesRefreshRef.current = window.setInterval(() => {
      void refreshConsoleDiagnostics()
    }, 4000)

    return () => {
      mounted = false
      stoppedRef.current = true
      window.clearInterval(poll)
      window.clearInterval(playersPoll)
      if (pingRef.current) window.clearInterval(pingRef.current)
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
      if (pollRef.current) window.clearInterval(pollRef.current)
      if (issuesRefreshRef.current) window.clearInterval(issuesRefreshRef.current)
      socketRef.current?.close()
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ghrp-player-trace')
      if (!raw) return
      const parsed = JSON.parse(raw) as PlayerTracePoint[]
      if (Array.isArray(parsed)) setPlayerTrace(parsed)
    } catch {
      // ignore storage parse errors
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('ghrp-player-trace', JSON.stringify(playerTrace))
    } catch {
      // ignore storage write errors
    }
  }, [playerTrace])

  useEffect(() => {
    consoleModeRef.current = consoleMode
  }, [consoleMode])

  useEffect(() => {
    consoleCursorRef.current = consoleCursor
  }, [consoleCursor])

  useEffect(() => {
    positionsFeedSourceRef.current = positionsFeedSource
  }, [positionsFeedSource])

  useEffect(() => {
    const el = logsRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [consoleLines])

  const itemCategories = useMemo(() => {
    const categories = new Set<string>()
    for (const item of items) {
      const group = inferItemGroup(item)
      if (itemGroup === 'all' || group === itemGroup) {
        categories.add(normalizeCategory(item.category))
      }
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b))
  }, [items, itemGroup])

  useEffect(() => {
    if (itemCategory !== 'all' && !itemCategories.includes(itemCategory)) {
      setItemCategory('all')
    }
  }, [itemCategories, itemCategory])

  const itemTypes = useMemo(() => {
    const types = new Set<ItemType>()
    for (const item of items) {
      const group = inferItemGroup(item)
      const category = normalizeCategory(item.category)
      if ((itemGroup === 'all' || group === itemGroup) && (itemCategory === 'all' || category === itemCategory)) {
        types.add(inferItemType(item))
      }
    }
    return Array.from(types.values()).sort((a, b) => labelForType(a).localeCompare(labelForType(b)))
  }, [items, itemGroup, itemCategory])

  useEffect(() => {
    if (itemType !== 'all' && !itemTypes.includes(itemType)) {
      setItemType('all')
    }
  }, [itemTypes, itemType])

  const [gunHelperQuery, setGunHelperQuery] = useState('')
  const [gunHelperGunCode, setGunHelperGunCode] = useState('')

  const gunHelperCandidates = useMemo(() => {
    const q = gunHelperQuery.trim().toLowerCase()
    return items
      .filter(isGunLike)
      .filter((it) => {
        if (!q) return true
        const hay = `${effectiveItemName(it)} ${it.code} ${it.category ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => effectiveItemName(a).localeCompare(effectiveItemName(b)))
      .slice(0, 120)
  }, [items, gunHelperQuery])

  useEffect(() => {
    if (!gunHelperGunCode && gunHelperCandidates.length > 0) {
      setGunHelperGunCode(gunHelperCandidates[0].code)
      return
    }
    if (gunHelperGunCode && !gunHelperCandidates.some((x) => x.code === gunHelperGunCode)) {
      setGunHelperGunCode(gunHelperCandidates[0]?.code ?? '')
    }
  }, [gunHelperCandidates, gunHelperGunCode])

  const selectedGunForHelper = useMemo(
    () => items.find((x) => x.code === gunHelperGunCode) ?? null,
    [items, gunHelperGunCode]
  )
  const currentGunLoadout = useMemo(
    () => (selectedGunForHelper ? (gunLoadouts.find((x) => x.gunCode === selectedGunForHelper.code) ?? null) : null),
    [gunLoadouts, selectedGunForHelper]
  )

  const gunHelperAmmoAndMags = useMemo(() => {
    if (!selectedGunForHelper) return []
    return relatedAmmoAndMagsForGun(selectedGunForHelper, items)
      .sort((a, b) => effectiveItemName(a).localeCompare(effectiveItemName(b)))
      .slice(0, 120)
  }, [selectedGunForHelper, items])

  const gunHelperAttachments = useMemo(() => {
    if (!selectedGunForHelper) return []
    const gun = selectedGunForHelper
    const tokens = inferGunTokens(gun)
    const scored = relatedAttachmentsForGun(gun, items)
      .map((a) => {
        const t = `${a.code} ${a.name ?? ''} ${a.category ?? ''}`.toLowerCase()
        const tokenHits = tokens.filter((tok) => t.includes(tok)).length
        const genericHits = ['scope', 'sight', 'laser', 'suppressor', 'silencer', 'muzzle', 'grip', 'sling', 'strap', 'rail', 'mount']
          .filter((k) => t.includes(k)).length
        const score = tokenHits * 10 + Math.min(3, genericHits)
        const tag = tokenHits > 0 ? 'Specific' : (genericHits > 0 ? 'Generic' : 'Other')
        return { a, score, tag }
      })
      .sort((x, y) => (y.score - x.score) || effectiveItemName(x.a).localeCompare(effectiveItemName(y.a)))
      .slice(0, 160)
    return scored.map((x) => ({ ...x.a, _matchTag: x.tag } as CatalogItem & { _matchTag?: string }))
  }, [selectedGunForHelper, items])

  const gunHelperDefaults = useMemo(() => {
    if (!selectedGunForHelper) return { ammo: null as CatalogItem | null, magazine: null as CatalogItem | null }
    return pickDefaultAmmoAndMagForGun(selectedGunForHelper, items)
  }, [selectedGunForHelper, items])

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase()
    return items
      .filter((x) => {
        if (unavailableItemCodes.has(x.code)) return false
        const group = inferItemGroup(x)
        const matchesGroup = itemGroup === 'all' || group === itemGroup
        const category = normalizeCategory(x.category)
        const matchesCategory = itemCategory === 'all' || category === itemCategory
        const type = inferItemType(x)
        const matchesType = itemType === 'all' || type === itemType
        const matchesText = !q
          || x.code.toLowerCase().includes(q)
          || effectiveItemName(x).toLowerCase().includes(q)
          || String(x.category ?? '').toLowerCase().includes(q)
        return matchesGroup && matchesCategory && matchesType && matchesText
      })
      .sort((a, b) => effectiveItemName(a).localeCompare(effectiveItemName(b)))
  }, [items, itemGroup, itemCategory, itemType, itemQuery, unavailableItemCodes])

  const visibleItemLimit = Math.min(2000, Math.max(50, Math.floor(itemResultLimit || 250)))
  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleItemLimit),
    [filteredItems, visibleItemLimit]
  )

  const groupedFilteredItems = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>()
    for (const item of visibleItems) {
      const category = normalizeCategory(item.category)
      if (!groups.has(category)) groups.set(category, [])
      groups.get(category)!.push(item)
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, entries]) => ({
        category,
        entries: entries.sort((a, b) => effectiveItemName(a).localeCompare(effectiveItemName(b)))
      }))
  }, [visibleItems])

  const playersWithCoords = useMemo(
    () => playerPositions.filter((player) => player.x != null && player.y != null),
    [playerPositions]
  )

  const filteredStreets = useMemo(() => {
    const q = streetQuery.trim().toLowerCase()
    if (!q) return streets.slice(0, 120)
    return streets.filter((street) => street.name.toLowerCase().includes(q)).slice(0, 120)
  }, [streets, streetQuery])

  const tracePlayers = useMemo(
    () => Array.from(new Set(playerTrace.map(point => point.name))).sort((a, b) => a.localeCompare(b)),
    [playerTrace]
  )

  const filteredTrace = useMemo(() => {
    const cutoff = Date.now() - traceWindowHours * 60 * 60 * 1000
    return playerTrace
      .filter(point => (!tracePlayerName || point.name === tracePlayerName) && new Date(point.timeUtc).getTime() >= cutoff)
      .sort((a, b) => new Date(a.timeUtc).getTime() - new Date(b.timeUtc).getTime())
  }, [playerTrace, tracePlayerName, traceWindowHours])

  function focusMapOn(x?: number, y?: number) {
    // Coordinate-based focus currently works only on b42map.
    if (mapSource !== 'b42map') setMapSource('b42map')
    setMapUrl(buildMapUrl('b42map', x, y))
  }

  function openMapInNewTab() {
    window.open(mapUrl, '_blank', 'noopener,noreferrer')
  }

  function fallbackMapSource() {
    const nextIndex = (mapFallbackIndex + 1) % MAP_SOURCES.length
    const nextSource = MAP_SOURCES[nextIndex].id
    setMapFallbackIndex(nextIndex)
    setMapSource(nextSource)
    setMapUrl(buildMapUrl(nextSource))
  }

  async function refreshStreets() {
    setStreetLoading(true)
    setStreetError('')
    try {
      const res = await getGameMapStreets()
      setStreets(res.streets ?? [])
    } catch (err) {
      setStreetError(err instanceof Error ? err.message : String(err))
      setStreets([])
    } finally {
      setStreetLoading(false)
    }
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ghrp-invalid-item-codes')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      setInvalidItemCodes(parsed.map((v) => String(v ?? '').trim()).filter(Boolean))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('ghrp-invalid-item-codes', JSON.stringify(invalidItemCodes))
    } catch {
      // ignore
    }
  }, [invalidItemCodes])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ghrp-pinned-presets')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      setPinnedPresetIds(parsed.map((v) => String(v ?? '').trim()).filter(Boolean))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('ghrp-pinned-presets', JSON.stringify(pinnedPresetIds))
    } catch {
      // ignore
    }
  }, [pinnedPresetIds])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ghrp-recent-presets')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      setRecentPresetIds(parsed.map((v) => String(v ?? '').trim()).filter(Boolean).slice(0, 10))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('ghrp-recent-presets', JSON.stringify(recentPresetIds.slice(0, 10)))
    } catch {
      // ignore
    }
  }, [recentPresetIds])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ghrp-loadout-draft-stash')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return
      const label = String(parsed?.label ?? '').trim()
      const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : []
      const loaded = itemsRaw
        .map((item: any) => ({
          code: String(item?.code ?? '').trim(),
          qty: Math.max(1, Math.floor(Number(item?.qty) || 1)),
          enabled: item?.enabled !== false
        }))
        .filter((item: DraftRolePresetItem) => item.code.length > 0)
      if (loaded.length > 0) {
        setStoredDraftItems(loaded)
        setStoredDraftLabel(label || 'Stored Draft')
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      if (storedDraftItems.length === 0) {
        window.localStorage.removeItem('ghrp-loadout-draft-stash')
        return
      }
      window.localStorage.setItem('ghrp-loadout-draft-stash', JSON.stringify({
        label: storedDraftLabel,
        items: storedDraftItems
      }))
    } catch {
      // ignore
    }
  }, [storedDraftItems, storedDraftLabel])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('ghrp-custom-presets')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const loaded = parsed
        .map((row) => ({
          id: String(row?.id ?? '').trim(),
          label: String(row?.label ?? '').trim(),
          items: Array.isArray(row?.items)
            ? row.items
              .map((item: any) => ({
                code: String(item?.code ?? '').trim(),
                qty: Math.max(1, Math.floor(Number(item?.qty) || 1))
              }))
              .filter((item: RolePresetItem) => item.code.length > 0)
            : []
        }))
        .filter((row) => row.id.startsWith('custom-') && row.label.length > 0 && row.items.length > 0)
      setCustomPresets(loaded)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('ghrp-custom-presets', JSON.stringify(customPresets))
    } catch {
      // ignore
    }
  }, [customPresets])

  useEffect(() => {
    if (!itemCode && visibleItems.length > 0) {
      setItemCode(visibleItems[0].code)
      return
    }
    if (itemCode && !visibleItems.some((item) => item.code === itemCode)) {
      setItemCode(visibleItems[0]?.code ?? '')
    }
  }, [visibleItems, itemCode])

  useEffect(() => {
    if (filteredPresetIds.size === 0) return
    if (filteredPresetIds.has(rolePresetId)) return
    const next = filteredRolePresetGroups[0]?.presets[0]?.id
    if (next) setRolePresetId(next)
  }, [filteredPresetIds, filteredRolePresetGroups, rolePresetId])

  useEffect(() => {
    const preset = allRolePresets.find((x) => x.id === rolePresetId)
    if (!preset) {
      setPresetDraftItems([])
      return
    }
    setPresetDraftItems(preset.items.map((item) => ({ code: item.code, qty: item.qty, enabled: true })))
  }, [allRolePresets, rolePresetId])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="admin-eyebrow">Operations</div>
          <h1>{mode === 'loadouts' ? 'Loadouts' : 'Server Control'}</h1>
          <p className="admin-sub">
            {mode === 'loadouts'
              ? 'Dedicated loadout manager: presets, bundles, custom edits, and controlled item grants.'
              : 'Live control and telemetry for the Pterodactyl-hosted Project Zomboid server.'}
          </p>
        </div>
        <div className="admin-actions">
          <button className="admin-btn" disabled={loading || busy} onClick={() => void refresh()}>Refresh</button>
        </div>
      </div>

      {mode === 'full' && (
      <div className="admin-grid four">
        <div className="admin-card">
          <div className="admin-card-title">Status</div>
          <div className={`admin-status ${statusTone}`} style={{ marginTop: 8 }}>
            <span className="admin-status-dot" />
            {statusLabel}
          </div>
          <div className="admin-card-sub">Server: {serverName}</div>
          <div className="admin-card-sub">Node: {nodeName}</div>
          <div className="admin-card-sub">Allocation: {allocation}</div>
          <div className="admin-card-sub">Updated: {lastRefresh || 'n/a'}</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">CPU</div>
          <div className="admin-card-value">{cpu != null ? `${cpu.toFixed(2)}%` : 'n/a'}</div>
          <div className="admin-card-sub">Real-time from Pterodactyl resources API.</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">Memory</div>
          <div className="admin-card-value">{fmtBytes(memoryBytes)}</div>
          <div className="admin-card-sub">Disk: {fmtBytes(diskBytes)}</div>
          <div className="admin-card-sub">Uptime: {fmtUptime(uptimeMs)}</div>
        </div>

        <div className="admin-card">
          <div className="admin-card-title">Power</div>
          <label className="admin-field" style={{ marginTop: 10 }}>
            <span>Power action</span>
            <select className="admin-select" value={powerAction} onChange={(e) => setPowerAction(e.currentTarget.value as ServerControlPowerSignal)}>
              <option value="restart">Restart (Recommended)</option>
              <option value="start">Start</option>
              <option value="stop">Stop</option>
              <option value="kill">Emergency Kill</option>
            </select>
          </label>
          <button className="admin-btn" disabled={busy} onClick={() => void runPower(powerAction)}>Run Power Action</button>
        </div>
      </div>
      )}

      {mode === 'full' && (
      <div className="admin-card" style={{ marginTop: 14 }}>
        <div className="admin-card-title">Beginner Debug Assistant</div>
        <div className="admin-card-sub">Use these buttons in order if you do not know what to do.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button className="admin-btn" disabled={busy} onClick={() => void runQuickAction('refresh')}>Refresh Health</button>
          <button className="admin-btn" disabled={busy} onClick={() => void runQuickAction('sync_mods')}>Sync Status + Mods</button>
          <button className="admin-btn" disabled={busy} onClick={() => void runQuickAction('sync_items')}>Sync Item Catalog</button>
          <button className="admin-btn" disabled={busy} onClick={() => void runQuickAction('safe_fix')}>Run Safe Auto-Fix</button>
          <button className="admin-btn" disabled={busy} onClick={() => void runQuickAction('check_mods_update')}>Check Mods Need Update</button>
          <button className="admin-btn" disabled={busy} onClick={() => void runQuickAction('panel_restart')}>Panel Restart</button>
        </div>
        {assistantStatus && (
          <div className="admin-notice" style={{ marginTop: 10 }}>
            {assistantStatus}
          </div>
        )}
        <label className="admin-field" style={{ marginTop: 12 }}>
          <span>What problem are you seeing?</span>
          <select className="admin-select" value={debugScenario} onChange={e => setDebugScenario(e.currentTarget.value as DebugScenarioKey)}>
            {(Object.keys(DEBUG_SCENARIOS) as DebugScenarioKey[]).map((key) => (
              <option key={key} value={key}>{DEBUG_SCENARIOS[key].title}</option>
            ))}
          </select>
        </label>
        <ol style={{ margin: '6px 0 0 18px' }}>
          {DEBUG_SCENARIOS[debugScenario].steps.map((step, idx) => (
            <li key={`scenario-step-${idx}`}>{step}</li>
          ))}
        </ol>
      </div>
      )}

      {mode === 'full' && (
      <div className="admin-card" style={{ marginTop: 14 }}>
        <div className="admin-card-title">Auto Issue Detector</div>
        <div className="admin-card-sub">
          Reads recent console logs and explains what to do step-by-step.
          {issuesGeneratedAt ? ` Last scan: ${new Date(issuesGeneratedAt).toLocaleTimeString()} (${issuesScannedLines} lines)` : ''}
        </div>
        {consoleIssues.length === 0 ? (
          <div className="admin-notice success" style={{ marginTop: 10 }}>
            No startup blockers detected right now.
          </div>
        ) : (
          <div className="admin-list" style={{ marginTop: 10 }}>
            {consoleIssues.map((issue) => (
              <div key={issue.id} className="admin-list-item">
                <div>
                  <div className="admin-list-title">
                    {issue.severity === 'error' ? 'Critical' : issue.severity === 'warn' ? 'Warning' : 'Info'}: {issue.title}
                  </div>
                  <div className="admin-list-sub">{issue.meaning}</div>
                  {issue.evidence && <div className="admin-list-sub">Evidence: {issue.evidence}</div>}
                  {issue.recommendedAction && <div className="admin-list-sub">Recommended action: {issue.recommendedAction}</div>}
                  <div className="admin-list-sub" style={{ marginTop: 8 }}>
                    Fix steps:
                  </div>
                  <ol style={{ margin: '6px 0 0 18px' }}>
                    {issue.fixSteps.map((step, idx) => (
                      <li key={`${issue.id}-step-${idx}`}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div className="admin-list-actions">
                  {issue.recommendedCommands.slice(0, 2).map((cmd) => (
                    <button key={`${issue.id}-${cmd}`} className="admin-btn" disabled={busy} onClick={() => void runIssueCommand(cmd)}>
                      Run: {cmd}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {mode === 'full' && (
      <div className="admin-card server-console-card">
        <div className="admin-card-header">
          <div className="admin-card-title">Console</div>
          <div className="admin-card-sub">
            Live stream with auto-scroll and timestamped lines ({consoleMode === 'websocket' ? 'WebSocket' : 'Polling Fallback'})
          </div>
        </div>

        <div className="server-console-log" ref={logsRef}>
          {consoleLines.length === 0 && <div className="server-console-line">[{nowTs()}] Waiting for console output...</div>}
          {consoleLines.map((line, idx) => (
            <div key={`${line.ts}-${idx}`} className={`server-console-line ${line.tone ?? 'normal'}`}>
              <span className="server-console-ts">[{line.ts}]</span> {line.text}
            </div>
          ))}
        </div>

        <div className="server-console-input-row">
          <select className="admin-select" value={commandPreset} onChange={(e) => setCommandPreset(e.currentTarget.value)}>
            <option value="save">Save World (Recommended)</option>
            <option value="players">Players List</option>
            <option value="help">Help</option>
            <option value="checkModsNeedUpdate">Check Mods Need Update</option>
            <option value="servermsg &quot;Server restart in 5 minutes.&quot;">Broadcast: Restart in 5 min</option>
            <option value="servermsg &quot;Server maintenance complete. Rejoin now.&quot;">Broadcast: Maintenance Complete</option>
            <option value="alarm">Trigger Alarm</option>
            <option value="clear">Clear Local Weather Effects</option>
            <option value="quit">Shutdown Server (Graceful)</option>
            <option value="__custom">Custom Command</option>
          </select>
          {commandPreset === '__custom' && (
            <input
              className="admin-input"
              value={command}
              onChange={e => setCommand(e.currentTarget.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !busy) {
                  e.preventDefault()
                  void runCommand()
                }
              }}
              placeholder="Type a console command"
            />
          )}
          <button
            className="admin-btn"
            disabled={busy || (commandPreset === '__custom' && !command.trim())}
            onClick={() => void runCommand()}
          >
            Send
          </button>
        </div>
      </div>
      )}

      {mode === 'full' && (
      <div className="admin-card" style={{ marginTop: 14 }}>
        <div className="admin-card-title">Live World Map (Build 42)</div>
        <div className="admin-card-sub">
          Full B42 map with live player coordinate focus.
          {playerPositionsUpdatedAt ? ` Player feed updated: ${playerPositionsUpdatedAt}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <label className="admin-field" style={{ margin: 0, minWidth: 260 }}>
            <span>Map Source</span>
            <select
              className="admin-select"
              value={mapSource}
              onChange={e => {
                const next = e.currentTarget.value as MapSourceId
                setMapSource(next)
                setMapUrl(buildMapUrl(next))
              }}
            >
              {MAP_SOURCES.map(source => (
                <option key={source.id} value={source.id}>{source.label}</option>
              ))}
            </select>
          </label>
          <label className="admin-field" style={{ margin: 0, minWidth: 220 }}>
            <span>Position Feed</span>
            <select
              className="admin-select"
              value={positionsFeedSource}
              onChange={e => {
                const next = e.currentTarget.value as PositionFeedSourceId
                setPositionsFeedSource(next)
                positionsFeedSourceRef.current = next
                void refreshPlayersOnly()
              }}
            >
              <option value="live">Live Feed</option>
              <option value="test">Test Feed</option>
            </select>
          </label>
          <button className="admin-btn" onClick={() => setMapUrl(buildMapUrl(mapSource))}>
            Reset Map View
          </button>
          <button className="admin-btn" onClick={() => void refreshPlayersOnly()}>
            Refresh Player Positions
          </button>
          <button className="admin-btn" onClick={() => void refreshStreets()}>
            Refresh Streets
          </button>
          <button className="admin-btn" onClick={openMapInNewTab}>
            Open in New Tab
          </button>
          <button className="admin-btn" onClick={fallbackMapSource}>
            Try Fallback Source
          </button>
          <label className="admin-field checkbox" style={{ margin: 0 }}>
            <input type="checkbox" checked={mapFollowLive} onChange={e => setMapFollowLive(e.currentTarget.checked)} />
            <span>Follow first player with coordinates</span>
          </label>
        </div>
        <div className="admin-card" style={{ marginTop: 12 }}>
          <div className="admin-card-title">Map Diagnostics</div>
          <div className="admin-card-sub">Feed command: {playerFeedCommand}</div>
          <div className="admin-card-sub">Coordinate source: {playerFeedSource}</div>
          <div className="admin-card-sub">Coordinates available: {playerFeedHasCoords ? 'Yes' : 'No'}</div>
          <div className="admin-card-sub">Players online entries: {playerPositions.length}</div>
          {!playerFeedHasCoords && (
            <div className="admin-notice warn" style={{ marginTop: 8 }}>
              Coordinate data is missing from current player feed. The map can only place players when x/y are present.
            </div>
          )}
          {!playerFeedHasCoords && playerFeedResponseSnippet && (
            <div className="admin-card-sub">Sample feed: {playerFeedResponseSnippet}</div>
          )}
          {playerFeedAttempts.length > 0 && (
            <div className="admin-list" style={{ marginTop: 8 }}>
              {playerFeedAttempts.map((row, idx) => (
                <div key={`feed-attempt-${row.command}-${idx}`} className="admin-list-item">
                  <div>
                    <div className="admin-list-title">{row.command}</div>
                    <div className="admin-list-sub">ok: {row.ok ? 'yes' : 'no'} • players: {row.players} • coords: {row.hasCoordinates ? 'yes' : 'no'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-grid two" style={{ marginTop: 12 }}>
          <div className="admin-card" style={{ padding: 10 }}>
            <iframe
              title="Project Zomboid Build 42 Map"
              src={mapUrl}
              style={{ width: '100%', height: 560, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, background: '#050609' }}
              loading="lazy"
              onError={fallbackMapSource}
            />
          </div>

          <div className="admin-card">
            <div className="admin-card-title">Players on Map</div>
            <div className="admin-card-sub">
              {playersWithCoords.length} with coordinates • {playerPositions.length} total online entries
            </div>
            <div className="admin-list" style={{ marginTop: 10, maxHeight: 540, overflowY: 'auto' }}>
              {playerPositions.length === 0 && (
                <div className="admin-list-item">
                  <div>
                    <div className="admin-list-title">No players in current feed</div>
                    <div className="admin-list-sub">Use Refresh Player Positions. If players are online but still missing, check server player command output format.</div>
                  </div>
                </div>
              )}
              {playerPositions.map((player, idx) => (
                <div key={`${player.name}-${idx}`} className="admin-list-item">
                  <div>
                    <div className="admin-list-title">{player.name}</div>
                    <div className="admin-list-sub">
                      {player.x != null && player.y != null ? (
                        <>
                          X {Math.round(player.x)} • Y {Math.round(player.y)}
                          {player.z != null ? ` • Z ${Math.round(player.z)}` : ''}
                        </>
                      ) : (
                        'Coordinates unavailable in current player feed'
                      )}
                    </div>
                  </div>
                  <div className="admin-list-actions">
                    <button className="admin-btn" disabled={player.x == null || player.y == null} onClick={() => focusMapOn(player.x, player.y)}>
                      Focus on Map
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hr" />
            <div className="admin-card-title">Street Names</div>
            <div className="admin-card-sub">Search streets and jump map focus to the selected road center.</div>
            <label className="admin-field" style={{ marginTop: 8 }}>
              <span>Search street</span>
              <input
                className="admin-input"
                value={streetQuery}
                onChange={e => setStreetQuery(e.currentTarget.value)}
                placeholder="Example: Oak, Main, Riverside…"
              />
            </label>
            {streetError && <div className="admin-notice warn">{streetError}</div>}
            <div className="admin-list" style={{ marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
              {streetLoading && (
                <div className="admin-list-item">
                  <div className="admin-list-title">Loading street names…</div>
                </div>
              )}
              {!streetLoading && filteredStreets.length === 0 && (
                <div className="admin-list-item">
                  <div className="admin-list-title">No streets match</div>
                </div>
              )}
              {!streetLoading && filteredStreets.map((street) => (
                <div key={`${street.name}-${street.x}-${street.y}`} className="admin-list-item">
                  <div>
                    <div className="admin-list-title">{street.name}</div>
                    <div className="admin-list-sub">X {Math.round(street.x)} • Y {Math.round(street.y)}</div>
                  </div>
                  <div className="admin-list-actions">
                    <button className="admin-btn" onClick={() => focusMapOn(street.x, street.y)}>
                      Focus Street
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hr" />
            <div className="admin-card-title">Player Movement Trace</div>
            <div className="admin-card-sub">Track where a player has been over time. Default window: 36 hours.</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              <label className="admin-field checkbox" style={{ margin: 0 }}>
                <input type="checkbox" checked={traceEnabled} onChange={e => setTraceEnabled(e.currentTarget.checked)} />
                <span>Enable trace capture</span>
              </label>
              <label className="admin-field" style={{ margin: 0, minWidth: 220 }}>
                <span>Player</span>
                <select className="admin-select" value={tracePlayerName} onChange={e => setTracePlayerName(e.currentTarget.value)}>
                  <option value="">All tracked players</option>
                  {tracePlayers.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field" style={{ margin: 0, minWidth: 160 }}>
                <span>Window</span>
                <select className="admin-select" value={traceWindowHours} onChange={e => setTraceWindowHours(Number(e.currentTarget.value) || 36)}>
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={36}>36 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                </select>
              </label>
              <button className="admin-btn" onClick={() => setPlayerTrace([])}>
                Clear Trace
              </button>
            </div>
            <div className="admin-card-sub" style={{ marginTop: 8 }}>
              Points in window: {filteredTrace.length}
            </div>
            <div className="admin-list" style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
              {filteredTrace.length === 0 && (
                <div className="admin-list-item">
                  <div>
                    <div className="admin-list-title">No trace points yet</div>
                    <div className="admin-list-sub">Keep trace enabled while players move; points will accumulate automatically.</div>
                  </div>
                </div>
              )}
              {filteredTrace.slice(-300).map((point, idx) => (
                <div key={`${point.name}-${point.timeUtc}-${idx}`} className="admin-list-item">
                  <div>
                    <div className="admin-list-title">{point.name}</div>
                    <div className="admin-list-sub">
                      {new Date(point.timeUtc).toLocaleString()} • X {Math.round(point.x)} • Y {Math.round(point.y)}
                      {point.z != null ? ` • Z ${Math.round(point.z)}` : ''}
                    </div>
                  </div>
                  <div className="admin-list-actions">
                    <button className="admin-btn" onClick={() => focusMapOn(point.x, point.y)}>
                      View Point
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {mode === 'loadouts' && (
      <>
        {bulkProgress && (
          <div className="admin-notice" style={{ marginTop: 14 }}>
            {bulkProgress.label}: {bulkProgress.current}/{bulkProgress.total} • ok {bulkProgress.ok} • fail {bulkProgress.fail}
            {bulkProgress.currentCode ? ` • ${bulkProgress.currentCode}` : ''}
          </div>
        )}

      {lastBulkFailures.length > 0 && (
          <div className="admin-card" style={{ marginTop: 14 }}>
            <div className="admin-card-title">Bulk Failures</div>
            <div className="admin-card-sub">{lastBulkFailures.length} items failed in the last bulk operation.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button className="admin-btn" type="button" disabled={busy} onClick={() => void retryLastBulkFailures()}>
                Retry Failed Only
              </button>
              <button className="admin-btn" type="button" disabled={busy} onClick={() => void copyBulkFailures()}>
                Copy Failed Codes
              </button>
              <button
                className="admin-btn"
                type="button"
                disabled={busy || !selectedPlayerValue}
                onClick={() => {
                  const player = selectedPlayerValue
                  const lines = lastBulkFailures.map((x) => `additem \"${sanitizeConsoleArg(player)}\" \"${sanitizeConsoleArg(x.code)}\" ${x.qty}`)
                  void safeCopy(lines.join('\n')).then(() => setResult(`Copied ${lines.length} additem commands for ${player}.`))
                }}
              >
                Copy additem Commands
              </button>
              <button
                className="admin-btn"
                type="button"
                disabled={busy}
                onClick={() => {
                  for (const row of lastBulkFailures) safeAddToDraft(row.code, row.qty)
                  setResult(`Added ${lastBulkFailures.length} failed items to draft.`)
                }}
              >
                Add Failures To Draft
              </button>
              <button
                className="admin-btn"
                type="button"
                disabled={busy}
                onClick={() => {
                  const failed = new Set(lastBulkFailures.map((x) => x.code))
                  setPresetDraftItems((prev) => prev.filter((x) => !failed.has(x.code)))
                  setResult(`Removed failed item codes from draft.`)
                }}
              >
                Remove Failures From Draft
              </button>
              <button className="admin-btn" type="button" disabled={busy} onClick={() => setLastBulkFailures([])}>
                Clear
              </button>
            </div>
            <div className="admin-list" style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto' }}>
              {lastBulkFailures.slice(0, 200).map((row) => (
                <div key={`${row.code}-${row.qty}`} className="admin-list-item">
                  <div>
                    <div className="admin-list-title">{row.code} x{row.qty}</div>
                    <div className="admin-list-sub">{String(row.error ?? '').slice(0, 260)}</div>
                  </div>
                  <div className="admin-list-actions">
                    <button className="admin-btn" type="button" onClick={() => setItemCode(row.code)}>
                      Use Code
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="admin-card loadouts-flow-card" style={{ marginTop: 14 }}>
          <div className="admin-card-title">Grant Flow</div>
          <div className="admin-grid three loadouts-flow-grid" style={{ marginTop: 10 }}>
            <div className="admin-list-item loadouts-step">
              <div>
                <div className="admin-list-title">1. Select Player</div>
                <div className="admin-list-sub">{selectedPlayerValue ? selectedPlayerValue : 'Player not selected'}</div>
              </div>
              <div className={`admin-status ${selectedPlayerValue ? 'good' : 'warn'}`}>{selectedPlayerValue ? 'READY' : 'PENDING'}</div>
            </div>
            <div className="admin-list-item loadouts-step">
              <div>
                <div className="admin-list-title">2. Select Preset</div>
                <div className="admin-list-sub">{selectedRolePreset?.label ?? 'Preset not selected'}</div>
              </div>
              <div className={`admin-status ${selectedRolePreset ? 'good' : 'warn'}`}>{selectedRolePreset ? 'READY' : 'PENDING'}</div>
            </div>
            <div className="admin-list-item loadouts-step">
              <div>
                <div className="admin-list-title">3. Grant</div>
                <div className="admin-list-sub">{draftTotals.selectedUnique}/{draftTotals.unique} items selected • scaled {draftTotals.scaledQty}</div>
              </div>
              <button className="admin-btn" disabled={busy || !selectedPlayerValue || !selectedRolePreset} onClick={() => void grantRolePresetToPlayer()}>
                Grant Preset
              </button>
            </div>
          </div>
        </div>
        <div className="admin-grid two loadouts-main-grid" style={{ marginTop: 14 }}>
          <div className="admin-card">
            <div className="admin-card-title">Give Items Fast</div>
            <div className="admin-card-sub">For update reimbursements. Uses server console additem command.</div>
            <div className="loadouts-block" style={{ marginTop: 10 }}>
              <label className="admin-field">
                <span>Player</span>
                <select className="admin-select" value={selectedPlayer || '__manual'} onChange={e => setSelectedPlayer(e.currentTarget.value)}>
                  {players.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="__manual">Manual Player Name</option>
                </select>
              </label>
              {selectedPlayer === '__manual' && (
                <label className="admin-field">
                  <span>Manual player name</span>
                  <input className="admin-input" value={manualPlayer} onChange={e => setManualPlayer(e.currentTarget.value)} placeholder="Exact username" />
                </label>
              )}
            </div>
            <div className="loadouts-block">
              <label className="admin-field" style={{ marginTop: 2 }}>
                <span>Give mode</span>
                <select className="admin-select" value={giveMode} onChange={(e) => setGiveMode(e.currentTarget.value as GiveMode)}>
                  <option value="presets">Presets Mode</option>
                  <option value="manual">Manual Item Mode</option>
                </select>
              </label>
              <div className="admin-grid two" style={{ marginTop: 8 }}>
                <button className="admin-btn" type="button" onClick={() => setGiveMode('presets')} disabled={giveMode === 'presets'}>
                  Presets Mode
                </button>
                <button className="admin-btn" type="button" onClick={() => setGiveMode('manual')} disabled={giveMode === 'manual'}>
                  Manual Item Mode
                </button>
              </div>
            </div>
            {giveMode === 'manual' && (
              <div className="loadouts-block">
                <details className="admin-section" open>
                  <summary className="admin-section-header">
                    <h2>Gun Helper (Ammo, Magazines, Attachments)</h2>
                  </summary>
                  <div className="admin-card-sub" style={{ marginTop: 6 }}>
                    Type a gun name, pick the gun, then click ammo/mags/attachments to set the item code or add to draft.
                  </div>
                  <label className="admin-field checkbox" style={{ marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={includeInactiveItems}
                      onChange={(e) => setIncludeInactiveItems(e.currentTarget.checked)}
                    />
                    <span>Include inactive-mod items (debug)</span>
                  </label>
                  <div className="admin-grid two" style={{ marginTop: 10 }}>
                    <label className="admin-field">
                      <span>Gun search</span>
                      <input
                        className="admin-input"
                        value={gunHelperQuery}
                        onChange={(e) => setGunHelperQuery(e.currentTarget.value)}
                        placeholder="Example: M16, shotgun, revolver, hunting rifle..."
                      />
                    </label>
                    <label className="admin-field">
                      <span>Gun</span>
                      <select className="admin-select" value={gunHelperGunCode} onChange={(e) => setGunHelperGunCode(e.currentTarget.value)}>
                        {gunHelperCandidates.map((gun) => (
                          <option key={gun.code} value={gun.code}>
                            {effectiveItemName(gun)} ({gun.code}){isItemFromInactiveMod(gun.code) ? ' [INACTIVE MOD]' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {selectedGunForHelper && (
                    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                      <div className="admin-card">
                        <div className="admin-card-title">Saved Loadout Recipes</div>
                        <div className="admin-card-sub">
                          {gunLoadoutsUpdatedUtc ? `Updated ${new Date(gunLoadoutsUpdatedUtc).toLocaleString()}` : 'Not yet saved'} • {gunLoadouts.length} recipes
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          <button className="admin-btn" type="button" disabled={busy} onClick={() => void upsertGunLoadoutFromCurrentSelection()}>
                            Save Recipe From Current Gun
                          </button>
                        </div>
                        {currentGunLoadout ? (
                          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                            <div className="admin-grid two">
                              <label className="admin-field">
                                <span>Recipe label</span>
                                <input
                                  className="admin-input"
                                  defaultValue={currentGunLoadout.label}
                                  onBlur={(e) => void renameCurrentGunLoadout(e.currentTarget.value)}
                                />
                              </label>
                              <div className="admin-field">
                                <span>Actions</span>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <button className="admin-btn" type="button" onClick={() => addGunLoadoutToDraft(currentGunLoadout)}>Add To Draft</button>
                                  <button className="admin-btn" type="button" onClick={() => void safeCopy(JSON.stringify(currentGunLoadout, null, 2))}>Copy JSON</button>
                                  <button className="admin-btn" type="button" onClick={() => void deleteCurrentGunLoadout()}>Delete</button>
                                </div>
                              </div>
                            </div>

                            <div className="admin-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
                              {(currentGunLoadout.items ?? []).map((it) => (
                                <div key={`${currentGunLoadout.id}:${it.code}`} className="admin-list-item">
                                  <div>
                                    <div className="admin-list-title">{it.code} x{it.qty}</div>
                                    <div className="admin-list-sub">{it.kind ? `kind: ${it.kind}` : 'kind: (none)'}</div>
                                  </div>
                                  <div className="admin-list-actions">
                                    <button className="admin-btn" type="button" onClick={() => setItemCode(it.code)}>Use</button>
                                    <button className="admin-btn" type="button" onClick={() => safeAddToDraft(it.code, it.qty)}>Add</button>
                                    <button className="admin-btn" type="button" onClick={() => void removeItemFromCurrentGunLoadout(it.code)}>Remove</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="admin-notice" style={{ marginTop: 10 }}>
                            No saved recipe for this gun yet. Click "Save Recipe From Current Gun".
                          </div>
                        )}
                      </div>

                      <div className="admin-list">
                        <div className="admin-list-item">
                          <div>
                            <div className="admin-list-title">{effectiveItemName(selectedGunForHelper)}</div>
                            <div className="admin-list-sub">{selectedGunForHelper.code}{selectedGunForHelper.category ? ` • ${selectedGunForHelper.category}` : ''}</div>
                          </div>
                          <div className="admin-list-actions">
                            <button className="admin-btn" type="button" onClick={() => setItemCode(selectedGunForHelper.code)}>
                              Use Gun
                            </button>
                            <button className="admin-btn" type="button" onClick={() => safeAddToDraft(selectedGunForHelper.code, 1)}>
                              Add To Draft
                            </button>
                            {gunHelperDefaults.magazine && gunHelperDefaults.ammo && (
                              <button
                                className="admin-btn"
                                type="button"
                                onClick={() => {
                                  safeAddToDraft(selectedGunForHelper.code, 1)
                                  safeAddToDraft(gunHelperDefaults.magazine!.code, 4)
                                  safeAddToDraft(gunHelperDefaults.ammo!.code, 120)
                                  setResult(`Draft: ${selectedGunForHelper.code} + 4 mags + 120 ammo`)
                                }}
                              >
                                Add Gun + 4 Mags + 120 Ammo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="admin-card">
                        <div className="admin-card-title">Ammo & Magazines</div>
                        <div className="admin-card-sub">{gunHelperAmmoAndMags.length} matches</div>
                        {gunHelperAmmoAndMags.length === 0 ? (
                          <div className="admin-notice warn" style={{ marginTop: 10 }}>
                            No ammo/mag matches found for this gun in the current item catalog.
                          </div>
                        ) : (
                          <div className="admin-list" style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto' }}>
                            {gunHelperAmmoAndMags.map((it) => {
                              const hint = ammoOrMagazineHint(it)
                              return (
                                <div key={it.code} className="admin-list-item">
                                  <div>
                                    <div className="admin-list-title">{effectiveItemName(it)}</div>
                                    <div className="admin-list-sub">
                                      {it.code}{hint ? ` • ${hint}` : ''}{it.category ? ` • ${it.category}` : ''}
                                    </div>
                                  </div>
                                  <div className="admin-list-actions">
                                    <button className="admin-btn" type="button" onClick={() => setItemCode(it.code)}>Use</button>
                                    <button className="admin-btn" type="button" onClick={() => safeAddToDraft(it.code, 1)}>Add</button>
                                    {currentGunLoadout && (
                                      <button
                                        className="admin-btn"
                                        type="button"
                                        onClick={() => {
                                          const txt = `${it.code} ${it.name ?? ''}`
                                          const kind = /magazine|clip/i.test(txt) ? 'mag' : 'ammo'
                                          void addItemToCurrentGunLoadout(it.code, 1, kind)
                                        }}
                                      >
                                        Add To Recipe
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="admin-card">
                        <div className="admin-card-title">Attachments (Likely)</div>
                        <div className="admin-card-sub">{gunHelperAttachments.length} matches (generic + token-matched)</div>
                        {gunHelperAttachments.length === 0 ? (
                          <div className="admin-notice" style={{ marginTop: 10 }}>
                            No attachment matches found for this gun in the current item catalog.
                          </div>
                        ) : (
                          <div className="admin-list" style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto' }}>
                            {gunHelperAttachments.map((it) => (
                              <div key={it.code} className="admin-list-item">
                                <div>
                                  <div className="admin-list-title">{effectiveItemName(it)}</div>
                                  <div className="admin-list-sub">
                                    {it.code}
                                    {(it as any)._matchTag ? ` • ${(it as any)._matchTag}` : ''}
                                    {it.category ? ` • ${it.category}` : ''}
                                  </div>
                                </div>
                                <div className="admin-list-actions">
                                  <button className="admin-btn" type="button" onClick={() => setItemCode(it.code)}>Use</button>
                                  <button className="admin-btn" type="button" onClick={() => safeAddToDraft(it.code, 1)}>Add</button>
                                  {currentGunLoadout && (
                                    <button className="admin-btn" type="button" onClick={() => void addItemToCurrentGunLoadout(it.code, 1, 'attachment')}>
                                      Add To Recipe
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </details>

                <label className="admin-field">
                  <span>Item group</span>
                  <select className="admin-select" value={itemGroup} onChange={e => setItemGroup(e.currentTarget.value as ItemGroup)}>
                    {ITEM_GROUP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Search item</span>
                  <input className="admin-input" value={itemQuery} onChange={e => setItemQuery(e.currentTarget.value)} placeholder="Type item name or code" />
                </label>
                <label className="admin-field">
                  <span>Subcategory</span>
                  <select className="admin-select" value={itemCategory} onChange={e => setItemCategory(e.currentTarget.value)}>
                    <option value="all">All Subcategories</option>
                    {itemCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Type</span>
                  <select className="admin-select" value={itemType} onChange={e => setItemType(e.currentTarget.value as ItemType)}>
                    <option value="all">All Types</option>
                    {itemTypes.map((type) => (
                      <option key={type} value={type}>{labelForType(type)}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Visible results</span>
                  <select className="admin-select" value={String(itemResultLimit)} onChange={e => setItemResultLimit(Number(e.currentTarget.value) || 250)}>
                    <option value="100">100</option>
                    <option value="250">250</option>
                    <option value="500">500</option>
                    <option value="1000">1000</option>
                  </select>
                </label>
                <div className="admin-card-sub">
                  Showing {visibleItems.length} of {filteredItems.length} matching items
                  {itemGroup !== 'all' ? ` in ${ITEM_GROUP_OPTIONS.find(x => x.value === itemGroup)?.label ?? itemGroup}` : ''}
                  {itemCategory !== 'all' ? ` • ${itemCategory}` : ''}
                  {itemType !== 'all' ? ` • ${labelForType(itemType)}` : ''}
                  {unavailableItemCodes.size > 0 ? ` • hidden invalid/removed: ${unavailableItemCodes.size}` : ''}
                </div>
                {unavailableItemCodes.size > 0 && (
                  <button className="admin-btn" type="button" onClick={() => setInvalidItemCodes([])}>
                    Reset Hidden Invalid Items
                  </button>
                )}
                <label className="admin-field">
                  <span>Item code</span>
                  <select className="admin-select" value={itemCode} onChange={e => setItemCode(e.currentTarget.value)}>
                    {groupedFilteredItems.map((group) => (
                      <optgroup key={group.category} label={`${group.category} (${group.entries.length})`}>
                        {group.entries.map((it) => {
                          const hint = ammoOrMagazineHint(it)
                          return (
                            <option key={it.code} value={it.code}>
                              {effectiveItemName(it)}{hint ? ` • ${hint}` : ''} ({it.code})
                            </option>
                          )
                        })}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="admin-btn" type="button" disabled={busy || !itemCode.trim()} onClick={() => void validateSelectedItem()}>
                    Validate Item
                  </button>
                  {itemValidation && itemValidation.code === itemCode.trim() && (
                    <button className="admin-btn" type="button" onClick={() => setItemValidation(null)}>
                      Clear Validation
                    </button>
                  )}
                </div>
                {itemValidation && itemValidation.code === itemCode.trim() && (
                  <div className={`admin-notice ${itemValidation.inCatalog && itemValidation.active ? 'success' : 'warn'}`} style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                    {itemValidation.time}{"\n"}
                    inCatalog: {itemValidation.inCatalog ? 'yes' : 'no'} • active: {itemValidation.active ? 'yes' : 'no'}
                    {itemValidation.kind ? ` • kind: ${itemValidation.kind}` : ''}
                    {(itemValidation.caliberKeys?.length ?? 0) > 0 ? ` • caliber: ${(itemValidation.caliberKeys ?? []).join(', ')}` : ''}
                    {(itemValidation.reasons?.length ?? 0) > 0 ? `\nreasons: ${(itemValidation.reasons ?? []).join(', ')}` : ''}
                    {itemValidation.sourceModId ? `\nsourceModId: ${itemValidation.sourceModId}` : ''}
                    {itemValidation.sourceWorkshopId ? `\nsourceWorkshopId: ${itemValidation.sourceWorkshopId}` : ''}
                  </div>
                )}
                <label className="admin-field">
                  <span>Quantity</span>
                  <input className="admin-input" type="number" min={1} max={500} value={itemQty} onChange={e => setItemQty(Number(e.currentTarget.value) || 1)} />
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[1, 5, 10, 25, 50].map((amount) => (
                    <button key={`qty-${amount}`} type="button" className="admin-btn" onClick={() => setItemQty(amount)}>
                      Qty {amount}
                    </button>
                  ))}
                </div>
                <button className="admin-btn" disabled={busy || !itemCode.trim() || !selectedPlayerValue} onClick={() => void giveItemToPlayer()}>
                  Give Item
                </button>
              </div>
            )}

            <div className="hr" />
            <div className="loadouts-block">
              <details className="admin-section">
                <summary className="admin-section-header">
                  <h2>Loadout Preset Library (Content)</h2>
                </summary>
                <div className="admin-card-sub" style={{ marginTop: 6 }}>
                  Loaded presets: {baseRolePresets.length}{loadoutPresetsUpdatedUtc ? ` • Updated ${new Date(loadoutPresetsUpdatedUtc).toLocaleString()}` : ' • Using built-in defaults'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button className="admin-btn" type="button" disabled={busy} onClick={() => void reloadLoadoutPresets()}>
                    Reload From Content
                  </button>
                  <button className="admin-btn" type="button" disabled={busy} onClick={() => void saveBuiltinPresetsToContent()}>
                    Save Built-ins To Content
                  </button>
                  <button className="admin-btn" type="button" disabled={busy || !loadoutPresetsJson.trim()} onClick={() => void saveLoadoutPresetsFromJson()}>
                    Save JSON
                  </button>
                </div>
                <label className="admin-field" style={{ marginTop: 10 }}>
                  <span>loadout-presets.json</span>
                  <textarea
                    className="admin-textarea"
                    rows={10}
                    value={loadoutPresetsJson}
                    onChange={(e) => setLoadoutPresetsJson(e.currentTarget.value)}
                    placeholder='{"updatedUtc":"...","presets":[...]}'
                  />
                </label>
              </details>

              <div className="admin-card-title" style={{ marginTop: 4 }}>Role Presets</div>
              <div className="admin-card-sub">Use the left section menu, then pick a preset card.</div>
              <div className="admin-grid two" style={{ marginTop: 8 }}>
                <label className="admin-field">
                  <span>Find preset</span>
                  <input
                    className="admin-input"
                    value={presetQuery}
                    onChange={e => setPresetQuery(e.currentTarget.value)}
                    placeholder="Search by name or role"
                  />
                </label>
                <label className="admin-field">
                  <span>Quantity profile</span>
                  <select className="admin-select" value={qtyProfile} onChange={e => setQtyProfile(e.currentTarget.value as QtyProfileId)}>
                    {QTY_PROFILES.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="loadouts-preset-browser">
                <div className="loadouts-section-nav">
                  <button className="admin-btn" type="button" onClick={() => setPresetSection('all')} disabled={presetSection === 'all'}>
                    All ({allRolePresets.length})
                  </button>
                  {rolePresetSections.map((section) => (
                    <button key={section} className="admin-btn" type="button" onClick={() => setPresetSection(section)} disabled={presetSection === section}>
                      {section} ({presetSectionCounts.get(section) ?? 0})
                    </button>
                  ))}
                </div>
                <div className="loadouts-preset-cards">
                  {flattenedFilteredPresets.length === 0 && (
                    <div className="admin-list-item">No presets match current filter.</div>
                  )}
                  {flattenedFilteredPresets.map(({ preset, section }) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`loadouts-preset-card ${rolePresetId === preset.id ? 'selected' : ''}`}
                      onClick={() => setRolePresetId(preset.id)}
                    >
                      <div className="loadouts-preset-card-title">{preset.label}</div>
                      <div className="loadouts-preset-card-sub">{section} • {preset.items.length} items</div>
                      <div className="loadouts-preset-card-tags">
                        {pinnedPresetIds.includes(preset.id) && <span className="admin-pill">Pinned</span>}
                        {recentPresetIds.includes(preset.id) && <span className="admin-pill count">Recent</span>}
                        {rolePresetId === preset.id && <span className="admin-pill fixable">Selected</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <details className="loadouts-details" style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer' }}>Quick Bundles</summary>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {sortedPresetBundles.map((bundle) => (
                  <button key={bundle.id} className="admin-btn" disabled={busy || !selectedPlayerValue} onClick={() => void grantPresetBundle(bundle)}>
                    Bundle: {bundle.label}
                  </button>
                ))}
              </div>
            </details>
            <details className="loadouts-details" style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer' }}>Custom Presets</summary>
              <div className="admin-grid two" style={{ marginTop: 8 }}>
                <label className="admin-field">
                  <span>Custom preset name</span>
                  <input
                    className="admin-input"
                    value={customPresetName}
                    onChange={(e) => setCustomPresetName(e.currentTarget.value)}
                    placeholder="Example: Power Grid Alpha"
                  />
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                  <button className="admin-btn" type="button" onClick={saveDraftAsCustomPreset}>
                    Save Draft as Custom
                  </button>
                  <button className="admin-btn" type="button" onClick={exportCustomPresets}>
                    Export Custom Presets
                  </button>
                  <button className="admin-btn" type="button" onClick={() => importPresetsRef.current?.click()}>
                    Import Custom Presets
                  </button>
                  <button
                    className="admin-btn"
                    type="button"
                    disabled={!selectedRolePreset?.id.startsWith('custom-')}
                    onClick={deleteSelectedCustomPreset}
                  >
                    Delete Custom Preset
                  </button>
                  <button className="admin-btn" type="button" onClick={addManualItemToDraft} disabled={!itemCode.trim()}>
                    Add Manual Item to Draft
                  </button>
                  <input
                    ref={importPresetsRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0] ?? null
                      void onImportCustomPresetsFile(file)
                      e.currentTarget.value = ''
                    }}
                  />
                </div>
              </div>
            </details>
            <details className="loadouts-details" style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer' }}>Draft Editor ({presetDraftItems.length})</summary>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button className="admin-btn" type="button" onClick={() => setAllDraftItemsEnabled(true)} disabled={presetDraftItems.length === 0}>
                  Select All
                </button>
                <button className="admin-btn" type="button" onClick={() => setAllDraftItemsEnabled(false)} disabled={presetDraftItems.length === 0}>
                  Deselect All
                </button>
              </div>
              <div className="admin-list" style={{ marginTop: 8 }}>
                {presetDraftItems.length === 0 && (
                  <div className="admin-list-item">
                    <div>
                      <div className="admin-list-title">No items in current draft</div>
                      <div className="admin-list-sub">Use Restore Preset Items or choose another preset.</div>
                    </div>
                  </div>
                )}
                {presetDraftItems.map((it, idx) => (
                  <div key={`${selectedRolePreset?.id ?? 'preset'}-${it.code}-${idx}`} className="admin-list-item">
                    <div>
                      <div className="admin-list-title">
                        <label className="admin-field checkbox" style={{ gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={it.enabled !== false}
                            onChange={(e) => {
                              const enabled = e.currentTarget.checked
                              setPresetDraftItems((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, enabled } : row)))
                            }}
                          />
                          <span>{it.code}</span>
                        </label>
                      </div>
                      <div className="admin-list-sub">Qty: {it.qty} • Scaled: {Math.max(1, Math.floor(it.qty * qtyMultiplier))}</div>
                    </div>
                    <div className="admin-list-actions">
                      <input
                        className="admin-input"
                        type="number"
                        min={1}
                        max={5000}
                        value={it.qty}
                        onChange={(e) => {
                          const qty = Math.max(1, Math.floor(Number(e.currentTarget.value) || 1))
                          setPresetDraftItems((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, qty } : row)))
                        }}
                        style={{ width: 92 }}
                      />
                      <select
                        className="admin-select"
                        defaultValue=""
                        onChange={(e) => {
                          const action = e.currentTarget.value
                          if (!action) return
                          applyDraftRowAction(idx, action)
                          e.currentTarget.value = ''
                        }}
                        style={{ width: 170 }}
                      >
                        <option value="">Actions</option>
                        <option value="up">Move Up</option>
                        <option value="down">Move Down</option>
                        <option value="use">Use as Manual Item</option>
                        <option value="remove">Remove from Draft</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button
                  className="admin-btn"
                  type="button"
                  onClick={() => {
                    const preset = allRolePresets.find((x) => x.id === rolePresetId)
                    setPresetDraftItems((preset?.items ?? []).map((item) => ({ code: item.code, qty: item.qty, enabled: true })))
                  }}
                >
                  Restore Preset Items
                </button>
                <button className="admin-btn" type="button" onClick={stashCurrentDraft}>
                  Store Draft for Later
                </button>
                <button className="admin-btn" type="button" onClick={clearCurrentDraft} disabled={presetDraftItems.length === 0}>
                  Clear Current Draft
                </button>
                <button className="admin-btn" type="button" onClick={restoreStashedDraft} disabled={storedDraftItems.length === 0}>
                  Restore Stored Draft
                </button>
              </div>
            </details>
          </div>

          <div className="admin-card loadouts-summary-card" style={{ position: 'sticky', top: 18, alignSelf: 'start' }}>
            <div className="admin-card-title">Loadout Summary</div>
            <div className="admin-card-sub">Player: {selectedPlayerValue || 'Not selected'}</div>
            <div className="admin-card-sub">Online: {selectedPlayerValue ? (selectedPlayerOnline ? 'Yes' : 'No / Manual') : 'n/a'}</div>
            <div className="admin-card-sub">Preset: {selectedRolePreset?.label ?? 'Not selected'}</div>
            <div className="admin-card-sub">Section: {selectedRolePreset ? rolePresetSection(selectedRolePreset) : 'n/a'}</div>
            <div className="admin-card-sub">Draft: {draftTotals.selectedUnique}/{draftTotals.unique} selected</div>
            <div className="admin-card-sub">Scaled Qty: {draftTotals.scaledQty}</div>
            <div className="admin-card-sub">Stored Draft: {storedDraftItems.length > 0 ? `${storedDraftLabel || 'Stored Draft'} (${storedDraftItems.length})` : 'None'}</div>
            <div className="admin-card-sub">
              Giving now: {givingPreviewItems.length === 0
                ? 'No items selected'
                : givingPreviewItems.slice(0, 10).map((item) => `${item.code} x${item.scaledQty}`).join(', ')
              }
              {givingPreviewItems.length > 10 ? ` ... +${givingPreviewItems.length - 10} more` : ''}
            </div>
            <details className="loadouts-details" style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>Inspector</summary>
              <div className="admin-card-sub" style={{ marginTop: 8 }}>
                {previewGroupBreakdown.length === 0
                  ? 'No selected items.'
                  : previewGroupBreakdown.map(([group, count]) => `${ITEM_GROUP_OPTIONS.find((x) => x.value === group)?.label ?? group}: ${count}`).join(' • ')
                }
              </div>
              <div className="admin-list" style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto' }}>
                {givingPreviewItems.slice(0, 50).map((item) => (
                  <div key={`inspect-${item.code}`} className="admin-list-item">
                    <div>
                      <div className="admin-list-title">{itemByCode.get(item.code)?.name ?? item.code}</div>
                      <div className="admin-list-sub">{item.code}</div>
                    </div>
                    <div className="admin-list-meta">x{item.scaledQty}</div>
                  </div>
                ))}
              </div>
            </details>
            {missingDraftCodes.length > 0 && (
              <div className="admin-notice warn" style={{ marginTop: 8 }}>
                Missing from catalog: {missingDraftCodes.length} item codes
              </div>
            )}
            {largeGrantWarning && (
              <div className="admin-notice warn" style={{ marginTop: 8 }}>
                Large grant warning: scaled quantity is {draftTotals.scaledQty}
              </div>
            )}
            {(presetSection === 'Electrical Infrastructure' || rolePresetSection(selectedRolePreset ?? allRolePresets[0]) === 'Electrical Infrastructure') && (
              <div className="admin-card-sub" style={{ marginTop: 8 }}>
                Generator item codes are not in current catalog yet; electrical presets are ready for expansion.
              </div>
            )}
            {(presetSection === 'Antenna / Towers' || rolePresetSection(selectedRolePreset ?? allRolePresets[0]) === 'Antenna / Towers') && (
              <div className="admin-card-sub">
                Antenna/Tower presets are mod-ready; add future tower mod items via draft edits or custom presets.
              </div>
            )}
            {(presetSection === 'Corrections' || rolePresetSection(selectedRolePreset ?? allRolePresets[0]) === 'Corrections') && (
              <div className="admin-card-sub">
                Corrections presets are safe-only: food, water, and basic care, with no escape-assist tools.
              </div>
            )}
            {selectedRolePreset && (
              <button className="admin-btn" type="button" style={{ marginTop: 8 }} onClick={() => togglePinnedPreset(selectedRolePreset.id)}>
                {pinnedPresetIds.includes(selectedRolePreset.id) ? 'Unpin Preset' : 'Pin Preset'}
              </button>
            )}
            <button className="admin-btn primary loadouts-grant-btn" style={{ marginTop: 8 }} disabled={busy || !selectedPlayerValue || !selectedRolePreset} onClick={() => void grantRolePresetToPlayer()}>
              Grant Preset to Player
            </button>
            <div className="hr" />
            <details className="loadouts-details">
              <summary style={{ cursor: 'pointer' }}>Update Loss Watch ({lossRows.length})</summary>
              <div className="admin-card-sub" style={{ marginTop: 8 }}>Tracks item codes removed by updates/mod sync. Not death loss.</div>
              <button className="admin-btn" style={{ marginTop: 10 }} onClick={() => void refreshPlayersAndItems()}>Refresh Loss Watch</button>
              <div className="admin-list" style={{ marginTop: 10 }}>
                {lossRows.length === 0 && <div className="admin-list-item">No update-related item removals detected.</div>}
                {lossRows.slice(0, 20).map((row) => (
                  <div key={row.id} className="admin-list-item">
                    <div>
                      <div className="admin-list-title">{new Date(row.timeUtc).toLocaleString()} • Removed {row.removedCount} item codes • Source: {row.source === 'item-catalog-sync' ? 'Update Sync' : row.source}</div>
                      <div className="admin-list-sub">{row.removedCodes.slice(0, 5).join(', ')}{row.removedCodes.length > 5 ? ' ...' : ''}</div>
                      <div className="admin-list-sub">{row.reason}</div>
                    </div>
                    <div className="admin-list-actions">
                      {row.removedCodes[0] && (
                        <button className="admin-btn" onClick={() => setItemCode(row.removedCodes[0])}>Use First Code</button>
                      )}
                      <button className="admin-btn" disabled={busy || !selectedPlayerValue || row.source !== 'item-catalog-sync'} onClick={() => void reimburseLossRow(row)}>
                        Reimburse Event
                      </button>
                      {!row.acknowledged && (
                        <button className="admin-btn" onClick={() => void ackLoss(row.id)}>Acknowledge</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      </>
      )}

      {result && <div className="admin-notice success">{result}</div>}
      {error && <div className="admin-notice warn">{error}</div>}
      {lastGiveFailure && (
        <div className="admin-card" style={{ marginTop: 14 }}>
          <div className="admin-card-title">Give Item Failure Details</div>
          <div className="admin-card-sub">
            {lastGiveFailure.time} • player: {lastGiveFailure.player} • requested: {lastGiveFailure.requestedCode}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button
              className="admin-btn"
              type="button"
              onClick={() => void safeCopy(JSON.stringify(lastGiveFailure, null, 2))}
            >
              Copy Debug JSON
            </button>
            {lastGiveFailure.triedCandidates?.[0] && (
              <button className="admin-btn" type="button" onClick={() => setItemCode(lastGiveFailure.triedCandidates[0])}>
                Use First Candidate
              </button>
            )}
          </div>
          {lastGiveFailure.lastResponseText && (
            <div className="admin-notice warn" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
              {lastGiveFailure.lastResponseText}
            </div>
          )}
          {lastGiveFailure.triedCommands?.length > 0 && (
            <div className="admin-card-sub" style={{ marginTop: 10 }}>
              Tried commands:
              <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
                {lastGiveFailure.triedCommands.join('\n')}
              </pre>
            </div>
          )}
        </div>
      )}
      {loading && <div className="admin-notice">Loading server control panel...</div>}
    </div>
  )
}
