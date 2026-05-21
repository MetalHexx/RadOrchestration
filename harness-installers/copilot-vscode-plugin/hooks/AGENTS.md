# hooks/

## Purpose

Two hooks that ship inside the Copilot in VS Code plugin payload and manage install lifecycle and drift detection. They bridge VS Code Copilot's hook system and the install state machine in `lib/install/`.

## How it works

**`bootstrap.mjs` — `UserPromptSubmit` hook**

Runs once on the user's first prompt after plugin installation. Calls `runInstall({ pluginRoot, radHome })` from `lib/install/run-install.js`. On success, writes a marker file at `~/.radorch/.copilot-vscode-plugin-bootstrap.json` so the hook skips all subsequent runs (marker-file idempotency). On failure, writes an error marker (`status: "error"`) so the next prompt invocation reads the marker, sees `status !== "success"`, and falls through to a retry. The marker is the last write in both paths, so its state always reflects the most recent outcome.

Idempotency uses a marker file rather than rewriting `hooks.json` in place — VS Code reads `hooks.json` from a disk cache at session start and does not re-read it mid-session, making mid-session `hooks.json` rewrites unsafe. The marker approach matches the platform's cache-and-read semantics.

Path-resolution: `bootstrap.mjs` derives the plugin root from its own `import.meta.url` and publishes `COPILOT_VSCODE_PLUGIN_ROOT` to the process environment before calling downstream modules. `RAD_HOME` is optional (tests override it; production falls back to `~/.radorch`).

**`drift-check.mjs` — `SessionStart` hook**

Persistent — never self-uninstalls. Reads `plugin.json` at the plugin root for `pkg.version` (the delivering version) and `${RAD_HOME}/install.json` for the installed version, found at `installed.harnesses['copilot-vscode-plugin'].version`. Writes a single line to stdout when the two differ; VS Code injects that line as conversation context. Also surfaces a stale bootstrap-error marker on its own line. Silent on match or when either version is unavailable. Must remain dependency-free.

Derives the plugin root from its own `import.meta.url` and publishes `COPILOT_VSCODE_PLUGIN_ROOT` in the same way as `bootstrap.mjs`.

**`hooks.json`**

Registers both hooks with VS Code's hook system. Event names are **PascalCase** (`UserPromptSubmit`, `SessionStart`) — VS Code's native form. This is the explicit casing contrast with the CLI plugin's camelCase `userPromptSubmitted` / `sessionStart`.

Each entry's command string is an **inline `node -e` shim** that probes the plugin root via two mechanisms in priority order:

1. **VS Code command-string template substitution.** The shim embeds `${CLAUDE_PLUGIN_ROOT}`, `${COPILOT_PLUGIN_ROOT}`, `${COPILOT_VSCODE_PLUGIN_ROOT}`, and `${PLUGIN_ROOT}` as JavaScript string literals. If VS Code's substitution engine fires for Copilot-format plugin command strings (documented for Claude/OpenPlugin format, undocumented but possible for Copilot format), the literals are replaced with absolute paths before Node parses the command. Un-substituted entries survive as text starting with `${` and are filtered out.

2. **Plugin-root environment variables.** Falls back to `process.env.COPILOT_PLUGIN_ROOT` → `COPILOT_VSCODE_PLUGIN_ROOT` → `CLAUDE_PLUGIN_ROOT` → `PLUGIN_ROOT`. Empirically confirmed (as of the iteration that introduced this shim) that VS Code does NOT inject any of these for Copilot-format plugins, but kept as a defensive fallback in case the behavior changes.

The first non-empty, non-literal value wins. On success the shim logs `[rad-orc-vscode] resolved plugin root via <token|env> <NAME> -> <path>` to stderr so future iterations can see which mechanism resolved. On failure (neither mechanism produced a usable path) it dumps the full token-state JSON + the env-key filter + `process.cwd()` and exits with code 2 — actionable empirical data instead of an opaque `MODULE_NOT_FOUND`.

The resolved path is normalized for Cygwin-style `/c/...` on Windows, then the shim dynamic-`import()`s the absolute file URL of the target `.mjs`. The shim is the single path-resolution point; downstream `bootstrap.mjs` / `drift-check.mjs` derive the plugin root independently via `import.meta.url` and publish `COPILOT_VSCODE_PLUGIN_ROOT`.

Inline shims are used rather than a `launcher.cjs` dispatcher because the dispatcher itself would have to be self-locatable — and a relative `node hooks/launcher.cjs ...` resolves against `process.cwd()` (the workspace folder, not the plugin root), so the launcher can't be loaded before its own path-resolution logic runs. The inline shim sidesteps this chicken-and-egg by carrying its own env-var lookup directly on the command line.

## Build treatment

- `bootstrap.mjs` is bundled by `emitHookBundle`: esbuild inlines `lib/install/*` dependencies, producing a single self-contained file. It is never shipped as separate source modules.
- `drift-check.mjs`, `hooks.json`, and this `AGENTS.md` are copied verbatim by `emitHookBundle`.

## Coding conventions

- `bootstrap.mjs` uses a top-level `async main()` with `process.exit(await main())` so the hook exits with the correct code.
- The marker-file write uses write-to-tmp then `fs.renameSync` (same pattern as `lib/install/`).
- `drift-check.mjs` is synchronous and has no external dependencies — it must stay that way so it ships verbatim without bundling.
- The inline shim in `hooks.json` carries no backslash literals — per the JSON-embedded `node -e` quoting rules, those would have to be double-escaped and have burned us before. Keep the shim using forward slashes and `path.platform`-aware string concatenation only.
- Scripts resolve their plugin root via `import.meta.url`; they never rely on a CWD-relative path.

## Rules for making updates

- If `bootstrap.mjs` gains new `lib/install/` imports, `emit-hook-bundle` in `build-scripts/build.js` handles them automatically via esbuild — no build-script change needed.
- Changes to `hooks.json` hook names or event types must match VS Code Copilot's hook system contract. Event names are **PascalCase** — do not silently downcase them to match the CLI plugin.
- `drift-check.mjs` must remain dependency-free (Node built-ins only) so it can ship verbatim.
- The marker file path (`~/.radorch/.copilot-vscode-plugin-bootstrap.json`) is part of the install contract — do not rename it without updating `lib/install/user-data-paths.js` and any migration logic in `lib/install/`.

## Seam to lib/install/

`bootstrap.mjs` imports modules from `lib/install/` at source time; esbuild inlines them into the bundled artifact at build time. `lib/install/` is the only folder this hook directory imports from.
