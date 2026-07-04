import { stat } from 'node:fs/promises'
import path from 'node:path'
import { VNITE_BACKUP_MAX_SIZE_BYTES, VNITE_BACKUP_DATABASE_NAMES } from '../utils/constants'
import { omitUndefined } from '../utils/object'
import { nowTimestamp } from '../utils/time'
import { VNITE_MEDIA_ATTACHMENT_IDS } from '../vnite/attachments'
import { createVniteBackupStatistics } from '../vnite/statistics'
import { extractVniteBackupArchive } from './archive'
import { VniteBackupReader } from './reader'
import { BackupWorkspaceManager } from './workspace'
import type {
  VniteBackupAnalysisResult,
  VniteBackupAnalysisSummary,
  VniteBackupSnapshot,
  VniteBackupWorkspace,
  VniteFieldCoverageSummary,
  VniteImportDiagnostic
} from './types'

export interface AnalyzeVniteBackupArchiveInput {
  archivePath: string
  workspaceRoot: string
  maxSizeBytes?: number
  keepWorkspace?: boolean
}

export async function analyzeVniteBackupArchive(
  input: AnalyzeVniteBackupArchiveInput
): Promise<VniteBackupAnalysisResult> {
  const workspaceManager = new BackupWorkspaceManager(input.workspaceRoot)
  const workspace = await workspaceManager.create({ purpose: 'analysis' })

  try {
    const extracted = await extractVniteBackupArchive({
      archivePath: input.archivePath,
      extractRoot: workspace.extractPath,
      maxSizeBytes: input.maxSizeBytes ?? VNITE_BACKUP_MAX_SIZE_BYTES
    })
    const snapshot = await new VniteBackupReader().read(extracted.backupRoot)
    const summary = await createVniteBackupAnalysisSummary(snapshot, {
      archivePath: input.archivePath,
      sizeBytes: extracted.sizeBytes
    })

    return { snapshot, summary, workspace }
  } finally {
    if (input.keepWorkspace === false) {
      await workspaceManager.cleanup(workspace)
    }
  }
}

export async function createVniteBackupAnalysisSummary(
  snapshot: VniteBackupSnapshot,
  file?: { archivePath: string; sizeBytes?: number }
): Promise<VniteBackupAnalysisSummary> {
  const statistics = createVniteBackupStatistics({
    games: snapshot.games,
    gameLocals: snapshot.gameLocals,
    collections: snapshot.collections
  })
  const diagnostics = [...snapshot.diagnostics, ...createAnalysisDiagnostics(snapshot)]

  return omitUndefined({
    createdAt: nowTimestamp(),
    file: file
      ? {
          name: path.basename(file.archivePath),
          sizeBytes: file.sizeBytes ?? (await stat(file.archivePath)).size
        }
      : undefined,
    statistics,
    fieldCoverage: createFieldCoverage(statistics.games.total, statistics),
    diagnostics
  })
}

export function createAnalysisDiagnostics(
  snapshot: Pick<VniteBackupSnapshot, 'games'>
): readonly VniteImportDiagnostic[] {
  const diagnostics: VniteImportDiagnostic[] = []

  for (const game of snapshot.games) {
    const attachmentIds = new Set(game.attachmentIds)
    const name = game.doc.metadata.name || game.doc.metadata.originalName || game.id

    if (attachmentIds.has(VNITE_MEDIA_ATTACHMENT_IDS.wideCover)) {
      diagnostics.push({
        level: 'info',
        code: 'vnite.media.wideCoverUnsupported',
        message: 'Vnite 宽封面附件当前不会导入。',
        itemKey: `vnite:game:${game.id}`,
        vniteGameId: game.id,
        vniteGameName: name,
        dbName: 'game',
        docId: game.id,
        attachmentId: VNITE_MEDIA_ATTACHMENT_IDS.wideCover
      })
    }

    for (const save of Object.values(game.doc.save.saveList)) {
      const attachmentId = `saves/${save._id}.zip`
      if (!attachmentIds.has(attachmentId)) {
        diagnostics.push({
          level: 'warning',
          code: 'vnite.save.attachmentMissing',
          message: 'Vnite 存档记录缺少对应备份附件，导入时会跳过该存档文件。',
          itemKey: `vnite:game:${game.id}`,
          vniteGameId: game.id,
          vniteGameName: name,
          dbName: 'game',
          docId: game.id,
          attachmentId
        })
      }
    }

    if (game.local && game.local.doc.path.savePaths.length > 1) {
      diagnostics.push({
        level: 'warning',
        code: 'vnite.save.multiplePaths',
        message: 'Vnite 游戏包含多个存档路径，Kisaki 当前只会导入第一项。',
        itemKey: `vnite:game:${game.id}`,
        vniteGameId: game.id,
        vniteGameName: name,
        dbName: 'game-local',
        docId: game.id
      })
    }
  }

  return diagnostics
}

function createFieldCoverage(
  gameTotal: number,
  statistics: Awaited<ReturnType<typeof createVniteBackupStatistics>>
): readonly VniteFieldCoverageSummary[] {
  return [
    {
      key: 'local.gamePath',
      label: '游戏路径',
      present: statistics.games.withGamePath,
      total: gameTotal
    },
    {
      key: 'activity.lastRunDate',
      label: '最后游玩时间',
      present: statistics.games.withLastRunDate,
      total: gameTotal
    },
    {
      key: 'activity.playTime',
      label: '游玩时长',
      present: statistics.games.withPlayTime,
      total: gameTotal
    },
    {
      key: 'activity.score',
      label: '评分',
      present: statistics.games.withScore,
      total: gameTotal
    },
    {
      key: 'media.cover',
      label: '封面',
      present: statistics.attachments.cover,
      total: gameTotal
    },
    {
      key: 'media.backdrop',
      label: '背景图',
      present: statistics.attachments.backdrop,
      total: gameTotal
    },
    {
      key: 'media.logo',
      label: 'Logo',
      present: statistics.attachments.logo,
      total: gameTotal
    },
    {
      key: 'media.icon',
      label: '图标',
      present: statistics.attachments.icon,
      total: gameTotal
    },
    {
      key: 'memories.notes',
      label: '回忆记录',
      present: statistics.games.withMemoryList,
      total: gameTotal
    },
    {
      key: 'saves.saveBackups',
      label: '存档记录',
      present: statistics.games.withSaveList,
      total: gameTotal
    }
  ]
}

export function getVniteBackupDatabaseNames(): readonly string[] {
  return VNITE_BACKUP_DATABASE_NAMES
}

export type { VniteBackupWorkspace }
