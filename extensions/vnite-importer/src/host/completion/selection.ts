import { GAME_UPDATE_SURFACES, type GameUpdateSurface } from '@kisaki3/extension-sdk'

interface VniteCompletionOption {
  value: string
  label: string
  description?: string
}

export type VniteCompletionSurfacePreset = 'missingCoreAndMedia' | 'missingAll' | 'custom'

export const VNITE_COMPLETION_SURFACE_PRESETS = [
  'missingCoreAndMedia',
  'missingAll',
  'custom'
] as const satisfies readonly VniteCompletionSurfacePreset[]

export const DEFAULT_VNITE_COMPLETION_SURFACE_PRESET =
  'missingCoreAndMedia' satisfies VniteCompletionSurfacePreset

export const DEFAULT_VNITE_COMPLETION_CUSTOM_SURFACES = [
  'name',
  'originalName',
  'releaseDate',
  'description',
  'relatedSites',
  'externalIds',
  'covers',
  'backdrops',
  'logos',
  'icons'
] as const satisfies readonly GameUpdateSurface[]

export const VNITE_COMPLETION_SURFACE_PRESET_OPTIONS = [
  {
    value: 'missingCoreAndMedia',
    label: '核心与媒体',
    description: '补全标题、发售日、简介、外部 ID 和图片'
  },
  {
    value: 'missingAll',
    label: '全部可补全字段',
    description: '额外补全标签、制作方、人物和角色关系'
  },
  {
    value: 'custom',
    label: '自定义',
    description: '手动选择要补全的字段'
  }
] as const satisfies readonly VniteCompletionOption[]

export const VNITE_COMPLETION_SURFACE_OPTIONS = [
  { value: 'name', label: '名称' },
  { value: 'originalName', label: '原名' },
  { value: 'releaseDate', label: '发售日期' },
  { value: 'description', label: '简介' },
  { value: 'relatedSites', label: '相关网站' },
  { value: 'externalIds', label: '外部 ID' },
  { value: 'tags', label: '标签' },
  { value: 'person', label: '人物' },
  { value: 'company', label: '制作方' },
  { value: 'character', label: '角色' },
  { value: 'covers', label: '封面' },
  { value: 'backdrops', label: '背景图' },
  { value: 'logos', label: 'Logo' },
  { value: 'icons', label: '图标' }
] as const satisfies readonly VniteCompletionOption[]

const GAME_UPDATE_SURFACE_KEYS: ReadonlySet<string> = new Set(
  GAME_UPDATE_SURFACES.map((surface) => surface.key)
)

export function resolveVniteCompletionSurfaces(input: {
  preset: VniteCompletionSurfacePreset
  customSurfaces?: readonly string[]
}): readonly GameUpdateSurface[] {
  if (input.preset === 'missingAll') {
    return GAME_UPDATE_SURFACES.map((surface) => surface.key)
  }

  if (input.preset === 'custom') {
    const selected = normalizeGameUpdateSurfaces(input.customSurfaces)
    return selected.length > 0 ? selected : DEFAULT_VNITE_COMPLETION_CUSTOM_SURFACES
  }

  return DEFAULT_VNITE_COMPLETION_CUSTOM_SURFACES
}

export function normalizeVniteCompletionSurfacePreset(
  value: unknown,
  fallback: VniteCompletionSurfacePreset = DEFAULT_VNITE_COMPLETION_SURFACE_PRESET
): VniteCompletionSurfacePreset {
  return VNITE_COMPLETION_SURFACE_PRESETS.includes(value as VniteCompletionSurfacePreset)
    ? (value as VniteCompletionSurfacePreset)
    : fallback
}

export function normalizeGameUpdateSurfaces(value: unknown): readonly GameUpdateSurface[] {
  if (!Array.isArray(value)) {
    return []
  }

  const result: GameUpdateSurface[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string' || !GAME_UPDATE_SURFACE_KEYS.has(item) || seen.has(item)) {
      continue
    }

    seen.add(item)
    result.push(item as GameUpdateSurface)
  }

  return result
}
