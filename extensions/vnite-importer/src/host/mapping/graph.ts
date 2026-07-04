import type {
  LibraryGraphEdge,
  LibraryGraphNodeKind,
  LibraryGraphNodeRef
} from '@kisaki3/extension-api'

export function createVniteGameNodeKey(gameId: string): string {
  return `vnite:game:${gameId}`
}

export function createVniteCollectionNodeKey(collectionId: string): string {
  return `vnite:collection:${collectionId}`
}

export function createVniteTagNodeKey(name: string): string {
  return `vnite:tag:${name}`
}

export function createVniteCompanyNodeKey(gameId: string, name: string): string {
  return `vnite:company:${gameId}:${name}`
}

export function createVnitePersonNodeKey(gameId: string, name: string): string {
  return `vnite:person:${gameId}:${name}`
}

export function createVniteMemoryNoteNodeKey(gameId: string, memoryId: string): string {
  return `vnite:note:memory:${gameId}:${memoryId}`
}

export function createVniteExtraNoteNodeKey(gameId: string): string {
  return `vnite:note:extra:${gameId}`
}

export function createVniteSessionNodeKey(gameId: string, index: number): string {
  return `vnite:session:${gameId}:${index}`
}

export function createVniteAttachmentNodeKey(gameId: string, attachmentId: string): string {
  return `vnite:attachment:${gameId}:${attachmentId}`
}

export function createGraphNodeRef(kind: LibraryGraphNodeKind, key: string): LibraryGraphNodeRef {
  return { kind, key }
}

export function createVniteEdgeIdentity(edge: LibraryGraphEdge): string {
  switch (edge.kind) {
    case 'media-company':
    case 'media-person':
      return `${edge.kind}:${edge.from.kind}:${edge.from.key}:${edge.to.kind}:${edge.to.key}:${edge.role}`
    case 'media-attachment':
      return `${edge.kind}:${edge.from.kind}:${edge.from.key}:${edge.to.kind}:${edge.to.key}:${edge.slot}`
    default:
      return `${edge.kind}:${edge.from.kind}:${edge.from.key}:${edge.to.kind}:${edge.to.key}`
  }
}
