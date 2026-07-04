import type {
  ExtensionLogger,
  GameUpdateSurface,
  IngestCapability,
  LibraryGraphNodeResult,
  LibraryGraphResult,
  ScraperProfilesCapability
} from '@kisaki3/extension-sdk'
import type { VniteBackupGame, VniteBackupSnapshot, VniteImportDiagnostic } from '../backup/types'
import { createVniteGameNodeKey } from '../mapping'
import { VniteImportError, toSafeErrorMessage } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import { createVniteCompletionLookup } from './lookup'
import {
  createEmptyVniteMetadataCompletionSummary,
  type VniteMetadataCompletionSummary
} from './summary'

export interface VniteMetadataCompletionRunnerDependencies {
  ingest?: IngestCapability
  profiles?: ScraperProfilesCapability
  logger?: ExtensionLogger
}

export interface RunVniteMetadataCompletionInput {
  graph: LibraryGraphResult
  snapshot: VniteBackupSnapshot
  profileId?: string
  surfaces: readonly GameUpdateSurface[]
  signal?: AbortSignal
  checkpoint?: () => Promise<void>
  reportProgress?: (progress: { current: number; total: number }) => Promise<void> | void
}

export class VniteMetadataCompletionRunner {
  constructor(private readonly deps: VniteMetadataCompletionRunnerDependencies) {}

  async run(input: RunVniteMetadataCompletionInput): Promise<VniteMetadataCompletionSummary> {
    if (!input.profileId) {
      return createSkippedSummary('scraper_profile_missing', '未选择刮削配置，已跳过补全。')
    }

    if (!this.deps.ingest || !this.deps.profiles) {
      return createSkippedSummary('metadata_completion_failed', '补全能力不可用，已跳过补全。')
    }

    const profile = await this.deps.profiles.get(input.profileId)
    if (!profile) {
      return createSkippedSummary('scraper_profile_missing', '刮削配置不可用，已跳过补全。')
    }

    const gamesByKey = createGameMap(input.snapshot)
    const candidates = getCompletionCandidates(input.graph)
    const diagnostics: VniteImportDiagnostic[] = []
    let completed = 0
    let failed = 0

    for (const [index, node] of candidates.entries()) {
      await checkpoint(input)
      const game = gamesByKey.get(node.key)
      if (!game || !node.entityId) {
        continue
      }

      try {
        const result = await this.deps.ingest.game.update.fromScraper(
          {
            rootId: node.entityId,
            profileId: input.profileId,
            lookup: createVniteCompletionLookup(game),
            selection: {
              surfaces: input.surfaces
            },
            policy: {
              singularUpdate: 'ifMissing',
              collectionUpdate: 'merge'
            }
          },
          { taskRun: false }
        )
        completed += 1
        diagnostics.push(...toIngestWarningDiagnostics(result.warnings ?? [], game, node.entityId))
      } catch (error) {
        failed += 1
        diagnostics.push(createCompletionFailureDiagnostic(game, node.entityId, error))
        this.deps.logger?.warn(
          'Vnite metadata completion failed.',
          toSafeCompletionLog(game, error)
        )
      } finally {
        await input.reportProgress?.({
          current: index + 1,
          total: candidates.length
        })
      }
    }

    return {
      completed,
      failed,
      skipped: input.graph.nodes.filter((node) => isGameNode(node)).length - candidates.length,
      diagnostics
    }
  }
}

function createGameMap(snapshot: VniteBackupSnapshot): Map<string, VniteBackupGame> {
  return new Map(snapshot.games.map((game) => [createVniteGameNodeKey(game.id), game]))
}

function getCompletionCandidates(graph: LibraryGraphResult): readonly LibraryGraphNodeResult[] {
  return graph.nodes.filter(
    (node) =>
      isGameNode(node) && !!node.entityId && (node.action === 'create' || node.action === 'update')
  )
}

function isGameNode(node: LibraryGraphNodeResult): boolean {
  return node.kind === 'media' && node.mediaType === 'game'
}

async function checkpoint(input: Pick<RunVniteMetadataCompletionInput, 'checkpoint' | 'signal'>) {
  if (input.signal?.aborted) {
    throw new VniteImportError('job_cancelled', 'Vnite 导入已取消。')
  }

  await input.checkpoint?.()

  if (input.signal?.aborted) {
    throw new VniteImportError('job_cancelled', 'Vnite 导入已取消。')
  }
}

function createSkippedSummary(code: string, message: string): VniteMetadataCompletionSummary {
  return {
    ...createEmptyVniteMetadataCompletionSummary(),
    diagnostics: [
      {
        level: 'warning',
        code,
        message
      }
    ]
  }
}

function toIngestWarningDiagnostics(
  warnings: readonly { code?: string; message: string }[],
  game: VniteBackupGame,
  targetGameId: string
): readonly VniteImportDiagnostic[] {
  return warnings.map((warning) => ({
    level: 'warning',
    code: warning.code ? `vnite.completion.${warning.code}` : 'metadata_completion_failed',
    message: warning.message || '补全元数据返回警告。',
    itemKey: createVniteGameNodeKey(game.id),
    vniteGameId: game.id,
    vniteGameName: readGameName(game),
    targetGameId
  }))
}

function createCompletionFailureDiagnostic(
  game: VniteBackupGame,
  targetGameId: string | undefined,
  error: unknown
): VniteImportDiagnostic {
  void error
  return omitUndefined({
    level: 'warning',
    code: 'metadata_completion_failed',
    message: '补全元数据失败，已保留直接导入结果。',
    itemKey: createVniteGameNodeKey(game.id),
    vniteGameId: game.id,
    vniteGameName: readGameName(game),
    targetGameId
  })
}

function readGameName(game: VniteBackupGame): string {
  return game.doc.metadata.name || game.doc.metadata.originalName || game.id
}

function toSafeCompletionLog(game: VniteBackupGame, error: unknown): Record<string, unknown> {
  return {
    gameId: game.id,
    message: toSafeErrorMessage(error)
  }
}
