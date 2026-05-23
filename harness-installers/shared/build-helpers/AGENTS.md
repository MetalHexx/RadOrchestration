# build-helpers/

## Purpose

Five mechanical helpers that installer build scripts use to emit bundles and run transforms. Published as `@rad-orchestration/build-helpers` (private). Every installer-specific value flows in as a parameter; no file here hard-codes installer names, destination paths, or token maps.

## Helpers

**`expandTokens(opts)` — `expand-tokens.js`**

`opts: { source: string, target: string, tokenMap: Record<string,string>, agentNames?: string[] }`

Walks `source` recursively. Text files (extensions in `TEXT_EXTS`: `.md .txt .js .mjs .cjs .ts .tsx .json .yml .yaml .sh .css .html`) get token substitution via `substituteTokens` and optional agent namespacing via `applyNamespacing`; binary files are copied verbatim. `agentNames` drives the namespacing rewrite that prefixes bare agent names with `rad-orc:` in dispatch contexts (`**<name>**`, `<name> agent(s)`, `<name> spawn(s)`, `subagent_type: <name>`, and comma-separated lists). For back-compat the rewrite also normalizes already-prefixed `rad-orchestration:<name>` occurrences to `rad-orc:<name>`. The `TEXT_EXTS` set mirrors the list in `harness-adapters/engine/index.js` — keep the two in sync.

**`emitCliBundle(opts)` — `emit-cli-bundle.js`**

`opts: { source: string, target: string, entryPoint?: string, mode?: number }`

Bundles `entryPoint` (default `${source}/src/bin/radorch.ts`) to a single ESM file at `target` using esbuild (`platform: node`, `format: esm`, `target: node20`). Creates parent directories of `target`. Applies `mode` (default `0o755`) via `fs.chmodSync`; chmod is silently a no-op on Windows.

**`emitPipelineBundle(opts)` — `emit-pipeline-bundle.js`**

`opts: { source: string, target: string }`

Bundles the entry listed in `RUNTIME_ENTRIES` (`['pipeline']`) from `source` to `target/${entryName}.js` via esbuild. The array shape is preserved so future iterations can re-extend it without a structural revert. Adds a `#!/usr/bin/env node` banner and applies `0o755` chmod on each output file.

**`emitUiBundle(opts)` — `emit-ui-bundle.js`**

`opts: { source: string, target: string, runner?: () => Promise<void> }`

Invokes `runner` (default: `npm run build-standalone` inside `source`) to produce a Next.js standalone build, then copies `source/.next/standalone`, `source/.next/static`, and `source/public` to `target`. Removes `source/.next/` after copying. Tests inject a no-op `runner` via `opts.runner` to skip the actual build.

**`emitHookBundle(opts)` — `emit-hook-bundle.js`**

`opts: { source: string, target: string, libRoot?: string }`

Bundles `${source}/bootstrap.mjs` (with `lib/install/*` inlined by esbuild) to `${target}/bootstrap.mjs`. Copies `drift-check.mjs`, `hooks.json`, and `AGENTS.md` from `source` to `target` verbatim if they exist. `libRoot` defaults to `${source}/../lib` and is the esbuild module resolution root for the inlined dependencies.

## Installer-blindness contract

No function in this folder may reference:
- Installer package names (`claude-plugin`, `standard`, etc.)
- Destination paths (`~/.radorch/`, `${CLAUDE_PLUGIN_ROOT}`, etc.)
- Specific token keys or agent names

All such values are supplied by the caller.

## Coding conventions

- Every exported function accepts a single `opts` object.
- All I/O is scoped to the `source` and `target` paths passed in; no writes outside those trees.
- esbuild failures propagate as thrown errors; callers (build scripts) catch them through the `step()` wrapper.
- No global state; no module-level side effects.

## Rules for making updates

- Changing `TEXT_EXTS` in `expand-tokens.js` requires the same change in `harness-adapters/engine/index.js` to keep token-processing scope in sync.
- Adding a new entry to `RUNTIME_ENTRIES` in `emit-pipeline-bundle.js` causes both an additional bundle to be emitted and an additional artifact to validate in `claude-plugin/build-scripts/validate.js`; update both together.
- `emitHookBundle`'s verbatim-copy list (`['drift-check.mjs', 'hooks.json', 'AGENTS.md']`) must match what `hooks/` actually ships; update here when adding new verbatim hook files.
- Tests in `__tests__/` cover each helper; run them after any signature or behavior change.
