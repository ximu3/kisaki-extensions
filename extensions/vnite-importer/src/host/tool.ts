import { kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'

const extensionName = `Vnite Importer`

/** Registers a sample extension-card action. */
export function activateStarter(context: ExtensionContext): void {
  context.contributions.cardActions.register({
    id: 'run',
    label: 'Run',
    description: `Run ${extensionName}.`,
    async run() {
      await kisaki.notify.info(extensionName, 'The sample tool action completed.')
    }
  })
}
