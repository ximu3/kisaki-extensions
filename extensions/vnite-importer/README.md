# Vnite Importer

Import games and user data from Vnite database backups.

## Metadata

- Extension ID: `vnite-importer`
- Categories: tool
- Starter: `tool`
- Webview: Vue
- Webview addons: Kisaki UI Vue

## Project Layout

- `src/host/` contains Node.js extension-host code.
- `src/ui/` contains isolated webview documents when UI is enabled.
- `src/shared/` contains pure contracts shared by the host and webview sides.

## Development

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run build
pnpm run validate
pnpm run dev
```

## Package

```bash
pnpm run pack
```

## Publish With GitHub

This extension lives in `extensions/vnite-importer` and is published by the
repository root workflow. Commit the manifest update, then push a publish tag:

```bash
git push origin main
git tag vnite-importer-v0.0.1
git push origin vnite-importer-v0.0.1
```

The workflow parses the tag, validates this extension's manifest id and
version, packages only the tagged source, updates and validates the shared
`registry/manifest.json`, and uploads the signed `.kisx` package to the
GitHub Release for `vnite-importer-v0.0.1`.

Optional release changelogs live in this extension directory:

```text
extensions/vnite-importer/changelogs/v0.0.1/en.md
extensions/vnite-importer/changelogs/v0.0.1/zh-Hans.md
```

Each changelog can start with optional YAML frontmatter containing `summary`.

If a publish job fails, fix the issue, move the same tag to the corrected
commit, and push the tag again:

```bash
git tag -f vnite-importer-v0.0.1
git push --force origin vnite-importer-v0.0.1
```

The workflow reuses the existing release, replaces its assets, and updates the
registry from the latest `main`. You can also run the workflow manually and
enter the publish tag.

The workflow requires the repository signing-key secret. Generate it from the
workspace root with `pnpm run key:generate`, then store the entire
`.keys/author.ed25519.json` file JSON in `KISAKI_EXTENSION_SIGNING_KEY`.

The workflow commits the updated registry manifest back to `main`. After a
successful publish, pull or rebase before continuing local work:

```bash
git pull --rebase
```
