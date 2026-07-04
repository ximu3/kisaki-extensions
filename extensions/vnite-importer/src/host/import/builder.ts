import type { LibraryGraphConflictMode, LibraryGraphInput } from '@kisaki3/extension-api'
import type { VniteBackupSnapshot } from '../backup/types'
import { toLibraryGraphDiagnostic, type VniteAttachmentPathResolver } from '../mapping'
import { omitUndefined } from '../utils/object'
import { VniteGraphBuildAccumulator } from './accumulator'
import { addCollectionGraphItems } from './collections'
import { addGameGraphItems } from './game'
import type {
  PartialVniteImportFieldSelection,
  VniteImportFieldSelection
} from '../../shared/import-wizard'
import { DEFAULT_VNITE_IMPORT_GRAPH_OPTIONS, mergeVniteImportFieldSelection } from './options'

export interface BuildVniteLibraryGraphInput {
  snapshot: VniteBackupSnapshot
  requestId?: string
  fieldSelection?: PartialVniteImportFieldSelection
  conflictMode?: LibraryGraphConflictMode
  strictAttachments?: boolean
  resolveAttachmentPath?: VniteAttachmentPathResolver
  includeSnapshotDiagnostics?: boolean
}

export function buildVniteLibraryGraph(input: BuildVniteLibraryGraphInput): LibraryGraphInput {
  const selection = mergeVniteImportFieldSelection(input.fieldSelection)
  const graph = new VniteGraphBuildAccumulator()
  const context = omitUndefined({
    graph,
    selection,
    resolveAttachmentPath: input.resolveAttachmentPath
  })

  if (input.includeSnapshotDiagnostics !== false) {
    graph.addDiagnostics(input.snapshot.diagnostics.map(toLibraryGraphDiagnostic))
  }

  for (const game of input.snapshot.games) {
    addGameGraphItems(context, game)
  }

  if (selection.organization.collections) {
    addCollectionGraphItems(graph, input.snapshot)
  }

  return omitUndefined({
    requestId: input.requestId,
    options: {
      conflictMode: input.conflictMode ?? DEFAULT_VNITE_IMPORT_GRAPH_OPTIONS.conflictMode,
      strictAttachments:
        input.strictAttachments ?? DEFAULT_VNITE_IMPORT_GRAPH_OPTIONS.strictAttachments
    },
    nodes: graph.nodes,
    edges: graph.edges,
    diagnostics: graph.diagnostics
  })
}

export type { VniteImportFieldSelection }
