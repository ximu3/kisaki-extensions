import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

interface CommandOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`)
  }
  return value
}

export function resolveWorkspacePath(value: string): string {
  if (path.isAbsolute(value)) {
    return value
  }
  return path.resolve(process.env.GITHUB_WORKSPACE ?? process.cwd(), value)
}

export function ensureFile(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`)
  }
}

export function run(command: string, args: readonly string[], options: CommandOptions = {}): void {
  execFileSync(command, [...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: 'inherit'
  })
}

export function readCommand(
  command: string,
  args: readonly string[],
  options: CommandOptions = {}
): string {
  return execFileSync(command, [...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8'
  }).trim()
}

export function commandSucceeds(
  command: string,
  args: readonly string[],
  options: CommandOptions = {}
): boolean {
  try {
    execFileSync(command, [...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: 'ignore'
    })
    return true
  } catch {
    return false
  }
}

export function readJsonObject(filePath: string): Record<string, unknown> {
  const value = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`JSON file must contain an object: ${filePath}`)
  }
  return value as Record<string, unknown>
}

export function requireStringField(
  value: Record<string, unknown>,
  key: string,
  label: string
): string {
  const field = value[key]
  if (typeof field !== 'string' || field.length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return field
}

export function writeGithubOutput(values: Record<string, string | boolean>): void {
  const outputPath = process.env.GITHUB_OUTPUT
  for (const [key, rawValue] of Object.entries(values)) {
    const value = String(rawValue)
    if (!outputPath) {
      console.log(`${key}=${value}`)
      continue
    }

    if (value.includes('\n')) {
      const delimiter = `kisaki_${randomUUID()}`
      appendFileSync(outputPath, `${key}<<${delimiter}\n${value}\n${delimiter}\n`)
    } else {
      appendFileSync(outputPath, `${key}=${value}\n`)
    }
  }
}

export function configureGitHubActionsAuthor(): void {
  run('git', ['config', 'user.name', 'github-actions[bot]'])
  run('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com'])
}
