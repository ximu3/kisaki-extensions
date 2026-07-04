import path from 'node:path'
import sanitize from 'sanitize-filename'

export function assertInsidePath(targetPath: string, rootPath: string): void {
  if (!isInsidePath(targetPath, rootPath)) {
    throw new Error('Resolved path is outside of the allowed directory.')
  }
}

export function isInsidePath(targetPath: string, rootPath: string): boolean {
  const relativePath = path.relative(path.resolve(rootPath), path.resolve(targetPath))
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

export function toSafeFileName(input: string, fallback = 'item'): string {
  const cleaned = sanitize(input, { replacement: '_' }).trim()
  return cleaned.length > 0 ? cleaned : fallback
}

export function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/')
}

export function assertSafeZipEntry(entryName: string, extractRoot: string): string {
  const normalized = normalizeZipEntryName(entryName)
  const segments = normalized.split('/').filter(Boolean)

  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    segments.some((segment) => segment === '..')
  ) {
    throw new Error('Archive entry escapes the extraction directory.')
  }

  const targetPath = path.resolve(extractRoot, normalized)
  assertInsidePath(targetPath, extractRoot)
  return targetPath
}
