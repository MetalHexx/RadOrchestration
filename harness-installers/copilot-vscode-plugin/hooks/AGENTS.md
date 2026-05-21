# hooks/

## Purpose

Two hooks that ship inside the Copilot in VS Code plugin payload and manage install lifecycle and drift detection. They bridge VS Code Copilot's hook system and the install state machine in `lib/install/`.

## How it works

**`bootstrap.mjs` — `UserPromptSubmit` hook**

Runs on the user's first prompt after plugin installation. Calls `runInstall({ pluginRoot, radHome })` from `lib/install/run-install.js`. **On success**, immediately calls `bakeAbsolutePaths(pluginRoot)` from `lib/install/bake-paths.js` to substitute the `${COPILOT_VSCODE_PLUGIN_ROOT}` token in every `skills/**/*.md` file with the real absolute install path (forward-slashed). Then atomically rewrites the plugin's own `hooks/hooks.json` (tmp + rename) to delete its `UserPromptSubmit` entry — so the hook never fires again until the next plugin upgrade ships a fresh `hooks.json` with `UserPromptSubmit` restored. `SessionStart` (drift-check) stays in place. **On failure** (either `runInstall` or `bakeAbsolutePaths` throws), `hooks.json` is left untouched and the bootstrap exits 1 (non-blocking for VS Code per NFR-12) — VS Code's normal hook dispatch fires bootstrap again on the next prompt, naturally retrying.

The bake step is VS Code-specific: VS Code injects the plugin-root env var only into hook processes (per the agent-plugins format-vs-token table), not into the agent's chat-shell where bash blocks from SKILL.md execute. The Claude and Copilot CLI siblings don't need a bake — their runtimes populate the env var in the chat-shell. See the root `AGENTS.md` "Why SKILL.md tokens are baked to absolute paths at install time" section for the full rationale.

Idempotency lives in `hooks.json` itself (no marker file). A best-effort `fs.unlinkSync` removes the legacy `~/.radorch/.copilot-vscode-plugin-bootstrap.json` marker file from the prior idempotency design so upgraded installs don't leave an orphan.

The prior design used a marker file with the rationale that "VS Code's cache-and-read semantics make mid-session hooks.json mutations unreliable." Empirical reality contradicted that: the Claude plugin sibling (which auto-loads in VS Code via cross-discovery) and the Copilot CLI sibling both rewrite hooks.json successfully. The self-uninstall pattern matches both siblings.

Path-resolution: `bootstrap.mjs` derives the plugin root from its own `import.meta.url` and publishes `COPILOT_VSCODE_PLUGIN_ROOT` to the process environment before calling downstream modules. `RAD_HOME` is optional (tests override it; production falls back to `~/.radorch`).

**`drift-check.mjs` — `SessionStart` hook**

Persistent — never self-uninstalls. Reads `package.json` at the plugin root for `pkg.version` (the delivering version, synthesized from `.claude-plugin/plugin.json` at build time) and `${RAD_HOME}/install.json` for the installed version, found at `installed.harnesses['copilot-vscode-plugin'].version`. Writes a single line to stdout when the two differ; VS Code injects that line as conversation context. Silent on match or when either version is unavailable. Must remain dependency-free.

Derives the plugin root from its own `import.meta.url` and publishes `COPILOT_VSCODE_PLUGIN_ROOT` in the same way as `bootstrap.mjs`.

**`hooks.json`**

Registers both hooks with VS Code's hook system. Event names are **PascalCase** (`UserPromptSubmit`, `SessionStart`) — VS Code's native form. This is the explicit casing contrast with the CLI plugin's camelCase `userPromptSubmitted` / `sessionStart`.

Each entry's command string is an **inline `node -e` shim** that reads `process.env.CLAUDE_PLUGIN_ROOT` — the env var VS Code injects when it detects the plugin as Claude format (via the `.claude-plugin/plugin.json` manifest layout). The shim normalizes Cygwin-style `/c/...` paths on Windows, then dynamic-`import()`s the absolute file URL of the target `.mjs`.

The plugin ships in Claude-format layout precisely so this works: the VS Code agent-plugins docs format-vs-token table marks Copilot format's plugin-root token as **(Not defined)** — Copilot-format plugins have no documented mechanism for hooks to self-locate. Claude format gets `${CLAUDE_PLUGIN_ROOT}` token substitution AND `CLAUDE_PLUGIN_ROOT` env-var injection on every supported OS, so the env-var path is cross-platform.

If `CLAUDE_PLUGIN_ROOT` is empty, the shim emits a stderr diagnostic listing every `process.env` key matching `/PLUGIN|COPILOT|CLAUDE|VSCODE/i` and exits with code 2. That should never fire under normal operation (VS Code 1.110+ injecting CLAUDE_PLUGIN_ROOT for Claude format is GA-stable); if it does, the plugin is being detected as a different format and the manifest layout needs investigation.

The shim is the single path-resolution point; downstream `bootstrap.mjs` / `drift-check.mjs` derive the plugin root independently via `import.meta.url` and publish `COPILOT_VSCODE_PLUGIN_ROOT`. No `${…}` patterns in the JSON-embedded command string — those interact badly with PowerShell on Windows (it interprets `${VAR}` as PowerShell variable expansion and crashes the parser on the inner JS braces). Env-var-only is the safe shape.

Inline shims are used rather than a `launcher.cjs` dispatcher because the dispatcher itself would have to be self-locatable — and a relative `node hooks/launcher.cjs ...` resolves against `process.cwd()` (the workspace folder, not the plugin root), so the launcher can't be loaded before its own path-resolution logic runs. The inline shim sidesteps this chicken-and-egg by carrying its own env-var lookup directly on the command line.

## Build treatment

- `bootstrap.mjs` is bundled by `emitHookBundle`: esbuild inlines `lib/install/*` dependencies, producing a single self-contained file. It is never shipped as separate source modules.
- `drift-check.mjs`, `hooks.json`, and this `AGENTS.md` are copied verbatim by `emitHookBundle`.

## Coding conventions

- `bootstrap.mjs` uses a top-level `async main()` with `process.exit(await main())` so the hook exits with the correct code.
- The self-uninstall `hooks.json` rewrite uses write-to-tmp then `fs.renameSync` (atomic; same pattern `lib/install/` uses for state files).
- `drift-check.mjs` is synchronous and has no external dependencies — it must stay that way so it ships verbatim without bundling.
- The inline shim in `hooks.json` carries no backslash literals — per the JSON-embedded `node -e` quoting rules, those would have to be double-escaped and have burned us before. Keep the shim using forward slashes and `path.platform`-aware string concatenation only.
- Scripts resolve their plugin root via `import.meta.url`; they never rely on a CWD-relative path.

## Rules for making updates

- If `bootstrap.mjs` gains new `lib/install/` imports, `emit-hook-bundle` in `build-scripts/build.js` handles them automatically via esbuild — no build-script change needed.
- Changes to `hooks.json` hook names or event types must match VS Code Copilot's hook system contract. Event names are **PascalCase** — do not silently downcase them to match the CLI plugin.
- `drift-check.mjs` must remain dependency-free (Node built-ins only) so it can ship verbatim.
- `selfUninstall` in `bootstrap.mjs` deletes the `UserPromptSubmit` key only; `SessionStart` must remain intact for the drift-check.

## Seam to lib/install/

`bootstrap.mjs` imports modules from `lib/install/` at source time; esbuild inlines them into the bundled artifact at build time. `lib/install/` is the only folder this hook directory imports from.
