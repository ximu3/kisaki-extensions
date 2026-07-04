import { commandSucceeds, readRequiredEnv, run } from './common'
import { createDefaultReleaseNotes, readReleaseChangelog } from './changelog'

const tag = readRequiredEnv('PUBLISH_TAG')
const extensionId = readRequiredEnv('PUBLISH_EXTENSION_ID')
const version = readRequiredEnv('PUBLISH_VERSION')
const archivePath = readRequiredEnv('ARCHIVE_PATH')
const signaturePath = readRequiredEnv('SIGNATURE_PATH')
const workspaceDir = readRequiredEnv('GITHUB_WORKSPACE')
const changelog = readReleaseChangelog(`${workspaceDir}/artifacts/release-source`, version)
const releaseNotes = changelog?.releaseNotes ?? createDefaultReleaseNotes(extensionId, version)

readRequiredEnv('GH_TOKEN')

if (!commandSucceeds('gh', ['release', 'view', tag])) {
  const args = ['release', 'create', tag, '--verify-tag', ...createReleaseMetadataArgs()]
  if (version.includes('-')) {
    args.push('--prerelease')
  }
  run('gh', args)
} else {
  run('gh', ['release', 'edit', tag, ...createReleaseMetadataArgs()])
}

run('gh', ['release', 'upload', tag, archivePath, signaturePath, '--clobber'])

function createReleaseMetadataArgs(): string[] {
  return ['--title', `${extensionId} v${version}`, '--notes', releaseNotes]
}
