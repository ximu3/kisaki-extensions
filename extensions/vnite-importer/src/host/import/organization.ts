import type { VniteBackupGame } from '../backup/types'
import { createGraphNodeRef, createVniteTagNodeKey, mapVniteTags } from '../mapping'
import type { VniteGraphBuildContext } from './context'

export function addOrganizationItems(
  context: VniteGraphBuildContext,
  game: VniteBackupGame,
  mediaKey: string
): void {
  const tags = mapVniteTags(game.doc.metadata, {
    includeTags: context.selection.organization.tags,
    includeGenres: context.selection.organization.genresAsTags,
    includePlatforms: context.selection.organization.platformsAsTags,
    includeEngineExtras: context.selection.organization.tags
  })

  for (const [order, tag] of tags.entries()) {
    const tagKey = context.graph.addTagNode({
      kind: 'tag',
      key: createVniteTagNodeKey(tag.name),
      input: { name: tag.name }
    })
    context.graph.addEdge({
      kind: 'media-tag',
      from: createGraphNodeRef('media', mediaKey),
      to: createGraphNodeRef('tag', tagKey),
      order
    })
  }
}
