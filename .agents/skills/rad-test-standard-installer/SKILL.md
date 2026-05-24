---
name: rad-test-standard-installer
description: 'Build, pack, and end-to-end install-test the greenfield standard installer (`rad-orchestration` npm package) against a single harness. Builds via `node harness-installers/standard/build-scripts/build.js`, packs `output/`, runs `npx ./<tarball> --yes --harness <h>`, verifies post-install state via `radorch doctor` and the per-harness manifest sha. Use when asked to "smoke-test the greenfield standard installer", "test the new npm installer install", or "validate the standard installer end-to-end".'
---

# rad-test-standard-installer

**Where this fits.** `rad-test-standard-installer` is the greenfield counterpart to `.agents/prompts/rad-test-release.prompt.md` (legacy installer) and mirrors the single-harness smoke-test discipline of `.agents/skills/rad-test-claude-plugin/SKILL.md` (plugin channel). Both the greenfield and legacy channels support `npx rad-orchestration` install for the standard harness targets (Claude Code, GitHub Copilot VS Code, GitHub Copilot CLI), but they use different build chains:

- `.agents/prompts/rad-test-release.prompt.md` → **legacy** build (`npm run build:installer` at repo root, output at `cli/dist/installers/`)
- **this skill** → **greenfield** build (`node harness-installers/standard/build-scripts/build.js`, output at `harness-installers/standard/output/`)

Pick the one matching the channel you want to validate. Single-harness per run keeps the diagnostic focused; you can re-run the skill for the other harnesses afterward. You do **not** install or verify the installer yourself — you build, pack, hand off the exact command for the user to run, and then verify the installed artifacts.

## When to Use This Skill

- Smoke-testing the greenfield standard installer end-to-end before publishing.
- Verifying that a greenfield build change reaches a real harness install via `npx rad-orchestration`.
- Reproducing a user-reported install issue against the current greenfield build.

## Prerequisites

- Node.js and npm installed.
- Working directory is anywhere inside the repo clone (the skill resolves repo root itself).
- **A pre-bootstrap step is required on a fresh clone** (see Step 2 below). `build.js` has top-level `import` statements that load from `harness-installers/shared/build-helpers/` — specifically `emit-cli-bundle.js`, `emit-hook-bundle.js`, `emit-ui-bundle.js`, and `expand-tokens.js`. Those modules require `esbuild`, which lives in `build-helpers/node_modules`. On a fresh clone that directory does not exist, so Node rejects the imports before any code in `build.js` runs — including the `bootstrap-deps` step that would otherwise install them. The fix is to run `npm install` in `build-helpers` once, pre-emptively, before invoking the build. The build's own `bootstrap-deps` step then handles the remaining three packages (`harness-adapters/engine`, `cli/`, `ui/`) during the normal build run.

## Workflow

### Step 1 — Pick a harness

Which harness do you want to smoke-test the standard installer against? Single-harness per run keeps the diagnostic focused; you can re-run the skill for the other harnesses afterward.

Use the `AskUserQuestion` tool:

```
question: "Which harness do you want to smoke-test the standard installer against? Single-harness per run keeps the diagnostic focused; you can re-run the skill for the other harnesses afterward."
options:
  - label: "Claude Code"
    value: "claude"
    description: "Install lands at ~/.claude/. Default if your install ran on a system where ~/.claude is present."
  - label: "GitHub Copilot (VS Code)"
    value: "copilot-vscode"
    description: "Install lands at ~/.copilot/. Folder mutex with copilot-cli — installing one removes the other from install.json."
  - label: "GitHub Copilot CLI"
    value: "copilot-cli"
    description: "Install lands at ~/.copilot/. Folder mutex with copilot-vscode."
```

Save the choice as `{harness}`.

### Step 2 — Resolve repo root and preflight dependency health

Resolve the repo root:

```
git rev-parse --show-toplevel
```

Use the result as `{repoRoot}` for every subsequent path.

Before running the build, run a dependency-health preflight. Why this is required: `build.js` only checks whether each package has a `node_modules/` directory; it does **not** verify that required executables exist. A partial or stale `node_modules/` (for example, `ui/node_modules` exists but `next` is missing) will make the build skip bootstrap and then fail later in `emit-ui-bundle` with `'next' is not recognized`.

Run this PowerShell block:

```powershell
$ErrorActionPreference = 'Stop'

$bhDir = Join-Path "{repoRoot}" 'harness-installers\shared\build-helpers'
$engineDir = Join-Path "{repoRoot}" 'harness-adapters\engine'
$scriptsDir = Join-Path "{repoRoot}" 'harness-files\skills\rad-orchestration\scripts'
$cliDir = Join-Path "{repoRoot}" 'cli'
$uiDir = Join-Path "{repoRoot}" 'ui'

function Ensure-NodeModules([string]$pkgDir) {
  if (-not (Test-Path (Join-Path $pkgDir 'node_modules'))) {
    npm install --prefix $pkgDir
  }
}

# build-helpers must exist before build.js can import shared helpers.
Ensure-NodeModules $bhDir

# Keep the remaining package roots healthy for bootstrap/build steps.
Ensure-NodeModules $engineDir
Ensure-NodeModules $scriptsDir
Ensure-NodeModules $cliDir
Ensure-NodeModules $uiDir

# Guard against partial installs: verify required executables exist.
if (-not (Test-Path (Join-Path $uiDir 'node_modules\.bin\next.cmd')) -and -not (Test-Path (Join-Path $uiDir 'node_modules\.bin\next'))) {
  npm install --prefix $uiDir
}
if (-not (Test-Path (Join-Path $cliDir 'node_modules\.bin\esbuild.cmd')) -and -not (Test-Path (Join-Path $cliDir 'node_modules\.bin\esbuild'))) {
  npm install --prefix $cliDir
}
if (-not (Test-Path (Join-Path $scriptsDir 'node_modules\.bin\tsx.cmd')) -and -not (Test-Path (Join-Path $scriptsDir 'node_modules\.bin\tsx'))) {
  npm install --prefix $scriptsDir
}
```

Expected: missing or unhealthy dependencies are installed and required binaries (`next`, `esbuild`, `tsx`) exist. If any `npm install` fails, stop and report — the build cannot proceed.

The build's own `bootstrap-deps` still runs during build, but this preflight prevents false-green `node_modules` checks from causing late failures.

If Step 3 later fails with a Next.js SWC-native error such as `Failed to load SWC binary for win32/x64` or `next-swc... is not a valid Win32 application`, treat `ui/node_modules` as unhealthy and repair it before retrying:

```powershell
$uiDir = Join-Path "{repoRoot}" 'ui'
Remove-Item -Recurse -Force (Join-Path $uiDir 'node_modules') -ErrorAction SilentlyContinue
npm install --prefix $uiDir
```

Then re-run Step 3 once.

### Step 3 — Build the greenfield standard installer

From the repo root:

```
node harness-installers/standard/build-scripts/build.js
```

> Expected: exit 0; `harness-installers/standard/output/` populated; `output/<harness>/manifests/v<version>.json` exists. (The publish `package.json` lives at the source root `standard/package.json` — the build does not write a top-level `output/package.json`.)
>
> On first run (or any run after one of the package `node_modules` folders was removed), expect one or more `npm install` operations from Step 2 and/or `bootstrap-deps`. The `ui/` install is typically the longest (~1 min on a cold network).
>
> On Windows and Linux, `next build` (invoked during `emit-ui-bundle`) emits a non-fatal `Module not found: Can't resolve 'fsevents'` warning. `fsevents` is a macOS-only file-watcher used by `chokidar` (a transitive `next` dependency); the warning is cosmetic and the build completes normally. Ignore unless the build's overall exit code is non-zero.

If the build fails, stop and report the failure. Do not continue.

### Step 4 — Pack the tarball

Navigate to the installer source directory and pack. The pack site is `standard/` (not `output/`) because the source-side `standard/package.json` is the publish package — its `files` allowlist names `index.js`, `lib/`, and `output/` so the per-harness payloads and the shared `output/ui/` (including its vendored `node_modules/`) all end up in the tarball:

```
cd {repoRoot}\harness-installers\standard
npm pack
```

Capture the resulting tarball filename (matching pattern `rad-orchestration-<version>.tgz`) as `{tarballPath}`. Read `standard/package.json` to confirm the version and note it as `{version}` — you will print it in the handoff message so the user can confirm it after install.

Expected: `npm pack` exits 0; the tarball file exists at `{tarballPath}`.

### Step 5 — Install against the picked harness

Before installing, provide the user with the exact command they must run in their shell:

```
npx file:{tarballPath} --yes --harness {harness}
```

The `file:` prefix is required on npm 11+ — without it, `npm exec` treats the raw tarball path as a command name instead of a package spec and silently exits 0. Post-publish users invoke this as `npx rad-orchestration` (no path, no `file:` prefix); the prefix is only for local smoke-testing.

Instruct the user to run this command and report back when the install completes. Do **not** run the install yourself.

Expected: exit 0; banner renders; per-harness spinner resolves to a green check; post-install summary lists the harness; the four `/rad-` command pointers appear.

### Step 6 — Verify the install

Once the user reports the install is complete, verify the installed artifacts by reading three sources:

1. **install.json version match**: Read `~/.radorch/install.json` and confirm that `harnesses.<harness>.version === {version}`.

2. **Sentinel file check**: Confirm that `~/.<harness-dir>/skills/rad-orchestration/scripts/radorch.mjs` exists (sentinel for installed pipeline).

3. **Per-harness manifest sha validation**: Load the manifest at `{repoRoot}/harness-installers/standard/output/{harness}/manifests/v{version}.json`. For every file entry in the manifest, read `~/.<harness-dir>/<skill-or-agent-path>` on disk and compute its sha256 hash. Compare each computed hash to the manifest's recorded sha for that file. All hashes must match.

### Step 7 — Run radorch doctor

Run `radorch doctor` from inside the installed harness's slash-command surface:

```
/radorch doctor
```

Confirm the following rows in the output are green:
- `install-json-shape`
- `version-match`
- `multi-harness-install-table`

The now-retired `bootstrap-skeleton` row should **not** appear (its absence is the validation signal that the new pipeline initialization succeeded).

If any of these checks fail, stop and report — the install is incomplete.

### Step 8 — Cleanup

Use the `AskUserQuestion` tool to ask before removing the tarball:

```
question: "Delete the tarball at {tarballPath}? Keeping it around lets you re-run the install in another shell; removing it keeps the repo clean."
options:
  - label: "Yes, delete the tarball"
    value: "delete"
    description: "Removes {tarballPath}. Safe — the build artifacts in output/ stay intact."
  - label: "No, keep the tarball"
    value: "keep"
    description: "Leaves {tarballPath} on disk for additional install attempts."
```

If the user picks **delete**:

```powershell
Remove-Item -Force {tarballPath}
```

Run it. Confirm the file is gone.

If the user picks **keep**, no action is needed.

### Step 9 — Summary

Finish with a one-line summary that names `{harness}`, `{version}`, and the manifest-sha match result:

> Smoke-test complete: `{harness}` v`{version}` installed and verified (manifest sha: all files match).
