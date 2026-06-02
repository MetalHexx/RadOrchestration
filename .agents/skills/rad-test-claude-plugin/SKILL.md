---
name: rad-test-claude-plugin
description: 'Stage the greenfield rad-orchestration Claude plugin as a local dogfood marketplace. Builds the plugin via the greenfield build chain, copies the build output into a sibling dogfood marketplace tree, writes an ephemeral marketplace.json, and prints the exact /plugin marketplace add + /plugin install commands for the user to run in a fresh Claude Code session. Use when asked to "dogfood the claude plugin", "test the greenfield plugin install", or "stage the plugin for manual install".'
---

# rad-test-claude-plugin

**Where this fits.** `rad-test-claude-plugin` is the greenfield counterpart to `.agents/prompts/rad-test-plugin-release.prompt.md`. Both stage a Claude plugin as a local marketplace for manual `/plugin install`, but they target different build chains and ship under different plugin names — greenfield installs as `rad-orc`, legacy installs as `rad-orchestration`:

- `.agents/prompts/rad-test-plugin-release.prompt.md` → **legacy** build (`npm run build:plugin` at repo root, output at `cli/dist/marketplaces/claude/`)
- **this skill** → **greenfield** build (`node harness-installers/claude-plugin/build-scripts/build.js`, output at `harness-installers/claude-plugin/output/`)

Pick the one matching the channel you want to validate. The faster contributor dogfood loop (pack → install → verify on a single harness, no Claude Code session swap required) is `.agents/skills/rad-build-harness/SKILL.md`.

You do **not** install or verify the plugin yourself — that happens in a separate Claude Code session the user opens manually. Your job is to build, stage the marketplace, and hand off the install commands.

## When to Use This Skill

- Dogfooding the greenfield Claude plugin install end-to-end before publishing.
- Verifying that a greenfield build change reaches a real Claude Code session via `/plugin install`.
- Reproducing a user-reported install issue against the current greenfield build.

## Important — coexisting with the legacy `rad-orchestration` channel

This skill installs the greenfield plugin under name `rad-orc` (marketplace `rad-orc-dogfood`), distinct from the legacy `rad-test-plugin-release` channel which installs as `rad-orchestration` (marketplace `rad-orchestration-dogfood`). The two CAN coexist as separate Claude plugins, but both deliver the same `skills/rad-orchestration/` set and both bootstrap `~/.radorc/`, so running them side-by-side will produce duplicate skills and racy bootstrap behavior. If the user previously installed the legacy dogfood marketplace, they should remove it inside the test session **before** the install commands you hand them in Step 6:

```
/plugin uninstall rad-orchestration
/plugin marketplace remove rad-orchestration-dogfood
```

Surface this reminder in your handoff message — do not assume the user remembers it.

## Prerequisites

- Node.js and npm installed.
- Working directory is anywhere inside the repo clone (the skill resolves repo root itself).
- **A single root install is required on a fresh clone** (see Step 2 below). The repo uses npm workspaces; `build.js` and the shared `build-helpers` modules all resolve `esbuild`, `next`, and other executables from the hoisted root `node_modules/.bin`. On a fresh clone that directory does not exist, so the fix is to run `npm install` once at the repo root — this installs all workspace packages and hoists every binary into the root `node_modules/.bin`.

## Workflow

### 1. Resolve repo root

```
git rev-parse --show-toplevel
```

Use the result as `{repoRoot}` for every subsequent path. The user is on Windows — backslash-separate paths in the handoff message.

### 2. Root install (fresh-clone guard)

Before running the build, verify that the root `node_modules` is present and the required executables (`esbuild`, `next`) are hoisted. The repo uses npm workspaces and all binaries resolve from the root `node_modules/.bin` — not from per-package `node_modules/.bin` paths:

```powershell
if (-not (Test-Path (Join-Path "{repoRoot}" 'node_modules\.bin\next.cmd')) -and
    -not (Test-Path (Join-Path "{repoRoot}" 'node_modules\.bin\next'))) {
  npm install --prefix "{repoRoot}"
}
if (-not (Test-Path (Join-Path "{repoRoot}" 'node_modules\.bin\esbuild.cmd')) -and
    -not (Test-Path (Join-Path "{repoRoot}" 'node_modules\.bin\esbuild'))) {
  npm install --prefix "{repoRoot}"
}
```

Expected: `npm install` completes (or is skipped because the root `node_modules` already exists with the required binaries hoisted). If `npm install` fails, stop and report — the build cannot proceed.

### 3. Build the greenfield plugin

From the repo root:

```
node harness-installers/claude-plugin/build-scripts/build.js
```

> Expected: exit 0; `harness-installers/claude-plugin/output/` populated; the build's final `validate` step (from `build-scripts/validate.js`) reports no missing artifacts and the per-version manifest exists.
>
> On first run (or any run after `node_modules` was deleted at the root), expect the root `npm install` from Step 2 to run. Expect longer build times on first run; subsequent runs skip the root install. The `ui/` install is the largest (~1 min on a cold network).
>
> On Windows and Linux, `next build` (invoked during `emit-ui-bundle`) emits a non-fatal `Module not found: Can't resolve 'fsevents'` warning. `fsevents` is a macOS-only file-watcher used by `chokidar` (a transitive `next` dependency); the warning is cosmetic and the build completes normally. Ignore unless the build's overall exit code is non-zero.

If the build fails, stop and report the failure. Do not continue.

### 4. Verify the staged plugin tree and capture the version

Confirm that `{repoRoot}/harness-installers/claude-plugin/output/.claude-plugin/plugin.json` exists. Read its `version` field and remember it as `{version}` — you will print it in the handoff message so the user can confirm it after install.

If the file is missing, stop and report. Build must have silently produced an incomplete tree.

### 5. Stage the dogfood marketplace tree

The dogfood marketplace lives at `{repoRoot}/harness-installers/claude-plugin/dogfood-marketplace/` — a sibling of `output/`. The plugin tree must live as a `./<subpath>` of the marketplace root: Claude Code's marketplace spec ([docs](https://code.claude.com/docs/en/plugin-marketplaces)) requires relative-path sources to start with `./` and forbids parent-directory traversal (`../`) and absolute paths. The plugin therefore lives at `dogfood-marketplace/plugins/rad-orc/` as a copy of `output/`. This mirrors the legacy `rad-test-plugin-release` prompt's layout. `output/` itself remains the canonical npm-pack source and is untouched.

**Stage in two parts:**

**(a)** Remove any prior `dogfood-marketplace/plugins/rad-orc/` (so a stale copy never lingers across rebuilds), then copy the current `output/` tree into place. PowerShell:

```powershell
$mkt = "{repoRoot}\harness-installers\claude-plugin\dogfood-marketplace"
$pluginDest = "$mkt\plugins\rad-orc"
if (Test-Path $pluginDest) { Remove-Item -Recurse -Force $pluginDest }
New-Item -ItemType Directory -Force -Path (Split-Path $pluginDest) | Out-Null
Copy-Item -Recurse -Force "{repoRoot}\harness-installers\claude-plugin\output" $pluginDest
```

Confirm `$pluginDest\.claude-plugin\plugin.json` exists after the copy.

**(b)** Write this exact JSON to `{repoRoot}/harness-installers/claude-plugin/dogfood-marketplace/.claude-plugin/marketplace.json` (create the nested `.claude-plugin/` first):

```json
{
  "name": "rad-orc-dogfood",
  "owner": { "name": "metalhexx" },
  "description": "Ephemeral local dogfood marketplace for the greenfield rad-orchestration Claude plugin build. Generated by rad-test-claude-plugin skill; do not publish.",
  "plugins": [
    {
      "name": "rad-orc",
      "source": "./plugins/rad-orc",
      "description": "Rad Orc multi-agent orchestration system for Claude Code (dogfood build)."
    }
  ]
}
```

After writing, parse the file back as JSON to confirm it is syntactically valid.

### 6. Print install instructions for the user

Print a block like the following, substituting `{repoRoot}` and `{version}` with the values you captured. Use backslash-separated Windows paths.

> The greenfield dogfood marketplace is staged. Plugin version: **`{version}`**.
>
> **Before running the commands below**, if you previously installed the legacy dogfood marketplace from `rad-test-plugin-release`, remove it first inside the test session:
>
> ```
> /plugin uninstall rad-orchestration
> /plugin marketplace remove rad-orchestration-dogfood
> ```
>
> Then open a **fresh Claude Code session** in a test workspace of your choice (any directory — does not need to be related to this repo), and run:
>
> ```
> /plugin marketplace add {repoRoot}\harness-installers\claude-plugin\dogfood-marketplace
> /plugin install rad-orc@rad-orc-dogfood
> ```
>
> Reload Claude Code if prompted. The `UserPromptSubmit` hook will auto-bootstrap `~/.radorc/` on your first prompt in the new session. `SessionStart`'s drift-check stays silent unless the cache's plugin version differs from `~/.radorc/install.json`.
>
> Come back here when you're done dogfooding — I'll offer cleanup.

### 7. Wait for the user, then offer cleanup

After printing the instructions, your next turn waits for the user to say they're done. When they return, call `AskUserQuestion` to offer cleanup. Surface both options explicitly — do not rely on an auto-injected "Other":

- **Question:** "Done dogfooding the greenfield plugin? You can remove the staged dogfood marketplace, or leave it in place for another round of testing."
- **Options:**
  - **Yes, clean up** — "Remove `{repoRoot}\harness-installers\claude-plugin\dogfood-marketplace` (deletes both the marketplace.json and the plugin copy at `plugins/rad-orc/`). The canonical build output at `output/` is left untouched. Next run of this skill regenerates the marketplace and the plugin copy from `output/`."
  - **Leave it for another round** — "Keep the dogfood-marketplace dir so you can iterate. Re-running this skill after a rebuild refreshes the plugin copy. Print the cleanup command for later."

If the user picks **clean up**:

```
Remove-Item -Recurse -Force {repoRoot}\harness-installers\claude-plugin\dogfood-marketplace
```

Run it. Confirm the directory is gone. Print "Cleaned up the dogfood marketplace (marketplace.json + the plugin copy at `plugins/rad-orc/`). The greenfield plugin output at `harness-installers/claude-plugin/output/` is untouched (rebuild via `node harness-installers/claude-plugin/build-scripts/build.js` if needed). Re-run this skill to regenerate the dogfood marketplace."

If the user picks **leave it**:

Print the cleanup command above so they can run it later. Also remind them that the user is still responsible for running `/plugin uninstall rad-orc` (and optionally `/plugin marketplace remove rad-orc-dogfood`) inside the test Claude Code session before switching back to the legacy `rad-test-plugin-release` channel.

That ends the skill. Do not run tests, npm pack, or any other E2E validation — those belong in CI or a separate workflow.
