import type {
  ExtensionLogger,
  JsonObject,
  TaskRunHandle,
  TaskRunProgressUpdate,
  TaskRunProgressWorkInput,
  TaskRunWarning
} from '@kisaki3/extension-sdk'
import { createTaskRunProgressWork, isTaskRunCancellation } from '@kisaki3/extension-sdk'
import type { VniteImportDiagnostic } from '../backup/types'
import { VniteImportError, toSafeErrorMessage } from '../utils/errors'
import type { VniteImportExecutorResult } from '../import/executor'
import type { VniteImportRunEvents } from './events'
import { createVniteImportReport, toFallbackCounters, type VniteImportReport } from './report'

export const VNITE_IMPORT_JOB_PHASES = {
  extracting: '正在解压备份包',
  reading: '正在读取 Vnite 数据',
  buildingGraph: '正在构建资料库图',
  attachments: '正在准备媒体文件',
  writing: '正在写入 Kisaki 资料库',
  completion: '正在补全元数据',
  cleanup: '正在清理临时文件',
  finished: '导入完成'
} as const

export type VniteImportJobPhase = keyof typeof VNITE_IMPORT_JOB_PHASES

/**
 * Representative warnings forwarded to the task run result. The full
 * diagnostic list lives in the extension's own report; task-run results are
 * bounded summaries by contract.
 */
const RESULT_WARNING_LIMIT = 10

export interface VniteImportJobRun {
  fileName: string
  run: TaskRunHandle
  events: VniteImportRunEvents
}

interface VniteImportJobState {
  startedAt: number
  counters: Record<string, number>
  diagnostics: VniteImportDiagnostic[]
}

export class VniteImportJobController {
  constructor(
    private readonly state: VniteImportJobState,
    private readonly context: VniteImportJobRun
  ) {}

  get signal(): AbortSignal {
    return this.context.run.signal
  }

  get diagnostics(): readonly VniteImportDiagnostic[] {
    return this.state.diagnostics
  }

  async checkpoint(): Promise<void> {
    await this.context.run.checkpoint()
  }

  addDiagnostic(diagnostic: VniteImportDiagnostic): void {
    this.state.diagnostics.push(diagnostic)
    if (diagnostic.level === 'warning') {
      this.increment('warnings')
    }
  }

  addDiagnostics(diagnostics: readonly VniteImportDiagnostic[]): void {
    for (const diagnostic of diagnostics) {
      this.addDiagnostic(diagnostic)
    }
  }

  increment(key: string, amount = 1): void {
    this.state.counters[key] = (this.state.counters[key] ?? 0) + amount
  }

  mergeCounters(counters: Record<string, number>): void {
    for (const [key, value] of Object.entries(counters)) {
      this.state.counters[key] = value
    }
  }

  async report(phase: VniteImportJobPhase, progress: TaskRunProgressWorkInput = {}): Promise<void> {
    const update: TaskRunProgressUpdate = {
      phase: {
        key: phase,
        label: VNITE_IMPORT_JOB_PHASES[phase]
      },
      counters: this.state.counters
    }
    const work = createTaskRunProgressWork(progress)
    if (work) {
      update.work = work
    }

    await this.context.run.report(update)
    this.context.events.emit({
      type: 'progress',
      runId: this.context.run.id,
      phaseKey: phase,
      phaseLabel: VNITE_IMPORT_JOB_PHASES[phase],
      ...(work ? { work: { ...work } } : {}),
      counters: { ...this.state.counters }
    })
  }
}

/**
 * Runs one import inside its task run: reports progress, finishes the run
 * with a bounded result, and emits the full report as an in-process event.
 */
export async function runVniteImportJob(
  context: VniteImportJobRun,
  logger: ExtensionLogger | undefined,
  execute: (job: VniteImportJobController) => Promise<VniteImportExecutorResult>
): Promise<VniteImportReport> {
  const state: VniteImportJobState = {
    startedAt: Date.now(),
    counters: {},
    diagnostics: []
  }
  const job = new VniteImportJobController(state, context)

  let report: VniteImportReport
  try {
    await job.checkpoint()
    const execution = await execute(job)
    job.mergeCounters({ ...execution.summary.counters })
    await job.report('finished', {
      current: execution.summary.counters.gamesTotal,
      total: execution.summary.counters.gamesTotal
    })

    report = createVniteImportReport({
      runId: context.run.id,
      status: 'completed',
      fileName: context.fileName,
      startedAt: state.startedAt,
      counters: execution.summary.counters,
      diagnostics: [...execution.summary.diagnostics, ...state.diagnostics]
    })
    await finishRun(context, logger, () =>
      context.run.complete({
        summary: createCompletedMessage(report),
        output: toTaskRunOutput(report),
        counters: { ...report.counters },
        warnings: toTaskRunWarnings(report.diagnostics)
      })
    )
  } catch (error) {
    const cancelled = isVniteImportCancellation(error, context.run.signal)
    report = createVniteImportReport({
      runId: context.run.id,
      status: cancelled ? 'cancelled' : 'failed',
      fileName: context.fileName,
      startedAt: state.startedAt,
      counters: toFallbackCounters(state.counters),
      diagnostics: cancelled
        ? state.diagnostics
        : [...state.diagnostics, toFailureDiagnostic(error)]
    })

    if (cancelled) {
      await job.report('cleanup', { indeterminate: true }).catch(() => undefined)
      await finishRun(context, logger, () =>
        context.run.cancel({
          summary: 'Vnite 导入已取消。',
          output: toTaskRunOutput(report),
          counters: { ...report.counters },
          warnings: toTaskRunWarnings(report.diagnostics)
        })
      )
    } else {
      await finishRun(context, logger, () =>
        context.run.fail(error, {
          summary: toUserErrorMessage(error),
          output: toTaskRunOutput(report),
          counters: { ...report.counters },
          warnings: toTaskRunWarnings(report.diagnostics)
        })
      )
      logger?.warn('Vnite import job failed.', toSafeJobErrorLog(error))
    }
  }

  context.events.emit({ type: 'finished', report })
  return report
}

/**
 * Finishing the run must never lose the report: if the host rejects the
 * result payload it also terminates the run with a minimal terminal state, so
 * the failure is logged and the in-process report flow continues.
 */
async function finishRun(
  context: VniteImportJobRun,
  logger: ExtensionLogger | undefined,
  finish: () => Promise<void>
): Promise<void> {
  try {
    await finish()
  } catch (error) {
    logger?.warn('Vnite import task run result was rejected.', toSafeJobErrorLog(error))
  }
}

function toTaskRunOutput(report: VniteImportReport): JsonObject {
  return {
    fileName: report.fileName,
    status: report.status,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    counters: { ...report.counters },
    diagnosticsTotal: report.diagnosticsTotal
  }
}

function toTaskRunWarnings(
  diagnostics: readonly VniteImportDiagnostic[]
): readonly TaskRunWarning[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.level === 'warning')
    .slice(0, RESULT_WARNING_LIMIT)
    .map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message
    }))
}

function createCompletedMessage(report: VniteImportReport): string {
  return `Vnite 导入完成：新增 ${report.counters.gamesCreated} 个游戏，更新 ${report.counters.gamesUpdated} 个游戏。`
}

function toFailureDiagnostic(error: unknown): VniteImportDiagnostic {
  return {
    level: 'error',
    code: error instanceof VniteImportError ? error.code : 'host_graph_failed',
    message: toUserErrorMessage(error)
  }
}

function isVniteImportCancellation(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted ||
    isTaskRunCancellation(error) ||
    (error instanceof VniteImportError && error.code === 'job_cancelled')
  )
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof VniteImportError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return 'Vnite 导入失败。'
}

function toSafeJobErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof VniteImportError) {
    return {
      code: error.code,
      message: error.message,
      dbName: error.context?.dbName,
      docId: error.context?.docId,
      attachmentId: error.context?.attachmentId
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    }
  }

  return {
    message: toSafeErrorMessage(error)
  }
}
