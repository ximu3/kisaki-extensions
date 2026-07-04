import { nowTimestamp } from '../utils/time'
import { omitUndefined } from '../utils/object'
import { classifyVniteAttachments, type VniteAttachmentMetadata } from '../vnite/attachments'
import {
  normalizeVniteCollectionDoc,
  normalizeVniteGameDoc,
  normalizeVniteGameLocalDoc
} from '../vnite/normalization'
import type {
  NormalizedVniteCollection,
  NormalizedVniteGame,
  NormalizedVniteGameLocal
} from '../vnite/models'
import { VnitePouchStore } from './pouch'
import type {
  VniteBackupDatabaseName,
  VniteBackupGame,
  VniteBackupSnapshot,
  VniteImportDiagnostic,
  VnitePouchDocument
} from './types'

export class VniteBackupReader {
  async read(backupRoot: string): Promise<VniteBackupSnapshot> {
    const pouch = new VnitePouchStore(backupRoot)
    const [gameDocs, gameLocalDocs, collectionDocs] = await Promise.all([
      pouch.readAllDocs('game'),
      pouch.readAllDocs('game-local'),
      pouch.readAllDocs('game-collection')
    ])
    const diagnostics: VniteImportDiagnostic[] = []
    const gameLocals = normalizeDocuments(
      'game-local',
      gameLocalDocs,
      normalizeVniteGameLocalDoc,
      diagnostics
    )
    const gameLocalById = new Map(gameLocals.map((local) => [local.id, local]))
    const games = normalizeGameDocuments(gameDocs, gameLocalById, diagnostics)
    const collections = normalizeDocuments(
      'game-collection',
      collectionDocs,
      normalizeVniteCollectionDoc,
      diagnostics
    )

    return {
      rootPath: backupRoot,
      games,
      gameLocals,
      collections,
      diagnostics,
      readAt: nowTimestamp()
    }
  }
}

function normalizeGameDocuments(
  docs: readonly VnitePouchDocument[],
  gameLocalById: ReadonlyMap<string, NormalizedVniteGameLocal>,
  diagnostics: VniteImportDiagnostic[]
): readonly VniteBackupGame[] {
  const games: VniteBackupGame[] = []

  for (const doc of docs) {
    const result = normalizeVniteGameDoc(doc.doc, doc.id)
    const itemDiagnostics = toDiagnostics('game', result.issues, doc.id)
    diagnostics.push(...itemDiagnostics)

    if (!result.value) {
      continue
    }

    games.push(
      omitUndefined({
        ...result.value,
        local: gameLocalById.get(result.value.id),
        attachments: classifyVniteAttachments(doc.attachments),
        diagnostics: itemDiagnostics
      })
    )
  }

  return games
}

function normalizeDocuments<TValue extends NormalizedVniteGameLocal | NormalizedVniteCollection>(
  dbName: VniteBackupDatabaseName,
  docs: readonly VnitePouchDocument[],
  normalize: (
    doc: unknown,
    fallbackId?: string
  ) => {
    value?: TValue
    issues: readonly {
      level: 'warning' | 'error'
      code: string
      message: string
      docId?: string
      field?: string
    }[]
  },
  diagnostics: VniteImportDiagnostic[]
): readonly TValue[] {
  const values: TValue[] = []

  for (const doc of docs) {
    const result = normalize(doc.doc, doc.id)
    diagnostics.push(...toDiagnostics(dbName, result.issues, doc.id))

    if (result.value) {
      values.push(result.value)
    }
  }

  return values
}

function toDiagnostics(
  dbName: VniteBackupDatabaseName,
  issues: readonly {
    level: 'warning' | 'error'
    code: string
    message: string
    docId?: string
    field?: string
  }[],
  fallbackDocId: string
): VniteImportDiagnostic[] {
  return issues.map((issue) =>
    omitUndefined({
      level: issue.level,
      code: issue.code,
      message: issue.message,
      dbName,
      docId: issue.docId ?? fallbackDocId,
      vniteGameId: dbName === 'game' ? (issue.docId ?? fallbackDocId) : undefined
    })
  )
}

export function getGameAttachment(
  game: Pick<NormalizedVniteGame, 'id'> & { attachments: readonly VniteAttachmentMetadata[] },
  attachmentId: string
): VniteAttachmentMetadata | undefined {
  return game.attachments.find((attachment) => attachment.id === attachmentId)
}
