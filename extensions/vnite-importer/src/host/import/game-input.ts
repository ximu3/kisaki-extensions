import type {
  LibraryGameCreateInput,
  LibraryGraphDiagnostic,
  RelatedSite
} from '@kisaki3/extension-api'
import type { VniteBackupGame } from '../backup/types'
import {
  createVniteGraphDiagnostic,
  mapVniteExternalIds,
  mapVniteLocalGameFields,
  mapVnitePlayStatus,
  parseVnitePartialDate,
  parseVniteTimestamp,
  toKisakiScore
} from '../mapping'
import type { VniteImportFieldSelection } from '../../shared/import-wizard'
import { assignTrimmed, toNonNegativeInteger, trimToUndefined } from './values'

export interface VniteGameInputBuildResult {
  input: LibraryGameCreateInput
  diagnostics: readonly LibraryGraphDiagnostic[]
}

export function buildGameInput(
  game: VniteBackupGame,
  selection: VniteImportFieldSelection,
  nodeKey: string
): VniteGameInputBuildResult {
  const metadata = game.doc.metadata
  const record = game.doc.record
  const input: LibraryGameCreateInput = {
    name: resolveGameName(game, selection),
    externalIds: mapVniteExternalIds(game, {
      includeMetadataIds: selection.core.externalIds
    })
  }
  const diagnostics: LibraryGraphDiagnostic[] = []

  assignTrimmed(input, 'originalName', selection.core.originalName ? metadata.originalName : '')
  assignTrimmed(input, 'sortName', selection.core.sortName ? metadata.sortName : '')
  assignTrimmed(input, 'description', selection.core.description ? metadata.description : '')

  if (selection.core.releaseDate) {
    const result = parseVnitePartialDate(metadata.releaseDate, {
      nodeKey,
      field: 'metadata.releaseDate'
    })
    if (result.value) {
      input.releaseDate = result.value
    }
    diagnostics.push(...result.diagnostics)
  }

  if (selection.core.relatedSites) {
    const relatedSites = mapRelatedSites(metadata.relatedSites, nodeKey, diagnostics)
    if (relatedSites.length > 0) {
      input.relatedSites = relatedSites
    }
  }

  if (selection.core.nsfw) {
    input.isNsfw = game.doc.apperance.nsfw
  }

  if (selection.activity.status) {
    input.status = mapVnitePlayStatus(record.playStatus)
  }

  if (selection.activity.score) {
    const score = toKisakiScore(record.score)
    if (score !== null) {
      input.score = score
    }
  }

  if (selection.activity.totalDuration || selection.activity.sessions) {
    input.totalDuration = record.playTime
  }

  if (selection.activity.lastActiveAt) {
    const result = parseVniteTimestamp(record.lastRunDate, {
      nodeKey,
      field: 'record.lastRunDate'
    })
    if (result.value !== undefined) {
      input.lastActiveAt = result.value
    }
    diagnostics.push(...result.diagnostics)
  }

  if (selection.activity.createdAt) {
    const result = parseVniteTimestamp(record.addDate, {
      nodeKey,
      field: 'record.addDate'
    })
    if (result.value !== undefined) {
      input.createdAt = result.value
    }
    diagnostics.push(...result.diagnostics)
  }

  const local = mapVniteLocalGameFields(game.local, {
    includeLauncher: selection.local.launcher,
    includeGameDirPath: selection.local.gameDirPath,
    includeSavePath: selection.local.savePath,
    nodeKey
  })
  Object.assign(input, local.input)
  diagnostics.push(...local.diagnostics)

  if (selection.saves.maxSaveBackups) {
    const maxSaveBackups = toNonNegativeInteger(game.doc.save.maxBackups)
    if (maxSaveBackups === undefined) {
      diagnostics.push(
        createVniteGraphDiagnostic({
          level: 'warning',
          code: 'vnite.save.maxBackupsInvalid',
          message: 'Vnite 最大存档备份数不是有效整数，已跳过。',
          nodeKey
        })
      )
    } else {
      input.maxSaveBackups = maxSaveBackups
    }
  }

  return { input, diagnostics }
}

function resolveGameName(game: VniteBackupGame, selection: VniteImportFieldSelection): string {
  const metadata = game.doc.metadata
  if (selection.core.name) {
    return trimToUndefined(metadata.name) ?? trimToUndefined(metadata.originalName) ?? game.id
  }

  return trimToUndefined(metadata.originalName) ?? trimToUndefined(metadata.name) ?? game.id
}

function mapRelatedSites(
  sites: readonly { label: string; url: string }[],
  nodeKey: string,
  diagnostics: LibraryGraphDiagnostic[]
): readonly RelatedSite[] {
  const result: RelatedSite[] = []
  const seen = new Set<string>()

  for (const site of sites) {
    const label = site.label.trim()
    const url = site.url.trim()
    if (!label || !url) {
      continue
    }

    try {
      void new URL(url)
    } catch {
      diagnostics.push(
        createVniteGraphDiagnostic({
          level: 'warning',
          code: 'vnite.url.invalid',
          message: 'Vnite 相关网站 URL 无法解析，已跳过。',
          nodeKey
        })
      )
      continue
    }

    const key = `${label}\u0000${url}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push({ label, url })
  }

  return result
}
