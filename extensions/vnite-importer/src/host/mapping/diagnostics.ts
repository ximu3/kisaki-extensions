import type { LibraryGraphDiagnostic, LibraryGraphEdgeKind } from '@kisaki3/extension-api'
import type { VniteImportDiagnostic } from '../backup/types'
import { omitUndefined } from '../utils/object'

export interface VniteGraphDiagnosticInput {
  level: LibraryGraphDiagnostic['level']
  code: string
  message: string
  nodeKey?: string | undefined
  edgeKind?: LibraryGraphEdgeKind | undefined
}

export function createVniteGraphDiagnostic(
  input: VniteGraphDiagnosticInput
): LibraryGraphDiagnostic {
  return omitUndefined({
    level: input.level,
    code: input.code,
    message: input.message,
    nodeKey: input.nodeKey,
    edgeKind: input.edgeKind
  })
}

export function toLibraryGraphDiagnostic(
  diagnostic: VniteImportDiagnostic
): LibraryGraphDiagnostic {
  return createVniteGraphDiagnostic({
    level: diagnostic.level,
    code: diagnostic.code,
    message: diagnostic.message,
    nodeKey: diagnostic.itemKey
  })
}
