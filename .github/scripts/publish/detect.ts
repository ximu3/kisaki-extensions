import { readRequiredEnv, writeGithubOutput } from './common'

const PUBLISH_TAG_PATTERN = /^([a-z0-9][a-z0-9.-]*)-v([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)$/

const tag = readRequiredEnv('PUBLISH_TAG')
const match = PUBLISH_TAG_PATTERN.exec(tag)

if (!match) {
  throw new Error(`Invalid publish tag "${tag}". Expected <extension-id>-v<semver>.`)
}

const extensionId = match[1]!
const version = match[2]!

writeGithubOutput({
  extension_id: extensionId,
  extension_dir: `extensions/${extensionId}`,
  version,
  tag
})
console.log(`Detected extension publish tag ${tag} (${extensionId}@${version}).`)
