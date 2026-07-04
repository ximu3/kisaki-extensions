import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  ExtensionLogger,
  LibraryGraphCapability,
  LibraryGraphConflictMode,
  LibraryGraphInput,
  LibraryGraphResult
} from '@kisaki3/extension-api'
import { VnitePouchStore } from '../backup/pouch'
import type {
  VniteBackupGame,
  VniteBackupSnapshot,
  VniteBackupWorkspace,
  VniteImportDiagnostic
} from '../backup/types'
import { VniteImportError, toSafeErrorMessage } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import { assertInsidePath, toSafeFileName } from '../utils/path'
import {
  createVniteAttachmentPathKey,
  createVniteGameNodeKey,
  findVniteMediaAttachment,
  findVniteMemoryCoverAttachment,
  findVniteSaveArchiveAttachment,
  getVniteDescriptionImageAttachments,
  toLibraryGraphDiagnostic
} from '../mapping'
import type { VniteAttachmentMetadata } from '../vnite/attachments'
import { buildVniteLibraryGraph } from './builder'
import type {
  PartialVniteImportFieldSelection,
  VniteImportFieldSelection
} from '../../shared/import-wizard'
import { mergeVniteImportFieldSelection } from './options'
import { createVniteImportExecutionSummary, type VniteImportExecutionSummary } from './summary'

export interface VniteImportExecutorDependencies {
  graph: LibraryGraphCapability
  logger?: ExtensionLogger
}

export interface ExecuteVniteImportGraphInput {
  snapshot: VniteBackupSnapshot
  workspace: Pick<VniteBackupWorkspace, 'attachmentsPath'>
  requestId?: string
  fieldSelection?: PartialVniteImportFieldSelection
  conflictMode?: LibraryGraphConflictMode
  strictAttachments?: boolean
  signal?: AbortSignal
  checkpoint?: () => Promise<void>
  reportAttachmentProgress?: (progress: VniteAttachmentExportProgress) => Promise<void> | void
  beforeGraphCall?: (mode: 'preview' | 'apply', graph: LibraryGraphInput) => Promise<void> | void
}

export interface VniteAttachmentExportProgress {
  current: number
  total: number
}

export interface VniteExportedAttachment {
  gameId: string
  attachmentId: string
  path: string
  sizeBytes: number
}

export interface VniteAttachmentExportResult {
  exported: readonly VniteExportedAttachment[]
  diagnostics: readonly VniteImportDiagnostic[]
  resolvePath(gameId: string, attachmentId: string): string | undefined
}

export interface VniteImportExecutorResult {
  graph: LibraryGraphResult
  summary: VniteImportExecutionSummary
  exportedAttachments: readonly VniteExportedAttachment[]
}

interface RequiredVniteAttachment {
  game: VniteBackupGame
  attachment: VniteAttachmentMetadata
}

export class VniteImportExecutor {
  constructor(private readonly deps: VniteImportExecutorDependencies) {}

  async preview(input: ExecuteVniteImportGraphInput): Promise<VniteImportExecutorResult> {
    return await this.execute('preview', input)
  }

  async apply(input: ExecuteVniteImportGraphInput): Promise<VniteImportExecutorResult> {
    return await this.execute('apply', input)
  }

  async exportAttachments(
    input: ExecuteVniteImportGraphInput
  ): Promise<VniteAttachmentExportResult> {
    const selection = mergeVniteImportFieldSelection(input.fieldSelection)
    const required = collectRequiredAttachments(input.snapshot, selection)
    const paths = new Map<string, string>()
    const exported: VniteExportedAttachment[] = []
    const diagnostics: VniteImportDiagnostic[] = []
    const store = new VnitePouchStore(input.snapshot.rootPath)
    const attachmentsRoot = path.resolve(input.workspace.attachmentsPath)

    await mkdir(attachmentsRoot, { recursive: true })

    for (const [index, item] of required.entries()) {
      await checkpoint(input)

      try {
        const targetPath = createExportedAttachmentPath({
          attachmentsRoot,
          gameId: item.game.id,
          attachmentId: item.attachment.id
        })
        assertInsidePath(targetPath, attachmentsRoot)

        const buffer = await store.getAttachment('game', item.game.id, item.attachment.id)
        await mkdir(path.dirname(targetPath), { recursive: true })
        await writeFile(targetPath, new Uint8Array(buffer))

        paths.set(createVniteAttachmentPathKey(item.game.id, item.attachment.id), targetPath)
        exported.push({
          gameId: item.game.id,
          attachmentId: item.attachment.id,
          path: targetPath,
          sizeBytes: buffer.byteLength
        })
      } catch (error) {
        diagnostics.push(createAttachmentExportDiagnostic(item, error))
        this.deps.logger?.warn('Vnite attachment export failed.', toSafeAttachmentLog(item, error))
      } finally {
        await input.reportAttachmentProgress?.({
          current: index + 1,
          total: required.length
        })
      }
    }

    return {
      exported,
      diagnostics,
      resolvePath(gameId, attachmentId) {
        return paths.get(createVniteAttachmentPathKey(gameId, attachmentId))
      }
    }
  }

  private async execute(
    mode: 'preview' | 'apply',
    input: ExecuteVniteImportGraphInput
  ): Promise<VniteImportExecutorResult> {
    await checkpoint(input)
    const attachmentExport = await this.exportAttachments(input)
    await checkpoint(input)

    const graph = createGraphInput(input, attachmentExport)
    await input.beforeGraphCall?.(mode, graph)
    await checkpoint(input)

    const result =
      mode === 'preview' ? await this.deps.graph.preview(graph) : await this.deps.graph.apply(graph)
    const summary = createVniteImportExecutionSummary({
      graph: result,
      snapshot: input.snapshot
    })

    return {
      graph: result,
      summary,
      exportedAttachments: attachmentExport.exported
    }
  }
}

function createGraphInput(
  input: ExecuteVniteImportGraphInput,
  attachmentExport: VniteAttachmentExportResult
): LibraryGraphInput {
  const graph = buildVniteLibraryGraph(
    omitUndefined({
      snapshot: input.snapshot,
      requestId: input.requestId,
      fieldSelection: input.fieldSelection,
      conflictMode: input.conflictMode,
      strictAttachments: input.strictAttachments,
      resolveAttachmentPath: (request: { gameId: string; attachmentId: string }) =>
        attachmentExport.resolvePath(request.gameId, request.attachmentId)
    })
  )

  return {
    ...graph,
    diagnostics: [
      ...(graph.diagnostics ?? []),
      ...attachmentExport.diagnostics.map(toLibraryGraphDiagnostic)
    ]
  }
}

function collectRequiredAttachments(
  snapshot: VniteBackupSnapshot,
  selection: VniteImportFieldSelection
): readonly RequiredVniteAttachment[] {
  const items: RequiredVniteAttachment[] = []
  const seen = new Set<string>()

  for (const game of snapshot.games) {
    const add = (attachment: VniteAttachmentMetadata | undefined) => {
      if (!attachment) {
        return
      }

      const key = createVniteAttachmentPathKey(game.id, attachment.id)
      if (seen.has(key)) {
        return
      }

      seen.add(key)
      items.push({ game, attachment })
    }

    if (selection.media.cover) {
      add(findVniteMediaAttachment(game, 'cover'))
    }
    if (selection.media.backdrop) {
      add(findVniteMediaAttachment(game, 'backdrop'))
    }
    if (selection.media.logo) {
      add(findVniteMediaAttachment(game, 'logo'))
    }
    if (selection.media.icon) {
      add(findVniteMediaAttachment(game, 'icon'))
    }
    if (selection.media.descriptionImages) {
      for (const attachment of getVniteDescriptionImageAttachments(game)) {
        add(attachment)
      }
    }
    if (selection.memories.notes && selection.memories.noteImages) {
      for (const memory of Object.values(game.doc.memory.memoryList)) {
        add(findVniteMemoryCoverAttachment(game, memory._id))
      }
    }
    if (selection.saves.saveBackups) {
      for (const save of Object.values(game.doc.save.saveList)) {
        add(findVniteSaveArchiveAttachment(game, save._id))
      }
    }
  }

  return items
}

function createExportedAttachmentPath(input: {
  attachmentsRoot: string
  gameId: string
  attachmentId: string
}): string {
  const gameDirName = toSafeFileName(input.gameId, 'game')
  const attachmentName = input.attachmentId.split('/').at(-1) ?? 'attachment'
  const safeAttachmentName = toSafeFileName(attachmentName, 'attachment')
  const digest = createHash('sha256').update(input.attachmentId).digest('hex').slice(0, 12)

  return path.resolve(input.attachmentsRoot, gameDirName, `${digest}-${safeAttachmentName}`)
}

async function checkpoint(input: Pick<ExecuteVniteImportGraphInput, 'checkpoint' | 'signal'>) {
  if (input.signal?.aborted) {
    throw new VniteImportError('job_cancelled', 'Vnite 导入已取消。')
  }

  await input.checkpoint?.()

  if (input.signal?.aborted) {
    throw new VniteImportError('job_cancelled', 'Vnite 导入已取消。')
  }
}

function createAttachmentExportDiagnostic(
  item: RequiredVniteAttachment,
  error: unknown
): VniteImportDiagnostic {
  void error

  return {
    level: 'warning',
    code: 'vnite.attachment.exportFailed',
    message: 'Vnite 附件导出失败，已跳过该附件。',
    itemKey: createVniteGameNodeKey(item.game.id),
    vniteGameId: item.game.id,
    vniteGameName:
      item.game.doc.metadata.name || item.game.doc.metadata.originalName || item.game.id,
    dbName: 'game',
    docId: item.game.id,
    attachmentId: item.attachment.id
  }
}

function toSafeAttachmentLog(
  item: RequiredVniteAttachment,
  error: unknown
): Record<string, unknown> {
  return {
    code: error instanceof VniteImportError ? error.code : 'attachment_export_failed',
    gameId: item.game.id,
    attachmentId: item.attachment.id,
    message: toSafeErrorMessage(error)
  }
}
