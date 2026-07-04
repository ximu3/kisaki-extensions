import type {
  LibraryGraphAttachmentNode,
  LibraryGraphCollectionNode,
  LibraryGraphCompanyNode,
  LibraryGraphDiagnostic,
  LibraryGraphEdge,
  LibraryGraphInput,
  LibraryGraphMediaNode,
  LibraryGraphNoteNode,
  LibraryGraphPersonNode,
  LibraryGraphSessionNode,
  LibraryGraphTagNode
} from '@kisaki3/extension-api'
import { createVniteEdgeIdentity, createVniteGraphDiagnostic } from '../mapping'

export class VniteGraphBuildAccumulator {
  private readonly media: LibraryGraphMediaNode[] = []
  private readonly collections: LibraryGraphCollectionNode[] = []
  private readonly tags: LibraryGraphTagNode[] = []
  private readonly companies: LibraryGraphCompanyNode[] = []
  private readonly people: LibraryGraphPersonNode[] = []
  private readonly notes: LibraryGraphNoteNode[] = []
  private readonly sessions: LibraryGraphSessionNode[] = []
  private readonly attachments: LibraryGraphAttachmentNode[] = []
  private readonly edgesValue: LibraryGraphEdge[] = []
  private readonly allNodeKeys = new Set<string>()
  private readonly edgeIdentities = new Set<string>()
  private readonly mediaKeyByGameId = new Map<string, string>()
  private readonly tagKeyByName = new Map<string, string>()
  private readonly diagnosticsValue: LibraryGraphDiagnostic[] = []

  get nodes(): LibraryGraphInput['nodes'] {
    return {
      media: this.media,
      collections: this.collections,
      tags: this.tags,
      companies: this.companies,
      people: this.people,
      notes: this.notes,
      sessions: this.sessions,
      attachments: this.attachments
    }
  }

  get edges(): readonly LibraryGraphEdge[] {
    return [...this.edgesValue]
  }

  get diagnostics(): readonly LibraryGraphDiagnostic[] {
    return this.diagnosticsValue
  }

  addMediaNode(node: LibraryGraphMediaNode, gameId: string): boolean {
    if (!this.addNodeKey(node.key)) {
      this.addDuplicateNodeDiagnostic(node.key)
      return false
    }

    this.media.push(node)
    this.mediaKeyByGameId.set(gameId, node.key)
    return true
  }

  addCollectionNode(node: LibraryGraphCollectionNode): void {
    if (!this.addNodeKey(node.key)) {
      this.addDuplicateNodeDiagnostic(node.key)
      return
    }
    this.collections.push(node)
  }

  addTagNode(node: LibraryGraphTagNode): string {
    const existingKey = this.tagKeyByName.get(node.input.name)
    if (existingKey) {
      return existingKey
    }

    if (!this.addNodeKey(node.key)) {
      this.addDuplicateNodeDiagnostic(node.key)
      return node.key
    }

    this.tags.push(node)
    this.tagKeyByName.set(node.input.name, node.key)
    return node.key
  }

  addCompanyNode(node: LibraryGraphCompanyNode): void {
    if (this.allNodeKeys.has(node.key)) {
      return
    }
    if (!this.addNodeKey(node.key)) {
      this.addDuplicateNodeDiagnostic(node.key)
      return
    }
    this.companies.push(node)
  }

  addPersonNode(node: LibraryGraphPersonNode): void {
    if (this.allNodeKeys.has(node.key)) {
      return
    }
    if (!this.addNodeKey(node.key)) {
      this.addDuplicateNodeDiagnostic(node.key)
      return
    }
    this.people.push(node)
  }

  addNoteNode(node: LibraryGraphNoteNode): void {
    if (!this.addNodeKey(node.key)) {
      this.addDuplicateNodeDiagnostic(node.key)
      return
    }
    this.notes.push(node)
  }

  addSessionNode(node: LibraryGraphSessionNode): void {
    if (!this.addNodeKey(node.key)) {
      this.addDuplicateNodeDiagnostic(node.key)
      return
    }
    this.sessions.push(node)
  }

  addAttachmentNode(node: LibraryGraphAttachmentNode): void {
    if (this.allNodeKeys.has(node.key)) {
      return
    }
    if (!this.addNodeKey(node.key)) {
      this.addDuplicateNodeDiagnostic(node.key)
      return
    }
    this.attachments.push(node)
  }

  addEdge(edge: LibraryGraphEdge): void {
    const identity = createVniteEdgeIdentity(edge)
    if (this.edgeIdentities.has(identity)) {
      return
    }

    this.edgeIdentities.add(identity)
    this.edgesValue.push(edge)
  }

  getMediaKey(gameId: string): string | undefined {
    return this.mediaKeyByGameId.get(gameId)
  }

  addDiagnostic(diagnostic: LibraryGraphDiagnostic): void {
    this.diagnosticsValue.push(diagnostic)
  }

  addDiagnostics(diagnostics: readonly LibraryGraphDiagnostic[]): void {
    this.diagnosticsValue.push(...diagnostics)
  }

  private addNodeKey(key: string): boolean {
    if (this.allNodeKeys.has(key)) {
      return false
    }

    this.allNodeKeys.add(key)
    return true
  }

  private addDuplicateNodeDiagnostic(key: string): void {
    this.addDiagnostic(
      createVniteGraphDiagnostic({
        level: 'error',
        code: 'vnite.graph.duplicateNodeKey',
        message: 'Vnite 导入图节点键重复，已跳过重复节点。',
        nodeKey: key
      })
    )
  }
}
