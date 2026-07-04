import type { VniteAttachmentMetadata } from '../vnite/attachments'
import type {
  NormalizedVniteCollection,
  NormalizedVniteGame,
  NormalizedVniteGameLocal,
  VnitePouchAttachmentStub,
  VniteRawDocument
} from '../vnite/models'
import type { VniteBackupStatistics } from '../vnite/statistics'
import type { VNITE_BACKUP_DATABASE_NAMES } from '../utils/constants'

export type VniteBackupDatabaseName = (typeof VNITE_BACKUP_DATABASE_NAMES)[number]

export type VniteImportDiagnosticLevel = 'info' | 'warning' | 'error'

// Type alias keeps the implicit index signature so diagnostics stay
// assignable to the JsonValue task-run output contract.
export type VniteImportDiagnostic = {
  level: VniteImportDiagnosticLevel
  code: string
  message: string
  itemKey?: string
  vniteGameId?: string
  vniteGameName?: string
  targetGameId?: string
  dbName?: VniteBackupDatabaseName
  docId?: string
  attachmentId?: string
}

export interface VnitePouchDocument {
  id: string
  doc: VniteRawDocument
  attachments: Readonly<Record<string, VnitePouchAttachmentStub>>
}

export interface VniteBackupGame extends NormalizedVniteGame {
  local?: NormalizedVniteGameLocal
  attachments: readonly VniteAttachmentMetadata[]
  diagnostics: readonly VniteImportDiagnostic[]
}

export interface VniteBackupSnapshot {
  rootPath: string
  games: readonly VniteBackupGame[]
  gameLocals: readonly NormalizedVniteGameLocal[]
  collections: readonly NormalizedVniteCollection[]
  diagnostics: readonly VniteImportDiagnostic[]
  readAt: number
}

export interface VniteFieldCoverageSummary {
  key: string
  label: string
  present: number
  total: number
}

export interface VniteBackupAnalysisSummary {
  createdAt: number
  file?: {
    name: string
    sizeBytes: number
  }
  statistics: VniteBackupStatistics
  fieldCoverage: readonly VniteFieldCoverageSummary[]
  diagnostics: readonly VniteImportDiagnostic[]
}

export interface VniteBackupAnalysisResult {
  snapshot: VniteBackupSnapshot
  summary: VniteBackupAnalysisSummary
  workspace: VniteBackupWorkspace
}

export interface VniteBackupWorkspace {
  runId: string
  rootPath: string
  extractPath: string
  attachmentsPath: string
}
