---
name: rad-build-harness
description: 'End-to-end installer test for a contributor: builds a local tarball from installer/, installs it globally, runs the radorch installer for the chosen harness, bootstraps the plugin, and verifies via radorch doctor and sha256 manifest check. Use when asked to "test the installer", "build and install the harness", or "verify the global install".'
---

# rad-build-harness

Run the real installer end-to-end from local source. This skill selects a harness, removes any prior global install, builds the canonical adapter sources, packs the installer into a tarball, installs it globally, runs the wizard non-interactively, bootstraps the plugin (with `--force` to defeat the version-equal short-circuit on repeat runs), and verifies the result.

`~/.radorch/projects/` is never touched at any point in this workflow — existing user projects survive unchanged.

## When to Use This Skill

- Testing a local build of the installer before publishing.
- Verifying that a harness change propagates end-to-end through the pack → install → bootstrap path.
- Confirming `radorch doctor` reports a clean state after a fresh or upgraded install.

## Prerequisites

- Node.js and npm installed.
- Working directory is anywhere inside the repo clone (the skill resolves repo root itself).
- `~/.radorch/bin/` may or may not be on `PATH` — `radorch` commands below assume it is.

## Workflow

### 1. Ask which harness

Use `AskUserQuestion` with these options:

| Label | Value |
|-------|-------|
| Claude Code | `claude` |
| GitHub Copilot in VS Code | `copilot-vscode` |
| GitHub Copilot CLI | `copilot-cli` |

Record the answer as `{harness}`.

### 2. Resolve repo root

```bash
git rev-parse --show-toplevel
```

Use the result as `{repoRoot}` for every subsequent command.

### 3. Remove any prior global install

```bash
npm list -g --depth=0
```

If `rad-orchestration` appears in the output:

```bash
npm uninstall -g rad-orchestration
```

Verify removal:

```bash
npm list -g --depth=0
```

> `~/.radorch/projects/` is left entirely intact — do not delete it.

### 4. Build canonical adapter sources

From `{repoRoot}`:

```bash
npm run build:{harness}
```

Note: for Claude Code the script name is `build:claude`, not `build:claude-code`.

| Harness | Command |
|---------|---------|
| `claude` | `npm run build:claude` |
| `copilot-vscode` | `npm run build:copilot-vscode` |
| `copilot-cli` | `npm run build:copilot-cli` |

### 5. Pack the installer

```bash
cd {repoRoot}/installer && npm pack
```

Note the generated tarball filename — something like `rad-orchestration-X.Y.Z.tgz`. Store it as `{tarball}`. The full absolute path is `{repoRoot}/installer/{tarball}`.

### 6. Install from tarball

```bash
npm install -g {repoRoot}/installer/{tarball}
```

Confirm the install:

```bash
radorch --version
```

### 7. Run the installer non-interactively

```bash
radorch --yes --harness {harness}
```

> Expected: installer completes without interactive prompts and exits with code 0.
> `~/.radorch/projects/` is not touched.

### 8. Bootstrap the plugin with --force

Locate the bundled plugin root for the harness. The installer unpacks to a global npm prefix; the plugin payload ships at `{repoRoot}/installer/src/{bundleDir}/` where `bundleDir` matches the harness:

| Harness | Bundle directory |
|---------|-----------------|
| `claude` | `installer/src/claude/` |
| `copilot-vscode` | `installer/src/copilot-vscode/` |
| `copilot-cli` | `installer/src/copilot-cli/` |

Run plugin-bootstrap with `--force` to defeat the version-equal short-circuit:

```bash
radorch plugin-bootstrap --force --harness {harness} --plugin-root {repoRoot}/installer/src/{bundleDir}
```

> `--force` ensures the bootstrap runs even when the delivering version equals the installed version. This is required on repeat test runs.

### 9. Verify the install

Run all three checks and report any failure:

```bash
radorch --version
radorch doctor
```

**sha256 manifest check:** The manifest catalog is written into the bundled plugin payload during `npm pack` (via the `prepack` lifecycle hook). Verify that the manifest file for the tested version exists and that every entry carries a `sha256` field.

The manifest path is:

```
{repoRoot}/installer/src/{bundleDir}/manifests/v{version}.json
```

Open the file and confirm:
- The file exists.
- Each entry in the file has a `sha256` field with a non-empty value.

### 10. Report results

Report:
- The version tested (from Step 5).
- Whether `radorch doctor` passed or flagged issues.
- Whether the sha256 manifest check passed.
- Any step that failed, with the verbatim error output.

### 11. Delete the local tarball

```bash
cd {repoRoot}/installer && Remove-Item -Force {tarball}
```

The global install extracts the package at install time and no longer references the file. Delete it to keep the working tree clean.
