import type {
  ExtensionLogger,
  FilesCapability,
  LibraryCapability,
  ScrapersCapability,
  TaskRunsCapability
} from '@kisaki3/extension-sdk'
import type { VniteImporterSettingsStore } from '../config'
import type { VniteImportJobRunner } from '../jobs/import-runner'
import type { VniteImportFlowStore } from './store'

export interface VniteImportWizardRuntime {
  settingsStore: VniteImporterSettingsStore
  flowStore: VniteImportFlowStore
  jobRunner: VniteImportJobRunner
  library: LibraryCapability
  files: FilesCapability
  scrapers: ScrapersCapability
  taskRuns: TaskRunsCapability
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
