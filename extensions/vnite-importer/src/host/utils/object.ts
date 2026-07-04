type DefinedKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]

type OptionalDefinedKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]

type OmitUndefined<T extends object> = Pick<T, DefinedKeys<T>> &
  Partial<{
    [K in OptionalDefinedKeys<T>]: Exclude<T[K], undefined>
  }>

export function omitUndefined<const T extends Record<string, unknown>>(value: T): OmitUndefined<T> {
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      output[key] = entry
    }
  }
  return output as OmitUndefined<T>
}
