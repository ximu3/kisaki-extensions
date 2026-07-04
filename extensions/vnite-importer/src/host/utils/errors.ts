export type VniteImportErrorCode =
  | 'backup_not_selected'
  | 'backup_not_found'
  | 'backup_too_large'
  | 'backup_extract_failed'
  | 'backup_invalid_layout'
  | 'pouch_open_failed'
  | 'pouch_read_failed'
  | 'attachment_missing'
  | 'attachment_export_failed'
  | 'invalid_vnite_doc'
  | 'library_graph_invalid'
  | 'host_graph_failed'
  | 'scraper_profile_missing'
  | 'metadata_completion_failed'
  | 'job_cancelled'

export class VniteImportError extends Error {
  constructor(
    public readonly code: VniteImportErrorCode,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'VniteImportError'
  }
}

export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
