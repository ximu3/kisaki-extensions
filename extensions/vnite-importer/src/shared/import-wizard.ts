import type {
  TaskRunStatus,
  GameUpdateSurface,
  LibraryGraphConflictMode
} from '@kisaki3/extension-sdk'

export type VniteImportStep = 'pickBackup' | 'config' | 'preview' | 'running' | 'done'

export interface VniteImportFieldSelection {
  core: {
    name: boolean
    originalName: boolean
    sortName: boolean
    releaseDate: boolean
    description: boolean
    relatedSites: boolean
    externalIds: boolean
    nsfw: boolean
  }
  local: {
    launcher: boolean
    gameDirPath: boolean
    savePath: boolean
  }
  activity: {
    status: boolean
    score: boolean
    totalDuration: boolean
    lastActiveAt: boolean
    sessions: boolean
    createdAt: boolean
  }
  organization: {
    collections: boolean
    tags: boolean
    genresAsTags: boolean
    platformsAsTags: boolean
  }
  credits: {
    companies: boolean
    personsFromExtra: boolean
    unknownExtraAsNotes: boolean
  }
  media: {
    cover: boolean
    backdrop: boolean
    logo: boolean
    icon: boolean
    descriptionImages: boolean
  }
  saves: {
    saveBackups: boolean
    maxSaveBackups: boolean
  }
  memories: {
    notes: boolean
    noteImages: boolean
  }
}

export type PartialVniteImportFieldSelection = {
  [TGroup in keyof VniteImportFieldSelection]?: Partial<VniteImportFieldSelection[TGroup]>
}

/**
 * Webview RPC contract between the extension host entry and the import wizard
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const VNITE_IMPORT_WIZARD_ENTRY = 'import/index.html'

export type VniteCompletionSurfacePresetValue = 'missingCoreAndMedia' | 'missingAll' | 'custom'

export interface VniteImportOptionsForm {
  completeMetadata: boolean
  scraperProfileId: string
  completionSurfacePreset: VniteCompletionSurfacePresetValue
  completionSurfaces: readonly GameUpdateSurface[]
  conflictMode: LibraryGraphConflictMode
  strictAttachments: boolean
}

export interface VnitePreviewSummaryDto {
  created: number
  updated: number
  skipped: number
  errors: number
  warnings: number
}

export interface VniteDiagnosticCountDto {
  errors: number
  warnings: number
  infos: number
}

export interface VniteBackupCoverageDto {
  key: string
  label: string
  present: number
  total: number
  percent: number
}

export interface VniteBackupAnalysisDto {
  createdAt: number
  fileName: string
  sizeBytes: number
  gamesTotal: number
  localGamesTotal: number
  collectionsTotal: number
  collectionLinksTotal: number
  attachmentsTotal: number
  playedGamesTotal: number
  scoredGamesTotal: number
  saveGamesTotal: number
  memoryGamesTotal: number
  diagnostics: VniteDiagnosticCountDto
  coverage: readonly VniteBackupCoverageDto[]
}

export type VnitePreviewActionDto = 'create' | 'update' | 'skip' | 'fail'

export type VnitePreviewActionFilterDto = 'all' | VnitePreviewActionDto

export const VNITE_PREVIEW_DEFAULT_PAGE_SIZE = 50

export type VnitePreviewSectionKeyDto = 'metadata' | 'activity' | 'organization'

export interface VnitePreviewFieldDto {
  label: string
  value: string
}

export interface VnitePreviewSectionDto {
  key: VnitePreviewSectionKeyDto
  label: string
  current: readonly VnitePreviewFieldDto[]
  incoming: readonly VnitePreviewFieldDto[]
}

export interface VniteDiagnosticRowDto {
  level: string
  subject: string
  message: string
}

export interface VnitePreviewRowDto {
  id: string
  title: string
  action: VnitePreviewActionDto
  sections: readonly VnitePreviewSectionDto[]
  diagnostics: VniteDiagnosticCountDto
  diagnosticRows: readonly VniteDiagnosticRowDto[]
}

export interface VnitePreviewQueryDto {
  action: VnitePreviewActionFilterDto
  search: string
  page: number
  pageSize: number
}

export interface VnitePreviewPaginationDto {
  page: number
  pageSize: number
  pagesTotal: number
  allRowsTotal: number
  filteredRowsTotal: number
  firstRow: number
  lastRow: number
}

export interface VnitePreviewDto {
  summary: VnitePreviewSummaryDto
  query: VnitePreviewQueryDto
  pagination: VnitePreviewPaginationDto
  rows: readonly VnitePreviewRowDto[]
}

export interface VniteRunWorkDto {
  current?: number
  total?: number
  percent?: number
  indeterminate?: boolean
}

export interface VniteRunDto {
  status: TaskRunStatus
  phaseKey: string | null
  /**
   * Current phase label reported by the import job, when available. The UI
   * owns the fallback wording for bare statuses.
   */
  phaseLabel: string | null
  work: VniteRunWorkDto | null
  counters: Record<string, number>
  canCancel: boolean
}

export type VniteImportRunStatusDto = 'completed' | 'failed' | 'cancelled'

export interface VniteDoneSummaryDto {
  status: VniteImportRunStatusDto
  fileName: string
  created: number
  updated: number
  completionCompleted: number
  completionFailed: number
  errors: number
  warnings: number
}

export interface VniteWizardState {
  step: VniteImportStep
  file: { name: string; sizeBytes: number } | null
  analysis: VniteBackupAnalysisDto | null
  options: VniteImportOptionsForm
  fieldSelection: VniteImportFieldSelection
  profiles: readonly { value: string; label: string }[]
  preview: VnitePreviewDto | null
  run: VniteRunDto | null
  doneSummary: VniteDoneSummaryDto | null
  diagnostics: readonly VniteDiagnosticRowDto[]
  diagnosticsTotal: number
}

/**
 * Functions the extension host exposes to the wizard webview.
 */
export interface VniteImportWizardHostFunctions {
  getState(): Promise<VniteWizardState>
  pickBackupFile(): Promise<VniteWizardState>
  goToConfig(): Promise<VniteWizardState>
  backToConfig(): Promise<VniteWizardState>
  resetFlow(): Promise<VniteWizardState>
  generatePreview(
    options: VniteImportOptionsForm,
    fieldSelection: VniteImportFieldSelection
  ): Promise<VniteWizardState>
  setPreviewQuery(query: VnitePreviewQueryDto): Promise<VniteWizardState>
  startImport(
    options: VniteImportOptionsForm,
    fieldSelection: VniteImportFieldSelection
  ): Promise<VniteWizardState>
  cancelImport(): Promise<VniteWizardState>
}

/**
 * Functions the wizard webview exposes to the extension host. The import job
 * runs in this same host process, so live run progress is pushed straight
 * into the document instead of being polled.
 */
export interface VniteImportWizardUiFunctions {
  stateChanged(state: VniteWizardState): void
}
