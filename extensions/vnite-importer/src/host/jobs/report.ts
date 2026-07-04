import type { VniteImportDiagnostic } from '../backup/types'
import type { VniteImportExecutionCounters } from '../import/summary'

export type VniteImportRunStatus = 'completed' | 'failed' | 'cancelled'

/**
 * Bound on diagnostics kept per report; the counters carry the full totals.
 * The report is the extension's own record of an import run, persisted in
 * extension storage — the task run result only receives a bounded summary.
 */
export const VNITE_REPORT_DIAGNOSTIC_LIMIT = 500

export type VniteImportReport = {
  runId: string
  status: VniteImportRunStatus
  fileName: string
  startedAt: number
  finishedAt: number
  counters: VniteImportExecutionCounters
  diagnostics: readonly VniteImportDiagnostic[]
  diagnosticsTotal: number
}

export function createVniteImportReport(input: {
  runId: string
  status: VniteImportRunStatus
  fileName: string
  startedAt: number
  counters: VniteImportExecutionCounters
  diagnostics: readonly VniteImportDiagnostic[]
}): VniteImportReport {
  return {
    runId: input.runId,
    status: input.status,
    fileName: input.fileName,
    startedAt: input.startedAt,
    finishedAt: Date.now(),
    counters: {
      ...input.counters,
      errors: countLevel(input.diagnostics, 'error'),
      warnings: countLevel(input.diagnostics, 'warning')
    },
    diagnostics: input.diagnostics.slice(0, VNITE_REPORT_DIAGNOSTIC_LIMIT),
    diagnosticsTotal: input.diagnostics.length
  }
}

/**
 * Counters for terminal paths reached before the executor produced a full
 * counter set; loose state counters fill in what is known.
 */
export function toFallbackCounters(
  counters: Readonly<Record<string, number>>
): VniteImportExecutionCounters {
  return {
    gamesTotal: counters.gamesTotal ?? 0,
    gamesCreated: counters.gamesCreated ?? 0,
    gamesUpdated: counters.gamesUpdated ?? 0,
    gamesSkipped: counters.gamesSkipped ?? 0,
    gamesFailed: counters.gamesFailed ?? 0,
    collectionsCreated: counters.collectionsCreated ?? 0,
    collectionsUpdated: counters.collectionsUpdated ?? 0,
    attachmentsImported: counters.attachmentsImported ?? 0,
    attachmentsFailed: counters.attachmentsFailed ?? 0,
    completionCompleted: counters.completionCompleted ?? 0,
    completionFailed: counters.completionFailed ?? 0,
    errors: counters.errors ?? 0,
    warnings: counters.warnings ?? 0
  }
}

function countLevel(
  diagnostics: readonly VniteImportDiagnostic[],
  level: VniteImportDiagnostic['level']
): number {
  return diagnostics.filter((diagnostic) => diagnostic.level === level).length
}
