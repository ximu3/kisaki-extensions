export function nowTimestamp(): number {
  return Date.now()
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
