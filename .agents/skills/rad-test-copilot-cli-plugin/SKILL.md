---
name: rad-test-copilot-cli-plugin
description: 'Stage the greenfield rad-orchestration Copilot CLI plugin as a local dogfood marketplace. Builds the plugin via the greenfield build chain, copies the build output into a sibling dogfood marketplace tree, writes an ephemeral marketplace.json at .github/plugin/marketplace.json, and prints the exact `copilot plugin marketplace add` + `copilot plugin install` commands for the user to run in a fresh Copilot CLI session. Use when asked to "dogfood the copilot cli plugin", "test the greenfield copilot plugin install", or "stage the copilot plugin for manual install".'
---

# rad-test-copilot-cli-plugin

**Where this fits.** `rad-test-copilot-cli-plugin` is the greenfield Copilot CLI counterpart to `.agents/skills/rad-test-claude-plugin/SKILL.md`. Both stage a `rad-orchestration` plugin as a local marketplace for manual install, but they target different harnesses and build chains:

- `.agents/skills/rad-test-claude-plugin/SKILL.md` → **Claude Code** plugin (`greenfield/harness-installers/claude-plugin/build-scripts/build.js`, marketplace at `.claude-plugin/marketplace.json`)
- **this skill** → **Copilot CLI** plugin (`greenfield/harness-installers/copilot-cli-plugin/build-scripts/build.js`, marketplace at `.github/plugin/marketplace.json`)

Pick the one matching the harness you want to validate. You do **not** install or verify the plugin yourself — that happens in a separate Copilot CLI session the user opens manually. Your job is to build, stage the marketplace, and hand off the install commands.

## When to Use This Skill

- Dogfooding the greenfield Copilot CLI plugin install end-to-end before publishing.
- Verifying that a greenfield build change reaches a real Copilot CLI session via `copilot plugin install`.
- Reproducing a user-reported install issue against the current greenfield Copilot CLI build.

## Important — marketplace name and coexistence with legacy installer

This skill uses the marketplace name `rad-orc-dogfood`. This name is distinct from the legacy installer's user-level `~/.copilot/` writes, so the two can coexist. However, if the user previously had the standard installer's `copilot-cli` target installed, the plugin's `userPromptSubmitted` bootstrap hook will surface a coexistence warning (this is expected behavior per FR-19 — proceed through it, it is not an error).

Surface this reminder in your handoff message — do not assume the user remembers it.

## Prerequisites

- Node.js and npm installed.
- Working directory is anywhere inside the repo clone (the skill resolves repo root itself).
- **A pre-bootstrap step is required on a fresh clone** (see Step 2 below). `build.js` has top-level `import` statements that load from `greenfield/harness-installers/shared/build-helpers/` — specifically `emit-cli-bundle.js`, `emit-pipeline-bundle.js`, `emit-hook-bundle.js`, `emit-ui-bundle.js`, and `expand-tokens.js`. Those modules require `esbuild`, which lives in `build-helpers/node_modules`. On a fresh clone that directory does not exist, so Node rejects the imports before any code in `build.js` runs — including the `bootstrap-deps` step that would otherwise install them. The fix is to run `npm install` in `build-helpers` once, pre-emptively, before invoking the build. The build's own `bootstrap-deps` step then handles the remaining packages during the normal build run.
- The build paths `greenfield/harness-installers/copilot-cli-plugin/output/` and `greenfield/harness-installers/copilot-cli-plugin/build-scripts/build.js` must exist (this skill is sequenced last in the iteration and those paths are produced by earlier tasks).

## Workflow

### 1. Resolve repo root

```bash
git rev-parse --show-toplevel
```

Use the result as `{repoRoot}` for every subsequent path. The user is on Windows — backslash-separate paths in the handoff message.

### 2. Pre-install build-helpers dependencies (fresh-clone guard)

Before running the build, check whether `greenfield/harness-installers/shared/build-helpers/node_modules` exists. If it does not, install it now — this is the only package that must exist before `build.js` is invoked, because `build.js` imports from it at module-load time:

```powershell
$bhDir = "{repoRoot}\greenfield\harness-installers\shared\build-helpers"
if (-not (Test-Path "$bhDir\node_modules")) {
    npm install --prefix $bhDir
}
```

Expected: `npm install` completes (or is skipped because `node_modules` already exists). If `npm install` fails, stop and report — the build cannot proceed.

The build's own `bootstrap-deps` step will handle the remaining packages during the build run; those do not need pre-installation.

### 3. Build the greenfield Copilot CLI plugin

From the repo root:

```
node greenfield/harness-installers/copilot-cli-plugin/build-scripts/build.js
```

> Expected: exit 0; `greenfield/harness-installers/copilot-cli-plugin/output/` populated; the build's final `validate` step reports no missing artifacts.
>
> On first run (or any run after sub-package `node_modules` were deleted), the `bootstrap-deps` step runs `npm install` in those sub-packages. Expect longer build times on first run; subsequent runs skip the installs.
>
> On Windows and Linux, `next build` (invoked during `emit-ui-bundle`) emits a non-fatal `Module not found: Can't resolve 'fsevents'` warning. `fsevents` is a macOS-only file-watcher used by `chokidar` (a transitive `next` dependency); the warning is cosmetic and the build completes normally. Ignore unless the build's overall exit code is non-zero.

If the build fails, stop and report the failure. Do not continue.

### 4. Verify the staged plugin tree and capture the version

Confirm that `{repoRoot}/greenfield/harness-installers/copilot-cli-plugin/output/plugin.json` exists at the payload root (not under `.claude-plugin/` — Copilot CLI reads from the root, not the Claude-style nested path). Read its `version` field and remember it as `{version}` — you will print it in the handoff message so the user can confirm it after install.

If the file is missing, stop and report. Build must have silently produced an incomplete tree.

### 5. Stage the dogfood marketplace tree

The dogfood marketplace lives at `{repoRoot}/greenfield/harness-installers/copilot-cli-plugin/dogfood-marketplace/` — a sibling of `output/`. Copilot CLI reads the plugin catalog from `.github/plugin/marketplace.json` within the marketplace directory (not `.claude-plugin/` — that is the Claude-native path).

**Stage in two parts:**

**(a)** Remove any prior `dogfood-marketplace/plugins/rad-orc/` (so a stale copy never lingers across rebuilds), then copy the current `output/` tree into place. PowerShell:

```powershell
$mkt = "{repoRoot}\greenfield\harness-installers\copilot-cli-plugin\dogfood-marketplace"
$pluginDest = "$mkt\plugins\rad-orc"
if (Test-Path $pluginDest) { Remove-Item -Recurse -Force $pluginDest }
New-Item -ItemType Directory -Force -Path (Split-Path $pluginDest) | Out-Null
Copy-Item -Recurse -Force "{repoRoot}\greenfield\harness-installers\copilot-cli-plugin\output" $pluginDest
```

Confirm `$pluginDest\plugin.json` exists after the copy.

**(b)** Write this exact JSON to `{repoRoot}/greenfield/harness-installers/copilot-cli-plugin/dogfood-marketplace/.github/plugin/marketplace.json` (create the nested `.github/plugin/` directory first):

```json
{
  "name": "rad-orc-dogfood",
  "owner": { "name": "metalhexx" },
  "description": "Ephemeral local dogfood marketplace for the greenfield rad-orchestration Copilot CLI plugin build. Generated by rad-test-copilot-cli-plugin skill; do not publish.",
  "plugins": [
    {
      "name": "rad-orc",
      "source": "./plugins/rad-orc",
      "description": "RAD multi-agent orchestration system for Copilot CLI (greenfield build).",
      "strict": true
    }
  ]
}
```

After writing, parse the file back as JSON to confirm it is syntactically valid.

### 6. Print install instructions for the user

Print a block like the following, substituting `{repoRoot}` and `{version}` with the values you captured. Use backslash-separated Windows paths.

> The greenfield Copilot CLI dogfood marketplace is staged. Plugin version: **`{version}`**.
>
> **Before running the commands below**, if the standard installer's `copilot-cli` target was previously active at `~/.copilot/`, the `userPromptSubmitted` bootstrap hook will surface a coexistence warning on first use — this is expected behavior, not an error. You do not need to remove the prior install to proceed.
>
> Open a **fresh Copilot CLI session** and run:
>
> ```
> copilot plugin marketplace add {repoRoot}\greenfield\harness-installers\copilot-cli-plugin\dogfood-marketplace
> copilot plugin install rad-orc@rad-orc-dogfood
> ```
>
> (Equivalently inside a Copilot CLI session: `/plugin install rad-orc@rad-orc-dogfood`. The `@rad-orc-dogfood` marketplace qualifier is required — bare `rad-orc` fails with "Invalid plugin spec".)
>
> The `userPromptSubmitted` hook will auto-bootstrap `~/.radorch/` on your first prompt in the new session. `sessionStart`'s drift-check stays silent on a clean install.
>
> Come back here when you're done dogfooding — I'll offer cleanup.

### 7. Wait for the user, then offer cleanup

After printing the instructions, your next turn waits for the user to say they're done. When they return, call `AskUserQuestion` to offer cleanup. Surface both options explicitly — do not rely on an auto-injected "Other":

- **Question:** "Done dogfooding the greenfield Copilot CLI plugin? You can remove the staged dogfood marketplace, or leave it in place for another round of testing."
- **Options:**
  - **Yes, clean up** — "Remove `{repoRoot}\greenfield\harness-installers\copilot-cli-plugin\dogfood-marketplace` (deletes both the marketplace.json and the plugin copy at `plugins/rad-orc/`). The canonical build output at `output/` is left untouched. Next run of this skill regenerates the marketplace and the plugin copy from `output/`."
  - **Leave it for another round** — "Keep the dogfood-marketplace dir so you can iterate. Re-running this skill after a rebuild refreshes the plugin copy. Print the cleanup command for later."

If the user picks **Yes, clean up**:

```powershell
Remove-Item -Recurse -Force {repoRoot}\greenfield\harness-installers\copilot-cli-plugin\dogfood-marketplace
```

Run it. Confirm the directory is gone. Print "Cleaned up the dogfood marketplace (marketplace.json + the plugin copy at `plugins/rad-orc/`). The greenfield plugin output at `greenfield/harness-installers/copilot-cli-plugin/output/` is untouched (rebuild via `node greenfield/harness-installers/copilot-cli-plugin/build-scripts/build.js` if needed). Re-run this skill to regenerate the dogfood marketplace."

If the user picks **Leave it for another round**:

Print the cleanup command above so they can run it later. Also remind them to run `copilot plugin uninstall rad-orc` (and optionally `copilot plugin marketplace remove rad-orc-dogfood`) inside the test Copilot CLI session before switching channels.

That ends the skill. Do not run tests, npm pack, or any other E2E validation — those belong in CI or a separate workflow.
