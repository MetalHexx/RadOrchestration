---
name: rad-test-copilot-vscode-plugin
description: 'Stage the greenfield rad-orchestration Copilot VS Code plugin as a local dogfood marketplace. Builds the plugin via the greenfield build chain, copies the build output into a sibling dogfood marketplace tree, writes an ephemeral marketplace.json at .github/plugin/marketplace.json, and prints the exact install instructions for the user to run in a fresh VS Code session — either via the `Chat: Install Plugin From Source` Command Palette entry or the `chat.pluginLocations` user-settings form. Use when asked to "dogfood the copilot vscode plugin", "test the greenfield copilot vscode plugin install", or "stage the copilot vscode plugin for manual install".'
---

# rad-test-copilot-vscode-plugin

**Where this fits.** `rad-test-copilot-vscode-plugin` is the VS Code counterpart to `.agents/skills/rad-test-copilot-cli-plugin/SKILL.md` and `.agents/skills/rad-test-claude-plugin/SKILL.md`. All three stage a `rad-orchestration` plugin as a local marketplace for manual install, but they target different harnesses and build chains:

- `.agents/skills/rad-test-claude-plugin/SKILL.md` → **Claude Code** plugin (`harness-installers/claude-plugin/build-scripts/build.js`, marketplace at `.claude-plugin/marketplace.json`)
- `.agents/skills/rad-test-copilot-cli-plugin/SKILL.md` → **Copilot CLI** plugin (`harness-installers/copilot-cli-plugin/build-scripts/build.js`, marketplace at `.github/plugin/marketplace.json`)
- **this skill** → **Copilot VS Code** plugin (`harness-installers/copilot-vscode-plugin/build-scripts/build.js`, marketplace at `.github/plugin/marketplace.json`)

Pick the one matching the harness you want to validate. The VS Code plugin is load-bearing for the iteration: it carries the `(copilot)`-suffixed model identifiers required by VS Code's resolver — the identifiers that allow skills and agents to reference the correct model family when running inside a VS Code Copilot session. You do **not** install or verify the plugin yourself — that happens in a separate VS Code session the user opens manually. Your job is to build, stage the marketplace, and hand off the install instructions.

## When to Use This Skill

- Dogfooding the greenfield Copilot VS Code plugin install end-to-end before publishing.
- Verifying that a greenfield build change reaches a real VS Code Copilot session via `chat.pluginLocations` or `Chat: Install Plugin From Source`.
- Reproducing a user-reported install issue against the current greenfield VS Code Copilot build.

## Important — marketplace name and coexistence with installed plugins

This skill uses the marketplace name `rad-orc-vscode-dogfood`. This name is distinct from the legacy installer's user-level `~/.copilot/` writes, so the two can coexist.

However, if the user previously had the standard installer's `copilot-vscode` target installed, **or** the `copilot-cli-plugin` is auto-discovered by VS Code from `~/.copilot/installed-plugins/` (VS Code picks up CLI-installed plugins automatically), the plugin's `UserPromptSubmit` bootstrap hook will surface a three-partner coexistence warning (this is expected behavior per FR-21 — proceed through it, it is not an error). All three copies — the VS Code dogfood install, the standard installer's VS Code target, and the Copilot CLI install auto-discovered by VS Code — can coexist; the coexistence warning is informational.

Surface this reminder in your handoff message — do not assume the user remembers it.

## Prerequisites

- Node.js and npm installed.
- VS Code with the GitHub Copilot extension installed and `chat.plugins.enabled` set to `true` (the Agent Plugins feature is Preview as of VS Code 1.110).
- Working directory is anywhere inside the repo clone (the skill resolves repo root itself).
- **A pre-bootstrap step is required on a fresh clone** (see Step 2 below). `build.js` has top-level `import` statements that load from `harness-installers/shared/build-helpers/` — specifically `emit-cli-bundle.js`, `emit-hook-bundle.js`, `emit-ui-bundle.js`, and `expand-tokens.js`. Those modules require `esbuild`, which lives in `build-helpers/node_modules`. On a fresh clone that directory does not exist, so Node rejects the imports before any code in `build.js` runs — including the `bootstrap-deps` step that would otherwise install them. The fix is to run `npm install` in `build-helpers` once, pre-emptively, before invoking the build. The build's own `bootstrap-deps` step then handles the remaining packages during the normal build run.
- The build paths `harness-installers/copilot-vscode-plugin/output/` and `harness-installers/copilot-vscode-plugin/build-scripts/build.js` must exist (this skill is sequenced last in the iteration and those paths are produced by earlier tasks).

## Workflow

### 1. Resolve repo root

```
git rev-parse --show-toplevel
```

Use the result as `{repoRoot}` for every subsequent path. The user is on Windows — backslash-separate paths in the handoff message.

### 2. Pre-install build-helpers dependencies (fresh-clone guard)

Before running the build, check whether `harness-installers/shared/build-helpers/node_modules` exists. If it does not, install it now — this is the only package that must exist before `build.js` is invoked, because `build.js` imports from it at module-load time:

```powershell
$bhDir = "{repoRoot}\harness-installers\shared\build-helpers"
if (-not (Test-Path "$bhDir\node_modules")) {
    npm install --prefix $bhDir
}
```

Expected: `npm install` completes (or is skipped because `node_modules` already exists). If `npm install` fails, stop and report — the build cannot proceed.

The build's own `bootstrap-deps` step will handle the remaining packages during the build run; those do not need pre-installation.

### 3. Build the greenfield Copilot VS Code plugin

From the repo root:

```
node harness-installers/copilot-vscode-plugin/build-scripts/build.js
```

> Expected: exit 0; `harness-installers/copilot-vscode-plugin/output/` populated; the build's final `validate` step reports no missing artifacts.
>
> On first run (or any run after sub-package `node_modules` were deleted), the `bootstrap-deps` step runs `npm install` in those sub-packages. Expect longer build times on first run; subsequent runs skip the installs.
>
> On Windows and Linux, `next build` (invoked during `emit-ui-bundle`) emits a non-fatal `Module not found: Can't resolve 'fsevents'` warning. `fsevents` is a macOS-only file-watcher used by `chokidar` (a transitive `next` dependency); the warning is cosmetic and the build completes normally. Ignore unless the build's overall exit code is non-zero.

If the build fails, stop and report the failure. Do not continue.

### 4. Verify the staged plugin tree and capture the version

Confirm that `{repoRoot}/harness-installers/copilot-vscode-plugin/output/.claude-plugin/plugin.json` exists. The Copilot VS Code plugin ships in **Claude-format manifest layout** (`.claude-plugin/plugin.json`, NOT a root `plugin.json`) — that's how VS Code knows to inject `CLAUDE_PLUGIN_ROOT` into the hook process so `bootstrap.mjs` / `drift-check.mjs` can self-locate. See `harness-installers/copilot-vscode-plugin/AGENTS.md` under "Why Claude-format manifest layout" for the full rationale. Read the manifest's `version` field and remember it as `{version}` — you will print it in the handoff message so the user can confirm it after install.

If the file is missing, stop and report. Build must have silently produced an incomplete tree.

### 5. Stage the dogfood marketplace tree

The dogfood marketplace lives at `{repoRoot}/harness-installers/copilot-vscode-plugin/dogfood-marketplace/` — a sibling of `output/`. VS Code Copilot reads the plugin catalog from `.github/plugin/marketplace.json` within the marketplace directory.

**Stage in two parts:**

**(a)** Remove any prior `dogfood-marketplace/plugins/rad-orc-vscode/` (so a stale copy never lingers across rebuilds), then copy the current `output/` tree into place. PowerShell:

```powershell
$mkt = "{repoRoot}\harness-installers\copilot-vscode-plugin\dogfood-marketplace"
$pluginDest = "$mkt\plugins\rad-orc-vscode"
if (Test-Path $pluginDest) { Remove-Item -Recurse -Force $pluginDest }
New-Item -ItemType Directory -Force -Path (Split-Path $pluginDest) | Out-Null
Copy-Item -Recurse -Force "{repoRoot}\harness-installers\copilot-vscode-plugin\output" $pluginDest
```

Confirm `$pluginDest\.claude-plugin\plugin.json` exists after the copy (the plugin ships in Claude-format manifest layout — see step 4).

**(b)** Write this exact JSON to `{repoRoot}/harness-installers/copilot-vscode-plugin/dogfood-marketplace/.github/plugin/marketplace.json` (create the nested `.github/plugin/` directory first):

```json
{
  "name": "rad-orc-vscode-dogfood",
  "owner": { "name": "metalhexx" },
  "description": "Ephemeral local dogfood marketplace for the greenfield rad-orchestration Copilot VS Code plugin build. Generated by rad-test-copilot-vscode-plugin skill; do not publish.",
  "plugins": [
    {
      "name": "rad-orc-vscode",
      "source": "./plugins/rad-orc-vscode",
      "description": "Rad Orc multi-agent orchestration system for Copilot in VS Code (dogfood build).",
      "strict": true
    }
  ]
}
```

After writing, parse the file back as JSON to confirm it is syntactically valid.

### 6. Print install instructions for the user

Use `AskUserQuestion` to ask which of the three viable install methods the user wants to use, so they can pick the one that fits their workflow. Surface all three options explicitly:

- **Question:** "The VS Code Copilot dogfood marketplace is staged. Plugin version: `{version}`. Which install method do you want to use? Option A (`chat.pluginLocations`) is the lowest-friction dev loop — it points VS Code at the plugin directory without going through a marketplace at all. Option B (`chat.plugins.marketplaces` with a `file:///` URI) registers the dogfood marketplace permanently so the plugin appears in VS Code's plugin marketplace UI for normal install/uninstall — the closest dogfood path to the published-marketplace user experience. Option C (`Chat: Install Plugin From Source`) is a one-shot install via the Command Palette."
- **Options:**
  - **Option A — `chat.pluginLocations` (lowest-friction dev loop)** — "Open your VS Code user settings JSON (Ctrl+Shift+P → 'Open User Settings JSON') and add the `chat.pluginLocations` entry. VS Code picks up the plugin in place without a marketplace round-trip."
  - **Option B — `chat.plugins.marketplaces` with `file:///` URI (plugin shows up in VS Code's marketplace UI)** — "Open your VS Code user settings JSON and add a `file:///` entry to the `chat.plugins.marketplaces` array pointing at the dogfood marketplace folder. The plugin then appears alongside the official `github/copilot-plugins` and `github/awesome-copilot` catalogs, installable and uninstallable from the Chat → Plugins UI like a published plugin."
  - **Option C — `Chat: Install Plugin From Source`** — "Open the Command Palette in VS Code (Ctrl+Shift+P) and run `Chat: Install Plugin From Source`, then paste the dogfood marketplace directory path when prompted."

After the user picks, print the corresponding instructions substituting `{repoRoot}` and `{version}` with the values you captured. Use backslash-separated Windows paths.

**If Option A** — print:

> The VS Code Copilot dogfood marketplace is staged. Plugin version: **`{version}`**.
>
> **Before installing**, note: if the standard installer's `copilot-vscode` target is already active, or if Copilot CLI has a plugin installed at `~/.copilot/installed-plugins/` that VS Code auto-discovers, the plugin's `UserPromptSubmit` bootstrap hook will surface a three-partner coexistence warning on first use — this is expected behavior (FR-21), not an error. You do not need to remove prior installs to proceed.
>
> Open your VS Code **user settings JSON** (Ctrl+Shift+P → "Open User Settings JSON") and add:
>
> ```json
> "chat.pluginLocations": {
>   "{repoRoot}\\harness-installers\\copilot-vscode-plugin\\dogfood-marketplace\\plugins\\rad-orc-vscode": true
> }
> ```
>
> Save the file. VS Code will load the plugin from the local path on the next chat session start — no restart required in most cases, but restart VS Code if the plugin does not appear under Chat → Plugins.
>
> The `UserPromptSubmit` hook will auto-bootstrap `~/.radorch/` on your first prompt in the new session. `SessionStart`'s drift-check stays silent on a clean install (per FR-5, FR-6).
>
> Come back here when you're done dogfooding — I'll offer cleanup.

**If Option B** — print:

> The VS Code Copilot dogfood marketplace is staged. Plugin version: **`{version}`**.
>
> **Before installing**, note: if the standard installer's `copilot-vscode` target is already active, or if Copilot CLI has a plugin installed at `~/.copilot/installed-plugins/` that VS Code auto-discovers, the plugin's `UserPromptSubmit` bootstrap hook will surface a three-partner coexistence warning on first use — this is expected behavior (FR-21), not an error. You do not need to remove prior installs to proceed.
>
> Open your VS Code **user settings JSON** (Ctrl+Shift+P → "Open User Settings JSON") and add a `file:///` entry to the `chat.plugins.marketplaces` array, alongside the two defaults:
>
> ```json
> "chat.plugins.marketplaces": [
>   "github/copilot-plugins",
>   "github/awesome-copilot",
>   "file:///{repoRoot-with-forward-slashes}/harness-installers/copilot-vscode-plugin/dogfood-marketplace/"
> ]
> ```
>
> Convert `{repoRoot}` to forward slashes for the URI (e.g. `file:///C:/dev/.../dogfood-marketplace/`). The trailing slash on the directory path is required. Save the file.
>
> Open VS Code's **Chat: Plugins** panel (or the Extensions view with the `@agentPlugins` filter). The `rad-orc-vscode` plugin from the `rad-orc-vscode-dogfood` marketplace should now appear alongside the published catalogs. Click install. Reload VS Code if prompted.
>
> The `UserPromptSubmit` hook will auto-bootstrap `~/.radorch/` on your first prompt in the new session. `SessionStart`'s drift-check stays silent on a clean install (per FR-5, FR-6).
>
> Come back here when you're done dogfooding — I'll offer cleanup. (To uninstall, remove via the Chat → Plugins UI AND remove the `file:///` entry from `chat.plugins.marketplaces` so the catalog stops appearing on next launch.)

**If Option C** — print:

> The VS Code Copilot dogfood marketplace is staged. Plugin version: **`{version}`**.
>
> **Before installing**, note: if the standard installer's `copilot-vscode` target is already active, or if Copilot CLI has a plugin installed at `~/.copilot/installed-plugins/` that VS Code auto-discovers, the plugin's `UserPromptSubmit` bootstrap hook will surface a three-partner coexistence warning on first use — this is expected behavior (FR-21), not an error. You do not need to remove prior installs to proceed.
>
> Open a **fresh VS Code session** and run from the Command Palette (Ctrl+Shift+P):
>
> ```
> Chat: Install Plugin From Source
> ```
>
> When prompted for a path, paste:
>
> ```
> {repoRoot}\harness-installers\copilot-vscode-plugin\dogfood-marketplace
> ```
>
> VS Code will read the `.github/plugin/marketplace.json` catalog, find `rad-orc-vscode`, and install it. Reload VS Code if prompted.
>
> The `UserPromptSubmit` hook will auto-bootstrap `~/.radorch/` on your first prompt in the new session. `SessionStart`'s drift-check stays silent on a clean install (per FR-5, FR-6).
>
> Come back here when you're done dogfooding — I'll offer cleanup.

### 7. Wait for the user, then offer cleanup

After printing the instructions, your next turn waits for the user to say they're done. When they return, call `AskUserQuestion` to offer cleanup. Surface both options explicitly — do not rely on an auto-injected "Other":

- **Question:** "Done dogfooding the greenfield Copilot VS Code plugin? You can remove the staged dogfood marketplace, or leave it in place for another round of testing."
- **Options:**
  - **Yes, clean up** — "Remove `{repoRoot}\harness-installers\copilot-vscode-plugin\dogfood-marketplace` (deletes both the marketplace.json and the plugin copy at `plugins/rad-orc-vscode/`). The canonical build output at `output/` is left untouched. Next run of this skill regenerates the marketplace and the plugin copy from `output/`."
  - **Leave it for another round** — "Keep the dogfood-marketplace dir so you can iterate. Re-running this skill after a rebuild refreshes the plugin copy. Print the cleanup command for later."

If the user picks **Yes, clean up**:

```powershell
Remove-Item -Recurse -Force {repoRoot}\harness-installers\copilot-vscode-plugin\dogfood-marketplace
```

Run it. Confirm the directory is gone. Print "Cleaned up the dogfood marketplace (marketplace.json + the plugin copy at `plugins/rad-orc-vscode/`). The greenfield plugin output at `harness-installers/copilot-vscode-plugin/output/` is untouched (rebuild via `node harness-installers/copilot-vscode-plugin/build-scripts/build.js` if needed). Re-run this skill to regenerate the dogfood marketplace."

If the user picks **Leave it for another round**:

Print the cleanup command above so they can run it later. Also remind them to remove the plugin from VS Code before switching channels:
- If they used **Option A** (`chat.pluginLocations`): remove the entry from user settings JSON.
- If they used **Option B** (`chat.plugins.marketplaces` `file:///` URI): uninstall the plugin via Chat → Plugins UI AND remove the `file:///` entry from the `chat.plugins.marketplaces` array in user settings JSON so the catalog stops appearing on next launch.
- If they used **Option C** (`Chat: Install Plugin From Source`): uninstall via the Chat → Plugins panel in VS Code.

That ends the skill. Do not run tests, npm pack, or any other E2E validation — those belong in CI or a separate workflow.
