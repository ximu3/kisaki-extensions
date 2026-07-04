import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

type Mode = 'format' | 'lint'
type PnpmInvocation = {
  command: string
  argsPrefix: string[]
  shell: boolean
}

const FORMAT_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'mts',
  'js',
  'mjs',
  'cjs',
  'json',
  'yaml',
  'yml',
  'md',
  'css',
  'vue',
  'html'
])

const LINT_EXTENSIONS = new Set(['ts', 'tsx', 'mts', 'js', 'mjs', 'cjs', 'vue'])

const IGNORED_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'out',
  'dev',
  '.tmp',
  'tmp',
  '.kisaki',
  'artifacts',
  '.keys'
])

const repoRoot = process.cwd()
const pnpmCliPath = process.env.npm_execpath
const pnpm = resolvePnpmInvocation()
const mode = parseMode(process.argv[2])
const files = collectFiles(process.argv.slice(3), mode)

if (files.length === 0) {
  process.exit(0)
}

if (mode === 'format') {
  runPnpm(['exec', 'prettier', '--write', ...relativeTo(repoRoot, files)], repoRoot)
} else {
  for (const [packageRoot, packageFiles] of groupByPackageRoot(files)) {
    runPnpm(
      ['exec', 'eslint', '--fix', '--cache', ...relativeTo(packageRoot, packageFiles)],
      packageRoot
    )
  }
}

function parseMode(value: string | undefined): Mode {
  if (value === 'format' || value === 'lint') return value
  fail('Usage: tsx tools/git-hooks/staged.ts <format|lint> <files...>')
}

function collectFiles(rawFiles: readonly string[], selectedMode: Mode): string[] {
  const uniqueFiles = new Set<string>()

  for (const rawFile of rawFiles) {
    const absoluteFile = path.resolve(repoRoot, rawFile)
    if (!isInsideOrEqual(absoluteFile, repoRoot) || !existsSync(absoluteFile)) continue

    const relativeFile = toPosixPath(path.relative(repoRoot, absoluteFile))
    if (matchesMode(relativeFile, selectedMode)) {
      uniqueFiles.add(absoluteFile)
    }
  }

  return [...uniqueFiles].sort(comparePaths)
}

function matchesMode(relativeFile: string, selectedMode: Mode): boolean {
  if (hasIgnoredSegment(relativeFile)) return false

  const extension = path.extname(relativeFile).slice(1)
  return selectedMode === 'format'
    ? FORMAT_EXTENSIONS.has(extension)
    : LINT_EXTENSIONS.has(extension)
}

function hasIgnoredSegment(relativeFile: string): boolean {
  return relativeFile.split('/').some((segment) => IGNORED_SEGMENTS.has(segment))
}

function groupByPackageRoot(filesToGroup: readonly string[]): [string, string[]][] {
  const groups = new Map<string, string[]>()

  for (const file of filesToGroup) {
    const packageRoot = findPackageRoot(file)
    const group = groups.get(packageRoot)
    if (group) {
      group.push(file)
    } else {
      groups.set(packageRoot, [file])
    }
  }

  return [...groups.entries()]
    .map(
      ([packageRoot, packageFiles]) =>
        [packageRoot, packageFiles.sort(comparePaths)] as [string, string[]]
    )
    .sort(([leftRoot], [rightRoot]) => comparePaths(leftRoot, rightRoot))
}

function findPackageRoot(file: string): string {
  let directory = path.dirname(file)

  while (isInsideOrEqual(directory, repoRoot)) {
    if (existsSync(path.join(directory, 'package.json'))) return directory

    const parent = path.dirname(directory)
    if (parent === directory) break
    directory = parent
  }

  return repoRoot
}

function relativeTo(root: string, absoluteFiles: readonly string[]): string[] {
  return absoluteFiles.map((file) => toPosixPath(path.relative(root, file)))
}

function runPnpm(args: readonly string[], cwd: string): void {
  const result = spawnSync(pnpm.command, [...pnpm.argsPrefix, ...args], {
    cwd,
    shell: pnpm.shell,
    stdio: 'inherit'
  })

  if (result.error) {
    fail(result.error.message)
  }

  process.exitCode = result.status ?? 1
  if (process.exitCode !== 0) {
    process.exit()
  }
}

function isInsideOrEqual(target: string, root: string): boolean {
  const relativePath = path.relative(root, target)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function comparePaths(left: string, right: string): number {
  return toPosixPath(left).localeCompare(toPosixPath(right), 'en')
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/')
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function resolvePnpmInvocation(): PnpmInvocation {
  if (pnpmCliPath) {
    return { command: process.execPath, argsPrefix: [pnpmCliPath], shell: false }
  }

  if (process.platform === 'win32') {
    const cliPath = findWindowsPnpmCliPath()
    if (cliPath) {
      return { command: process.execPath, argsPrefix: [cliPath], shell: false }
    }
  }

  return { command: 'pnpm', argsPrefix: [], shell: process.platform === 'win32' }
}

function findWindowsPnpmCliPath(): string | undefined {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue

    const cmdPath = path.join(directory, 'pnpm.CMD')
    if (!existsSync(cmdPath)) continue

    const content = readFileSync(cmdPath, 'utf8')
    const match = content.match(/%~dp0([^"\r\n]*pnpm\.cjs)/i)
    const relativeCliPath = match?.[1]
    if (!relativeCliPath) continue

    const cliPath = path.resolve(directory, relativeCliPath.replace(/^[\\/]+/, ''))
    if (existsSync(cliPath)) return cliPath
  }

  return undefined
}
