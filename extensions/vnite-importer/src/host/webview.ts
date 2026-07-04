import {
  createWebviewRpc,
  kisaki,
  type ExtensionContext,
  type WebviewHandle
} from '@kisaki3/extension-sdk'
import type { HostFunctions, UiFunctions } from '../shared/contract'

const extensionName = `Vnite Importer`

/** Registers the sample webview card action. */
export function registerWebview(context: ExtensionContext): void {
  let current: WebviewHandle | null = null

  context.contributions.cardActions.register({
    id: 'open-webview',
    label: 'Open',
    description: `Open the ${extensionName} webview.`,
    async run() {
      if (current) {
        return
      }

      const webview = await kisaki.webviews.open({
        entry: 'main/index.html',
        title: extensionName,
        surface: { kind: 'dialog', size: 'md' }
      })
      current = webview
      webview.onClose(() => {
        current = null
      })

      createWebviewRpc<UiFunctions, HostFunctions>(webview, createHostFunctions(context))
    }
  })
}

function createHostFunctions(context: ExtensionContext): HostFunctions {
  return {
    async loadState() {
      return {
        enabled: (await context.storage.get<boolean>('enabled')) ?? true
      }
    },
    async saveState(state) {
      await context.storage.set('enabled', state.enabled)
    },
    async sendTestNotification() {
      await kisaki.notify.info(extensionName, 'Notification sent from the extension webview.')
    }
  }
}
