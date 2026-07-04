import { defineExtension, kisaki } from '@kisaki3/extension-sdk'
import { VniteImporterSettingsStore } from './config'
import { registerVniteImporterCommands, VniteImportJobRunner } from './jobs'
import { registerVniteImportWizard, VniteImportFlowStore } from './wizard'

export default defineExtension({
  async activate(context) {
    const settingsStore = new VniteImporterSettingsStore(context.storage)
    const flowStore = new VniteImportFlowStore(context.storage)
    await settingsStore.get()

    const jobRunner = new VniteImportJobRunner({
      graph: kisaki.library.graph,
      workspaceRoot: context.extension.tempPath,
      files: kisaki.files,
      ingest: kisaki.ingest,
      scraperProfiles: kisaki.scrapers.profiles,
      taskRuns: kisaki.taskRuns,
      logger: context.logger
    })
    context.logger.info('Vnite importer activated.')
    for (const registration of registerVniteImporterCommands({
      commands: context.contributions.commands,
      runner: jobRunner,
      settingsStore,
      flowStore,
      signal: context.abortSignal
    })) {
      context.subscriptions.add(registration)
    }
    registerVniteImportWizard(context, {
      settingsStore,
      flowStore,
      jobRunner,
      library: kisaki.library,
      files: kisaki.files,
      scrapers: kisaki.scrapers,
      taskRuns: kisaki.taskRuns,
      logger: context.logger,
      abortSignal: context.abortSignal
    })
  }
})
