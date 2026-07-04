import type { VniteExtraField } from '../vnite/models'
import { trimToUndefined } from './values'

export function createUniqueNoteName(baseName: string, names: Map<string, number>): string {
  const count = names.get(baseName) ?? 0
  names.set(baseName, count + 1)
  return count === 0 ? baseName : `${baseName} (${count + 1})`
}

export function formatUnknownExtraLines(extra: VniteExtraField): readonly string[] {
  const key = trimToUndefined(extra.key)
  const values = extra.value.map((value) => value.trim()).filter(Boolean)
  return key && values.length > 0 ? [`${key}: ${values.join(', ')}`] : []
}
