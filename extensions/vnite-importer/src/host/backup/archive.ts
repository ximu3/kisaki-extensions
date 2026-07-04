import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import extract from 'extract-zip'
import { VNITE_BACKUP_MAX_SIZE_BYTES } from '../utils/constants'
import { VniteImportError, toSafeErrorMessage } from '../utils/errors'
import { assertSafeZipEntry } from '../utils/path'
import { matchesVniteBackupRoot } from './validation'

export interface ExtractVniteBackupArchiveInput {
  archivePath: string
  extractRoot: string
  maxSizeBytes?: number
}

export interface ExtractedVniteBackupArchive {
  archivePath: string
  extractRoot: string
  backupRoot: string
  sizeBytes: number
}

export async function extractVniteBackupArchive(
  input: ExtractVniteBackupArchiveInput
): Promise<ExtractedVniteBackupArchive> {
  const sizeBytes = await validateBackupArchive(input.archivePath, input.maxSizeBytes)
  const extractRoot = path.resolve(input.extractRoot)

  await rm(extractRoot, { recursive: true, force: true })
  await mkdir(extractRoot, { recursive: true })

  try {
    await extract(input.archivePath, {
      dir: extractRoot,
      onEntry(entry) {
        assertSafeZipEntry(entry.fileName, extractRoot)
      }
    })
  } catch (error) {
    throw new VniteImportError('backup_extract_failed', 'Vnite 备份包解压失败。', {
      message: toSafeErrorMessage(error)
    })
  }

  const backupRoot = await detectVniteBackupRoot(extractRoot)
  return {
    archivePath: input.archivePath,
    extractRoot,
    backupRoot,
    sizeBytes
  }
}

export async function detectVniteBackupRoot(extractRoot: string): Promise<string> {
  const resolvedRoot = path.resolve(extractRoot)

  if (await matchesVniteBackupRoot(resolvedRoot)) {
    return resolvedRoot
  }

  const entries = await readdir(resolvedRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const candidate = path.join(resolvedRoot, entry.name)
    if (await matchesVniteBackupRoot(candidate)) {
      return candidate
    }
  }

  throw new VniteImportError('backup_invalid_layout', '未找到有效的 Vnite 数据库备份目录。')
}

async function validateBackupArchive(archivePath: string, maxSizeBytes?: number): Promise<number> {
  let archiveStats: Awaited<ReturnType<typeof stat>>
  try {
    archiveStats = await stat(archivePath)
  } catch {
    throw new VniteImportError('backup_not_found', 'Vnite 备份包不存在。')
  }

  if (!archiveStats.isFile()) {
    throw new VniteImportError('backup_not_found', 'Vnite 备份包不是文件。')
  }

  if (path.extname(archivePath).toLowerCase() !== '.zip') {
    throw new VniteImportError('backup_invalid_layout', 'Vnite 备份包必须是 zip 文件。')
  }

  const limit = maxSizeBytes ?? VNITE_BACKUP_MAX_SIZE_BYTES
  if (archiveStats.size > limit) {
    throw new VniteImportError('backup_too_large', 'Vnite 备份包超过大小限制。')
  }

  return archiveStats.size
}
