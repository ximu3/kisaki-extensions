import type { ExtensionFileGrant } from '@kisaki3/extension-sdk'
import type {
  VniteImportFieldSelection,
  VniteImportOptionsForm,
  VniteImportWizardHostFunctions,
  VniteWizardState
} from '../../shared/import-wizard'
import type { VniteImporterSettingsV1 } from '../config'
import { VNITE_BACKUP_MAX_SIZE_BYTES } from '../utils/constants'
import { omitUndefined } from '../utils/object'
import { createVniteImportPreviewGames } from './preview-games'
import type { VniteWizardSession } from './session'
import { resolveImportRunState, resolveWizardState } from './state'
import type { VniteStoredFileGrant } from './store'
import type { VniteImportWizardRuntime } from './runtime'

/**
 * RPC handlers exposed to the wizard webview. Each handler mutates flow or
 * session state and returns the freshly resolved wizard state.
 */
export function createVniteImportWizardFunctions(
  runtime: VniteImportWizardRuntime,
  session: VniteWizardSession
): VniteImportWizardHostFunctions {
  const refresh = (): Promise<VniteWizardState> => resolveWizardState(runtime, session)

  return {
    getState: refresh,

    async pickBackupFile() {
      const grant = await runtime.files.pickFile({
        title: '选择 Vnite 备份包',
        filters: [{ name: 'Vnite 备份包', extensions: ['zip'] }],
        copyTo: 'temp',
        maxSizeBytes: VNITE_BACKUP_MAX_SIZE_BYTES
      })

      if (grant) {
        let analysis
        try {
          analysis = await runtime.jobRunner.analyzeFromGrant({
            fileGrant: grant,
            requestId: createRequestId()
          })
        } catch (error) {
          await releaseGrant(runtime, grant.grantId)
          throw error
        }

        const flow = await runtime.flowStore.get()
        if (flow.file && flow.file.grantId !== grant.grantId) {
          await releaseGrant(runtime, flow.file.grantId)
        }
        session.analysis = analysis
        session.clearPreview()
        await runtime.flowStore.setFileGrant(grant, 'pickBackup')
      }

      return await refresh()
    },

    async goToConfig() {
      const flow = await runtime.flowStore.get()
      requireFileGrant(flow.file)
      await runtime.flowStore.setStep('config')
      return await refresh()
    },

    async backToConfig() {
      await runtime.flowStore.setStep('config')
      return await refresh()
    },

    async resetFlow() {
      await resetTransientFlow(runtime, session)
      return await refresh()
    },

    async generatePreview(options, fieldSelection) {
      const flow = await runtime.flowStore.get()
      const fileGrant = requireFileGrant(flow.file)
      const settings = await persistOptions(runtime, options, fieldSelection)
      validateCompletionOptions(options)

      const result = await runtime.jobRunner.previewFromGrant({
        fileGrant,
        requestId: createRequestId(),
        fieldSelection: settings.defaults.fieldSelection,
        conflictMode: settings.defaults.conflictMode,
        strictAttachments: settings.defaults.strictAttachments
      })
      session.preview = {
        createdAt: Date.now(),
        analysis: result.analysis,
        summary: result.execution.summary,
        games: await createVniteImportPreviewGames({
          snapshot: result.snapshot,
          graph: result.execution.graph,
          library: runtime.library
        })
      }
      session.resetPreviewQuery()
      await runtime.flowStore.setStep('preview')

      return await refresh()
    },

    async setPreviewQuery(query) {
      if (!session.preview) {
        throw new Error('请先生成写入预览。')
      }

      session.setPreviewQuery(query)
      return await refresh()
    },

    async startImport(options, fieldSelection) {
      const flow = await runtime.flowStore.get()
      const fileGrant = requireFileGrant(flow.file)
      const settings = await persistOptions(runtime, options, fieldSelection)
      validateCompletionOptions(options)

      const result = await runtime.jobRunner.startImportFromGrant({
        fileGrant,
        requestId: createRequestId(),
        fieldSelection: settings.defaults.fieldSelection,
        conflictMode: settings.defaults.conflictMode,
        strictAttachments: settings.defaults.strictAttachments,
        completion: omitUndefined({
          enabled: options.completeMetadata,
          profileId: options.scraperProfileId || undefined,
          surfaces: options.completionSurfaces
        }),
        initiator: { type: 'user' }
      })
      await runtime.flowStore.setActiveRun(result.runId)
      session.clearPreview()

      return await refresh()
    },

    async cancelImport() {
      const flow = await runtime.flowStore.get()
      if (flow.activeRunId) {
        await runtime.taskRuns.cancelOwn(flow.activeRunId)
      }

      return await refresh()
    }
  }
}

/**
 * Drops stale wizard state left behind by an earlier session when no import
 * run is active anymore.
 */
export async function prepareVniteImportWizardSession(
  runtime: VniteImportWizardRuntime,
  session: VniteWizardSession
): Promise<void> {
  const runState = await resolveImportRunState(runtime)
  if (runState.activeRun) {
    return
  }

  const flow = runState.flow
  if (flow.file || flow.activeRunId || session.preview || flow.step !== 'pickBackup') {
    await resetTransientFlow(runtime, session)
  }
}

async function resetTransientFlow(
  runtime: VniteImportWizardRuntime,
  session: VniteWizardSession
): Promise<void> {
  const flow = await runtime.flowStore.get()
  if (flow.file) {
    await releaseGrant(runtime, flow.file.grantId)
  }
  session.clearAnalysis()
  session.clearPreview()
  await runtime.flowStore.reset()
}

async function releaseGrant(runtime: VniteImportWizardRuntime, grantId: string): Promise<void> {
  await runtime.files.releaseGrant(grantId).catch((error: unknown) => {
    runtime.logger.warn('Vnite importer failed to release file grant.', {
      message: error instanceof Error ? error.message : String(error)
    })
  })
}

async function persistOptions(
  runtime: VniteImportWizardRuntime,
  options: VniteImportOptionsForm,
  fieldSelection?: VniteImportFieldSelection
): Promise<VniteImporterSettingsV1> {
  return await runtime.settingsStore.update((settings) => ({
    ...settings,
    defaults: omitUndefined({
      ...settings.defaults,
      fieldSelection: fieldSelection ?? settings.defaults.fieldSelection,
      conflictMode: options.conflictMode,
      completeMetadata: options.completeMetadata,
      completionSurfacePreset: options.completionSurfacePreset,
      completionSurfaces: options.completionSurfaces,
      strictAttachments: options.strictAttachments,
      scraperProfileId: options.scraperProfileId || settings.defaults.scraperProfileId
    })
  }))
}

function requireFileGrant(
  file: VniteStoredFileGrant | undefined
): Pick<ExtensionFileGrant, 'grantId' | 'name' | 'path' | 'sizeBytes'> {
  if (!file) {
    throw new Error('请先选择 Vnite 备份包。')
  }

  return file
}

function validateCompletionOptions(options: VniteImportOptionsForm): void {
  if (options.completeMetadata && !options.scraperProfileId) {
    throw new Error('请先选择刮削配置，或关闭补全。')
  }
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `vnite-import:${Date.now()}`
}
