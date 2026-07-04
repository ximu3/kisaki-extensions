import type { LibraryGraphMediaNode } from '@kisaki3/extension-api'
import type { VniteBackupGame } from '../backup/types'
import { createVniteGameNodeKey } from '../mapping'
import { addMediaAttachmentItems, addSaveBackupAttachmentItems } from './attachments'
import type { VniteGraphBuildContext } from './context'
import { addCreditItems } from './credits'
import { buildGameInput } from './game-input'
import { addMemoryNoteItems } from './memories'
import { addOrganizationItems } from './organization'
import { addSessionItems } from './sessions'

export function addGameGraphItems(context: VniteGraphBuildContext, game: VniteBackupGame): void {
  const mediaKey = createVniteGameNodeKey(game.id)
  const gameInput = buildGameInput(game, context.selection, mediaKey)
  const mediaNode: LibraryGraphMediaNode = {
    kind: 'media',
    mediaType: 'game',
    key: mediaKey,
    input: gameInput.input
  }

  if (!context.graph.addMediaNode(mediaNode, game.id)) {
    return
  }
  context.graph.addDiagnostics(gameInput.diagnostics)

  addOrganizationItems(context, game, mediaKey)
  addCreditItems(context, game, mediaKey)
  addSessionItems(context, game, mediaKey)
  addMemoryNoteItems(context, game, mediaKey)
  addMediaAttachmentItems(context, game, mediaKey)
  addSaveBackupAttachmentItems(context, game, mediaKey)
}
