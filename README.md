# Kisaki Extensions

Kisaki extension registry for Kisaki Extensions.

## Development

Install all extension dependencies from the repository root and run the project
checks:

```bash
pnpm install
pnpm run check
```

The root workspace checks workflow and tool scripts alongside extension
projects. Git hooks are installed automatically when the repository has Git
metadata.

The root workspace owns the shared `pnpm-lock.yaml`. Each extension remains an
independent project under `extensions/<extension-id>`.

The root workspace also owns the repository signing key used for published
extension artifacts:

```bash
pnpm run key:generate
```

## Extensions

<!-- extensions:start -->

- `vnite-importer` - Vnite Importer (`extensions/vnite-importer`)

<!-- extensions:end -->

## Add Extensions

Run the scaffold from the repository root. It generates the extension,
refreshes this list, installs the shared lockfile, and leaves the changes ready
for review:

```bash
pnpm create kisaki-extension add <extension-id>
```

## Publish

Publish an extension by updating its `manifest.json`, committing the change,
and pushing a scoped publish tag from the repository root:

```bash
git push origin main
git tag <extension-id>-v0.0.1
git push origin <extension-id>-v0.0.1
```

The workflow parses the tag, validates the matching manifest id and version,
packages only the tagged extension source, updates and validates
`registry/manifest.json`, and uploads the signed `.kisx` package to the
GitHub Release for `<extension-id>-v0.0.1` without removing other extension
packages.

Optional release changelogs live under the extension directory. The workflow
uses the default locale entry for GitHub Release notes and writes all locale
entries into the registry release:

```text
extensions/<extension-id>/changelogs/v0.0.1/en.md
extensions/<extension-id>/changelogs/v0.0.1/zh-Hans.md
```

Each changelog can start with optional YAML frontmatter containing `summary`.

If a publish job fails, fix the issue, move the same tag to the corrected
commit, and push the tag again:

```bash
git tag -f <extension-id>-v0.0.1
git push --force origin <extension-id>-v0.0.1
```

The workflow reuses the existing release, replaces its assets, and updates the
registry from the latest `main`. You can also run the workflow manually and
enter the publish tag.

The workflow commits the updated registry manifest back to `main`. After a
successful publish, pull or rebase before continuing local work:

```bash
git pull --rebase
```

Registry URL:

```text
https://raw.githubusercontent.com/ximu3/kisaki-extensions/main/registry/manifest.json
```

Generate the repository signing key from the workspace root:

```bash
pnpm run key:generate
```

Store the entire `.keys/author.ed25519.json` file JSON in the required
`KISAKI_EXTENSION_SIGNING_KEY` repository secret.
