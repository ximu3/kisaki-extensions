import type { Disposable, TaskRunProgressWork } from '@kisaki3/extension-sdk'
import type { VniteImportReport } from './report'

/**
 * In-process events emitted by import runs. The wizard webview gets live
 * progress through these (no task-run polling), and the flow store persists
 * the final report from the `finished` event.
 */
export type VniteImportRunEvent =
  | {
      type: 'progress'
      runId: string
      phaseKey: string
      phaseLabel: string
      work?: TaskRunProgressWork
      counters: Readonly<Record<string, number>>
    }
  | {
      type: 'finished'
      report: VniteImportReport
    }

export class VniteImportRunEvents {
  private readonly listeners = new Set<(event: VniteImportRunEvent) => void>()

  subscribe(listener: (event: VniteImportRunEvent) => void): Disposable {
    this.listeners.add(listener)
    return {
      dispose: () => {
        this.listeners.delete(listener)
      }
    }
  }

  emit(event: VniteImportRunEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event)
      } catch {
        // Listener failures must never break the import job itself.
      }
    }
  }
}
