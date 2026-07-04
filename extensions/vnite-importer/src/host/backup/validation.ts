import { access, stat } from 'node:fs/promises'
import path from 'node:path'
import { VNITE_BACKUP_DATABASE_NAMES } from '../utils/constants'
import type { VniteBackupDatabaseName } from './types'

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await stat(targetPath)).isDirectory()
  } catch {
    return false
  }
}

export async function findMissingVniteDatabases(
  rootPath: string
): Promise<readonly VniteBackupDatabaseName[]> {
  const missing: VniteBackupDatabaseName[] = []

  for (const dbName of VNITE_BACKUP_DATABASE_NAMES) {
    const dbPath = path.join(rootPath, dbName)
    if (!(await isDirectory(dbPath))) {
      missing.push(dbName)
    }
  }

  return missing
}

export async function matchesVniteBackupRoot(rootPath: string): Promise<boolean> {
  return (await findMissingVniteDatabases(rootPath)).length === 0
}
