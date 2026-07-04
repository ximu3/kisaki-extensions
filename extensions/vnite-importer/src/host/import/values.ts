export function assignTrimmed<T extends object, TKey extends keyof T & string>(
  input: T,
  key: TKey,
  value: string
): void {
  const text = trimToUndefined(value)
  if (text) {
    input[key] = text as T[TKey]
  }
}

export function toNonNegativeInteger(value: number): number | undefined {
  return Number.isInteger(value) && value >= 0 ? value : undefined
}

export function trimToUndefined(value: string | undefined): string | undefined {
  const text = value?.trim()
  return text ? text : undefined
}
