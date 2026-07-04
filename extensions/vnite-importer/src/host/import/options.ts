import type { LibraryGraphConflictMode } from '@kisaki3/extension-api'
import type {
  PartialVniteImportFieldSelection,
  VniteImportFieldSelection
} from '../../shared/import-wizard'

export interface VniteImportGraphOptions {
  conflictMode: LibraryGraphConflictMode
  strictAttachments: boolean
}

export const DEFAULT_VNITE_IMPORT_GRAPH_OPTIONS: VniteImportGraphOptions = {
  conflictMode: 'mergeSelected',
  strictAttachments: false
}

export const DEFAULT_VNITE_IMPORT_FIELD_SELECTION: VniteImportFieldSelection = {
  core: {
    name: true,
    originalName: true,
    sortName: true,
    releaseDate: true,
    description: true,
    relatedSites: true,
    externalIds: true,
    nsfw: true
  },
  local: {
    launcher: true,
    gameDirPath: true,
    savePath: true
  },
  activity: {
    status: true,
    score: true,
    totalDuration: true,
    lastActiveAt: true,
    sessions: true,
    createdAt: true
  },
  organization: {
    collections: true,
    tags: true,
    genresAsTags: true,
    platformsAsTags: false
  },
  credits: {
    companies: true,
    personsFromExtra: false,
    unknownExtraAsNotes: false
  },
  media: {
    cover: true,
    backdrop: true,
    logo: true,
    icon: true,
    descriptionImages: false
  },
  saves: {
    saveBackups: false,
    maxSaveBackups: true
  },
  memories: {
    notes: true,
    noteImages: true
  }
}

export function createDefaultVniteImportFieldSelection(): VniteImportFieldSelection {
  return mergeVniteImportFieldSelection()
}

export function mergeVniteImportFieldSelection(
  selection?: PartialVniteImportFieldSelection
): VniteImportFieldSelection {
  return {
    core: { ...DEFAULT_VNITE_IMPORT_FIELD_SELECTION.core, ...selection?.core },
    local: { ...DEFAULT_VNITE_IMPORT_FIELD_SELECTION.local, ...selection?.local },
    activity: { ...DEFAULT_VNITE_IMPORT_FIELD_SELECTION.activity, ...selection?.activity },
    organization: {
      ...DEFAULT_VNITE_IMPORT_FIELD_SELECTION.organization,
      ...selection?.organization
    },
    credits: { ...DEFAULT_VNITE_IMPORT_FIELD_SELECTION.credits, ...selection?.credits },
    media: { ...DEFAULT_VNITE_IMPORT_FIELD_SELECTION.media, ...selection?.media },
    saves: { ...DEFAULT_VNITE_IMPORT_FIELD_SELECTION.saves, ...selection?.saves },
    memories: { ...DEFAULT_VNITE_IMPORT_FIELD_SELECTION.memories, ...selection?.memories }
  }
}
