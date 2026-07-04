import {
  DEFAULT_VNITE_IMPORT_GRAPH_OPTIONS,
  createDefaultVniteImportFieldSelection
} from '../import/options'
import {
  DEFAULT_VNITE_COMPLETION_CUSTOM_SURFACES,
  DEFAULT_VNITE_COMPLETION_SURFACE_PRESET
} from '../completion'
import type { VniteImporterSettingsV1 } from './schema'

export function createDefaultVniteImporterSettings(): VniteImporterSettingsV1 {
  return {
    version: 1,
    defaults: {
      fieldSelection: createDefaultVniteImportFieldSelection(),
      conflictMode: DEFAULT_VNITE_IMPORT_GRAPH_OPTIONS.conflictMode,
      strictAttachments: DEFAULT_VNITE_IMPORT_GRAPH_OPTIONS.strictAttachments,
      completeMetadata: false,
      completionSurfacePreset: DEFAULT_VNITE_COMPLETION_SURFACE_PRESET,
      completionSurfaces: DEFAULT_VNITE_COMPLETION_CUSTOM_SURFACES
    }
  }
}
