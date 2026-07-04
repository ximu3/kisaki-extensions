import type { LibraryGraphDiagnostic, PartialDate } from '@kisaki3/extension-api'
import { omitUndefined } from '../utils/object'
import { createVniteGraphDiagnostic } from './diagnostics'

export interface VniteDateMappingContext {
  nodeKey?: string
  field: string
}

export interface VniteMappedDate<TValue> {
  value?: TValue
  diagnostics: readonly LibraryGraphDiagnostic[]
}

export function parseVnitePartialDate(
  value: string,
  context: VniteDateMappingContext
): VniteMappedDate<PartialDate> {
  const text = value.trim()
  if (!text) {
    return { diagnostics: [] }
  }

  const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(text)
  if (!match) {
    return createInvalidDateResult(context)
  }

  const year = Number(match[1])
  const month = match[2] === undefined ? undefined : Number(match[2])
  const day = match[3] === undefined ? undefined : Number(match[3])

  if (!isValidPartialDate(year, month, day)) {
    return createInvalidDateResult(context)
  }

  return {
    value: omitUndefined({
      year,
      month,
      day
    }),
    diagnostics: []
  }
}

export function parseVniteTimestamp(
  value: string,
  context: VniteDateMappingContext
): VniteMappedDate<number> {
  const text = value.trim()
  if (!text) {
    return { diagnostics: [] }
  }

  const timestamp = Date.parse(text)
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    return createInvalidDateResult(context)
  }

  return { value: timestamp, diagnostics: [] }
}

export function formatVniteTimestampForNoteName(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function isValidPartialDate(year: number, month?: number, day?: number): boolean {
  if (!Number.isInteger(year) || year <= 0 || year > 9999) {
    return false
  }
  if (month === undefined) {
    return day === undefined
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false
  }
  if (day === undefined) {
    return true
  }
  if (!Number.isInteger(day) || day < 1) {
    return false
  }

  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day <= lastDayOfMonth
}

function createInvalidDateResult<TValue>(
  context: VniteDateMappingContext
): VniteMappedDate<TValue> {
  return {
    diagnostics: [
      createVniteGraphDiagnostic({
        level: 'warning',
        code: 'vnite.date.invalid',
        message: `Vnite 日期字段 ${context.field} 无法解析，已跳过。`,
        nodeKey: context.nodeKey
      })
    ]
  }
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}
