import type {
  LibraryGraphAttachmentSlot,
  LibraryGraphSaveBackupInput
} from '@kisaki3/extension-api'
import type { VniteBackupGame } from '../backup/types'
import type { VniteAttachmentMetadata } from '../vnite/attachments'
import type { VniteSaveEntry } from '../vnite/models'
import {
  createVniteAttachmentNode,
  createVniteAttachmentNodeKey,
  createVniteGraphDiagnostic,
  createVniteMediaAttachmentEdge,
  findVniteMediaAttachment,
  findVniteSaveArchiveAttachment,
  getVniteDescriptionImageAttachments,
  parseVniteTimestamp
} from '../mapping'
import type { VniteGraphBuildContext } from './context'

export function addMediaAttachmentItems(
  context: VniteGraphBuildContext,
  game: VniteBackupGame,
  mediaKey: string
): void {
  const selectedSlots = [
    ['cover', context.selection.media.cover],
    ['backdrop', context.selection.media.backdrop],
    ['logo', context.selection.media.logo],
    ['icon', context.selection.media.icon]
  ] as const

  for (const [slot, enabled] of selectedSlots) {
    if (!enabled) {
      continue
    }

    const attachment = findVniteMediaAttachment(game, slot)
    if (!attachment) {
      continue
    }
    addAttachmentEdge(context, game.id, mediaKey, attachment, slot)
  }

  if (context.selection.media.descriptionImages) {
    for (const attachment of getVniteDescriptionImageAttachments(game)) {
      addAttachmentEdge(context, game.id, mediaKey, attachment, 'description-inline')
    }
  }

  if (game.attachmentIds.includes('images/wideCover.webp')) {
    context.graph.addDiagnostic(
      createVniteGraphDiagnostic({
        level: 'info',
        code: 'vnite.media.wideCoverUnsupported',
        message: 'Vnite 宽封面附件当前不会导入。',
        nodeKey: mediaKey
      })
    )
  }
}

export function addSaveBackupAttachmentItems(
  context: VniteGraphBuildContext,
  game: VniteBackupGame,
  mediaKey: string
): void {
  if (!context.selection.saves.saveBackups) {
    for (const save of Object.values(game.doc.save.saveList)) {
      if (!findVniteSaveArchiveAttachment(game, save._id)) {
        addMissingSaveAttachmentDiagnostic(context, mediaKey, save)
      }
    }
    return
  }

  for (const save of Object.values(game.doc.save.saveList)) {
    const backupAt = parseVniteTimestamp(save.date, {
      nodeKey: mediaKey,
      field: 'save.saveList.date'
    })
    context.graph.addDiagnostics(backupAt.diagnostics)

    if (backupAt.value === undefined) {
      continue
    }

    const attachment = findVniteSaveArchiveAttachment(game, save._id)
    if (!attachment) {
      addMissingSaveAttachmentDiagnostic(context, mediaKey, save)
      continue
    }

    addAttachmentEdge(context, game.id, mediaKey, attachment, 'save-backup', {
      backupAt: backupAt.value,
      note: save.note,
      locked: save.locked
    })
  }
}

function addAttachmentEdge(
  context: VniteGraphBuildContext,
  gameId: string,
  mediaKey: string,
  attachment: VniteAttachmentMetadata,
  slot: LibraryGraphAttachmentSlot,
  saveBackup?: LibraryGraphSaveBackupInput
): void {
  const attachmentPath = context.resolveAttachmentPath?.({ gameId, attachmentId: attachment.id })
  if (!attachmentPath) {
    context.graph.addDiagnostic(
      createVniteGraphDiagnostic({
        level: 'warning',
        code: 'vnite.attachment.pathMissing',
        message: 'Vnite 附件尚未导出到临时目录，已跳过该附件节点。',
        nodeKey: mediaKey,
        edgeKind: 'media-attachment'
      })
    )
    return
  }

  const attachmentKey = createVniteAttachmentNodeKey(gameId, attachment.id)
  context.graph.addAttachmentNode(
    createVniteAttachmentNode({
      key: attachmentKey,
      attachment,
      sourcePath: attachmentPath
    })
  )
  context.graph.addEdge(
    createVniteMediaAttachmentEdge({
      mediaKey,
      attachmentKey,
      slot,
      saveBackup
    })
  )
}

function addMissingSaveAttachmentDiagnostic(
  context: VniteGraphBuildContext,
  nodeKey: string,
  save: VniteSaveEntry
): void {
  context.graph.addDiagnostic(
    createVniteGraphDiagnostic({
      level: 'warning',
      code: 'vnite.save.attachmentMissing',
      message: 'Vnite 存档记录缺少对应备份附件，导入时会跳过该存档文件。',
      nodeKey,
      edgeKind: 'media-attachment'
    })
  )
  void save
}
