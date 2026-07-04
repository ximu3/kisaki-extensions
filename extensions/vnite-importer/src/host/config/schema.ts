import {
  LIBRARY_GRAPH_CONFLICT_MODES,
  type GameUpdateSurface,
  type LibraryGraphConflictMode
} from '@kisaki3/extension-sdk'
import type { VniteImportFieldSelection } from '../../shared/import-wizard'
import { DEFAULT_VNITE_IMPORT_FIELD_SELECTION } from '../import/options'
import {
  normalizeGameUpdateSurfaces,
  normalizeVniteCompletionSurfacePreset,
  type VniteCompletionSurfacePreset
} from '../completion'
import { createDefaultVniteImporterSettings } from './defaults'

export interface VniteImporterSettingsV1 {
  version: 1
  defaults: {
    fieldSelection: VniteImportFieldSelection
    conflictMode: LibraryGraphConflictMode
    strictAttachments: boolean
    completeMetadata: boolean
    completionSurfacePreset: VniteCompletionSurfacePreset
    completionSurfaces: readonly GameUpdateSurface[]
    scraperProfileId?: string
  }
}

export function normalizeVniteImporterSettings(value: unknown): VniteImporterSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = createDefaultVniteImporterSettings()
  const inputDefaults = asRecord(input?.defaults)
  const scraperProfileId = normalizeOptionalString(inputDefaults?.scraperProfileId)
  const normalizedDefaults: VniteImporterSettingsV1['defaults'] = {
    fieldSelection: normalizeFieldSelection(
      inputDefaults?.fieldSelection,
      defaults.defaults.fieldSelection
    ),
    conflictMode: normalizeConflictMode(
      inputDefaults?.conflictMode,
      defaults.defaults.conflictMode
    ),
    strictAttachments: normalizeBoolean(
      inputDefaults?.strictAttachments,
      defaults.defaults.strictAttachments
    ),
    completeMetadata: normalizeBoolean(
      inputDefaults?.completeMetadata,
      defaults.defaults.completeMetadata
    ),
    completionSurfacePreset: normalizeVniteCompletionSurfacePreset(
      inputDefaults?.completionSurfacePreset,
      defaults.defaults.completionSurfacePreset
    ),
    completionSurfaces: normalizeCompletionSurfaces(
      inputDefaults?.completionSurfaces,
      defaults.defaults.completionSurfaces
    )
  }

  if (scraperProfileId !== undefined) {
    normalizedDefaults.scraperProfileId = scraperProfileId
  }

  return {
    version: 1,
    defaults: normalizedDefaults
  }
}

function normalizeFieldSelection(
  value: unknown,
  defaults: VniteImportFieldSelection
): VniteImportFieldSelection {
  const input = asRecord(value)

  return {
    core: normalizeBooleanGroup(asRecord(input?.core), defaults.core),
    local: normalizeBooleanGroup(asRecord(input?.local), defaults.local),
    activity: normalizeBooleanGroup(asRecord(input?.activity), defaults.activity),
    organization: normalizeBooleanGroup(asRecord(input?.organization), defaults.organization),
    credits: normalizeBooleanGroup(asRecord(input?.credits), defaults.credits),
    media: normalizeBooleanGroup(asRecord(input?.media), defaults.media),
    saves: normalizeBooleanGroup(asRecord(input?.saves), defaults.saves),
    memories: normalizeBooleanGroup(asRecord(input?.memories), defaults.memories)
  }
}

function normalizeBooleanGroup<TGroup extends Record<string, boolean>>(
  value: Record<string, unknown> | undefined,
  defaults: TGroup
): TGroup {
  const result = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof TGroup)[]) {
    result[key] = normalizeBoolean(value?.[String(key)], defaults[key]) as TGroup[keyof TGroup]
  }

  return result
}

function normalizeConflictMode(
  value: unknown,
  fallback: LibraryGraphConflictMode
): LibraryGraphConflictMode {
  return LIBRARY_GRAPH_CONFLICT_MODES.includes(value as LibraryGraphConflictMode)
    ? (value as LibraryGraphConflictMode)
    : fallback
}

function normalizeCompletionSurfaces(
  value: unknown,
  fallback: readonly GameUpdateSurface[]
): readonly GameUpdateSurface[] {
  const surfaces = normalizeGameUpdateSurfaces(value)
  return surfaces.length > 0 ? surfaces : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export { DEFAULT_VNITE_IMPORT_FIELD_SELECTION }
