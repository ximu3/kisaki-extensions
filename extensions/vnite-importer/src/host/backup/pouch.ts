import path from 'node:path'
import PouchDB from 'pouchdb'
import { VniteImportError, toSafeErrorMessage } from '../utils/errors'
import { readAttachmentStubs } from '../vnite/normalization'
import type { VniteBackupDatabaseName, VnitePouchDocument } from './types'

export class VnitePouchStore {
  constructor(private readonly backupRoot: string) {}

  async readAllDocs(dbName: VniteBackupDatabaseName): Promise<readonly VnitePouchDocument[]> {
    const db = this.openDatabase(dbName)

    try {
      const result = await db.allDocs({
        include_docs: true,
        attachments: false
      })

      return result.rows
        .filter((row) => !row.id.startsWith('_design/') && row.doc)
        .map((row) => {
          const doc = row.doc as unknown as Record<string, unknown>
          return {
            id: row.id,
            doc,
            attachments: readAttachmentStubs(doc._attachments)
          }
        })
    } catch (error) {
      throw new VniteImportError('pouch_read_failed', '读取 Vnite 数据库失败。', {
        dbName,
        message: toSafeErrorMessage(error)
      })
    } finally {
      await closeDatabase(db)
    }
  }

  async getAttachment(
    dbName: VniteBackupDatabaseName,
    docId: string,
    attachmentId: string
  ): Promise<Buffer> {
    const db = this.openDatabase(dbName)

    try {
      const attachment = await db.getAttachment(docId, attachmentId)
      return toBuffer(attachment)
    } catch (error) {
      throw new VniteImportError('attachment_missing', '读取 Vnite 附件失败。', {
        dbName,
        docId,
        attachmentId,
        message: toSafeErrorMessage(error)
      })
    } finally {
      await closeDatabase(db)
    }
  }

  private openDatabase(dbName: VniteBackupDatabaseName): PouchDB.Database {
    try {
      return new PouchDB(path.join(this.backupRoot, dbName))
    } catch (error) {
      throw new VniteImportError('pouch_open_failed', '打开 Vnite 数据库失败。', {
        dbName,
        message: toSafeErrorMessage(error)
      })
    }
  }
}

async function closeDatabase(db: PouchDB.Database): Promise<void> {
  try {
    await db.close()
  } catch {
    // Closing a best-effort read handle must not mask the actual read result.
  }
}

async function toBuffer(value: Blob | Buffer | ArrayBuffer): Promise<Buffer> {
  if (Buffer.isBuffer(value)) {
    return value
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value)
  }

  return Buffer.from(await value.arrayBuffer())
}
