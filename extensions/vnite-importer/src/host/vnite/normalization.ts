import { omitUndefined } from '../utils/object'
import {
  DEFAULT_VNITE_LAUNCHER_MODE,
  DEFAULT_VNITE_MONITOR_MODE,
  DEFAULT_VNITE_PLAY_STATUS,
  createDefaultVniteGameDoc,
  createDefaultVniteGameLocalDoc
} from './defaults'
import {
  VNITE_COLLECTION_SORT_FIELDS,
  VNITE_LAUNCHER_MODES,
  VNITE_MONITOR_MODES,
  VNITE_PLAY_STATUSES,
  type NormalizedVniteCollection,
  type NormalizedVniteGame,
  type NormalizedVniteGameLocal,
  type VniteCollectionSortField,
  type VniteExtraField,
  type VniteGameCollectionDoc,
  type VniteGameDoc,
  type VniteLauncherMode,
  type VniteMonitorMode,
  type VnitePlayStatus,
  type VnitePouchAttachmentStub,
  type VniteRawDocument,
  type VniteRelatedSite,
  type VniteSaveEntry,
  type VniteMemoryEntry
} from './models'

export interface VniteNormalizationIssue {
  level: 'warning' | 'error'
  code: string
  message: string
  docId?: string
  field?: string
}

export interface VniteNormalizationResult<T> {
  value?: T
  issues: readonly VniteNormalizationIssue[]
}

export function normalizeVniteGameDoc(
  rawDoc: unknown,
  fallbackId?: string
): VniteNormalizationResult<NormalizedVniteGame> {
  const doc = toRecord(rawDoc)
  const id = readDocumentId(doc, fallbackId)
  if (!id) {
    return {
      issues: [
        {
          level: 'error',
          code: 'vnite.doc.invalid',
          message: 'Vnite 游戏文档缺少 _id。'
        }
      ]
    }
  }

  const normalized = createDefaultVniteGameDoc(id)
  const metadata = toRecord(doc.metadata)
  const record = toRecord(doc.record)
  const save = toRecord(doc.save)
  const memory = toRecord(doc.memory)
  const apperance = toRecord(doc.apperance)
  const logo = toRecord(apperance.logo)
  const logoPosition = toRecord(logo.position)
  const issues: VniteNormalizationIssue[] = []

  normalized.metadata = {
    ...normalized.metadata,
    name: readString(metadata.name),
    originalName: readString(metadata.originalName),
    sortName: readString(metadata.sortName),
    releaseDate: readString(metadata.releaseDate),
    description: readString(metadata.description),
    developers: readStringArray(metadata.developers),
    publishers: readStringArray(metadata.publishers),
    platforms: readStringArray(metadata.platforms),
    genres: readStringArray(metadata.genres),
    tags: readStringArray(metadata.tags),
    relatedSites: readRelatedSites(metadata.relatedSites),
    steamId: readString(metadata.steamId),
    vndbId: readString(metadata.vndbId),
    igdbId: readString(metadata.igdbId),
    ymgalId: readString(metadata.ymgalId),
    extra: readExtraFields(metadata.extra)
  }
  normalized.record = {
    ...normalized.record,
    addDate: readString(record.addDate),
    lastRunDate: readString(record.lastRunDate),
    score: readNumber(record.score, -1),
    playTime: readNonNegativeNumber(record.playTime, 0),
    playStatus: readPlayStatus(record.playStatus, id, issues),
    hideFromRecentGames: readBoolean(record.hideFromRecentGames),
    timers: readTimerEntries(record.timers),
    dailyPlayTimes: readDailyPlayTimes(record.dailyPlayTimes),
    storageSize: readNonNegativeNumber(record.storageSize, 0)
  }
  normalized.save = {
    ...normalized.save,
    saveList: readSaveEntries(save.saveList),
    maxBackups: readNonNegativeNumber(save.maxBackups, 0),
    autoRestoreSave: readBoolean(save.autoRestoreSave)
  }
  normalized.memory = {
    memoryList: readMemoryEntries(memory.memoryList)
  }
  normalized.apperance = {
    logo: {
      position: {
        x: readNumber(logoPosition.x, 0),
        y: readNumber(logoPosition.y, 0)
      },
      size: readNumber(logo.size, 1),
      visible: readBoolean(logo.visible, true)
    },
    nsfw: readBoolean(apperance.nsfw)
  }

  return {
    value: {
      id,
      doc: normalized,
      attachmentIds: Object.keys(readAttachmentStubs(doc._attachments))
    },
    issues
  }
}

export function normalizeVniteGameLocalDoc(
  rawDoc: unknown,
  fallbackId?: string
): VniteNormalizationResult<NormalizedVniteGameLocal> {
  const doc = toRecord(rawDoc)
  const id = readDocumentId(doc, fallbackId)
  if (!id) {
    return {
      issues: [
        {
          level: 'error',
          code: 'vnite.doc.invalid',
          message: 'Vnite 本地游戏文档缺少 _id。'
        }
      ]
    }
  }

  const normalized = createDefaultVniteGameLocalDoc(id)
  const path = toRecord(doc.path)
  const launcher = toRecord(doc.launcher)
  const fileConfig = toRecord(launcher.fileConfig)
  const urlConfig = toRecord(launcher.urlConfig)
  const scriptConfig = toRecord(launcher.scriptConfig)
  const utils = toRecord(doc.utils)
  const issues: VniteNormalizationIssue[] = []

  normalized.path = omitUndefined({
    gamePath: readString(path.gamePath),
    savePaths: readStringArray(path.savePaths),
    screenshotPath: readOptionalString(path.screenshotPath)
  })
  normalized.launcher = {
    mode: readLauncherMode(launcher.mode, id, issues),
    fileConfig: omitUndefined({
      path: readString(fileConfig.path),
      args: readStringArray(fileConfig.args),
      monitorMode: readMonitorMode(fileConfig.monitorMode),
      monitorPath: readString(fileConfig.monitorPath),
      workingDirectory: readOptionalString(fileConfig.workingDirectory)
    }),
    urlConfig: {
      url: readString(urlConfig.url),
      browserPath: readString(urlConfig.browserPath),
      monitorMode: readMonitorMode(urlConfig.monitorMode),
      monitorPath: readString(urlConfig.monitorPath)
    },
    scriptConfig: {
      workingDirectory: readString(scriptConfig.workingDirectory),
      command: readStringArray(scriptConfig.command),
      monitorMode: readMonitorMode(scriptConfig.monitorMode),
      monitorPath: readString(scriptConfig.monitorPath)
    },
    useMagpie: readBoolean(launcher.useMagpie)
  }
  normalized.utils = {
    markPath: readString(utils.markPath),
    rootPath: readString(utils.rootPath)
  }

  return {
    value: {
      id,
      doc: normalized
    },
    issues
  }
}

export function normalizeVniteCollectionDoc(
  rawDoc: unknown,
  fallbackId?: string
): VniteNormalizationResult<NormalizedVniteCollection> {
  const doc = toRecord(rawDoc)
  const id = readDocumentId(doc, fallbackId)
  if (!id) {
    return {
      issues: [
        {
          level: 'error',
          code: 'vnite.doc.invalid',
          message: 'Vnite 合集文档缺少 _id。'
        }
      ]
    }
  }

  const collection: VniteGameCollectionDoc = {
    _id: id,
    name: readString(doc.name),
    sort: readNumber(doc.sort, 0),
    sortBy: readCollectionSortField(doc.sortBy),
    sortOrder: doc.sortOrder === 'desc' ? 'desc' : 'asc',
    games: readStringArray(doc.games)
  }

  return {
    value: {
      id,
      doc: collection
    },
    issues: []
  }
}

export function readAttachmentStubs(
  value: unknown
): Readonly<Record<string, VnitePouchAttachmentStub>> {
  const record = toRecord(value)
  const attachments: Record<string, VnitePouchAttachmentStub> = {}

  for (const [id, rawStub] of Object.entries(record)) {
    const stub = toRecord(rawStub)
    attachments[id] = omitUndefined({
      content_type: readOptionalString(stub.content_type),
      contentType: readOptionalString(stub.contentType),
      digest: readOptionalString(stub.digest),
      length: readOptionalNumber(stub.length),
      stub: readOptionalBoolean(stub.stub)
    })
  }

  return attachments
}

export function stripPouchMetadata<T extends VniteRawDocument>(doc: T): Omit<T, '_rev'> {
  const rest = { ...doc }
  delete rest._rev
  return rest
}

function readDocumentId(doc: Record<string, unknown>, fallbackId?: string): string | undefined {
  const id = readOptionalString(doc._id) ?? fallbackId
  const trimmed = id?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readNonNegativeNumber(value: unknown, fallback: number): number {
  const number = readNumber(value, fallback)
  return number >= 0 ? number : fallback
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function readRelatedSites(value: unknown): readonly VniteRelatedSite[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(toRecord).map((item) => ({
    label: readString(item.label),
    url: readString(item.url)
  }))
}

function readExtraFields(value: unknown): readonly VniteExtraField[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(toRecord).map((item) => ({
    key: readString(item.key),
    value: readStringArray(item.value)
  }))
}

function readTimerEntries(value: unknown): VniteGameDoc['record']['timers'] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(toRecord).map((item) => ({
    start: readString(item.start),
    end: readString(item.end)
  }))
}

function readDailyPlayTimes(value: unknown): VniteGameDoc['record']['dailyPlayTimes'] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(toRecord).map((item) => ({
    date: readString(item.date),
    playTime: readNonNegativeNumber(item.playTime, 0)
  }))
}

function readSaveEntries(value: unknown): Readonly<Record<string, VniteSaveEntry>> {
  const entries: Record<string, VniteSaveEntry> = {}

  for (const [key, item] of Object.entries(toRecord(value))) {
    const record = toRecord(item)
    const id = readString(record._id, key)
    entries[key] = {
      _id: id,
      date: readString(record.date),
      note: readString(record.note),
      locked: readBoolean(record.locked)
    }
  }

  return entries
}

function readMemoryEntries(value: unknown): Readonly<Record<string, VniteMemoryEntry>> {
  const entries: Record<string, VniteMemoryEntry> = {}

  for (const [key, item] of Object.entries(toRecord(value))) {
    const record = toRecord(item)
    const id = readString(record._id, key)
    entries[key] = {
      _id: id,
      date: readString(record.date),
      note: readString(record.note)
    }
  }

  return entries
}

function readPlayStatus(
  value: unknown,
  docId: string,
  issues: VniteNormalizationIssue[]
): VnitePlayStatus {
  if (typeof value === 'string' && isOneOf(value, VNITE_PLAY_STATUSES)) {
    return value
  }

  if (typeof value === 'string' && value.length > 0) {
    issues.push({
      level: 'warning',
      code: 'vnite.status.unknown',
      message: 'Vnite 游戏状态无法识别，已按未游玩处理。',
      docId,
      field: 'record.playStatus'
    })
  }

  return DEFAULT_VNITE_PLAY_STATUS
}

function readLauncherMode(
  value: unknown,
  docId: string,
  issues: VniteNormalizationIssue[]
): VniteLauncherMode {
  if (typeof value === 'string' && isOneOf(value, VNITE_LAUNCHER_MODES)) {
    return value
  }

  if (typeof value === 'string' && value.length > 0) {
    issues.push({
      level: 'warning',
      code: 'vnite.launch.modeUnknown',
      message: 'Vnite 启动模式无法识别，已按文件启动处理。',
      docId,
      field: 'launcher.mode'
    })
  }

  return DEFAULT_VNITE_LAUNCHER_MODE
}

function readMonitorMode(value: unknown): VniteMonitorMode {
  return typeof value === 'string' && isOneOf(value, VNITE_MONITOR_MODES)
    ? value
    : DEFAULT_VNITE_MONITOR_MODE
}

function readCollectionSortField(value: unknown): VniteCollectionSortField {
  return typeof value === 'string' && isOneOf(value, VNITE_COLLECTION_SORT_FIELDS)
    ? value
    : 'custom'
}

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value)
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
