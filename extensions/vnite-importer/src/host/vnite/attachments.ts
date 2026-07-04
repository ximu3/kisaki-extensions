import { omitUndefined } from '../utils/object'
import type { VnitePouchAttachmentStub } from './models'

export const VNITE_MEDIA_ATTACHMENT_IDS = {
  cover: 'images/cover.webp',
  backdrop: 'images/background.webp',
  icon: 'images/icon.webp',
  logo: 'images/logo.webp',
  wideCover: 'images/wideCover.webp'
} as const

export type VniteAttachmentCategory =
  'media' | 'memory-cover' | 'memory-inline' | 'description-image' | 'save-archive' | 'unsupported'

export type VniteMediaAttachmentSlot = 'cover' | 'backdrop' | 'logo' | 'icon'

export interface VniteAttachmentMetadata {
  id: string
  category: VniteAttachmentCategory
  slot?: VniteMediaAttachmentSlot
  memoryId?: string
  imageId?: string
  saveId?: string
  contentType?: string
  sizeBytes?: number
  digest?: string
}

export function classifyVniteAttachment(
  id: string,
  stub?: VnitePouchAttachmentStub
): VniteAttachmentMetadata {
  const base = createAttachmentBase(id, stub)

  if (id === VNITE_MEDIA_ATTACHMENT_IDS.cover) {
    return { ...base, category: 'media', slot: 'cover' }
  }

  if (id === VNITE_MEDIA_ATTACHMENT_IDS.backdrop) {
    return { ...base, category: 'media', slot: 'backdrop' }
  }

  if (id === VNITE_MEDIA_ATTACHMENT_IDS.logo) {
    return { ...base, category: 'media', slot: 'logo' }
  }

  if (id === VNITE_MEDIA_ATTACHMENT_IDS.icon) {
    return { ...base, category: 'media', slot: 'icon' }
  }

  const memoryCoverMatch = /^images\/memories\/([^/]+)\.webp$/.exec(id)
  if (memoryCoverMatch) {
    return { ...base, category: 'memory-cover', memoryId: memoryCoverMatch[1] }
  }

  const memoryInlineMatch = /^images\/memories\/inline\/([^/]+)\.webp$/.exec(id)
  if (memoryInlineMatch) {
    return { ...base, category: 'memory-inline', imageId: memoryInlineMatch[1] }
  }

  const descriptionImageMatch = /^images\/description\/([^/]+)\.webp$/.exec(id)
  if (descriptionImageMatch) {
    return {
      ...base,
      category: 'description-image',
      imageId: descriptionImageMatch[1]
    }
  }

  const saveMatch = /^saves\/([^/]+)\.zip$/.exec(id)
  if (saveMatch) {
    return { ...base, category: 'save-archive', saveId: saveMatch[1] }
  }

  return { ...base, category: 'unsupported' }
}

export function classifyVniteAttachments(
  attachments: Readonly<Record<string, VnitePouchAttachmentStub>>
): readonly VniteAttachmentMetadata[] {
  return Object.entries(attachments).map(([id, stub]) => classifyVniteAttachment(id, stub))
}

export function getVniteAttachmentContentType(stub?: VnitePouchAttachmentStub): string | undefined {
  return stub?.content_type ?? stub?.contentType
}

function createAttachmentBase(
  id: string,
  stub?: VnitePouchAttachmentStub
): Omit<VniteAttachmentMetadata, 'category'> {
  return omitUndefined({
    id,
    contentType: getVniteAttachmentContentType(stub),
    sizeBytes: typeof stub?.length === 'number' ? stub.length : undefined,
    digest: stub?.digest
  })
}
