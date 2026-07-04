import type { ExternalId } from '@kisaki3/extension-api'
import type { VniteBackupGame } from '../backup/types'

export const VNITE_EXTERNAL_ID_SOURCE = 'vnite'

export interface MapVniteExternalIdsOptions {
  includeMetadataIds: boolean
}

export function mapVniteExternalIds(
  game: Pick<VniteBackupGame, 'id' | 'doc'>,
  options: MapVniteExternalIdsOptions
): readonly ExternalId[] {
  const metadata = game.doc.metadata
  const ids: ExternalId[] = [{ source: VNITE_EXTERNAL_ID_SOURCE, id: game.id }]

  if (options.includeMetadataIds) {
    pushExternalId(ids, 'steam', metadata.steamId)
    pushExternalId(ids, 'vndb', metadata.vndbId)
    pushExternalId(ids, 'igdb', metadata.igdbId)
    pushExternalId(ids, 'ymgal', metadata.ymgalId)
  }

  return dedupeExternalIds(ids)
}

function pushExternalId(ids: ExternalId[], source: string, value: string): void {
  const id = value.trim()
  if (id) {
    ids.push({ source, id })
  }
}

function dedupeExternalIds(ids: readonly ExternalId[]): readonly ExternalId[] {
  const seen = new Set<string>()
  const result: ExternalId[] = []

  for (const externalId of ids) {
    const source = externalId.source.trim()
    const id = externalId.id.trim()
    if (!source || !id) {
      continue
    }

    const key = `${source}\u0000${id}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push({ source, id })
  }

  return result
}
