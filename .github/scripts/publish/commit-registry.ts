import { commandSucceeds, configureGitHubActionsAuthor, readRequiredEnv, run } from './common'

const extensionId = readRequiredEnv('PUBLISH_EXTENSION_ID')
const version = readRequiredEnv('PUBLISH_VERSION')

configureGitHubActionsAuthor()
run('git', ['add', 'registry/manifest.json'])

if (commandSucceeds('git', ['diff', '--cached', '--quiet'])) {
  console.log('Registry manifest is already up to date.')
  process.exit(0)
}

run('git', ['commit', '-m', `chore(registry): publish ${extensionId} v${version} [skip ci]`])
run('git', ['push', 'origin', 'HEAD:main'])
