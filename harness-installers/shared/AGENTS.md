# shared/

## Purpose

Container for installer helpers that are reusable across every installer variant. Code here must not contain any installer-specific knowledge — names, paths, or config values that belong to a particular installer (`claude-plugin`, etc.) must not appear here.

## Contents

- `build-helpers/` — four mechanical helpers (`emitCliBundle`, `emitHookBundle`, `emitUiBundle`, `expandTokens`) that installer build scripts import directly via relative path.

No install-time (runtime) logic lives here. These are build-time tools only.

## Installer-blindness discipline

Every function in `shared/` accepts all installer-specific values as parameters. No function here references:
- Installer names (`claude-plugin`, `standard`, etc.)
- Hardcoded destination paths (`~/.radorc/`, `${CLAUDE_PLUGIN_ROOT}`, etc.)
- Hardcoded token maps or agent name lists

Current consumers are `harness-installers/claude-plugin/build-scripts/build.js` and `harness-installers/copilot-cli-plugin/build-scripts/build.js`. Each installer imports the same helpers with its own parameter set — the claude-plugin variant passes an `agentNames` list to enable agent-namespacing in `expandTokens`, the copilot-cli-plugin variant passes none so the namespacing pass is a no-op (per FR-3 / AD-10).

## Coding conventions

- All exports are named async functions accepting a single `opts` object.
- No global state; all inputs flow through function parameters.
- No side effects outside the `source`/`target` paths passed in.

## Rules for making updates

- New shared utilities belong here only if they are genuinely installer-agnostic. Anything that references a specific installer, harness, or destination path belongs in the installer package itself.
- Changing a helper's parameter shape is a breaking change for all callers. Locate every import before modifying a signature.
- Do not add `require`/`import` of installer-local files from within `shared/`; the dependency direction is installer → shared, never shared → installer.

## Further reading

- `build-helpers/AGENTS.md` — function signatures and per-helper contracts
