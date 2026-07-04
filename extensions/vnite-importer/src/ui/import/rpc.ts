import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import type {
  VniteImportWizardHostFunctions,
  VniteImportWizardUiFunctions,
  VniteWizardState
} from '../../shared/import-wizard'

type StateListener = (state: VniteWizardState) => void

let stateListener: StateListener | null = null

/**
 * Registers the receiver for host-pushed wizard state (live run progress and
 * the final report). The document has exactly one root listener.
 */
export function onHostStateChanged(listener: StateListener): void {
  stateListener = listener
}

export const host = createWebviewRpc<VniteImportWizardHostFunctions, VniteImportWizardUiFunctions>(
  webview,
  {
    stateChanged(state) {
      stateListener?.(state)
    }
  }
)

export function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Vnite 导入操作失败。'
}
