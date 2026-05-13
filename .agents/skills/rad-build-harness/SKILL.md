---
name: rad-build-harness
description: 'End-to-end installer test for a contributor: builds a local tarball from installer/, runs the installer via npx for the chosen harness, bootstraps the plugin, and verifies via doctor and sha256 manifest check. Use when asked to "test the installer", "build and install the harness", or "verify the install".'
---

# rad-build-harness

**Where this fits.** `rad-build-harness` is the quick contributor dogfood loop — pack, install, bootstrap, verify on a single harness. The comprehensive cross-cutting smoke is `.agents/prompts/rad-test-release.prompt.md` (legacy installer) and `.agents/prompts/rad-test-plugin-release.prompt.md` (Claude plugin). Use this skill when you want a fast feedback cycle on a build change; use the release prompts for go/no-go decisions.

Run the real installer end-to-end from local source. This skill selects a harness, builds the canonical adapter sources, packs the installer into a tarball, runs the wizard non-interactively via npx, bootstraps the plugin (with `--force` to defeat the version-equal short-circuit on repeat runs), and verifies the result.

`~/.radorch/projects/` is never touched at any point in this workflow — existing user projects survive unchanged.

## When to Use This Skill

- Testing a local build of the installer before publishing.
- Verifying that a harness change propagates end-to-end through the pack → install → bootstrap path.
- Confirming `doctor` reports a clean state after a fresh or upgraded install.

## Prerequisites

- Node.js and npm installed.
- Working directory is anywhere inside the repo clone (the skill resolves repo root itself).

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

### 3. Pack the installer

```bash
cd {repoRoot}/installer && npm pack
```

Note the generated tarball filename — something like `rad-orchestration-X.Y.Z.tgz`. Store it as `{tarball}`. The full absolute path is `{repoRoot}/installer/{tarball}`.

### 4. Verify the tarball

```bash
npx {repoRoot}/installer/{tarball} --version
```

### 5. Run the installer non-interactively

Tests the wizard surface: the single harness-question prompt and the canonical `orchestration.yml` write.

```bash
npx {repoRoot}/installer/{tarball} --yes --harness {harness}
```

> Expected: installer completes without interactive prompts and exits with code 0.
> `~/.radorch/projects/` is not touched.

### 6. Bootstrap the plugin with --force

Tests the force-bootstrap path: defeats the version-equal short-circuit so a repeat test on the same version still re-runs the bootstrap.

Locate the bundled plugin root for the harness. The plugin payload ships at `{repoRoot}/installer/src/{bundleDir}/` where `bundleDir` matches the harness:

| Harness | Bundle directory |
|---------|-----------------|
| `claude` | `installer/src/claude/` |
| `copilot-vscode` | `installer/src/copilot-vscode/` |
| `copilot-cli` | `installer/src/copilot-cli/` |

Run plugin-bootstrap with `--force` to defeat the version-equal short-circuit:

```bash
npx {repoRoot}/installer/{tarball} plugin-bootstrap --force --harness {harness} --plugin-root {repoRoot}/installer/src/{bundleDir}
```

> `--force` ensures the bootstrap runs even when the delivering version equals the installed version. This is required on repeat test runs.

### 7. Verify the install

Run all three checks and report any failure:

```bash
npx {repoRoot}/installer/{tarball} --version
npx {repoRoot}/installer/{tarball} doctor
```

**sha256 manifest check:** The manifest catalog is written into the bundled plugin payload during `npm pack` (via the `prepack` lifecycle hook). Verify that the manifest file for the tested version exists and that every entry carries a `sha256` field.

The manifest path is:

```
{repoRoot}/installer/src/{bundleDir}/manifests/v{version}.json
```

Open the file and confirm:
- The file exists.
- Each entry in the file has a `sha256` field with a non-empty value.

### 8. Report results

Report:
- The version tested (from Step 5).
- Whether `doctor` passed or flagged issues.
- Whether the sha256 manifest check passed.
- Any step that failed, with the verbatim error output.

### 9. Delete the local tarball

```bash
cd {repoRoot}/installer && Remove-Item -Force {tarball}
```

The global install extracts the package at install time and no longer references the file. Delete it to keep the working tree clean.
