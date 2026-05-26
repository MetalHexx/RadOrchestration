# hooks/

## Purpose

Two hooks that ship inside the Copilot CLI plugin payload and manage install lifecycle and drift detection. They bridge Copilot CLI's hook system and the install state machine in `lib/install/`.

## How it works

**`bootstrap.mjs` — `userPromptSubmitted` hook**

Runs once on the user's first prompt after plugin installation. Calls `runInstall({ pluginRoot, radHome })` from `lib/install/run-install.js`. On success, writes a marker file at `~/.radorc/.copilot-cli-plugin-bootstrap.json` so the hook skips all subsequent runs (marker-file idempotency). On failure, writes an error marker (`status: "error"`) with the delivering version (per DD-14) so the next bootstrap invocation reads the marker, sees `status !== "success"`, and falls through to a retry (per DD-16). The marker is the last write in both success and failure paths, so its state always reflects the most recent outcome.

Idempotency uses a marker file rather than rewriting `hooks.json` in place — Copilot CLI reads `hooks.json` from a disk cache at session start and does not re-read it mid-session, making mid-session `hooks.json` rewrites unsafe. The marker approach matches the platform's cache-and-read semantics.

Path-resolution uses `import.meta.url` (no `COPILOT_CLI_PLUGIN_ROOT` env var injected by the platform — scripts self-resolve). `RAD_HOME` is optional (tests override it; production falls back to `~/.radorc`).

**`drift-check.mjs` — `sessionStart` hook**

Persistent — never self-uninstalls. Reads `plugin.json` at the plugin root for `pkg.version` (the delivering version) and `${RAD_HOME}/install.json` for the installed version, found at `installed.harnesses['copilot-cli-plugin'].version`. Writes a single line to stdout when the two differ; Copilot CLI injects that line as conversation context. Silent on match or when either version is unavailable. Must remain dependency-free.

**`hooks.json`**

Registers both hooks with Copilot CLI's hook system. Event names are camelCase per the Copilot CLI contract (`userPromptSubmitted`, `sessionStart`). The `cwd: "."` anchor is set on each entry. Scripts self-resolve their own path via `import.meta.url` rather than relying on a platform-injected env var.

## Build treatment

- `bootstrap.mjs` is bundled by `emitHookBundle`: esbuild inlines `lib/install/*` dependencies, producing a single self-contained file. It is never shipped as separate source modules.
- `drift-check.mjs`, `hooks.json`, and this `AGENTS.md` are copied verbatim by `emitHookBundle`.

## Coding conventions

- `bootstrap.mjs` uses a top-level `async main()` with `process.exit(await main())` so the hook exits with the correct code.
- The marker-file write follows the same write-then-rename pattern used in `lib/install/`: write to a `.tmp-<pid>-<timestamp>` file, then `fs.renameSync`.
- `drift-check.mjs` is synchronous and has no external dependencies — it must stay that way so it ships verbatim without bundling.
- Both hooks resolve their plugin root via `import.meta.url`; they never rely on a CWD-relative path or a platform-injected env var for the root.

## Rules for making updates

- If `bootstrap.mjs` gains new `lib/install/` imports, `emit-hook-bundle` in `build-scripts/build.js` handles them automatically via esbuild bundling — no build-script change needed.
- Changes to `hooks.json` hook names or event types must match Copilot CLI's hook system contract. Event names are camelCase.
- `drift-check.mjs` must remain dependency-free (Node built-ins only) so it can ship verbatim.
- The marker file path (`~/.radorc/.copilot-cli-plugin-bootstrap.json`) is part of the install contract — do not rename it without updating `lib/install/run-install.js` and migration logic in `lib/install/install-json.js`.

## Seam to lib/install/

`bootstrap.mjs` imports modules from `lib/install/` at source time; esbuild inlines them into the bundled artifact at build time. `lib/install/` is the only consumer of this seam — no other folder imports from it at build time.
