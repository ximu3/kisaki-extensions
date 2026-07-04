import type { ExtensionFileGrant, ExtensionStorage } from '@kisaki3/extension-sdk'
import { VNITE_IMPORTER_STORAGE_KEYS } from '../utils/constants'
import type { VniteImportStep } from '../../shared/import-wizard'
import type { VniteImportReport } from '../jobs/report'

export interface VniteStoredFileGrant {
  grantId: string
  name: string
  sizeBytes: number
  path: string
}

/**
 * Persisted wizard flow. Deliberately small: the picked backup grant, the
 * active run id, and the last import report. Preview data is session state
 * and lives in host memory only ({@link import('./session').VniteWizardSession}).
 */
export interface VniteImportFlowState {
  version: 1
  step: VniteImportStep
  file?: VniteStoredFileGrant
  activeRunId?: string
  lastReport?: VniteImportReport
  updatedAt: number
}

export class VniteImportFlowStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(): Promise<VniteImportFlowState> {
    return normalizeFlowState(await this.storage.get(VNITE_IMPORTER_STORAGE_KEYS.flow))
  }

  async set(state: VniteImportFlowState): Promise<VniteImportFlowState> {
    const normalized = normalizeFlowState(state)
    await this.storage.set(VNITE_IMPORTER_STORAGE_KEYS.flow, normalized)
    return normalized
  }

  async setFileGrant(
    grant: Pick<ExtensionFileGrant, 'grantId' | 'name' | 'sizeBytes' | 'path'>,
    step: VniteImportStep = 'pickBackup'
  ): Promise<VniteImportFlowState> {
    return await this.set({
      version: 1,
      step,
      file: {
        grantId: grant.grantId,
        name: grant.name,
        sizeBytes: grant.sizeBytes,
        path: grant.path
      },
      updatedAt: Date.now()
    })
  }

  async setStep(step: VniteImportStep): Promise<VniteImportFlowState> {
    return await this.update((state) => ({
      ...state,
      step,
      updatedAt: Date.now()
    }))
  }

  async setActiveRun(runId: string): Promise<VniteImportFlowState> {
    return await this.update((state) => ({
      ...state,
      step: 'running',
      activeRunId: runId,
      updatedAt: Date.now()
    }))
  }

  async setDone(report: VniteImportReport): Promise<VniteImportFlowState> {
    return await this.update((state) => {
      const rest = { ...state }
      delete rest.activeRunId
      return {
        ...rest,
        step: 'done',
        lastReport: report,
        updatedAt: Date.now()
      }
    })
  }

  async clearActiveRun(): Promise<VniteImportFlowState> {
    return await this.update((state) => {
      const rest = { ...state }
      delete rest.activeRunId
      return {
        ...rest,
        step: rest.file ? 'config' : 'pickBackup',
        updatedAt: Date.now()
      }
    })
  }

  async reset(): Promise<VniteImportFlowState> {
    return await this.set({
      version: 1,
      step: 'pickBackup',
      updatedAt: Date.now()
    })
  }

  private async update(
    update: (state: VniteImportFlowState) => VniteImportFlowState
  ): Promise<VniteImportFlowState> {
    return await this.set(update(await this.get()))
  }
}

export function resolveVniteImportStep(input: {
  flow: VniteImportFlowState
  hasActiveRun: boolean
  hasPreview: boolean
}): VniteImportStep {
  const flow = input.flow
  if (input.hasActiveRun) {
    return 'running'
  }
  if (flow.step === 'done' && flow.lastReport) {
    return 'done'
  }
  if (!flow.file) {
    return 'pickBackup'
  }
  if (flow.step === 'pickBackup') {
    return 'pickBackup'
  }
  if (flow.step === 'preview' && input.hasPreview) {
    return 'preview'
  }
  return 'config'
}

function normalizeFlowState(value: unknown): VniteImportFlowState {
  if (!isRecord(value) || value.version !== 1) {
    return createEmptyFlowState()
  }

  const normalized: VniteImportFlowState = {
    version: 1,
    step: normalizeStep(value.step),
    updatedAt: normalizeTimestamp(value.updatedAt)
  }

  const file = normalizeFile(value.file)
  if (file) {
    normalized.file = file
  }

  const activeRunId = normalizeOptionalString(value.activeRunId)
  if (activeRunId) {
    normalized.activeRunId = activeRunId
  }

  const lastReport = normalizeReport(value.lastReport)
  if (lastReport) {
    normalized.lastReport = lastReport
  }

  return normalized
}

function createEmptyFlowState(): VniteImportFlowState {
  return {
    version: 1,
    step: 'pickBackup',
    updatedAt: Date.now()
  }
}

function normalizeStep(value: unknown): VniteImportStep {
  switch (value) {
    case 'pickBackup':
    case 'config':
    case 'preview':
    case 'running':
    case 'done':
      return value
    default:
      return 'pickBackup'
  }
}

function normalizeFile(value: unknown): VniteStoredFileGrant | undefined {
  const input = isRecord(value) ? value : undefined
  const grantId = normalizeOptionalString(input?.grantId)
  const name = normalizeOptionalString(input?.name)
  const path = normalizeOptionalString(input?.path)
  const sizeBytes = normalizeNumber(input?.sizeBytes)

  if (!grantId || !name || !path || sizeBytes === undefined) {
    return undefined
  }

  return { grantId, name, path, sizeBytes }
}

function normalizeReport(value: unknown): VniteImportReport | undefined {
  // Reports are written exclusively by this extension's job lifecycle; the
  // shape check guards against truncated or foreign storage content only.
  return isRecord(value) &&
    typeof value.runId === 'string' &&
    typeof value.status === 'string' &&
    isRecord(value.counters) &&
    Array.isArray(value.diagnostics)
    ? (value as unknown as VniteImportReport)
    : undefined
}

function normalizeTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : Date.now()
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
