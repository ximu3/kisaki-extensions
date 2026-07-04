import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { VNITE_IMPORT_TEMP_DIR } from '../utils/constants'
import { toSafeFileName } from '../utils/path'
import type { VniteBackupWorkspace } from './types'

export interface CreateVniteBackupWorkspaceOptions {
  runId?: string
  purpose?: string
}

export class BackupWorkspaceManager {
  constructor(private readonly tempRootPath: string) {}

  async create(options: CreateVniteBackupWorkspaceOptions = {}): Promise<VniteBackupWorkspace> {
    const runId = toSafeFileName(options.runId ?? randomUUID(), 'run')
    const purpose = toSafeFileName(options.purpose ?? 'analysis', 'analysis')
    const rootPath = path.join(this.tempRootPath, VNITE_IMPORT_TEMP_DIR, `${purpose}-${runId}`)
    const workspace: VniteBackupWorkspace = {
      runId,
      rootPath,
      extractPath: path.join(rootPath, 'extract'),
      attachmentsPath: path.join(rootPath, 'attachments')
    }

    await mkdir(workspace.extractPath, { recursive: true })
    await mkdir(workspace.attachmentsPath, { recursive: true })
    return workspace
  }

  async cleanup(workspace: VniteBackupWorkspace): Promise<void> {
    await rm(workspace.rootPath, { recursive: true, force: true })
  }
}
