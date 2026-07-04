import type { VniteBackupGame } from '../backup/types'
import {
  createGraphNodeRef,
  createVniteGraphDiagnostic,
  createVniteSessionNodeKey,
  parseVniteTimestamp
} from '../mapping'
import type { VniteGraphBuildContext } from './context'

export function addSessionItems(
  context: VniteGraphBuildContext,
  game: VniteBackupGame,
  mediaKey: string
): void {
  if (!context.selection.activity.sessions) {
    return
  }

  const seen = new Set<string>()
  let sessionIndex = 0
  for (const timer of game.doc.record.timers) {
    const start = parseVniteTimestamp(timer.start, {
      nodeKey: mediaKey,
      field: 'record.timers.start'
    })
    const end = parseVniteTimestamp(timer.end, {
      nodeKey: mediaKey,
      field: 'record.timers.end'
    })
    context.graph.addDiagnostics([...start.diagnostics, ...end.diagnostics])

    if (start.value === undefined || end.value === undefined) {
      continue
    }

    if (end.value <= start.value) {
      context.graph.addDiagnostic(
        createVniteGraphDiagnostic({
          level: 'warning',
          code: 'vnite.date.invalid',
          message: 'Vnite 游玩记录结束时间早于开始时间，已跳过。',
          nodeKey: mediaKey
        })
      )
      continue
    }

    const identity = `${start.value}:${end.value}`
    if (seen.has(identity)) {
      continue
    }
    seen.add(identity)

    const sessionKey = createVniteSessionNodeKey(game.id, sessionIndex)
    sessionIndex += 1
    context.graph.addSessionNode({
      kind: 'session',
      key: sessionKey,
      input: {
        startedAt: start.value,
        endedAt: end.value
      }
    })
    context.graph.addEdge({
      kind: 'media-session',
      from: createGraphNodeRef('media', mediaKey),
      to: createGraphNodeRef('session', sessionKey)
    })
  }
}
