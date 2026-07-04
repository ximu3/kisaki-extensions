import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { readRequiredEnv, resolveWorkspacePath, run } from './common'

const extensionDir = resolveWorkspacePath(readRequiredEnv('PUBLISH_EXTENSION_DIR'))
const workspaceDir = readRequiredEnv('GITHUB_WORKSPACE')
const signingKeyJson = readRequiredEnv('SIGNING_KEY_JSON')
const artifactsDir = path.join(workspaceDir, 'artifacts')
const keyDir = path.join(workspaceDir, '.keys')
const keyPath = path.join(keyDir, 'author.ed25519.json')

mkdirSync(artifactsDir, { recursive: true })
mkdirSync(keyDir, { recursive: true })
writeFileSync(keyPath, signingKeyJson)
chmodSync(keyPath, 0o600)

run('pnpm', [
  'exec',
  'kisx',
  '--project',
  extensionDir,
  'pack',
  '--out-dir',
  artifactsDir,
  '--no-build',
  '--sign',
  '--key',
  keyPath
])
