---
name: rad-test-standard-installer
description: 'Build, pack, and end-to-end install-test the greenfield standard installer (`rad-orchestration` npm package) against a single harness. Builds via `node greenfield/harness-installers/standard/build-scripts/build.js`, packs `output/`, runs `npx ./<tarball> --yes --harness <h>`, verifies post-install state via `radorch doctor` and the per-harness manifest sha. Use when asked to "smoke-test the greenfield standard installer", "test the new npm installer install", or "validate the standard installer end-to-end".'
---

# rad-test-standard-installer

**Where this fits.** `rad-test-standard-installer` is the greenfield counterpart to `.agents/prompts/rad-test-release.prompt.md` (legacy installer) and mirrors the single-harness smoke-test discipline of `.agents/skills/rad-test-claude-plugin/SKILL.md` (plugin channel). Both the greenfield and legacy channels support `npx rad-orchestration` install for the standard harness targets (Claude Code, GitHub Copilot VS Code, GitHub Copilot CLI), but they use different build chains:

- `.agents/prompts/rad-test-release.prompt.md` → **legacy** build (`npm run build:installer` at repo root, output at `cli/dist/installers/`)
- **this skill** → **greenfield** build (`node greenfield/harness-installers/standard/build-scripts/build.js`, output at `greenfield/harness-installers/standard/output/`)

Pick the one matching the channel you want to validate. Single-harness per run keeps the diagnostic focused; you can re-run the skill for the other harnesses afterward. You do **not** install or verify the installer yourself — you build, pack, hand off the exact command for the user to run, and then verify the installed artifacts.

## When to Use This Skill

- Smoke-testing the greenfield standard installer end-to-end before publishing.
- Verifying that a greenfield build change reaches a real harness install via `npx rad-orchestration`.
- Reproducing a user-reported install issue against the current greenfield build.

## Prerequisites

- Node.js and npm installed.
- Working directory is anywhere inside the repo clone (the skill resolves repo root itself).
- **A pre-bootstrap step is required on a fresh clone** (see Step 2 below). `build.js` has top-level `import` statements that load from `greenfield/harness-installers/shared/build-helpers/` — specifically `emit-cli-bundle.js`, `emit-pipeline-bundle.js`, `emit-hook-bundle.js`, `emit-ui-bundle.js`, and `expand-tokens.js`. Those modules require `esbuild`, which lives in `build-helpers/node_modules`. On a fresh clone that directory does not exist, so Node rejects the imports before any code in `build.js` runs — including the `bootstrap-deps` step that would otherwise install them. The fix is to run `npm install` in `build-helpers` once, pre-emptively, before invoking the build. The build's own `bootstrap-deps` step then handles the remaining three packages (`harness-adapters/engine`, `cli/`, `ui/`) during the normal build run.

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

### Step 2 — Resolve repo root and pre-install build-helpers dependencies

Resolve the repo root:

```bash
git rev-parse --show-toplevel
```

Use the result as `{repoRoot}` for every subsequent path.

Before running the build, check whether `{repoRoot}/greenfield/harness-installers/shared/build-helpers/node_modules` exists. If it does not, install it now — this is the only package that must exist before `build.js` is invoked, because `build.js` imports from it at module-load time:

```powershell
$bhDir = "{repoRoot}\greenfield\harness-installers\shared\build-helpers"
if (-not (Test-Path "$bhDir\node_modules")) {
    npm install --prefix $bhDir
}
```

Expected: `npm install` completes (or is skipped because `node_modules` already exists). If `npm install` fails, stop and report — the build cannot proceed.

The build's own `bootstrap-deps` step will handle the remaining three packages (`greenfield/harness-adapters/engine`, `cli/`, `ui/`) during the build run; those do not need pre-installation.

### Step 3 — Build the greenfield standard installer

From the repo root:

```
node greenfield/harness-installers/standard/build-scripts/build.js
```

> Expected: exit 0; `greenfield/harness-installers/standard/output/` populated; `output/<harness>/manifests/v<version>.json` exists; `output/package.json` exists.
>
> On first run (or any run after `cli/` or `ui/` `node_modules` were deleted), the `bootstrap-deps` step runs `npm install` in those sub-packages. Expect longer build times on first run; subsequent runs skip the installs. The `ui/` install is the largest (~1 min on a cold network).
>
> On Windows and Linux, `next build` (invoked during `emit-ui-bundle`) emits a non-fatal `Module not found: Can't resolve 'fsevents'` warning. `fsevents` is a macOS-only file-watcher used by `chokidar` (a transitive `next` dependency); the warning is cosmetic and the build completes normally. Ignore unless the build's overall exit code is non-zero.

If the build fails, stop and report the failure. Do not continue.

### Step 4 — Pack the tarball

Navigate to the output directory and pack:

```
cd {repoRoot}\greenfield\harness-installers\standard\output
npm pack
```

Capture the resulting tarball filename (matching pattern `rad-orchestration-<version>.tgz`) as `{tarballPath}`. Read `output/package.json` to confirm the version and note it as `{version}` — you will print it in the handoff message so the user can confirm it after install.

Expected: `npm pack` exits 0; the tarball file exists at `{tarballPath}`.

### Step 5 — Install against the picked harness

Before installing, provide the user with the exact command they must run in their shell:

```
npx {tarballPath} --yes --harness {harness}
```

Instruct the user to run this command and report back when the install completes. Do **not** run the install yourself.

Expected: exit 0; banner renders; per-harness spinner resolves to a green check; post-install summary lists the harness; the four `/rad-` command pointers appear.

### Step 6 — Verify the install

Once the user reports the install is complete, verify the installed artifacts by reading three sources:

1. **install.json version match**: Read `~/.radorch/install.json` and confirm that `harnesses.<harness>.version === {version}`.

2. **Sentinel file check**: Confirm that `~/.<harness-dir>/skills/rad-orchestration/scripts/radorch.mjs` exists (sentinel for installed pipeline).

3. **Per-harness manifest sha validation**: Load the manifest at `{repoRoot}/greenfield/harness-installers/standard/output/{harness}/manifests/v{version}.json`. For every file entry in the manifest, read `~/.<harness-dir>/<skill-or-agent-path>` on disk and compute its sha256 hash. Compare each computed hash to the manifest's recorded sha for that file. All hashes must match.

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
