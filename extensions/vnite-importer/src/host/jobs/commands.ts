import type {
  CommandContributionExecuteEvent,
  CommandRegistrar,
  Disposable,
  JsonObject
} from '@kisaki3/extension-sdk'
import { resolveVniteCompletionSurfaces } from '../completion'
import type { VniteImporterSettingsStore } from '../config'
import { VniteImportError } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import type { VniteImportFlowStore } from '../wizard'
import type { VniteImportJobRunner } from './import-runner'

export const VNITE_IMPORTER_COMMAND_IDS = {
  importBackup: 'vnite-importer.importBackup'
} as const

export function registerVniteImporterCommands(input: {
  commands: CommandRegistrar
  runner: VniteImportJobRunner
  settingsStore: VniteImporterSettingsStore
  flowStore: VniteImportFlowStore
  signal: AbortSignal
}): readonly Disposable[] {
  return [
    input.commands.register({
      id: VNITE_IMPORTER_COMMAND_IDS.importBackup,
      title: '导入 Vnite 备份包',
      description: '使用当前设置导入已选择的 Vnite 备份包',
      async execute(_args, event) {
        return await startImportFromCurrentSettings(input, event)
      }
    })
  ]
}

async function startImportFromCurrentSettings(
  input: {
    runner: VniteImportJobRunner
    settingsStore: VniteImporterSettingsStore
    flowStore: VniteImportFlowStore
    signal: AbortSignal
  },
  event: CommandContributionExecuteEvent
): Promise<JsonObject> {
  if (input.signal.aborted) {
    throw new VniteImportError('job_cancelled', 'Vnite 导入已取消。')
  }

  const [settings, flow] = await Promise.all([input.settingsStore.get(), input.flowStore.get()])
  if (!flow.file) {
    throw new VniteImportError('backup_not_selected', '请先在 Vnite 导入设置页选择备份包。')
  }

  if (settings.defaults.completeMetadata && !settings.defaults.scraperProfileId) {
    throw new VniteImportError('scraper_profile_missing', '请先选择刮削配置，或关闭补全。')
  }

  const result = await input.runner.startImportFromGrant({
    fileGrant: flow.file,
    fieldSelection: settings.defaults.fieldSelection,
    conflictMode: settings.defaults.conflictMode,
    strictAttachments: settings.defaults.strictAttachments,
    completion: omitUndefined({
      enabled: settings.defaults.completeMetadata,
      profileId: settings.defaults.scraperProfileId,
      surfaces: resolveVniteCompletionSurfaces({
        preset: settings.defaults.completionSurfacePreset,
        customSurfaces: settings.defaults.completionSurfaces
      })
    }),
    initiator: event.source
  })
  await input.flowStore.setActiveRun(result.runId)

  return { runId: result.runId }
}
