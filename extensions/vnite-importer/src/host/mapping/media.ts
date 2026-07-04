import path from 'node:path'
import type {
  LibraryGraphAttachmentNode,
  LibraryGraphMediaAttachmentEdge,
  LibraryGraphAttachmentSlot
} from '@kisaki3/extension-api'
import type { VniteAttachmentMetadata } from '../vnite/attachments'
import type { VniteBackupGame } from '../backup/types'
import { omitUndefined } from '../utils/object'
import { toSafeFileName } from '../utils/path'

export interface VniteAttachmentPathRequest {
  gameId: string
  attachmentId: string
}

export type VniteAttachmentPathResolver = (
  request: VniteAttachmentPathRequest
) => string | undefined

export interface VniteMappedAttachmentEdge {
  node: LibraryGraphAttachmentNode
  edge: LibraryGraphMediaAttachmentEdge
}

export function createVniteAttachmentPathKey(gameId: string, attachmentId: string): string {
  return `${gameId}\u0000${attachmentId}`
}

export function createVniteAttachmentNode(input: {
  key: string
  attachment: VniteAttachmentMetadata
  sourcePath: string
}): LibraryGraphAttachmentNode {
  return omitUndefined({
    kind: 'attachment',
    key: input.key,
    path: input.sourcePath,
    fileName: toVniteAttachmentFileName(input.attachment),
    contentType: input.attachment.contentType
  })
}

export function createVniteMediaAttachmentEdge(input: {
  mediaKey: string
  attachmentKey: string
  slot: LibraryGraphAttachmentSlot
  saveBackup?: LibraryGraphMediaAttachmentEdge['saveBackup']
}): LibraryGraphMediaAttachmentEdge {
  return omitUndefined({
    kind: 'media-attachment',
    from: { kind: 'media', key: input.mediaKey },
    to: { kind: 'attachment', key: input.attachmentKey },
    slot: input.slot,
    saveBackup: input.saveBackup
  })
}

export function findVniteMediaAttachment(
  game: Pick<VniteBackupGame, 'attachments'>,
  slot: 'cover' | 'backdrop' | 'logo' | 'icon'
): VniteAttachmentMetadata | undefined {
  return game.attachments.find(
    (attachment) => attachment.category === 'media' && attachment.slot === slot
  )
}

export function findVniteMemoryCoverAttachment(
  game: Pick<VniteBackupGame, 'attachments'>,
  memoryId: string
): VniteAttachmentMetadata | undefined {
  return game.attachments.find(
    (attachment) => attachment.category === 'memory-cover' && attachment.memoryId === memoryId
  )
}

export function findVniteSaveArchiveAttachment(
  game: Pick<VniteBackupGame, 'attachments'>,
  saveId: string
): VniteAttachmentMetadata | undefined {
  return game.attachments.find(
    (attachment) => attachment.category === 'save-archive' && attachment.saveId === saveId
  )
}

export function getVniteDescriptionImageAttachments(
  game: Pick<VniteBackupGame, 'attachments'>
): readonly VniteAttachmentMetadata[] {
  return game.attachments.filter((attachment) => attachment.category === 'description-image')
}

export function getVniteMemoryInlineAttachments(
  game: Pick<VniteBackupGame, 'attachments'>
): readonly VniteAttachmentMetadata[] {
  return game.attachments.filter((attachment) => attachment.category === 'memory-inline')
}

export function toVniteAttachmentFileName(attachment: VniteAttachmentMetadata): string {
  const baseName = attachment.id.split('/').at(-1) ?? path.basename(attachment.id)
  return toSafeFileName(baseName, 'attachment')
}
