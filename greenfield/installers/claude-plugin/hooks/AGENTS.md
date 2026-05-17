# hooks/

## Purpose

Two hooks that ship inside the Claude plugin payload and manage install lifecycle and drift detection. They are the bridge between Claude's hook system and the install state machine in `lib/install/`.

## How it works

**`bootstrap.mjs` — `UserPromptSubmit` hook**

Runs once on the user's first prompt after plugin installation. Calls `runInstall({ pluginRoot, radHome })` from `lib/install/run-install.js`. On success, calls `selfUninstall(pluginRoot)`: reads `hooks/hooks.json`, deletes the `UserPromptSubmit` entry, and atomically renames a `.tmp` file into place so the hook never fires again. On failure, leaves `hooks.json` intact so the user can retry. Reads `CLAUDE_PLUGIN_ROOT` from the environment; `RAD_HOME` is optional (tests override it; production falls back to `~/.radorch`).

**`drift-check.mjs` — `SessionStart` hook**

Persistent — never self-uninstalls. Reads `${CLAUDE_PLUGIN_ROOT}/package.json` for `pkg.version` (the delivering version) and `${RAD_HOME}/install.json` for the installed version, found at `installed.harnesses['claude-plugin'].version` or the legacy `installed.package_version` field. Writes a single line to stdout when the two differ; Claude injects that line as conversation context. Silent on match or when either version is unavailable.

**`hooks.json`**

Registers both hooks with Claude's hook system. `UserPromptSubmit` runs `node ${CLAUDE_PLUGIN_ROOT}/hooks/bootstrap.mjs`; `SessionStart` runs `node ${CLAUDE_PLUGIN_ROOT}/hooks/drift-check.mjs`.

## Build treatment

- `bootstrap.mjs` is bundled by `emitHookBundle`: esbuild inlines `lib/install/*` dependencies, producing a single self-contained file. It is never shipped as separate source modules.
- `drift-check.mjs`, `hooks.json`, and this `AGENTS.md` are copied verbatim by `emitHookBundle`.

## Coding conventions

- `bootstrap.mjs` uses a top-level `async main()` with `process.exit(await main())` so the hook exits with the correct code.
- The atomic rename for `selfUninstall` follows the same write-then-rename pattern used throughout `lib/install/`: write to a `.tmp-<pid>-<timestamp>` file, then `fs.renameSync`.
- `drift-check.mjs` is synchronous and has no external dependencies — it must stay that way so it ships verbatim without bundling.
- Both hooks read env vars (`CLAUDE_PLUGIN_ROOT`, `RAD_HOME`) only; they never read from relative paths that would vary by working directory.

## Rules for making updates

- If `bootstrap.mjs` gains new `lib/install/` imports, the build step `emit-hook-bundle` in `build-scripts/build.js` handles them automatically via esbuild bundling — no build-script change needed.
- Changes to `hooks.json` hook names or event types must match Claude's hook system contract; test with `tests/bootstrap.test.mjs` and `tests/drift-check.test.mjs`.
- `drift-check.mjs` must remain dependency-free (Node built-ins only) so it can ship verbatim.
- Do not add synchronous file operations in `bootstrap.mjs` outside of `selfUninstall`; the install itself is async via `runInstall`.
