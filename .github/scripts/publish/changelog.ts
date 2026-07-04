import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

interface LocalizedDocument {
  summary: string
  body?: string
}

interface LocalizedDocumentSet {
  defaultLocale: string
  locales: Record<string, LocalizedDocument>
}

export interface ReleaseChangelog {
  directory: string
  defaultLocale: string
  releaseNotes: string
}

const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const DEFAULT_LOCALE_CANDIDATES = ['en', 'zh-Hans', 'ja']

export function readReleaseChangelog(
  extensionDir: string,
  version: string
): ReleaseChangelog | null {
  const directory = path.join(extensionDir, 'changelogs', version)
  if (!existsSync(directory)) {
    return null
  }
  if (!statSync(directory).isDirectory()) {
    throw new Error(`Changelog path must be a directory: ${directory}`)
  }
  return readLocalizedChangelogDirectory(directory)
}

export function createDefaultReleaseNotes(extensionId: string, version: string): string {
  return `Kisaki extension package \`${extensionId}@${version}\`.`
}

function readLocalizedChangelogDirectory(directory: string): ReleaseChangelog {
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  if (entries.length === 0) {
    throw new Error(`No changelog markdown files found in ${directory}.`)
  }

  const locales: Record<string, LocalizedDocument> = {}
  const seenLocales = new Set<string>()
  for (const entry of entries) {
    const locale = path.basename(entry, '.md')
    const normalizedLocale = locale.toLowerCase()
    if (!LOCALE_PATTERN.test(locale)) {
      throw new Error(`Changelog filename must be a locale such as en or zh-Hans: ${entry}`)
    }
    if (seenLocales.has(normalizedLocale)) {
      throw new Error(`Duplicate changelog locale: ${locale}`)
    }
    seenLocales.add(normalizedLocale)
    locales[locale] = readChangelogMarkdown(path.join(directory, entry))
  }

  const document = {
    defaultLocale: selectDefaultLocale(Object.keys(locales)),
    locales
  }

  return createReleaseChangelog(directory, document)
}

function readChangelogMarkdown(filePath: string): LocalizedDocument {
  const content = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').trim()
  if (!content) {
    throw new Error(`Changelog file is empty: ${filePath}`)
  }

  const lines = content.split('\n')
  const summaryIndex = lines.findIndex((line) => line.trim().length > 0)
  if (summaryIndex < 0) {
    throw new Error(`Changelog file must start with a summary: ${filePath}`)
  }

  const summaryLine = lines[summaryIndex]
  if (summaryLine === undefined) {
    throw new Error(`Changelog file must start with a summary: ${filePath}`)
  }

  const summary = normalizeSummary(summaryLine)
  const body = lines
    .slice(summaryIndex + 1)
    .join('\n')
    .trim()
  if (!summary) {
    throw new Error(`Changelog summary is empty: ${filePath}`)
  }

  return {
    summary,
    ...(body ? { body } : {})
  }
}

function createReleaseChangelog(
  directory: string,
  document: LocalizedDocumentSet
): ReleaseChangelog {
  const defaultDocument = document.locales[document.defaultLocale]
  if (!defaultDocument) {
    throw new Error('Changelog default locale is missing from locales.')
  }

  return {
    directory,
    defaultLocale: document.defaultLocale,
    releaseNotes: [defaultDocument.summary, defaultDocument.body].filter(Boolean).join('\n\n')
  }
}

function normalizeSummary(value: string): string {
  return value
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .trim()
}

function selectDefaultLocale(locales: readonly string[]): string {
  for (const locale of DEFAULT_LOCALE_CANDIDATES) {
    if (locales.includes(locale)) {
      return locale
    }
  }
  return locales[0]!
}
