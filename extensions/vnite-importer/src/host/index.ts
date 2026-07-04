import { defineExtension } from '@kisaki3/extension-sdk'
import { activateStarter } from './tool'
import { registerWebview } from './webview'

const extensionName = `Vnite Importer`

export default defineExtension({
  async activate(context) {
    context.logger.info(`${extensionName} activated.`)
    await activateStarter(context)
    registerWebview(context)
  }
})
