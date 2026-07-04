import { classifyVniteAttachment, VNITE_MEDIA_ATTACHMENT_IDS } from './attachments'
import type {
  NormalizedVniteCollection,
  NormalizedVniteGame,
  NormalizedVniteGameLocal,
  VniteLauncherMode,
  VnitePlayStatus
} from './models'

export interface VniteBackupStatistics {
  games: {
    total: number
    withGamePath: number
    withMarkPathOnly: number
    withLastRunDate: number
    withPlayTime: number
    withTimers: number
    withScore: number
    withMemoryList: number
    withSaveList: number
    withAnyAttachment: number
  }
  gameLocals: {
    total: number
    withMultipleSavePaths: number
  }
  collections: {
    total: number
    memberLinks: number
  }
  statusDistribution: Record<VnitePlayStatus | 'unknown', number>
  launcherModeDistribution: Record<VniteLauncherMode | 'missing' | 'unknown', number>
  externalIds: {
    steam: number
    vndb: number
    igdb: number
    ymgal: number
  }
  attachments: {
    total: number
    cover: number
    backdrop: number
    logo: number
    icon: number
    memoryImages: number
    saveArchives: number
    descriptionImages: number
    wideCover: number
  }
}

export function createVniteBackupStatistics(input: {
  games: readonly NormalizedVniteGame[]
  gameLocals: readonly NormalizedVniteGameLocal[]
  collections: readonly NormalizedVniteCollection[]
}): VniteBackupStatistics {
  const localById = new Map(input.gameLocals.map((local) => [local.id, local]))
  const statusDistribution = createStatusDistribution()
  const launcherModeDistribution = createLauncherModeDistribution()
  const statistics: VniteBackupStatistics = {
    games: {
      total: input.games.length,
      withGamePath: 0,
      withMarkPathOnly: 0,
      withLastRunDate: 0,
      withPlayTime: 0,
      withTimers: 0,
      withScore: 0,
      withMemoryList: 0,
      withSaveList: 0,
      withAnyAttachment: 0
    },
    gameLocals: {
      total: input.gameLocals.length,
      withMultipleSavePaths: input.gameLocals.filter((local) => local.doc.path.savePaths.length > 1)
        .length
    },
    collections: {
      total: input.collections.length,
      memberLinks: input.collections.reduce(
        (sum, collection) => sum + collection.doc.games.length,
        0
      )
    },
    statusDistribution,
    launcherModeDistribution,
    externalIds: {
      steam: 0,
      vndb: 0,
      igdb: 0,
      ymgal: 0
    },
    attachments: {
      total: 0,
      cover: 0,
      backdrop: 0,
      logo: 0,
      icon: 0,
      memoryImages: 0,
      saveArchives: 0,
      descriptionImages: 0,
      wideCover: 0
    }
  }

  for (const game of input.games) {
    const local = localById.get(game.id)
    const record = game.doc.record
    const metadata = game.doc.metadata
    const hasGamePath = Boolean(local?.doc.path.gamePath)
    const hasMarkPathOnly = !hasGamePath && Boolean(local?.doc.utils.markPath)

    statistics.statusDistribution[record.playStatus] += 1
    statistics.launcherModeDistribution[local?.doc.launcher.mode ?? 'missing'] += 1
    statistics.games.withGamePath += hasGamePath ? 1 : 0
    statistics.games.withMarkPathOnly += hasMarkPathOnly ? 1 : 0
    statistics.games.withLastRunDate += record.lastRunDate ? 1 : 0
    statistics.games.withPlayTime += record.playTime > 0 ? 1 : 0
    statistics.games.withTimers += record.timers.length > 0 ? 1 : 0
    statistics.games.withScore += record.score >= 0 ? 1 : 0
    statistics.games.withMemoryList += Object.keys(game.doc.memory.memoryList).length > 0 ? 1 : 0
    statistics.games.withSaveList += Object.keys(game.doc.save.saveList).length > 0 ? 1 : 0
    statistics.games.withAnyAttachment += game.attachmentIds.length > 0 ? 1 : 0
    statistics.externalIds.steam += metadata.steamId ? 1 : 0
    statistics.externalIds.vndb += metadata.vndbId ? 1 : 0
    statistics.externalIds.igdb += metadata.igdbId ? 1 : 0
    statistics.externalIds.ymgal += metadata.ymgalId ? 1 : 0

    addAttachmentStatistics(statistics, game.attachmentIds)
  }

  return statistics
}

function addAttachmentStatistics(
  statistics: VniteBackupStatistics,
  attachmentIds: readonly string[]
): void {
  for (const id of attachmentIds) {
    const attachment = classifyVniteAttachment(id)
    statistics.attachments.total += 1

    if (attachment.slot) {
      statistics.attachments[attachment.slot] += 1
    }

    if (attachment.category === 'memory-cover' || attachment.category === 'memory-inline') {
      statistics.attachments.memoryImages += 1
    }

    if (attachment.category === 'save-archive') {
      statistics.attachments.saveArchives += 1
    }

    if (attachment.category === 'description-image') {
      statistics.attachments.descriptionImages += 1
    }

    if (id === VNITE_MEDIA_ATTACHMENT_IDS.wideCover) {
      statistics.attachments.wideCover += 1
    }
  }
}

function createStatusDistribution(): Record<VnitePlayStatus | 'unknown', number> {
  return {
    unplayed: 0,
    playing: 0,
    partial: 0,
    finished: 0,
    multiple: 0,
    shelved: 0,
    unknown: 0
  }
}

function createLauncherModeDistribution(): Record<
  VniteLauncherMode | 'missing' | 'unknown',
  number
> {
  return {
    file: 0,
    url: 0,
    script: 0,
    missing: 0,
    unknown: 0
  }
}
