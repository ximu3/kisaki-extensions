import type {
  LibraryGraphDiagnostic,
  LibraryGraphResult,
  LibraryGraphResultAction
} from '@kisaki3/extension-api'
import type { VniteBackupGame, VniteBackupSnapshot, VniteImportDiagnostic } from '../backup/types'
import { omitUndefined } from '../utils/object'
import { createVniteExtraNoteNodeKey, createVniteGameNodeKey } from '../mapping'

// Type alias keeps the implicit index signature so counters stay assignable
// to both Record<string, number> and the JsonValue task-run output contract.
export type VniteImportExecutionCounters = {
  gamesTotal: number
  gamesCreated: number
  gamesUpdated: number
  gamesSkipped: number
  gamesFailed: number
  collectionsCreated: number
  collectionsUpdated: number
  attachmentsImported: number
  attachmentsFailed: number
  completionCompleted: number
  completionFailed: number
  errors: number
  warnings: number
}

export interface VniteImportExecutionSummary {
  mode: LibraryGraphResult['mode']
  requestId?: string
  startedAt: number
  finishedAt: number
  counters: VniteImportExecutionCounters
  diagnostics: readonly VniteImportDiagnostic[]
}

const GRAPH_GAME_PATH_CONFLICT_PATTERN =
  /^External IDs resolve to game "([^"]+)", but local path resolves to game "([^"]+)"\.$/
const GRAPH_EXTERNAL_ID_ENTITY_CONFLICT_PATTERN =
  /^External IDs on this graph node resolve to different existing (game|company|person) entities: (.+)\.$/
const GRAPH_EXTERNAL_ID_UNAVAILABLE_PATTERN =
  /^External IDs on this graph node resolve to unavailable existing (game|company|person) entities: (.+)\.$/
const GRAPH_INCOMING_EXTERNAL_ID_CONFLICT_PATTERN =
  /^External ID (.+) is assigned to multiple (game|company|person) nodes in this import: (.+)\.$/
const GRAPH_EXTERNAL_ID_WRITE_CONFLICT_PATTERN =
  /^External IDs on this graph node cannot be written because they already belong to other existing (game|company|person) entities: (.+)\.$/
const GRAPH_EXISTING_NAME_PATTERN = /^Matched an existing (collection|tag) by name\.$/
const GRAPH_EXISTING_EXTERNAL_ID_PATTERN =
  /^Matched an existing (game|company|person) by external id\.$/

export function createVniteImportExecutionSummary(input: {
  graph: LibraryGraphResult
  snapshot: VniteBackupSnapshot
}): VniteImportExecutionSummary {
  const diagnostics = toVniteImportDiagnostics(input.graph, input.snapshot)

  return omitUndefined({
    mode: input.graph.mode,
    requestId: input.graph.requestId,
    startedAt: input.graph.startedAt,
    finishedAt: input.graph.finishedAt,
    counters: createVniteImportExecutionCounters(input.graph, diagnostics),
    diagnostics
  })
}

export function createVniteImportExecutionCounters(
  graph: LibraryGraphResult,
  diagnostics: readonly VniteImportDiagnostic[]
): VniteImportExecutionCounters {
  const gameNodes = graph.nodes.filter((node) => node.kind === 'media' && node.mediaType === 'game')
  const collectionNodes = graph.nodes.filter((node) => node.kind === 'collection')
  const attachmentNodes = graph.nodes.filter((node) => node.kind === 'attachment')

  return {
    gamesTotal: gameNodes.length,
    gamesCreated: countActions(gameNodes, 'create'),
    gamesUpdated: countActions(gameNodes, 'update'),
    gamesSkipped: countActions(gameNodes, 'skip'),
    gamesFailed: countActions(gameNodes, 'fail'),
    collectionsCreated: countActions(collectionNodes, 'create'),
    collectionsUpdated: countActions(collectionNodes, 'update'),
    attachmentsImported:
      countActions(attachmentNodes, 'create') + countActions(attachmentNodes, 'update'),
    attachmentsFailed: countActions(attachmentNodes, 'fail'),
    completionCompleted: 0,
    completionFailed: 0,
    errors: diagnostics.filter((diagnostic) => diagnostic.level === 'error').length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.level === 'warning').length
  }
}

export function toVniteImportDiagnostics(
  graph: LibraryGraphResult,
  snapshot: VniteBackupSnapshot
): readonly VniteImportDiagnostic[] {
  const games = [...snapshot.games].sort((left, right) => right.id.length - left.id.length)
  return collectLibraryGraphDiagnostics(graph).map((diagnostic) =>
    toVniteImportDiagnostic(diagnostic, games)
  )
}

export function collectLibraryGraphDiagnostics(
  graph: LibraryGraphResult
): readonly LibraryGraphDiagnostic[] {
  return dedupeLibraryGraphDiagnostics([
    ...graph.diagnostics,
    ...graph.nodes.flatMap((node) => node.diagnostics ?? []),
    ...graph.edges.flatMap((edge) => edge.diagnostics ?? [])
  ])
}

function dedupeLibraryGraphDiagnostics(
  diagnostics: readonly LibraryGraphDiagnostic[]
): readonly LibraryGraphDiagnostic[] {
  const seen = new Set<string>()
  const result: LibraryGraphDiagnostic[] = []

  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.level,
      diagnostic.code,
      diagnostic.message,
      diagnostic.nodeKey ?? '',
      diagnostic.edgeKind ?? ''
    ].join('\u0000')
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(diagnostic)
  }

  return result
}

function countActions(
  items: readonly { action: LibraryGraphResultAction }[],
  action: LibraryGraphResultAction
): number {
  return items.filter((item) => item.action === action).length
}

function toVniteImportDiagnostic(
  diagnostic: LibraryGraphDiagnostic,
  games: readonly VniteBackupGame[]
): VniteImportDiagnostic {
  const game = diagnostic.nodeKey ? resolveGameFromNodeKey(diagnostic.nodeKey, games) : undefined

  return omitUndefined({
    level: diagnostic.level,
    code: diagnostic.code,
    message: toLocalizedDiagnosticMessage(diagnostic),
    itemKey: diagnostic.nodeKey,
    vniteGameId: game?.id,
    vniteGameName: game ? readGameName(game) : undefined
  })
}

function toLocalizedDiagnosticMessage(diagnostic: LibraryGraphDiagnostic): string {
  const message = diagnostic.message

  if (message === 'Attachment file was not found.') {
    return '附件文件不存在。'
  }

  if (message === 'Attachment path does not point to a file.') {
    return '附件路径不是文件。'
  }

  if (message === 'Matched an existing game by local path.') {
    return '已通过本地路径匹配到现有游戏。'
  }

  if (message === 'Note nodes require a media-note edge.') {
    return '笔记节点缺少所属游戏关系。'
  }

  if (message === 'Session nodes require a media-session edge.') {
    return '游玩记录节点缺少所属游戏关系。'
  }

  const gamePathConflict = GRAPH_GAME_PATH_CONFLICT_PATTERN.exec(message)
  if (gamePathConflict) {
    return `外部 ID 匹配到现有游戏 "${gamePathConflict[1]}"，但本地路径匹配到现有游戏 "${gamePathConflict[2]}"。`
  }

  const entityConflict = GRAPH_EXTERNAL_ID_ENTITY_CONFLICT_PATTERN.exec(message)
  if (entityConflict) {
    return `该项目的外部 ID 指向多个现有${toEntityLabel(entityConflict[1])}：${entityConflict[2]}。`
  }

  const unavailable = GRAPH_EXTERNAL_ID_UNAVAILABLE_PATTERN.exec(message)
  if (unavailable) {
    return `该项目的外部 ID 指向无法读取的现有${toEntityLabel(unavailable[1])}：${unavailable[2]}。`
  }

  const incomingConflict = GRAPH_INCOMING_EXTERNAL_ID_CONFLICT_PATTERN.exec(message)
  if (incomingConflict) {
    return `外部 ID ${incomingConflict[1]} 在本次导入中被多个${toEntityLabel(incomingConflict[2])}项目使用：${incomingConflict[3]}。`
  }

  const writeConflict = GRAPH_EXTERNAL_ID_WRITE_CONFLICT_PATTERN.exec(message)
  if (writeConflict) {
    return `该项目的外部 ID 无法写入，因为它们已属于其他现有${toEntityLabel(writeConflict[1])}：${writeConflict[2]}。`
  }

  const nameMatch = GRAPH_EXISTING_NAME_PATTERN.exec(message)
  if (nameMatch) {
    return `已通过名称匹配到现有${toEntityLabel(nameMatch[1])}。`
  }

  const externalIdMatch = GRAPH_EXISTING_EXTERNAL_ID_PATTERN.exec(message)
  if (externalIdMatch) {
    return `已通过外部 ID 匹配到现有${toEntityLabel(externalIdMatch[1])}。`
  }

  return message
}

function toEntityLabel(label: string): string {
  switch (label) {
    case 'game':
      return '游戏'
    case 'company':
      return '公司'
    case 'person':
      return '人员'
    case 'collection':
      return '合集'
    case 'tag':
      return '标签'
    default:
      return '项目'
  }
}

function resolveGameFromNodeKey(
  nodeKey: string,
  games: readonly VniteBackupGame[]
): VniteBackupGame | undefined {
  for (const game of games) {
    const gameScopedPrefixes = [
      `vnite:attachment:${game.id}:`,
      `vnite:company:${game.id}:`,
      `vnite:person:${game.id}:`,
      `vnite:note:memory:${game.id}:`,
      `vnite:session:${game.id}:`
    ]

    if (
      nodeKey === createVniteGameNodeKey(game.id) ||
      nodeKey === createVniteExtraNoteNodeKey(game.id) ||
      gameScopedPrefixes.some((prefix) => nodeKey.startsWith(prefix))
    ) {
      return game
    }
  }

  return undefined
}

function readGameName(game: VniteBackupGame): string {
  return game.doc.metadata.name || game.doc.metadata.originalName || game.id
}
