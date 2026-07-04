import type { VniteBackupSnapshot } from '../backup/types'
import {
  createGraphNodeRef,
  createVniteCollectionNodeKey,
  createVniteGraphDiagnostic
} from '../mapping'
import type { VniteGraphBuildAccumulator } from './accumulator'
import { trimToUndefined } from './values'

export function addCollectionGraphItems(
  graph: VniteGraphBuildAccumulator,
  snapshot: VniteBackupSnapshot
): void {
  for (const collection of snapshot.collections) {
    const name = trimToUndefined(collection.doc.name) ?? collection.id
    const collectionKey = createVniteCollectionNodeKey(collection.id)
    graph.addCollectionNode({
      kind: 'collection',
      key: collectionKey,
      input: {
        name,
        order: Number.isFinite(collection.doc.sort) ? collection.doc.sort : 0,
        isDynamic: false
      }
    })

    if (collection.doc.sortBy !== 'custom') {
      graph.addDiagnostic(
        createVniteGraphDiagnostic({
          level: 'info',
          code: 'vnite.collection.sortUnsupported',
          message: 'Vnite 合集排序规则当前无法导入，已保留成员顺序。',
          nodeKey: collectionKey
        })
      )
    }

    for (const [order, gameId] of collection.doc.games.entries()) {
      const gameKey = graph.getMediaKey(gameId)
      if (!gameKey) {
        graph.addDiagnostic(
          createVniteGraphDiagnostic({
            level: 'warning',
            code: 'vnite.collection.memberMissing',
            message: 'Vnite 合集成员未在当前导入图中找到，已跳过该成员关系。',
            nodeKey: collectionKey,
            edgeKind: 'collection-media'
          })
        )
        continue
      }

      graph.addEdge({
        kind: 'collection-media',
        from: createGraphNodeRef('collection', collectionKey),
        to: createGraphNodeRef('media', gameKey),
        order
      })
    }
  }
}
