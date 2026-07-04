import type {
  Disposable,
  ExtensionFileGrant,
  ExtensionLogger,
  TaskRunHandle,
  TaskRunInitiator,
  TaskRunsCapability,
  FilesCapability,
  GameUpdateSurface,
  IngestCapability,
  LibraryGraphCapability,
  LibraryGraphConflictMode,
  ScraperProfilesCapability
} from '@kisaki3/extension-sdk'
import { VNITE_BACKUP_MAX_SIZE_BYTES, VNITE_IMPORTER_EXTENSION_ID } from '../utils/constants'
import { createVniteBackupAnalysisSummary } from '../backup/analyzer'
import { extractVniteBackupArchive } from '../backup/archive'
import { VniteBackupReader } from '../backup/reader'
import { BackupWorkspaceManager } from '../backup/workspace'
import type {
  VniteBackupAnalysisSummary,
  VniteBackupSnapshot,
  VniteBackupWorkspace,
  VniteImportDiagnostic
} from '../backup/types'
import { VniteImportError, toSafeErrorMessage } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import type { PartialVniteImportFieldSelection } from '../../shared/import-wizard'
import {
  VniteImportExecutor,
  type VniteAttachmentExportProgress,
  type VniteImportExecutorResult
} from '../import/executor'
import {
  VniteMetadataCompletionRunner,
  createEmptyVniteMetadataCompletionSummary,
  type VniteMetadataCompletionSummary
} from '../completion'
import { runVniteImportJob, type VniteImportJobController, type VniteImportJobRun } from './context'
import { VniteImportRunEvents, type VniteImportRunEvent } from './events'
import type { VniteImportReport } from './report'

export interface VniteImportJobRunnerDependencies {
  graph: LibraryGraphCapability
  workspaceRoot: string
  files?: FilesCapability
  ingest?: IngestCapability
  scraperProfiles?: ScraperProfilesCapability
  taskRuns?: TaskRunsCapability
  logger?: ExtensionLogger
}

export interface VniteMetadataCompletionOptions {
  enabled: boolean
  profileId?: string
  surfaces: readonly GameUpdateSurface[]
}

export interface VniteImportOptions {
  requestId?: string
  fieldSelection?: PartialVniteImportFieldSelection
  conflictMode?: LibraryGraphConflictMode
  strictAttachments?: boolean
  maxSizeBytes?: number
  completion?: VniteMetadataCompletionOptions
}

export interface VniteImportPreviewInput extends VniteImportOptions {
  fileGrant: Pick<ExtensionFileGrant, 'name' | 'path' | 'sizeBytes'>
}

export interface VniteImportRunInput extends VniteImportOptions {
  fileGrant: Pick<ExtensionFileGrant, 'grantId' | 'name' | 'path' | 'sizeBytes'>
  initiator?: TaskRunInitiator
  releaseGrantOnCleanup?: boolean
}

export interface VniteImportPreviewResult {
  analysis: VniteBackupAnalysisSummary
  snapshot: VniteBackupSnapshot
  execution: VniteImportExecutorResult
}

export interface VniteImportStartResult {
  runId: string
}

interface ReadBackupResult {
  workspace: VniteBackupWorkspace
  snapshot: VniteBackupSnapshot
  analysis: VniteBackupAnalysisSummary
}

export class VniteImportJobRunner {
  private readonly workspaceManager: BackupWorkspaceManager
  private readonly executor: VniteImportExecutor
  private readonly completion: VniteMetadataCompletionRunner
  private readonly events = new VniteImportRunEvents()

  constructor(private readonly deps: VniteImportJobRunnerDependencies) {
    this.workspaceManager = new BackupWorkspaceManager(deps.workspaceRoot)
    this.executor = new VniteImportExecutor(
      omitUndefined({
        graph: deps.graph,
        logger: deps.logger
      })
    )
    this.completion = new VniteMetadataCompletionRunner(
      omitUndefined({
        ingest: deps.ingest,
        profiles: deps.scraperProfiles,
        logger: deps.logger
      })
    )
  }

  async analyzeFromGrant(input: VniteImportPreviewInput): Promise<VniteBackupAnalysisSummary> {
    const read = await this.readBackup(
      omitUndefined({
        fileGrant: input.fileGrant,
        purpose: 'preview',
        requestId: input.requestId,
        maxSizeBytes: input.maxSizeBytes
      })
    )

    try {
      return read.analysis
    } finally {
      await this.cleanupWorkspace(read.workspace)
    }
  }

  async previewFromGrant(input: VniteImportPreviewInput): Promise<VniteImportPreviewResult> {
    const read = await this.readBackup(
      omitUndefined({
        fileGrant: input.fileGrant,
        purpose: 'preview',
        requestId: input.requestId,
        maxSizeBytes: input.maxSizeBytes
      })
    )

    try {
      const execution = await this.executor.preview(
        omitUndefined({
          snapshot: read.snapshot,
          workspace: read.workspace,
          requestId: input.requestId,
          fieldSelection: input.fieldSelection,
          conflictMode: input.conflictMode,
          strictAttachments: input.strictAttachments
        })
      )

      return {
        analysis: read.analysis,
        snapshot: read.snapshot,
        execution
      }
    } finally {
      await this.cleanupWorkspace(read.workspace)
    }
  }

  async startImportFromGrant(input: VniteImportRunInput): Promise<VniteImportStartResult> {
    if (!this.deps.taskRuns) {
      throw new VniteImportError('host_graph_failed', 'Vnite 导入任务能力不可用。')
    }

    const run = await this.deps.taskRuns.create(
      omitUndefined({
        operation: 'vnite.import',
        title: '导入 Vnite 备份包',
        description: input.fileGrant.name,
        initiator: input.initiator,
        subject: {
          type: 'extension',
          id: VNITE_IMPORTER_EXTENSION_ID
        },
        controls: {
          cancelable: true,
          pausable: false
        },
        presentation: {
          notify: {
            enabled: true,
            title: '导入 Vnite 备份包',
            showProgress: true,
            showResult: true,
            closable: true
          }
        }
      })
    )

    void this.runImportFromGrant(input, run).catch((error) => {
      this.deps.logger?.warn('Vnite import task launcher failed.', toSafeRunLog(error))
    })

    return { runId: run.id }
  }

  /**
   * Live run events for in-process consumers (wizard push, report
   * persistence). Listeners must not throw.
   */
  onRunEvent(listener: (event: VniteImportRunEvent) => void): Disposable {
    return this.events.subscribe(listener)
  }

  async runImportFromGrant(
    input: VniteImportRunInput,
    run: TaskRunHandle
  ): Promise<VniteImportReport> {
    return await runVniteImportJob(
      {
        fileName: input.fileGrant.name,
        run,
        events: this.events
      } satisfies VniteImportJobRun,
      this.deps.logger,
      async (job) => await this.executeImport(input, job)
    )
  }

  private async executeImport(
    input: VniteImportRunInput,
    job: VniteImportJobController
  ): Promise<VniteImportExecutorResult> {
    let workspace: VniteBackupWorkspace | undefined

    try {
      await job.report('extracting', { indeterminate: true })
      const read = await this.readBackup(
        omitUndefined({
          fileGrant: input.fileGrant,
          purpose: 'import',
          requestId: input.requestId,
          maxSizeBytes: input.maxSizeBytes,
          checkpoint: () => job.checkpoint()
        })
      )
      workspace = read.workspace

      job.mergeCounters({
        gamesTotal: read.analysis.statistics.games.total,
        warnings: read.analysis.diagnostics.filter((diagnostic) => diagnostic.level === 'warning')
          .length
      })
      await job.report('buildingGraph', { indeterminate: true })

      const execution = await this.executor.apply(
        omitUndefined({
          snapshot: read.snapshot,
          workspace: read.workspace,
          requestId: input.requestId,
          fieldSelection: input.fieldSelection,
          conflictMode: input.conflictMode,
          strictAttachments: input.strictAttachments,
          signal: job.signal,
          checkpoint: () => job.checkpoint(),
          reportAttachmentProgress: async (progress: VniteAttachmentExportProgress) => {
            await job.report('attachments', progress)
          },
          beforeGraphCall: async () => {
            await job.report('writing', { indeterminate: true })
          }
        })
      )

      if (!input.completion?.enabled) {
        return execution
      }

      const completion = await this.runCompletion({
        input,
        snapshot: read.snapshot,
        execution,
        job
      })

      return mergeCompletionSummary(execution, completion)
    } finally {
      await job.report('cleanup', { indeterminate: true }).catch(() => undefined)
      await this.cleanupWorkspace(workspace, job)
      if (input.releaseGrantOnCleanup !== false) {
        await this.releaseGrant(input.fileGrant.grantId, job)
      }
    }
  }

  private async runCompletion(input: {
    input: VniteImportRunInput
    snapshot: VniteBackupSnapshot
    execution: VniteImportExecutorResult
    job: VniteImportJobController
  }): Promise<VniteMetadataCompletionSummary> {
    const options = input.input.completion
    if (!options?.enabled) {
      return createEmptyVniteMetadataCompletionSummary()
    }

    await input.job.report('completion', {
      current: 0,
      total:
        input.execution.summary.counters.gamesCreated +
        input.execution.summary.counters.gamesUpdated
    })

    return await this.completion.run(
      omitUndefined({
        graph: input.execution.graph,
        snapshot: input.snapshot,
        profileId: options.profileId,
        surfaces: options.surfaces,
        signal: input.job.signal,
        checkpoint: () => input.job.checkpoint(),
        reportProgress: (progress: { current: number; total: number }) =>
          input.job.report('completion', progress)
      })
    )
  }

  private async readBackup(input: {
    fileGrant: Pick<ExtensionFileGrant, 'name' | 'path' | 'sizeBytes'>
    purpose: 'preview' | 'import'
    requestId?: string
    maxSizeBytes?: number
    checkpoint?: () => Promise<void>
  }): Promise<ReadBackupResult> {
    const workspace = await this.workspaceManager.create(
      omitUndefined({
        purpose: input.purpose,
        runId: input.requestId
      })
    )

    try {
      await input.checkpoint?.()
      const extracted = await extractVniteBackupArchive({
        archivePath: input.fileGrant.path,
        extractRoot: workspace.extractPath,
        maxSizeBytes: input.maxSizeBytes ?? VNITE_BACKUP_MAX_SIZE_BYTES
      })
      await input.checkpoint?.()

      const snapshot = await new VniteBackupReader().read(extracted.backupRoot)
      const analysis = await createVniteBackupAnalysisSummary(snapshot, {
        archivePath: input.fileGrant.name,
        sizeBytes: input.fileGrant.sizeBytes
      })

      return {
        workspace,
        snapshot,
        analysis
      }
    } catch (error) {
      await this.cleanupWorkspace(workspace)
      throw error
    }
  }

  private async cleanupWorkspace(
    workspace: VniteBackupWorkspace | undefined,
    job?: VniteImportJobController
  ): Promise<void> {
    if (!workspace) {
      return
    }

    try {
      await this.workspaceManager.cleanup(workspace)
    } catch (error) {
      const diagnostic = createCleanupDiagnostic(error)
      job?.addDiagnostic(diagnostic)
      this.deps.logger?.warn('Vnite import workspace cleanup failed.', toSafeRunLog(error))
    }
  }

  private async releaseGrant(grantId: string, job: VniteImportJobController): Promise<void> {
    if (!this.deps.files) {
      return
    }

    try {
      await this.deps.files.releaseGrant(grantId)
    } catch (error) {
      const diagnostic = createCleanupDiagnostic(error)
      job.addDiagnostic(diagnostic)
      this.deps.logger?.warn('Vnite import file grant release failed.', toSafeRunLog(error))
    }
  }
}

function mergeCompletionSummary(
  execution: VniteImportExecutorResult,
  completion: VniteMetadataCompletionSummary
): VniteImportExecutorResult {
  const diagnostics = [...execution.summary.diagnostics, ...completion.diagnostics]

  return {
    ...execution,
    summary: {
      ...execution.summary,
      counters: {
        ...execution.summary.counters,
        completionCompleted: completion.completed,
        completionFailed: completion.failed,
        warnings: diagnostics.filter((diagnostic) => diagnostic.level === 'warning').length
      },
      diagnostics
    }
  }
}

function createCleanupDiagnostic(error: unknown): VniteImportDiagnostic {
  void error
  return {
    level: 'warning',
    code: 'vnite.cleanup.failed',
    message: '临时文件清理失败，可稍后重试或等待系统清理。'
  }
}

function toSafeRunLog(error: unknown): Record<string, unknown> {
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
