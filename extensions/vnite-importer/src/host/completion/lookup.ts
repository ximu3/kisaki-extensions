import type { IngestUpdateLookup } from '@kisaki3/extension-sdk'
import type { VniteBackupGame } from '../backup/types'
import { VNITE_EXTERNAL_ID_SOURCE, mapVniteExternalIds } from '../mapping'

const COMPLETION_EXTERNAL_ID_PRIORITY = ['steam', 'vndb', 'igdb', 'ymgal'] as const

export function createVniteCompletionLookup(game: VniteBackupGame): IngestUpdateLookup {
  return {
    name: game.doc.metadata.name || game.doc.metadata.originalName || game.id,
    knownIds: mapVniteExternalIds(game, { includeMetadataIds: true })
      .filter((externalId) => externalId.source !== VNITE_EXTERNAL_ID_SOURCE)
      .sort((left, right) => getExternalIdOrder(left.source) - getExternalIdOrder(right.source))
  }
}

function getExternalIdOrder(source: string): number {
  const index = COMPLETION_EXTERNAL_ID_PRIORITY.indexOf(
    source as (typeof COMPLETION_EXTERNAL_ID_PRIORITY)[number]
  )
  return index >= 0 ? index : COMPLETION_EXTERNAL_ID_PRIORITY.length
}
