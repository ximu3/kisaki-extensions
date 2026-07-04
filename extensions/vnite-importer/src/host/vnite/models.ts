export const VNITE_PLAY_STATUSES = [
  'unplayed',
  'playing',
  'partial',
  'finished',
  'multiple',
  'shelved'
] as const

export type VnitePlayStatus = (typeof VNITE_PLAY_STATUSES)[number]

export const VNITE_LAUNCHER_MODES = ['file', 'url', 'script'] as const

export type VniteLauncherMode = (typeof VNITE_LAUNCHER_MODES)[number]

export const VNITE_MONITOR_MODES = ['file', 'folder', 'process'] as const

export type VniteMonitorMode = (typeof VNITE_MONITOR_MODES)[number]

export const VNITE_COLLECTION_SORT_FIELDS = [
  'metadata.name',
  'metadata.sortName',
  'metadata.releaseDate',
  'record.lastRunDate',
  'record.addDate',
  'record.playTime',
  'record.storageSize',
  'custom'
] as const

export type VniteCollectionSortField = (typeof VNITE_COLLECTION_SORT_FIELDS)[number]

export interface VniteRelatedSite {
  label: string
  url: string
}

export interface VniteExtraField {
  key: string
  value: readonly string[]
}

export interface VniteGameMetadata {
  name: string
  originalName: string
  sortName: string
  releaseDate: string
  description: string
  developers: readonly string[]
  publishers: readonly string[]
  platforms: readonly string[]
  genres: readonly string[]
  tags: readonly string[]
  relatedSites: readonly VniteRelatedSite[]
  steamId: string
  vndbId: string
  igdbId: string
  ymgalId: string
  extra: readonly VniteExtraField[]
}

export interface VnitePlayTimer {
  start: string
  end: string
}

export interface VniteDailyPlayTime {
  date: string
  playTime: number
}

export interface VniteGameRecord {
  addDate: string
  lastRunDate: string
  score: number
  playTime: number
  playStatus: VnitePlayStatus
  hideFromRecentGames: boolean
  timers: readonly VnitePlayTimer[]
  dailyPlayTimes: readonly VniteDailyPlayTime[]
  storageSize: number
}

export interface VniteSaveEntry {
  _id: string
  date: string
  note: string
  locked: boolean
}

export interface VniteGameSave {
  saveList: Readonly<Record<string, VniteSaveEntry>>
  maxBackups: number
  autoRestoreSave: boolean
}

export interface VniteMemoryEntry {
  _id: string
  date: string
  note: string
}

export interface VniteGameMemory {
  memoryList: Readonly<Record<string, VniteMemoryEntry>>
}

export interface VniteLogoAppearance {
  position: {
    x: number
    y: number
  }
  size: number
  visible: boolean
}

export interface VniteGameAppearance {
  logo: VniteLogoAppearance
  nsfw: boolean
}

export interface VniteGameDoc {
  _id: string
  metadata: VniteGameMetadata
  record: VniteGameRecord
  save: VniteGameSave
  memory: VniteGameMemory
  apperance: VniteGameAppearance
}

export interface VniteFileLauncherConfig {
  path: string
  args: readonly string[]
  monitorMode: VniteMonitorMode
  monitorPath: string
  workingDirectory?: string
}

export interface VniteUrlLauncherConfig {
  url: string
  browserPath: string
  monitorMode: VniteMonitorMode
  monitorPath: string
}

export interface VniteScriptLauncherConfig {
  workingDirectory: string
  command: readonly string[]
  monitorMode: VniteMonitorMode
  monitorPath: string
}

export interface VniteGameLocalDoc {
  _id: string
  path: {
    gamePath: string
    savePaths: readonly string[]
    screenshotPath?: string
  }
  launcher: {
    mode: VniteLauncherMode
    fileConfig: VniteFileLauncherConfig
    urlConfig: VniteUrlLauncherConfig
    scriptConfig: VniteScriptLauncherConfig
    useMagpie: boolean
  }
  utils: {
    markPath: string
    rootPath: string
  }
}

export interface VniteGameCollectionDoc {
  _id: string
  name: string
  sort: number
  sortBy: VniteCollectionSortField
  sortOrder: 'asc' | 'desc'
  games: readonly string[]
}

export interface VnitePouchAttachmentStub {
  content_type?: string
  contentType?: string
  digest?: string
  length?: number
  stub?: boolean
}

export interface VniteRawDocument {
  _id?: unknown
  _rev?: unknown
  _attachments?: unknown
  [key: string]: unknown
}

export interface NormalizedVniteGame {
  id: string
  doc: VniteGameDoc
  attachmentIds: readonly string[]
}

export interface NormalizedVniteGameLocal {
  id: string
  doc: VniteGameLocalDoc
}

export interface NormalizedVniteCollection {
  id: string
  doc: VniteGameCollectionDoc
}
