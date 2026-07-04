import type {
  LibraryCapability,
  LibraryCollection,
  LibraryCompany,
  LibraryGame,
  LibraryGraphResult,
  LibraryRelation,
  LibraryRelationKind,
  LibraryTag,
  PartialDate
} from '@kisaki3/extension-sdk'
import type { VniteBackupGame, VniteBackupSnapshot } from '../backup/types'
import { createVniteGameNodeKey } from '../mapping'
import { omitUndefined } from '../utils/object'
import type { VnitePlayStatus } from '../vnite/models'
import type { LibraryGraphResultAction } from '@kisaki3/extension-sdk'

export interface VniteImportPreviewGame {
  key: string
  sourceGameId?: string
  title: string
  action: LibraryGraphResultAction
  entityId?: string
  existing?: VniteImportPreviewExistingGame
  name?: string
  originalName?: string
  releaseDate?: string
  developers?: string
  publishers?: string
  platforms?: string
  genres?: string
  tags?: string
  collections?: string
  playStatus?: string
  playTime?: string
  score?: string
  localPath?: string
  attachments?: string
}

export interface VniteImportPreviewFieldValue {
  label: string
  value: string
}

export interface VniteImportPreviewExistingGame {
  metadata: readonly VniteImportPreviewFieldValue[]
  activity: readonly VniteImportPreviewFieldValue[]
  organization: readonly VniteImportPreviewFieldValue[]
}

type PreviewLibrary = Pick<
  LibraryCapability,
  'games' | 'relations' | 'tags' | 'collections' | 'companies'
>

const EXISTING_GAME_RELATION_KINDS = [
  'game-company',
  'game-tag',
  'collection-game'
] as const satisfies readonly LibraryRelationKind[]

export async function createVniteImportPreviewGames(input: {
  snapshot: VniteBackupSnapshot
  graph: LibraryGraphResult
  library: PreviewLibrary
}): Promise<readonly VniteImportPreviewGame[]> {
  const gameByNodeKey = new Map(
    input.snapshot.games.map((game) => [createVniteGameNodeKey(game.id), game])
  )
  const collectionNamesByGameId = createCollectionNamesByGameId(input.snapshot)
  const existingById = await loadExistingGames(input.library, input.graph)

  return input.graph.nodes
    .filter((node) => node.kind === 'media' && node.mediaType === 'game')
    .map((node) => {
      const game = gameByNodeKey.get(node.key)
      const collectionNames = game ? collectionNamesByGameId.get(game.id) : undefined
      const existing = node.entityId ? existingById.get(node.entityId) : undefined

      return createPreviewGame({
        game,
        key: node.key,
        action: node.action,
        ...(node.entityId ? { entityId: node.entityId } : {}),
        ...(existing ? { existing } : {}),
        ...(collectionNames ? { collectionNames } : {})
      })
    })
}

function createPreviewGame(input: {
  game: VniteBackupGame | undefined
  key: string
  action: VniteImportPreviewGame['action']
  entityId?: string
  existing?: VniteImportPreviewExistingGame
  collectionNames?: readonly string[]
}): VniteImportPreviewGame {
  const game = input.game
  if (!game) {
    return omitUndefined({
      key: input.key,
      title: '未命名游戏',
      action: input.action,
      entityId: input.entityId,
      existing: input.existing
    }) satisfies VniteImportPreviewGame
  }

  const metadata = game.doc.metadata
  const record = game.doc.record
  const title = readGameTitle(game)
  const originalTitle = normalizeText(metadata.originalName)

  return omitUndefined({
    key: input.key,
    sourceGameId: game.id,
    title,
    action: input.action,
    entityId: input.entityId,
    existing: input.existing,
    name: normalizeText(metadata.name),
    originalName: originalTitle,
    releaseDate: normalizeText(metadata.releaseDate),
    developers: formatList(metadata.developers),
    publishers: formatList(metadata.publishers),
    platforms: formatList(metadata.platforms),
    genres: formatList(metadata.genres),
    tags: formatList(metadata.tags, 4),
    collections: formatList(input.collectionNames, 4),
    playStatus: toPlayStatusLabel(record.playStatus),
    playTime: formatDuration(record.playTime),
    score: formatScore(record.score),
    localPath:
      normalizeText(game.local?.doc.path.gamePath) ?? normalizeText(game.local?.doc.utils.markPath),
    attachments: formatAttachmentCount(game.attachmentIds.length)
  }) satisfies VniteImportPreviewGame
}

async function loadExistingGames(
  library: PreviewLibrary,
  graph: LibraryGraphResult
): Promise<Map<string, VniteImportPreviewExistingGame>> {
  const entityIds = [
    ...new Set(
      graph.nodes
        .filter((node) => node.kind === 'media' && node.mediaType === 'game')
        .flatMap((node) => (node.entityId ? [node.entityId] : []))
    )
  ]
  if (!entityIds.length) {
    return new Map()
  }

  const games = await library.games.list({ ids: entityIds })
  const relationEntries = await Promise.all(
    games.map(async (game) => ({
      game,
      relations: await library.relations.list({
        entity: { entityType: 'game', id: game.id },
        kinds: EXISTING_GAME_RELATION_KINDS
      })
    }))
  )

  const lookup = await loadRelationEntities(
    library,
    relationEntries.flatMap((entry) => entry.relations)
  )
  return new Map(
    relationEntries.flatMap((entry) => {
      const existing = createExistingGameSummary(entry.game, entry.relations, lookup)
      return existing ? [[entry.game.id, existing] as const] : []
    })
  )
}

async function loadRelationEntities(
  library: PreviewLibrary,
  relations: readonly LibraryRelation[]
): Promise<{
  tags: ReadonlyMap<string, LibraryTag>
  collections: ReadonlyMap<string, LibraryCollection>
  companies: ReadonlyMap<string, LibraryCompany>
}> {
  const tagIds = new Set<string>()
  const collectionIds = new Set<string>()
  const companyIds = new Set<string>()

  for (const relation of relations) {
    if (isGameTagRelation(relation)) {
      tagIds.add(relation.to.id)
    } else if (isCollectionGameRelation(relation)) {
      collectionIds.add(relation.from.id)
    } else if (isGameCompanyRelation(relation)) {
      companyIds.add(relation.to.id)
    }
  }

  const [tags, collections, companies] = await Promise.all([
    tagIds.size ? library.tags.list({ ids: [...tagIds] }) : [],
    collectionIds.size ? library.collections.list({ ids: [...collectionIds] }) : [],
    companyIds.size ? library.companies.list({ ids: [...companyIds] }) : []
  ])

  return {
    tags: new Map(tags.map((tag) => [tag.id, tag])),
    collections: new Map(collections.map((collection) => [collection.id, collection])),
    companies: new Map(companies.map((company) => [company.id, company]))
  }
}

function createExistingGameSummary(
  game: LibraryGame,
  relations: readonly LibraryRelation[],
  lookup: {
    tags: ReadonlyMap<string, LibraryTag>
    collections: ReadonlyMap<string, LibraryCollection>
    companies: ReadonlyMap<string, LibraryCompany>
  }
): VniteImportPreviewExistingGame | undefined {
  const companies = getCompanyNamesByRole(relations, lookup.companies)
  const existing = {
    metadata: createFieldValues([
      ['名称', game.name],
      ['原名', game.originalName],
      ['发售日期', formatPartialDate(game.releaseDate)],
      ['开发商', companies.developers],
      ['发行商', companies.publishers]
    ]),
    activity: createFieldValues([
      ['游玩状态', toLibraryPlayStatusLabel(game.status)],
      ['评分', formatLibraryScoreValue(game.score)],
      ['游玩时长', formatDuration(game.totalDuration)],
      ['最近游玩', formatTimestampDate(game.lastActiveAt)]
    ]),
    organization: createFieldValues([
      ['合集', formatList(getCollectionNames(relations, lookup.collections), 4)],
      ['标签', formatList(getTagNames(relations, lookup.tags), 4)],
      ['媒体', formatExistingMediaCount(game)],
      ['游戏目录', normalizeText(game.gameDirPath)],
      ['启动路径', normalizeText(game.launcherPath)],
      ['存档路径', normalizeText(game.savePath)]
    ])
  }

  return existing.metadata.length || existing.activity.length || existing.organization.length
    ? existing
    : undefined
}

function getCompanyNamesByRole(
  relations: readonly LibraryRelation[],
  companies: ReadonlyMap<string, LibraryCompany>
): { developers?: string; publishers?: string } {
  const developers: string[] = []
  const publishers: string[] = []

  for (const relation of relations) {
    if (!isGameCompanyRelation(relation)) {
      continue
    }

    const name = companies.get(relation.to.id)?.name
    if (!name) {
      continue
    }

    if (relation.metadata.type === 'developer') {
      developers.push(name)
    } else if (relation.metadata.type === 'publisher') {
      publishers.push(name)
    }
  }

  return omitUndefined({
    developers: formatList(developers),
    publishers: formatList(publishers)
  })
}

function getTagNames(
  relations: readonly LibraryRelation[],
  tags: ReadonlyMap<string, LibraryTag>
): readonly string[] {
  return relations.flatMap((relation) =>
    isGameTagRelation(relation) ? [tags.get(relation.to.id)?.name].filter(isString) : []
  )
}

function getCollectionNames(
  relations: readonly LibraryRelation[],
  collections: ReadonlyMap<string, LibraryCollection>
): readonly string[] {
  return relations.flatMap((relation) =>
    isCollectionGameRelation(relation)
      ? [collections.get(relation.from.id)?.name].filter(isString)
      : []
  )
}

function isGameCompanyRelation(
  relation: LibraryRelation
): relation is LibraryRelation<'game-company'> {
  return relation.kind === 'game-company'
}

function isGameTagRelation(relation: LibraryRelation): relation is LibraryRelation<'game-tag'> {
  return relation.kind === 'game-tag'
}

function isCollectionGameRelation(
  relation: LibraryRelation
): relation is LibraryRelation<'collection-game'> {
  return relation.kind === 'collection-game'
}

function createCollectionNamesByGameId(
  snapshot: VniteBackupSnapshot
): Map<string, readonly string[]> {
  const output = new Map<string, string[]>()

  for (const collection of snapshot.collections) {
    const name = normalizeText(collection.doc.name)
    if (!name) {
      continue
    }

    for (const gameId of collection.doc.games) {
      const names = output.get(gameId) ?? []
      names.push(name)
      output.set(gameId, names)
    }
  }

  return output
}

function readGameTitle(game: VniteBackupGame): string {
  return (
    normalizeText(game.doc.metadata.name) ??
    normalizeText(game.doc.metadata.originalName) ??
    '未命名游戏'
  )
}

function normalizeText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function formatList(values: readonly string[] | undefined, maxItems = 3): string | undefined {
  const normalized = [...new Set(values?.map((item) => item.trim()).filter(Boolean) ?? [])]
  if (!normalized.length) {
    return undefined
  }

  if (normalized.length <= maxItems) {
    return normalized.join('、')
  }

  return `${normalized.slice(0, maxItems).join('、')} 等 ${normalized.length} 项`
}

function toPlayStatusLabel(status: VnitePlayStatus): string {
  switch (status) {
    case 'playing':
      return '进行中'
    case 'partial':
      return '部分完成'
    case 'finished':
      return '已通关'
    case 'multiple':
      return '多周目'
    case 'shelved':
      return '已搁置'
    case 'unplayed':
    default:
      return '未开始'
  }
}

function toLibraryPlayStatusLabel(status: LibraryGame['status']): string {
  switch (status) {
    case 'inProgress':
      return '进行中'
    case 'partial':
      return '部分完成'
    case 'completed':
      return '已通关'
    case 'multiple':
      return '多周目'
    case 'shelved':
      return '已搁置'
    case 'notStarted':
    default:
      return '未开始'
  }
}

function formatDuration(value: number): string | undefined {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined
  }

  const totalMinutes = Math.max(1, Math.round(value / 60_000))
  if (totalMinutes < 60) {
    return `${totalMinutes} 分钟`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
}

function formatScore(score: number): string | undefined {
  if (!Number.isFinite(score) || score < 0) {
    return undefined
  }

  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function formatAttachmentCount(count: number): string | undefined {
  return count > 0 ? `${count} 个附件` : undefined
}

function formatLibraryScoreValue(score: number | null | undefined): string | undefined {
  if (score === null || score === undefined || !Number.isFinite(score) || score < 0) {
    return undefined
  }

  return (score / 10).toFixed(1)
}

function formatPartialDate(value: PartialDate | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const parts = [
    formatDatePart(value.year, 4),
    formatDatePart(value.month, 2),
    formatDatePart(value.day, 2)
  ].filter(isString)

  return parts.length ? parts.join('-') : undefined
}

function formatDatePart(value: number | undefined, length: number): string | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined
  }

  return String(value).padStart(length, '0')
}

function formatTimestampDate(value: number | null | undefined): string | undefined {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function formatExistingMediaCount(game: LibraryGame): string | undefined {
  const assetCount = [game.coverFile, game.backdropFile, game.logoFile, game.iconFile].filter(
    isString
  ).length
  const inlineFileCount = game.descriptionInlineFiles?.length ?? 0
  const backupCount = game.saveBackups?.length ?? 0
  const total = assetCount + inlineFileCount + backupCount

  return total > 0 ? `${total} 项` : undefined
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function createFieldValues(
  entries: readonly (readonly [label: string, value: string | undefined])[]
): readonly VniteImportPreviewFieldValue[] {
  return entries.flatMap(([label, value]) => (value ? [{ label, value }] : []))
}
