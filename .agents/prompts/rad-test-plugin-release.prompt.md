---
description: "Test the rad-orchestration Claude plugin locally before publishing — builds the staged plugin tree, runs bundle-invariant tests, packs a tarball, installs into a clean Claude Code project, and verifies all artifacts and skills land."
---

# Rad Test Plugin Release

You are running a local end-to-end test of the `@rad-orchestration/claude-plugin` Claude marketplace plugin. Follow each step precisely — verify at each checkpoint.

This is the plugin-channel companion to `rad-test-release.prompt.md` (which covers the legacy `npx radorch` installer). The two prompts are independent — pick the one that matches the channel you want to validate.

---

## Step 1 — Build the staged plugin tree

```
cd c:\dev\src\RadOrchestration
npm run build:plugin
```

> Expected: build succeeds; `cli/dist/marketplaces/claude/plugins/rad-orchestration/` is fully populated; `validatePluginTree` (the final step inside `scripts/build-plugin.js`) reports no missing artifacts.

---

## Step 2 — Run bundle-invariant tests

```
node --test ^
  tests/scripts/plugin-only-skill-placement.test.mjs ^
  tests/scripts/bundle-completeness.test.mjs ^
  tests/scripts/manifest-coherence.test.mjs ^
  tests/scripts/plugin-tarball-size.test.mjs
```

> Expected: all four pass. If `plugin-only-skill-placement.test.mjs` fails, `rad-ui-*` skills have leaked into the legacy installer bundles. If `plugin-tarball-size.test.mjs` fails, dependency or asset growth pushed the plugin past the 50 MB + 10% budget.

---

## Step 3 — Pack the plugin tarball

```
cd cli\dist\marketplaces\claude\plugins\rad-orchestration
npm pack
```

Note the tarball filename — typically `rad-orchestration-claude-plugin-X.X.X.tgz`. Read the version stamped in `.claude-plugin/plugin.json` and confirm it matches `installer/package.json` (the source of truth for release version).

---

## Step 4 — Create ephemeral test project

```
mkdir c:\dev\src\RadOrchestration\test-plugin-installer
```

Drop a minimal `package.json` and `README.md` into it (same shape as `rad-test-release.prompt.md` Step 4). Do **not** pre-create `.claude/` or any orchestration folders — the plugin install creates everything it needs on its own.

---

## Step 5 — Install the plugin from the local staged tree

In Claude Code, with cwd = `c:\dev\src\RadOrchestration\test-plugin-installer`:

```
/plugin install c:\dev\src\RadOrchestration\cli\dist\marketplaces\claude\plugins\rad-orchestration
```

> Expected: install succeeds. Reload Claude Code. SessionStart hook fires on next session.

> If `/plugin install` from a local path is not supported by the current Claude Code version, fall back to: extract the tarball from Step 3 into a directory and point `/plugin install` at the extracted root.

---

## Step 6 — Verify plugin artifacts and functionality

Under `${CLAUDE_PLUGIN_ROOT}/rad-orchestration/`:

**Folder structure:**
- `agents/` — all canonical agents (orchestrator.md, brainstormer.md, planner.md, coder*, reviewer.md, source-control.md, etc.)
- `skills/` — all canonical skills **including** `rad-ui-start/`, `rad-ui-stop/`, `rad-ui-status/`
- `bin/radorch.mjs` — exists, executable
- `skills/rad-orchestration/scripts/pipeline.js` — exists, self-contained ESM bundle
- `ui/` — Next.js standalone build (server.js + .next/static)
- `hooks/hooks.json` — references `session-start.sh` and `session-start.ps1`
- `.claude-plugin/plugin.json` — version matches Step 3

**Functional checks:**
- `node ${CLAUDE_PLUGIN_ROOT}\rad-orchestration\skills\rad-orchestration\scripts\pipeline.js --help` prints usage with no missing-module errors.
- `node ${CLAUDE_PLUGIN_ROOT}\rad-orchestration\bin\radorch.mjs --help` prints usage.
- `~\.radorch\install.json` exists with `package_version` matching the plugin version (auto-bootstrapped by the SessionStart hook).
- `~/.radorch/bin/radorch.mjs` is a non-empty executable after SessionStart fires. Run `node ~/.radorch/bin/radorch.mjs --version` and confirm version matches Step 3.
- `~/.radorch/ui/` contains the Next.js standalone bundle (server.js or .next/static).

**Slash commands (in Claude Code):**
- `/rad-ui-start`, `/rad-ui-stop`, `/rad-ui-status` are visible.
- `/rad-ui-start` launches the dashboard. The plugin path injects `WORKSPACE_ROOT` and `ORCH_ROOT` as env vars at spawn time (via `cli/src/commands/ui/start.ts`) — it does **not** write a `.env.local`. This is intentional. The CLI returns a JSON envelope on stdout with `data.url`; open that URL in a browser and confirm the dashboard renders.

---

## Step 7 — Review and cleanup

Report:
- What passed
- What failed or was missing
- The version that was tested (from Step 3)

Then use the `vscode_askQuestions` tool to ask the user whether to clean up:

> "The plugin is installed in this Claude Code project and the test directory at `c:\dev\src\RadOrchestration\test-plugin-installer` is intact for inspection. Would you like to uninstall the plugin and remove the test directory + tarball?"

If **yes**:

```
/plugin uninstall rad-orchestration   # in Claude Code
Remove-Item -Recurse -Force c:\dev\src\RadOrchestration\test-plugin-installer
Remove-Item -Force c:\dev\src\RadOrchestration\cli\dist\marketplaces\claude\plugins\rad-orchestration\rad-orchestration-claude-plugin-*.tgz
```

If **no**: leave intact and note the locations.
