import type { LibraryGameStatus } from '@kisaki3/extension-api'
import type { VnitePlayStatus } from '../vnite/models'

const STATUS_MAP = {
  unplayed: 'notStarted',
  playing: 'inProgress',
  partial: 'partial',
  finished: 'completed',
  multiple: 'multiple',
  shelved: 'shelved'
} as const satisfies Record<VnitePlayStatus, LibraryGameStatus>

export function mapVnitePlayStatus(status: VnitePlayStatus): LibraryGameStatus {
  return STATUS_MAP[status]
}

export function toKisakiScore(score: number): number | null {
  return Number.isFinite(score) && score >= 0 ? Math.round(score * 10) : null
}
