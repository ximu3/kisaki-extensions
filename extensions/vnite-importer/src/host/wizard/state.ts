import type { TaskRunSnapshot } from '@kisaki3/extension-sdk'
import type {
  VniteBackupAnalysisDto,
  VniteDoneSummaryDto,
  VniteDiagnosticCountDto,
  VniteDiagnosticRowDto,
  VniteImportOptionsForm,
  VnitePreviewActionDto,
  VnitePreviewActionFilterDto,
  VnitePreviewDto,
  VnitePreviewFieldDto,
  VnitePreviewQueryDto,
  VnitePreviewRowDto,
  VnitePreviewSectionDto,
  VnitePreviewSectionKeyDto,
  VniteRunWorkDto,
  VniteRunDto,
  VniteWizardState
} from '../../shared/import-wizard'
import { VNITE_PREVIEW_DEFAULT_PAGE_SIZE } from '../../shared/import-wizard'
import type { VniteBackupAnalysisSummary, VniteImportDiagnostic } from '../backup/types'
import type { VniteImporterSettingsV1 } from '../config'
import type { VniteImportReport } from '../jobs/report'
import { createVisibleDiagnostics, toDiagnosticsTableRows } from './diagnostics'
import type { VniteImportPreviewGame } from './preview-games'
import type { VniteWizardPreview, VniteWizardSession } from './session'
import { resolveVniteImportStep, type VniteImportFlowState } from './store'
import type { VniteImportWizardRuntime } from './runtime'

type ActiveRunWork = NonNullable<NonNullable<TaskRunSnapshot['progress']>['work']>

const PREVIEW_ACTIONS = new Set<VnitePreviewActionDto>(['create', 'update', 'skip', 'fail'])
const MIN_PREVIEW_PAGE_SIZE = 10
const MAX_PREVIEW_PAGE_SIZE = 100

/**
 * Computes the full wizard state from persisted flow, session preview, and
 * the live task run, and records it on the session so progress pushes can
 * patch it in place.
 */
export async function resolveWizardState(
  runtime: VniteImportWizardRuntime,
  session: VniteWizardSession
): Promise<VniteWizardState> {
  const [settings, profiles] = await Promise.all([
    runtime.settingsStore.get(),
    listGameScraperProfiles(runtime)
  ])
  const runState = await resolveImportRunState(runtime)
  const flow = runState.flow
  const step = resolveVniteImportStep({
    flow,
    hasActiveRun: !!runState.activeRun,
    hasPreview: !!session.preview
  })
  const diagnostics = collectDiagnostics(flow, session)
  const visibleDiagnostics = createVisibleDiagnostics(diagnostics)

  const state: VniteWizardState = {
    step,
    file: flow.file ? { name: flow.file.name, sizeBytes: flow.file.sizeBytes } : null,
    analysis: session.analysis ? toAnalysisDto(session.analysis) : null,
    options: toOptionsForm(settings, profiles),
    fieldSelection: settings.defaults.fieldSelection,
    profiles,
    preview: session.preview ? toPreviewDto(session.preview, session.previewQuery) : null,
    run: runState.activeRun ? toRunDto(runState.activeRun) : null,
    doneSummary: flow.lastReport ? toDoneSummaryDto(flow.lastReport) : null,
    diagnostics: toDiagnosticRowDtos(visibleDiagnostics),
    diagnosticsTotal: visibleDiagnostics.length
  }

  session.rememberState(state)
  return state
}

/**
 * Reconciles the persisted flow with the actual run state. Terminal runs are
 * resolved from the extension's own report (written by the job lifecycle);
 * a run that vanished without one (host recycle) drops back to configuration.
 */
export async function resolveImportRunState(runtime: VniteImportWizardRuntime): Promise<{
  flow: VniteImportFlowState
  activeRun?: TaskRunSnapshot
}> {
  let flow = await runtime.flowStore.get()

  if (flow.activeRunId) {
    const activeRun = await runtime.taskRuns.getActiveOwn(flow.activeRunId)
    if (activeRun) {
      if (flow.step !== 'running') {
        flow = await runtime.flowStore.setStep('running')
      }
      return { flow, activeRun }
    }

    flow =
      flow.lastReport?.runId === flow.activeRunId
        ? await runtime.flowStore.setDone(flow.lastReport)
        : await runtime.flowStore.clearActiveRun()
  }

  const [activeRun] = await runtime.taskRuns.listActiveOwn({
    operations: ['vnite.import'],
    limit: 1
  })
  if (activeRun) {
    flow = await runtime.flowStore.setActiveRun(activeRun.id)
    return { flow, activeRun }
  }

  return { flow }
}

export function toOptionsForm(
  settings: VniteImporterSettingsV1,
  profiles: readonly { value: string }[]
): VniteImportOptionsForm {
  const defaults = settings.defaults

  return {
    completeMetadata: defaults.completeMetadata,
    scraperProfileId: defaults.scraperProfileId ?? profiles[0]?.value ?? '',
    completionSurfacePreset: defaults.completionSurfacePreset,
    completionSurfaces: defaults.completionSurfaces,
    conflictMode: defaults.conflictMode,
    strictAttachments: defaults.strictAttachments
  }
}

async function listGameScraperProfiles(
  runtime: VniteImportWizardRuntime
): Promise<readonly { value: string; label: string }[]> {
  try {
    const profiles = await runtime.scrapers.profiles.list({ mediaType: 'game' })
    return profiles.map((profile) => ({ value: profile.id, label: profile.name }))
  } catch (error) {
    runtime.logger.warn('Vnite importer failed to list scraper profiles.', {
      message: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

function collectDiagnostics(
  flow: VniteImportFlowState,
  session: VniteWizardSession
): readonly VniteImportDiagnostic[] {
  if (session.preview) {
    return [...session.preview.analysis.diagnostics, ...session.preview.summary.diagnostics]
  }

  if (session.analysis) {
    return session.analysis.diagnostics
  }

  return flow.lastReport?.diagnostics ?? []
}

function toAnalysisDto(analysis: VniteBackupAnalysisSummary): VniteBackupAnalysisDto {
  const statistics = analysis.statistics

  return {
    createdAt: analysis.createdAt,
    fileName: analysis.file?.name ?? 'Vnite 备份包',
    sizeBytes: analysis.file?.sizeBytes ?? 0,
    gamesTotal: statistics.games.total,
    localGamesTotal: statistics.gameLocals.total,
    collectionsTotal: statistics.collections.total,
    collectionLinksTotal: statistics.collections.memberLinks,
    attachmentsTotal: statistics.attachments.total,
    playedGamesTotal: statistics.games.withPlayTime,
    scoredGamesTotal: statistics.games.withScore,
    saveGamesTotal: statistics.games.withSaveList,
    memoryGamesTotal: statistics.games.withMemoryList,
    diagnostics: countDiagnostics(analysis.diagnostics),
    coverage: analysis.fieldCoverage.map((item) => ({
      key: item.key,
      label: item.label,
      present: item.present,
      total: item.total,
      percent: item.total > 0 ? Math.round((item.present / item.total) * 100) : 0
    }))
  }
}

function toPreviewDto(
  preview: VniteWizardPreview,
  queryInput: VnitePreviewQueryDto
): VnitePreviewDto {
  const counters = preview.summary.counters
  const diagnostics = [...preview.analysis.diagnostics, ...preview.summary.diagnostics]
  const baseQuery = normalizePreviewQuery(queryInput)
  const filteredGames = preview.games.filter((game) => matchesPreviewQuery(game, baseQuery))
  const pagesTotal = Math.max(1, Math.ceil(filteredGames.length / baseQuery.pageSize))
  const page = Math.min(baseQuery.page, pagesTotal)
  const startIndex = (page - 1) * baseQuery.pageSize
  const rows = filteredGames
    .slice(startIndex, startIndex + baseQuery.pageSize)
    .map((game) => toPreviewRow(game, diagnostics))
  const query = { ...baseQuery, page }

  return {
    summary: {
      created: counters.gamesCreated,
      updated: counters.gamesUpdated,
      skipped: counters.gamesSkipped,
      errors: counters.errors ?? 0,
      warnings: counters.warnings ?? 0
    },
    query,
    pagination: {
      page,
      pageSize: query.pageSize,
      pagesTotal,
      allRowsTotal: preview.games.length,
      filteredRowsTotal: filteredGames.length,
      firstRow: rows.length > 0 ? startIndex + 1 : 0,
      lastRow: rows.length > 0 ? startIndex + rows.length : 0
    },
    rows
  }
}

function normalizePreviewQuery(query: VnitePreviewQueryDto): VnitePreviewQueryDto {
  const pageSize = clampInteger(
    toPositiveInteger(query.pageSize, VNITE_PREVIEW_DEFAULT_PAGE_SIZE),
    MIN_PREVIEW_PAGE_SIZE,
    MAX_PREVIEW_PAGE_SIZE
  )

  return {
    action: normalizePreviewActionFilter(query.action),
    search: typeof query.search === 'string' ? query.search.trim().slice(0, 120) : '',
    page: toPositiveInteger(query.page, 1),
    pageSize
  }
}

function normalizePreviewActionFilter(
  action: VnitePreviewActionFilterDto
): VnitePreviewActionFilterDto {
  if (action === 'all') {
    return 'all'
  }

  return PREVIEW_ACTIONS.has(action) ? action : 'all'
}

function toPositiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function matchesPreviewQuery(game: VniteImportPreviewGame, query: VnitePreviewQueryDto): boolean {
  if (query.action !== 'all' && game.action !== query.action) {
    return false
  }

  const search = normalizeSearchText(query.search)
  if (!search) {
    return true
  }

  return getPreviewSearchValues(game).some((value) => normalizeSearchText(value).includes(search))
}

function getPreviewSearchValues(game: VniteImportPreviewGame): readonly string[] {
  return [
    game.title,
    game.name,
    game.originalName,
    game.releaseDate,
    game.developers,
    game.publishers,
    game.platforms,
    game.genres,
    game.tags,
    game.collections,
    game.playStatus,
    game.playTime,
    game.score,
    game.localPath,
    game.attachments,
    ...(game.existing?.metadata.flatMap((field) => [field.label, field.value]) ?? []),
    ...(game.existing?.activity.flatMap((field) => [field.label, field.value]) ?? []),
    ...(game.existing?.organization.flatMap((field) => [field.label, field.value]) ?? [])
  ].filter(isSearchValue)
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

function isSearchValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

function toPreviewRow(
  game: VniteImportPreviewGame,
  diagnostics: readonly VniteImportDiagnostic[]
): VnitePreviewRowDto {
  const matchingDiagnostics = diagnostics.filter((diagnostic) =>
    matchesPreviewGame(diagnostic, game)
  )
  const visibleDiagnostics = createVisibleDiagnostics(matchingDiagnostics)

  return {
    id: game.key,
    title: game.title,
    action: game.action,
    sections: [
      createPreviewSection('metadata', '资料', game.existing?.metadata ?? [], [
        ['名称', game.name],
        ['原名', game.originalName],
        ['发售日期', game.releaseDate],
        ['开发商', game.developers],
        ['发行商', game.publishers],
        ['平台', game.platforms],
        ['类型', game.genres]
      ]),
      createPreviewSection('activity', '记录', game.existing?.activity ?? [], [
        ['游玩状态', game.playStatus],
        ['评分', game.score],
        ['游玩时长', game.playTime]
      ]),
      createPreviewSection('organization', '组织与媒体', game.existing?.organization ?? [], [
        ['合集', game.collections],
        ['标签', game.tags],
        ['附件', game.attachments],
        ['游戏目录', game.localPath]
      ])
    ],
    diagnostics: countDiagnostics(matchingDiagnostics),
    diagnosticRows: toDiagnosticRowDtos(visibleDiagnostics)
  }
}

function matchesPreviewGame(
  diagnostic: VniteImportDiagnostic,
  game: VniteImportPreviewGame
): boolean {
  if (diagnostic.itemKey === game.key) {
    return true
  }

  if (!game.sourceGameId) {
    return false
  }

  return (
    diagnostic.vniteGameId === game.sourceGameId ||
    diagnostic.itemKey?.includes(`:${game.sourceGameId}:`) === true ||
    diagnostic.itemKey?.endsWith(`:${game.sourceGameId}`) === true
  )
}

function countDiagnostics(diagnostics: readonly VniteImportDiagnostic[]): VniteDiagnosticCountDto {
  return {
    errors: diagnostics.filter((diagnostic) => diagnostic.level === 'error').length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.level === 'warning').length,
    infos: diagnostics.filter((diagnostic) => diagnostic.level === 'info').length
  }
}

function toDiagnosticRowDtos(
  diagnostics: readonly VniteImportDiagnostic[]
): readonly VniteDiagnosticRowDto[] {
  return toDiagnosticsTableRows(diagnostics).map((row) => ({
    level: row.level ?? '',
    subject: row.subject ?? '',
    message: row.message ?? ''
  }))
}

function createPreviewSection(
  key: VnitePreviewSectionKeyDto,
  label: string,
  current: readonly VnitePreviewFieldDto[],
  incoming: readonly (readonly [label: string, value: string | undefined])[]
): VnitePreviewSectionDto {
  return {
    key,
    label,
    current,
    incoming: createFieldDtos(incoming)
  }
}

function createFieldDtos(
  fields: readonly (readonly [label: string, value: string | undefined])[]
): readonly VnitePreviewFieldDto[] {
  return fields.flatMap(([label, value]) => (value ? [{ label, value }] : []))
}

function toRunDto(run: TaskRunSnapshot): VniteRunDto {
  return {
    status: run.status,
    phaseKey: run.progress?.phase?.key ?? null,
    phaseLabel: run.progress?.phase?.label ?? null,
    work: toRunWorkDto(run.progress?.work),
    counters: run.progress?.counters ?? {},
    canCancel: run.controls.cancelable && run.status !== 'cancelling'
  }
}

function toRunWorkDto(work: ActiveRunWork | undefined): VniteRunWorkDto | null {
  if (!work) {
    return null
  }

  const current = typeof work.current === 'number' ? work.current : undefined
  const total = typeof work.total === 'number' ? work.total : undefined
  const percent =
    typeof work.percent === 'number'
      ? Math.round(work.percent)
      : current !== undefined && total !== undefined && total > 0
        ? Math.round((current / total) * 100)
        : undefined

  return {
    ...(current !== undefined ? { current } : {}),
    ...(total !== undefined ? { total } : {}),
    ...(percent !== undefined ? { percent } : {}),
    ...(work.indeterminate !== undefined ? { indeterminate: work.indeterminate } : {})
  }
}

function toDoneSummaryDto(report: VniteImportReport): VniteDoneSummaryDto {
  return {
    status: report.status,
    fileName: report.fileName,
    created: report.counters.gamesCreated,
    updated: report.counters.gamesUpdated,
    completionCompleted: report.counters.completionCompleted,
    completionFailed: report.counters.completionFailed,
    errors: report.counters.errors ?? 0,
    warnings: report.counters.warnings ?? 0
  }
}
