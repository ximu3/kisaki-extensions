import type { VniteImportDiagnostic } from '../backup/types'

export interface VniteMetadataCompletionSummary {
  completed: number
  failed: number
  skipped: number
  diagnostics: readonly VniteImportDiagnostic[]
}

export function createEmptyVniteMetadataCompletionSummary(): VniteMetadataCompletionSummary {
  return {
    completed: 0,
    failed: 0,
    skipped: 0,
    diagnostics: []
  }
}
