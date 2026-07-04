import type { VniteBackupGame } from '../backup/types'
import {
  createGraphNodeRef,
  createVniteGraphDiagnostic,
  createVniteMemoryNoteNodeKey,
  findVniteMemoryCoverAttachment,
  formatVniteTimestampForNoteName,
  getVniteMemoryInlineAttachments,
  parseVniteTimestamp,
  type VniteAttachmentPathResolver
} from '../mapping'
import { omitUndefined } from '../utils/object'
import type { VniteGraphBuildContext } from './context'
import { createUniqueNoteName } from './notes'
import { trimToUndefined } from './values'

export function addMemoryNoteItems(
  context: VniteGraphBuildContext,
  game: VniteBackupGame,
  mediaKey: string
): void {
  if (!context.selection.memories.notes) {
    return
  }

  const noteNames = new Map<string, number>()
  let order = 0
  for (const memory of Object.values(game.doc.memory.memoryList)) {
    const timestamp = parseVniteTimestamp(memory.date, {
      nodeKey: mediaKey,
      field: 'memory.memoryList.date'
    })
    context.graph.addDiagnostics(timestamp.diagnostics)

    const baseName =
      timestamp.value === undefined
        ? `Vnite 回忆 ${memory._id}`
        : `Vnite 回忆 ${formatVniteTimestampForNoteName(timestamp.value)}`
    const name = createUniqueNoteName(baseName, noteNames)
    const content = trimToUndefined(memory.note)
    const coverPath =
      context.selection.memories.noteImages && context.resolveAttachmentPath
        ? resolveMemoryCoverPath(context, game, memory._id, mediaKey, context.resolveAttachmentPath)
        : undefined

    if (!content && !coverPath) {
      context.graph.addDiagnostic(
        createVniteGraphDiagnostic({
          level: 'info',
          code: 'vnite.memory.empty',
          message: 'Vnite 回忆记录没有文字或图片，已跳过。',
          nodeKey: mediaKey
        })
      )
      continue
    }

    const noteKey = createVniteMemoryNoteNodeKey(game.id, memory._id)
    context.graph.addNoteNode({
      kind: 'note',
      key: noteKey,
      input: omitUndefined({
        name,
        content,
        coverPath,
        createdAt: timestamp.value,
        updatedAt: timestamp.value,
        order
      })
    })
    context.graph.addEdge({
      kind: 'media-note',
      from: createGraphNodeRef('media', mediaKey),
      to: createGraphNodeRef('note', noteKey)
    })
    order += 1
  }

  if (context.selection.memories.noteImages) {
    for (const attachment of getVniteMemoryInlineAttachments(game)) {
      context.graph.addDiagnostic(
        createVniteGraphDiagnostic({
          level: 'info',
          code: 'vnite.memory.inlineUnsupported',
          message: 'Vnite 回忆内联图片当前无法导入。',
          nodeKey: mediaKey
        })
      )
      void attachment
    }
  }
}

function resolveMemoryCoverPath(
  context: VniteGraphBuildContext,
  game: VniteBackupGame,
  memoryId: string,
  mediaKey: string,
  resolveAttachmentPath: VniteAttachmentPathResolver
): string | undefined {
  const attachment = findVniteMemoryCoverAttachment(game, memoryId)
  if (!attachment) {
    return undefined
  }

  const sourcePath = resolveAttachmentPath({ gameId: game.id, attachmentId: attachment.id })
  if (!sourcePath) {
    context.graph.addDiagnostic(
      createVniteGraphDiagnostic({
        level: 'warning',
        code: 'vnite.attachment.pathMissing',
        message: 'Vnite 回忆图片尚未导出到临时目录，已跳过该图片。',
        nodeKey: mediaKey
      })
    )
  }

  return sourcePath
}
