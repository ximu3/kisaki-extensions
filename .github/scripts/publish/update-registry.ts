import path from 'node:path'
import { cpSync, rmSync } from 'node:fs'
import { getReleaseChangelogDirectoryName, readReleaseChangelog } from './changelog'
import { readCommand, readRequiredEnv, resolveWorkspacePath, run } from './common'

const extensionId = readRequiredEnv('PUBLISH_EXTENSION_ID')
const extensionDir = resolveWorkspacePath(readRequiredEnv('PUBLISH_EXTENSION_DIR'))
const version = readRequiredEnv('PUBLISH_VERSION')
const tag = readRequiredEnv('PUBLISH_TAG')
const archivePath = readRequiredEnv('ARCHIVE_PATH')
const signaturePath = readRequiredEnv('SIGNATURE_PATH')
const repository = readRequiredEnv('GITHUB_REPOSITORY')
const workspaceDir = readRequiredEnv('GITHUB_WORKSPACE')
const registryManifestPath = path.join(workspaceDir, 'registry', 'manifest.json')
const artifactUrl = `https://github.com/${repository}/releases/download/${tag}/${extensionId}-${version}.kisx`
const releasePage = `https://github.com/${repository}/releases/tag/${tag}`
const tagCommit = readCommand('git', ['rev-list', '-n', '1', tag])
const publishedAt = new Date(
  readCommand('git', ['show', '-s', '--format=%cI', tagCommit])
).toISOString()
const changelog = readReleaseChangelog(extensionDir, version)
const changelogDirectory = changelog
  ? copyChangelogDirectory(
      changelog.directory,
      path.join(workspaceDir, 'artifacts', 'release-source')
    )
  : undefined

run('git', ['fetch', 'origin', 'main'])
run('git', ['checkout', '-B', 'publish-registry', 'origin/main'])
const addReleaseArgs = [
  'registry',
  'add-release',
  archivePath,
  '--manifest',
  registryManifestPath,
  '--url',
  artifactUrl,
  '--published-at',
  publishedAt,
  '--release-page',
  releasePage,
  '--signature',
  signaturePath
]
if (changelog) {
  addReleaseArgs.push(
    '--changelogs',
    changelogDirectory!,
    '--default-locale',
    changelog.defaultLocale
  )
}
run('pnpm', ['exec', 'kisx', ...addReleaseArgs])
run('pnpm', ['exec', 'kisx', 'registry', 'validate', registryManifestPath])

function copyChangelogDirectory(sourceDir: string, parentDir: string): string {
  const targetDir = path.join(parentDir, 'changelogs', getReleaseChangelogDirectoryName(version))
  rmSync(targetDir, { recursive: true, force: true })
  cpSync(sourceDir, targetDir, { recursive: true })
  return targetDir
}
