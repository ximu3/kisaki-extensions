import type { VniteImportDiagnostic } from '../backup/types'

export const VNITE_DIAGNOSTIC_ROW_LIMIT = 200

export function countVisibleDiagnostics(diagnostics: readonly VniteImportDiagnostic[]): number {
  return diagnostics.filter(isVisibleDiagnostic).length
}

export function createVisibleDiagnostics(
  diagnostics: readonly VniteImportDiagnostic[]
): readonly VniteImportDiagnostic[] {
  return [...diagnostics]
    .filter(isVisibleDiagnostic)
    .sort((left, right) => getDiagnosticPriority(left) - getDiagnosticPriority(right))
}

export function createDiagnosticsTitle(total: number): string {
  return total > VNITE_DIAGNOSTIC_ROW_LIMIT
    ? `需要处理的诊断（前 ${VNITE_DIAGNOSTIC_ROW_LIMIT} / ${total}）`
    : '需要处理的诊断'
}

export function toDiagnosticsTableRows(
  diagnostics: readonly VniteImportDiagnostic[]
): readonly Record<string, string>[] {
  return diagnostics.slice(0, VNITE_DIAGNOSTIC_ROW_LIMIT).map((diagnostic) => ({
    level: toDiagnosticLevelLabel(diagnostic.level),
    subject: toDiagnosticSubject(diagnostic),
    message: diagnostic.message
  }))
}

function isVisibleDiagnostic(diagnostic: VniteImportDiagnostic): boolean {
  return diagnostic.level !== 'info'
}

function getDiagnosticPriority(diagnostic: VniteImportDiagnostic): number {
  switch (diagnostic.level) {
    case 'error':
      return 0
    case 'warning':
      return 1
    case 'info':
    default:
      return 2
  }
}

function toDiagnosticSubject(diagnostic: VniteImportDiagnostic): string {
  if (diagnostic.vniteGameName) {
    return diagnostic.vniteGameName
  }

  if (diagnostic.attachmentId || diagnostic.itemKey?.includes(':attachment:')) {
    return '附件'
  }

  if (diagnostic.itemKey?.includes(':collection:') || diagnostic.dbName === 'game-collection') {
    return '合集'
  }

  if (diagnostic.dbName) {
    return toDatabaseLabel(diagnostic.dbName)
  }

  if (diagnostic.itemKey?.includes(':session:')) {
    return '游玩记录'
  }

  if (diagnostic.itemKey?.includes(':note:')) {
    return '笔记'
  }

  return '导入项目'
}

function toDiagnosticLevelLabel(level: string): string {
  switch (level) {
    case 'warning':
      return '警告'
    case 'error':
      return '错误'
    case 'info':
    default:
      return '信息'
  }
}

function toDatabaseLabel(dbName: string): string {
  switch (dbName) {
    case 'game':
      return '游戏'
    case 'game-local':
      return '本地配置'
    case 'game-collection':
      return '合集'
    default:
      return '备份数据'
  }
}
