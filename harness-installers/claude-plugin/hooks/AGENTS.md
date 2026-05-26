# hooks/

## Purpose

Two hooks that ship inside the Claude plugin payload and manage install lifecycle and drift detection. They are the bridge between Claude's hook system and the install state machine in `lib/install/`.

## How it works

**`bootstrap.mjs` — `UserPromptSubmit` hook**

Runs once on the user's first prompt after plugin installation. Calls `runInstall({ pluginRoot, radHome })` from `lib/install/run-install.js`. On success, calls `selfUninstall(pluginRoot)`: reads `hooks/hooks.json`, deletes the `UserPromptSubmit` entry, and atomically renames a `.tmp` file into place so the hook never fires again. On failure, leaves `hooks.json` intact so the user can retry. Reads `CLAUDE_PLUGIN_ROOT` from the environment; `RAD_HOME` is optional (tests override it; production falls back to `~/.radorc`).

`selfUninstall` refuses to mutate `hooks.json` unless `pluginRoot` is under `~/.claude/plugins/cache/` — the directory Claude Code owns and re-copies on `/plugin update`. This protects `"source": "directory"` dogfood marketplaces from accidental clobber if `bootstrap.mjs` ever runs with `CLAUDE_PLUGIN_ROOT` pointed at the marketplace tree (manual `node bootstrap.mjs`, stray test fixture, prior dogfood session quirk). Tests that intentionally run against `os.tmpdir()` fixtures override the guard via `RAD_BOOTSTRAP_SELFUNINSTALL_ALLOW_NONCACHE=1`.

**`drift-check.mjs` — `SessionStart` hook**

Persistent — never self-uninstalls. Reads `${CLAUDE_PLUGIN_ROOT}/package.json` for `pkg.version` (the delivering version) and `${RAD_HOME}/install.json` for the installed version, found at `installed.harnesses['claude-plugin'].version` or the legacy `installed.package_version` field. Writes a single line to stdout when the two differ; Claude injects that line as conversation context. Silent on match or when either version is unavailable.

**`hooks.json`**

Registers both hooks with Claude's hook system. Each command is an inline `node -e "..."` shim that reads `process.env.CLAUDE_PLUGIN_ROOT`, normalizes a leading `/<drive>/...` form into `<DRIVE>:/...` (Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` Unix-style on Windows; native Node can't load `/c/foo/bar.mjs`), writes the normalized value back to the env, then dynamic-imports `${pluginRoot}/hooks/bootstrap.mjs` (UserPromptSubmit) or `${pluginRoot}/hooks/drift-check.mjs` (SessionStart) via `pathToFileURL`. The shim contains no backslash literals — every cross-shell escaping level (JSON decode, bash double-quote, `cmd /d /s /c`) tends to collapse them differently, and forward slashes work everywhere Node accepts paths.

`tests/hooks-shim.test.mjs` is the regression guard. It pins the shim shape (no backslash literals, both targets correct) and spawns the live command string through both `bash -c` and the OS-default shell against a fixture plugin root — catches shell-quoting regressions without requiring a plugin reinstall.

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
- Changes to `hooks.json` hook names or event types must match Claude's hook system contract; test with `tests/bootstrap.test.mjs` and `tests/drift-check.test.mjs`. Changes to the inline shim itself must keep `tests/hooks-shim.test.mjs` green — that suite runs the live command string through `bash -c` and the OS-default shell, which is what catches shell-quoting regressions before they ship.
- `drift-check.mjs` must remain dependency-free (Node built-ins only) so it can ship verbatim.
- Do not add synchronous file operations in `bootstrap.mjs` outside of `selfUninstall`; the install itself is async via `runInstall`.
