import type { VniteExtraField, VniteGameMetadata } from '../vnite/models'

export interface VniteTagMappingOptions {
  includeTags: boolean
  includeGenres: boolean
  includePlatforms: boolean
  includeEngineExtras: boolean
}

export interface VniteMappedTag {
  name: string
  source: 'tag' | 'genre' | 'platform' | 'engine'
}

export function mapVniteTags(
  metadata: VniteGameMetadata,
  options: VniteTagMappingOptions
): readonly VniteMappedTag[] {
  const tags: VniteMappedTag[] = []

  if (options.includeTags) {
    pushTags(tags, metadata.tags, 'tag')
  }
  if (options.includeGenres) {
    pushTags(tags, metadata.genres, 'genre')
  }
  if (options.includePlatforms) {
    pushTags(tags, metadata.platforms, 'platform')
  }
  if (options.includeEngineExtras) {
    for (const extra of metadata.extra) {
      if (isVniteEngineExtraKey(extra.key)) {
        pushTags(tags, extra.value, 'engine')
      }
    }
  }

  return dedupeMappedTags(tags)
}

export function isVniteEngineExtraKey(key: string): boolean {
  return normalizeExtraKey(key) === 'engine' || key.trim() === '引擎'
}

export function normalizeExtraKey(key: string): string {
  return key.trim().toLowerCase()
}

function pushTags(
  tags: VniteMappedTag[],
  values: readonly string[],
  source: VniteMappedTag['source']
) {
  for (const value of values) {
    const name = value.trim()
    if (name) {
      tags.push({ name, source })
    }
  }
}

function dedupeMappedTags(tags: readonly VniteMappedTag[]): readonly VniteMappedTag[] {
  const seen = new Set<string>()
  const result: VniteMappedTag[] = []

  for (const tag of tags) {
    if (seen.has(tag.name)) {
      continue
    }
    seen.add(tag.name)
    result.push(tag)
  }

  return result
}

export function getUnknownVniteExtraFields(
  extra: readonly VniteExtraField[],
  knownPersonKeys: ReadonlySet<string>
): readonly VniteExtraField[] {
  return extra.filter((field) => {
    const key = normalizeExtraKey(field.key)
    return !knownPersonKeys.has(key) && !isVniteEngineExtraKey(field.key)
  })
}
