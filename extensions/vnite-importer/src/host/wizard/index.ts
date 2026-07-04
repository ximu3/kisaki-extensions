import {
  createWebviewRpc,
  kisaki,
  type ExtensionContext,
  type WebviewHandle
} from '@kisaki3/extension-sdk'
import {
  VNITE_IMPORT_WIZARD_ENTRY,
  type VniteImportWizardHostFunctions,
  type VniteImportWizardUiFunctions
} from '../../shared/import-wizard'
import type { VniteImportRunEvent } from '../jobs/events'
import { createVniteImportWizardFunctions, prepareVniteImportWizardSession } from './functions'
import { VniteWizardSession } from './session'
import { resolveWizardState } from './state'
import type { VniteImportWizardRuntime } from './runtime'

export * from './store'
export * from './preview-games'
export * from './diagnostics'
export * from './session'
export type { VniteImportWizardRuntime } from './runtime'

/**
 * Registers the import wizard card action and manages the singleton wizard
 * webview session. Import runs in this host process push their progress and
 * final report into the open document; the persisted flow is updated from the
 * same events so a reopened wizard resumes consistently.
 */
export function registerVniteImportWizard(
  context: ExtensionContext,
  runtime: VniteImportWizardRuntime
): void {
  const session = new VniteWizardSession(runtime.logger)
  let current: WebviewHandle | null = null

  context.subscriptions.add(
    runtime.jobRunner.onRunEvent((event) => {
      void handleRunEvent(runtime, session, event)
    })
  )
  context.subscriptions.add({ dispose: () => session.dispose() })

  context.contributions.cardActions.register({
    id: 'import-wizard',
    label: '导入',
    description: '从 Vnite 备份包导入资料库。',
    async run() {
      if (current) {
        return
      }

      await prepareVniteImportWizardSession(runtime, session)

      const webview = await kisaki.webviews.open({
        entry: VNITE_IMPORT_WIZARD_ENTRY,
        title: 'Vnite 导入',
        surface: { kind: 'dialog', size: '2xl' }
      })
      current = webview
      webview.onClose(() => {
        current = null
        session.detach()
      })

      const remote = createWebviewRpc<VniteImportWizardUiFunctions, VniteImportWizardHostFunctions>(
        webview,
        createVniteImportWizardFunctions(runtime, session)
      )
      session.attach(remote)
    }
  })
}

async function handleRunEvent(
  runtime: VniteImportWizardRuntime,
  session: VniteWizardSession,
  event: VniteImportRunEvent
): Promise<void> {
  if (event.type === 'progress') {
    session.notifyProgress(event)
    return
  }

  try {
    await runtime.flowStore.setDone(event.report)
    session.push(await resolveWizardState(runtime, session))
  } catch (error) {
    runtime.logger.warn('Vnite importer failed to record the import report.', {
      message: error instanceof Error ? error.message : String(error)
    })
  }
}
