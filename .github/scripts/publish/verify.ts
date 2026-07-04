import {
  commandSucceeds,
  ensureFile,
  readCommand,
  readJsonObject,
  readRequiredEnv,
  requireStringField,
  resolveWorkspacePath
} from './common'

const extensionId = readRequiredEnv('PUBLISH_EXTENSION_ID')
const extensionDir = resolveWorkspacePath(readRequiredEnv('PUBLISH_EXTENSION_DIR'))
const version = readRequiredEnv('PUBLISH_VERSION')
const tag = readRequiredEnv('PUBLISH_TAG')
const manifestPath = `${extensionDir}/manifest.json`

ensureFile(manifestPath)

const manifest = readJsonObject(manifestPath)
const manifestId = requireStringField(manifest, 'id', 'manifest.json id')
const manifestVersion = requireStringField(manifest, 'version', 'manifest.json version')

if (manifestId !== extensionId) {
  throw new Error(`manifest.json id (${manifestId}) must match publish scope (${extensionId}).`)
}

if (manifestVersion !== version) {
  throw new Error(
    `manifest.json version (${manifestVersion}) must match publish version (${version}).`
  )
}

if (commandSucceeds('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])) {
  const tagSha = readCommand('git', ['rev-list', '-n', '1', tag])
  const headSha = readCommand('git', ['rev-parse', 'HEAD'])
  if (tagSha !== headSha) {
    throw new Error(`Tag ${tag} points to ${tagSha}, but checkout is ${headSha}.`)
  }
} else {
  throw new Error(`Publish tag does not exist: ${tag}.`)
}

console.log(`Verified publish metadata for ${extensionId}@${version}.`)
