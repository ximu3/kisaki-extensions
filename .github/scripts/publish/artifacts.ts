import path from 'node:path'
import { ensureFile, readRequiredEnv, writeGithubOutput } from './common'

const extensionId = readRequiredEnv('PUBLISH_EXTENSION_ID')
const version = readRequiredEnv('PUBLISH_VERSION')
const workspaceDir = readRequiredEnv('GITHUB_WORKSPACE')
const archivePath = path.join(workspaceDir, 'artifacts', `${extensionId}-${version}.kisx`)
const signaturePath = path.join(workspaceDir, 'artifacts', `${extensionId}-${version}.sig`)

ensureFile(archivePath)
ensureFile(signaturePath)

writeGithubOutput({
  archive_path: archivePath,
  signature_path: signaturePath
})
