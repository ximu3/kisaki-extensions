import type { ExtensionLogger, WebviewRpcRemote } from '@kisaki3/extension-sdk'
import type {
  VniteImportWizardUiFunctions,
  VnitePreviewQueryDto,
  VniteWizardState
} from '../../shared/import-wizard'
import { VNITE_PREVIEW_DEFAULT_PAGE_SIZE } from '../../shared/import-wizard'
import type { VniteBackupAnalysisSummary } from '../backup/types'
import type { VniteImportExecutionSummary } from '../import/summary'
import type { VniteImportRunEvent } from '../jobs/events'
import type { VniteImportPreviewGame } from './preview-games'

/**
 * Coalesces high-frequency job progress (per-attachment reports) into pushes
 * the document can comfortably render.
 */
const PROGRESS_PUSH_INTERVAL_MS = 200

/**
 * Preview produced for the current wizard pass. Session state only: it is
 * recomputed from the backup on demand and is meaningless across host
 * restarts, so it never touches storage.
 */
export interface VniteWizardPreview {
  createdAt: number
  analysis: VniteBackupAnalysisSummary
  summary: VniteImportExecutionSummary
  games: readonly VniteImportPreviewGame[]
}

/**
 * In-memory wizard session: the current preview, the connected webview (if
 * any), and the last state snapshot used to patch live run progress without
 * recomputing the full state.
 */
export class VniteWizardSession {
  analysis: VniteBackupAnalysisSummary | null = null
  preview: VniteWizardPreview | null = null
  previewQuery: VnitePreviewQueryDto = createDefaultPreviewQuery()

  private remote: WebviewRpcRemote<VniteImportWizardUiFunctions> | null = null
  private lastState: VniteWizardState | null = null
  private pendingProgress: Extract<VniteImportRunEvent, { type: 'progress' }> | null = null
  private progressTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly logger: ExtensionLogger) {}

  attach(remote: WebviewRpcRemote<VniteImportWizardUiFunctions>): void {
    this.remote = remote
  }

  detach(): void {
    this.remote = null
    this.lastState = null
    this.clearProgressTimer()
  }

  clearPreview(): void {
    this.preview = null
    this.previewQuery = createDefaultPreviewQuery()
  }

  clearAnalysis(): void {
    this.analysis = null
  }

  resetPreviewQuery(): void {
    this.previewQuery = createDefaultPreviewQuery()
  }

  setPreviewQuery(query: VnitePreviewQueryDto): void {
    this.previewQuery = query
  }

  /**
   * Records the state a handler is about to return so progress patches build
   * on the same snapshot the document is rendering.
   */
  rememberState(state: VniteWizardState): void {
    this.lastState = state
  }

  push(state: VniteWizardState): void {
    this.lastState = state
    if (!this.remote) {
      return
    }

    this.remote.stateChanged(state).catch((error: unknown) => {
      this.logger.warn('Vnite wizard state push failed.', {
        message: error instanceof Error ? error.message : String(error)
      })
    })
  }

  notifyProgress(event: Extract<VniteImportRunEvent, { type: 'progress' }>): void {
    if (!this.remote) {
      return
    }

    if (this.progressTimer) {
      this.pendingProgress = event
      return
    }

    this.pushProgress(event)
    this.progressTimer = setTimeout(() => {
      this.progressTimer = null
      const pending = this.pendingProgress
      this.pendingProgress = null
      if (pending) {
        this.notifyProgress(pending)
      }
    }, PROGRESS_PUSH_INTERVAL_MS)
  }

  dispose(): void {
    this.detach()
    this.analysis = null
    this.preview = null
  }

  private pushProgress(event: Extract<VniteImportRunEvent, { type: 'progress' }>): void {
    if (!this.lastState) {
      return
    }

    this.push({
      ...this.lastState,
      step: 'running',
      run: {
        status: 'running',
        phaseKey: event.phaseKey,
        phaseLabel: event.phaseLabel,
        work: event.work ? { ...event.work } : null,
        counters: { ...event.counters },
        canCancel: true
      }
    })
  }

  private clearProgressTimer(): void {
    if (this.progressTimer) {
      clearTimeout(this.progressTimer)
      this.progressTimer = null
    }
    this.pendingProgress = null
  }
}

function createDefaultPreviewQuery(): VnitePreviewQueryDto {
  return {
    action: 'all',
    search: '',
    page: 1,
    pageSize: VNITE_PREVIEW_DEFAULT_PAGE_SIZE
  }
}
