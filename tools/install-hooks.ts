import { spawnSync } from 'node:child_process'

if (!commandSucceeds('git', ['rev-parse', '--is-inside-work-tree'])) {
  console.log('Skipping lefthook install outside a git repository.')
  process.exit(0)
}

const result = spawnSync('lefthook', ['install'], {
  shell: process.platform === 'win32',
  stdio: 'inherit'
})

process.exit(result.status ?? 1)

function commandSucceeds(command: string, args: readonly string[]): boolean {
  const result = spawnSync(command, [...args], {
    shell: process.platform === 'win32',
    stdio: 'ignore'
  })
  return result.status === 0
}
