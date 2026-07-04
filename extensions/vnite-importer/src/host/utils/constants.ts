export const VNITE_IMPORTER_EXTENSION_ID = 'vnite-importer'
export const VNITE_IMPORTER_PANEL_ID = 'settings'
export const VNITE_IMPORTER_NAME = 'Vnite 导入'
export const VNITE_BACKUP_DATABASE_NAMES = ['game', 'game-local', 'game-collection'] as const
export const VNITE_BACKUP_MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024
export const VNITE_IMPORT_TEMP_DIR = 'vnite-import'
export const VNITE_IMPORTER_STORAGE_KEYS = {
  settings: 'settings.v1',
  flow: 'flow.current'
} as const
