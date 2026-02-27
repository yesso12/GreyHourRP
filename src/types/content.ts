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
  playersOnline?: number
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
  source?: 'server' | 'manual'
}

export type ModsChangeLogEntry = {
  detectedUtc: string
  source?: string
  reason?: string
  addedWorkshop?: string[]
  removedWorkshop?: string[]
  addedMods?: string[]
  removedMods?: string[]
  addedTotal?: number
  removedTotal?: number
}

export type ModsChangeLogPayload = {
  updatedUtc?: string
  entries: ModsChangeLogEntry[]
}

export type ItemCatalogEntry = {
  code: string
  name: string
  category?: string
  sourceModId?: string
  sourceWorkshopId?: string
  kind?: 'gun' | 'ammo' | 'mag' | 'attachment' | 'other'
  caliberKeys?: string[]
}

export type ItemsCatalogPayload = {
  updatedUtc?: string
  items: ItemCatalogEntry[]
}

export type ShopStatus = 'pending' | 'approved' | 'denied'

export type ShopItem = {
  id: string
  name: string
  category: string
  description: string
  owner?: string
  location?: string
  contact?: string
  status: ShopStatus
  featured?: boolean
  tags?: string[]
  createdUtc?: string
  approvedUtc?: string
  deniedUtc?: string
  requestedBy?: string
  requestedFrom?: string
  source?: 'bot' | 'manual'
  notes?: string
}

export type AdminRole = 'owner' | 'editor' | 'ops'

export type AdminUserRecord = {
  role: AdminRole
  hasPassword: boolean
}

export type AdminUserMap = Record<string, AdminUserRecord>

export type HomeMedia = {
  enabled: boolean
  title: string
  description?: string
  videoUrl: string
  ctaLabel?: string
  ctaUrl?: string
}

export type SiteSettings = {
  discordInviteUrl?: string
}

export type SiteFlags = {
  showMods?: boolean
  showUpdates?: boolean
  showEvents?: boolean
  showFactions?: boolean
  showDirectory?: boolean
  showDossiers?: boolean
  showEconomy?: boolean
  showLevels?: boolean
  showTransmissions?: boolean
  showDiscordPage?: boolean
  showHowToJoin?: boolean
  showStaff?: boolean
}

export type GameServerLive = {
  status: 'online' | 'offline' | 'maintenance'
  state?: string
  playersOnline: number
  players?: Array<{ name?: string; raw: string }>
  maxPlayers: number
  queue: number
  map?: string
  wipeEta?: string
  cpuPercent?: number
  memoryBytes?: number
  diskBytes?: number
  networkRxBytes?: number
  networkTxBytes?: number
  uptimeMs?: number
  updatedUtc: string
}

export type DiscordLive = {
  online: boolean
  members?: number
  activeTickets?: number
  openModcalls?: number
  botUptimeSec?: number
  updatedUtc: string
}

export type IntegrationReadiness = {
  gameServerApiReady: boolean
  discordApiReady: boolean
  webhooksReady: boolean
  notes: string[]
}

export type PublicLiveSnapshot = {
  gameServer: GameServerLive
  discord: DiscordLive
  readiness?: IntegrationReadiness
}

export type FactionStatus = 'active' | 'dormant' | 'defunct'

export type Faction = {
  id: string
  name: string
  tagline?: string
  description?: string
  status?: FactionStatus
  color?: string
  icon?: string
  leader?: string
  headquarters?: string
  members?: number
  reputation?: number
  foundedUtc?: string
  allies?: string[]
  rivals?: string[]
  featured?: boolean
}

export type TerritoryStatus = 'controlled' | 'contested' | 'neutral' | 'lost'

export type TerritoryPoint = {
  id: string
  name: string
  x: number
  y: number
  status: TerritoryStatus
  factionId?: string
  region?: string
  description?: string
  lastConflictUtc?: string
  tags?: string[]
}

export type FactionTerritoryState = {
  updatedUtc: string
  mapUrl?: string
  mapAlt?: string
  mapAttribution?: string
  notes?: string[]
  factions: Faction[]
  territories: TerritoryPoint[]
}

export type GroupType = 'faction' | 'shop'

export type GroupEntry = {
  id: string
  type: GroupType
  name: string
  color?: string
  tagline?: string
  details?: string
  ownerId?: string
  memberIds?: string[]
  roleId?: string
  textChannelId?: string
  voiceChannelId?: string
  createdUtc?: string
  maxMembers?: number
}

export type GroupRegistry = {
  updatedUtc: string
  groups: GroupEntry[]
}

export type GroupRequestStatus = 'pending' | 'approved' | 'denied'

export type GroupRequest = {
  id: string
  type: GroupType
  name: string
  color?: string
  tagline?: string
  details?: string
  ownerId?: string
  createdUtc?: string
  status?: GroupRequestStatus
  approvedBy?: string
  approvedUtc?: string
  deniedBy?: string
  deniedUtc?: string
}

export type GroupRequestLogEntry = {
  id: string
  requestId: string
  action: 'submitted' | 'approved' | 'denied'
  type: GroupType
  name: string
  ownerId?: string
  actorId?: string
  createdUtc: string
}

export type GroupRequestLog = {
  updatedUtc: string
  entries: GroupRequestLogEntry[]
}

export type LevelBoardEntry = {
  userId: string
  xp: number
  level: number
}

export type LevelBoard = {
  updatedUtc: string
  entries: LevelBoardEntry[]
}

export type DossierStatus = 'pending' | 'approved' | 'denied'

export type PlayerDossier = {
  id: string
  characterName: string
  handle?: string
  factionId?: string
  backstory?: string
  goals?: string[]
  status: DossierStatus
  reputation: number
  commendations?: number
  warnings?: number
  lastSeenUtc?: string
  tags?: string[]
  requestedBy?: string
  requestedFrom?: string
  createdUtc?: string
  approvedUtc?: string
  deniedUtc?: string
  notes?: string
}

export type DossierCollection = {
  updatedUtc: string
  notes?: string[]
  dossiers: PlayerDossier[]
}

export type ArcPhaseStatus = 'locked' | 'active' | 'complete'

export type ArcPhase = {
  id: string
  name: string
  summary?: string
  status: ArcPhaseStatus
  startUtc?: string
  endUtc?: string
  objectives?: string[]
  outcomes?: string[]
}

export type StoryArcStatus = 'planning' | 'live' | 'complete' | 'paused'

export type StoryArc = {
  id: string
  title: string
  status: StoryArcStatus
  summary?: string
  season?: string
  startUtc?: string
  endUtc?: string
  featured?: boolean
  phases: ArcPhase[]
  factionsInvolved?: string[]
  rewards?: string[]
}

export type StoryArcCollection = {
  updatedUtc: string
  notes?: string[]
  arcs: StoryArc[]
}

export type EventStatus = 'scheduled' | 'open' | 'full' | 'complete' | 'canceled'

export type EventItem = {
  id: string
  title: string
  status: EventStatus
  summary?: string
  location?: string
  startUtc: string
  endUtc?: string
  capacity?: number
  waitlistEnabled?: boolean
  factionId?: string
  tags?: string[]
  host?: string
  link?: string
  createdUtc?: string
}

export type EventCalendar = {
  updatedUtc: string
  timezone?: string
  notes?: string[]
  events: EventItem[]
}

export type EconomyStatus = 'stable' | 'volatile' | 'scarce' | 'flush'

export type EconomySnapshot = {
  updatedUtc: string
  status: EconomyStatus
  summary?: string
  priceIndex?: number
  scarcityIndex?: number
  highlights?: string[]
  categories?: Array<{
    id: string
    name: string
    trend: 'up' | 'down' | 'flat'
    note?: string
  }>
  watchlist?: Array<{
    item: string
    status: EconomyStatus
    note?: string
  }>
}

export type HelplineScripts = {
  updatedUtc: string
  staff: Record<string, string[]>
  owner: Record<string, string[]>
  roleOverrides?: Record<string, { staff?: Record<string, string[]>; owner?: Record<string, string[]> }>
}

export type DiscordOpsSettings = {
  updatedUtc: string
  quietHoursEnabled: boolean
  quietHoursStartUtc: string
  quietHoursEndUtc: string
  mentionAllowedChannelIds: string[]
  staffDigestChannelId?: string
  staffDigestTimeUtc?: string
  lastDigestPostedUtc?: string
  disabledCommandKeys?: string[]
  musicAutoPlaylistSize?: number
}

export type FactionChannelMap = {
  updatedUtc: string
  mappings: Record<string, string>
}

export type DiscordCommandPermission = 'public' | 'staff' | 'admin' | 'restricted'

export type DiscordSubcommand = {
  name: string
  description: string
  usage: string
}

export type DiscordCommandDocEntry = {
  name: string
  description: string
  permission: DiscordCommandPermission
  defaultMemberPermissions?: string | null
  dmPermission?: boolean | null
  usage: string
  usageAll?: string[]
  subcommands?: DiscordSubcommand[]
}

export type DiscordCommandDoc = {
  generatedUtc: string
  commands: DiscordCommandDocEntry[]
}

export type DiscordChannelCommandItem = {
  usage: string
  description?: string
  permission: DiscordCommandPermission
}

export type DiscordChannelCommand = {
  id: string
  name: string
  parentId?: string | null
  parentName?: string | null
  type?: number | string
  allowRules: string[]
  commands: DiscordChannelCommandItem[]
}

export type DiscordChannelCommandDoc = {
  generatedUtc: string
  channels: DiscordChannelCommand[]
}
