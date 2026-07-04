import type { VniteBackupGame } from '../backup/types'
import type { VniteExtraField } from '../vnite/models'
import {
  createGraphNodeRef,
  createVniteCompanyNodeKey,
  createVniteExtraNoteNodeKey,
  createVniteGraphDiagnostic,
  createVnitePersonNodeKey,
  mapVniteCompanies,
  mapVnitePersonsFromExtra
} from '../mapping'
import type { VniteGraphBuildContext } from './context'
import { formatUnknownExtraLines } from './notes'
import { trimToUndefined } from './values'

export function addCreditItems(
  context: VniteGraphBuildContext,
  game: VniteBackupGame,
  mediaKey: string
): void {
  if (context.selection.credits.companies) {
    for (const [order, company] of mapVniteCompanies(game.doc.metadata).entries()) {
      const companyKey = createVniteCompanyNodeKey(game.id, company.name)
      context.graph.addCompanyNode({
        kind: 'company',
        key: companyKey,
        input: { name: company.name }
      })
      context.graph.addEdge({
        kind: 'media-company',
        from: createGraphNodeRef('media', mediaKey),
        to: createGraphNodeRef('company', companyKey),
        role: company.role,
        order
      })
    }
  }

  if (context.selection.credits.personsFromExtra) {
    const result = mapVnitePersonsFromExtra(game.doc.metadata.extra)
    for (const [order, person] of result.people.entries()) {
      const personKey = createVnitePersonNodeKey(game.id, person.name)
      context.graph.addPersonNode({
        kind: 'person',
        key: personKey,
        input: { name: person.name }
      })
      context.graph.addEdge({
        kind: 'media-person',
        from: createGraphNodeRef('media', mediaKey),
        to: createGraphNodeRef('person', personKey),
        role: person.role,
        order
      })
    }

    if (!context.selection.credits.unknownExtraAsNotes) {
      for (const extra of result.unknownExtras) {
        addUnknownExtraDiagnostic(context, mediaKey, extra)
      }
    }
  }

  if (context.selection.credits.unknownExtraAsNotes) {
    addUnknownExtraNote(context, game, mediaKey)
  }
}

function addUnknownExtraNote(
  context: VniteGraphBuildContext,
  game: VniteBackupGame,
  mediaKey: string
): void {
  const unknownExtras = mapVnitePersonsFromExtra(game.doc.metadata.extra).unknownExtras
  const lines = unknownExtras.flatMap((extra) => formatUnknownExtraLines(extra))
  if (lines.length === 0) {
    return
  }

  const noteKey = createVniteExtraNoteNodeKey(game.id)
  context.graph.addNoteNode({
    kind: 'note',
    key: noteKey,
    input: {
      name: 'Vnite 额外信息',
      content: lines.join('\n')
    }
  })
  context.graph.addEdge({
    kind: 'media-note',
    from: createGraphNodeRef('media', mediaKey),
    to: createGraphNodeRef('note', noteKey)
  })
}

function addUnknownExtraDiagnostic(
  context: VniteGraphBuildContext,
  nodeKey: string,
  extra: VniteExtraField
): void {
  if (!trimToUndefined(extra.key) || extra.value.length === 0) {
    return
  }

  context.graph.addDiagnostic(
    createVniteGraphDiagnostic({
      level: 'warning',
      code: 'vnite.extra.unknownKey',
      message: `Vnite 额外信息字段 ${extra.key} 无法映射，已跳过。`,
      nodeKey
    })
  )
}
