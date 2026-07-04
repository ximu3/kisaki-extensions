import type { LibraryGameCreateInput, LibraryGraphDiagnostic } from '@kisaki3/extension-api'
import { omitUndefined } from '../utils/object'
import type { NormalizedVniteGameLocal, VniteGameLocalDoc } from '../vnite/models'
import { createVniteGraphDiagnostic } from './diagnostics'

export interface VniteLocalFieldMappingOptions {
  includeLauncher: boolean
  includeGameDirPath: boolean
  includeSavePath: boolean
  nodeKey?: string
}

export interface VniteLocalFieldMappingResult {
  input: Partial<LibraryGameCreateInput>
  diagnostics: readonly LibraryGraphDiagnostic[]
}

export function mapVniteLocalGameFields(
  local: NormalizedVniteGameLocal | undefined,
  options: VniteLocalFieldMappingOptions
): VniteLocalFieldMappingResult {
  if (!local) {
    return { input: {}, diagnostics: [] }
  }

  const input: Partial<LibraryGameCreateInput> = {}
  const diagnostics: LibraryGraphDiagnostic[] = []
  const doc = local.doc

  if (options.includeLauncher) {
    Object.assign(input, mapLauncherFields(doc))
    diagnostics.push(...createLauncherDiagnostics(doc, options.nodeKey))
  }

  if (options.includeGameDirPath) {
    const gameDirPath = resolveGameDirPath(doc)
    if (gameDirPath) {
      input.gameDirPath = gameDirPath
    }
  }

  if (options.includeSavePath) {
    const savePaths = doc.path.savePaths.map((item) => item.trim()).filter(Boolean)
    if (savePaths[0]) {
      input.savePath = savePaths[0]
    }
    if (savePaths.length > 1) {
      diagnostics.push(
        createVniteGraphDiagnostic({
          level: 'warning',
          code: 'vnite.save.multiplePaths',
          message: 'Vnite 游戏包含多个存档路径，Kisaki 当前只会导入第一项。',
          nodeKey: options.nodeKey
        })
      )
    }
  }

  return { input, diagnostics }
}

export function joinVniteScriptCommand(command: readonly string[]): string | undefined {
  const parts = command.map((item) => item.trim()).filter(Boolean)
  if (parts.length === 0) {
    return undefined
  }

  return parts.map(shellEscapeCommandPart).join(' ')
}

function mapLauncherFields(doc: VniteGameLocalDoc): Partial<LibraryGameCreateInput> {
  switch (doc.launcher.mode) {
    case 'url':
      return omitUndefined({
        launcherMode: 'url',
        launcherPath: trimToUndefined(doc.launcher.urlConfig.url),
        monitorMode: doc.launcher.urlConfig.monitorMode,
        monitorPath: trimToUndefined(doc.launcher.urlConfig.monitorPath)
      })
    case 'script':
      return omitUndefined({
        launcherMode: 'exec',
        launcherPath: joinVniteScriptCommand(doc.launcher.scriptConfig.command),
        monitorMode: doc.launcher.scriptConfig.monitorMode,
        monitorPath: trimToUndefined(doc.launcher.scriptConfig.monitorPath)
      })
    case 'file':
      return omitUndefined({
        launcherMode: 'file',
        launcherPath:
          trimToUndefined(doc.path.gamePath) ?? trimToUndefined(doc.launcher.fileConfig.path),
        monitorMode: doc.launcher.fileConfig.monitorMode,
        monitorPath: trimToUndefined(doc.launcher.fileConfig.monitorPath)
      })
  }
}

function createLauncherDiagnostics(
  doc: VniteGameLocalDoc,
  nodeKey?: string
): readonly LibraryGraphDiagnostic[] {
  const diagnostics: LibraryGraphDiagnostic[] = []

  if (doc.launcher.fileConfig.args.length > 0) {
    diagnostics.push(
      createVniteGraphDiagnostic({
        level: 'info',
        code: 'vnite.launch.argsUnsupported',
        message: 'Vnite 文件启动参数当前无法完整导入。',
        nodeKey
      })
    )
  }

  if (doc.launcher.useMagpie) {
    diagnostics.push(
      createVniteGraphDiagnostic({
        level: 'info',
        code: 'vnite.launch.magpieUnsupported',
        message: 'Vnite Magpie 启动设置当前无法导入。',
        nodeKey
      })
    )
  }

  if (trimToUndefined(doc.launcher.urlConfig.browserPath)) {
    diagnostics.push(
      createVniteGraphDiagnostic({
        level: 'info',
        code: 'vnite.launch.browserPathUnsupported',
        message: 'Vnite URL 启动浏览器路径当前无法导入。',
        nodeKey
      })
    )
  }

  if (trimToUndefined(doc.path.screenshotPath)) {
    diagnostics.push(
      createVniteGraphDiagnostic({
        level: 'info',
        code: 'vnite.local.screenshotPathUnsupported',
        message: 'Vnite 截图目录当前无法导入。',
        nodeKey
      })
    )
  }

  return diagnostics
}

function resolveGameDirPath(doc: VniteGameLocalDoc): string | undefined {
  return (
    trimToUndefined(doc.utils.rootPath) ??
    trimToUndefined(doc.utils.markPath) ??
    trimToUndefined(doc.launcher.fileConfig.workingDirectory) ??
    trimToUndefined(doc.launcher.scriptConfig.workingDirectory)
  )
}

function shellEscapeCommandPart(part: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(part)) {
    return part
  }

  return `"${part.replace(/(["\\$`])/g, '\\$1')}"`
}

function trimToUndefined(value: string | undefined): string | undefined {
  const text = value?.trim()
  return text ? text : undefined
}
