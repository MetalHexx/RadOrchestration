# build-scripts/

## Purpose

Build orchestration for the Copilot CLI plugin. `build.js` is the single entry point; all other files here support it or serve as operator tools.

## How it works

**`build.js` — `runBuild(opts)`**

Exports `runBuild(opts)` and executes the following fixed step sequence, fail-fast via a local `step(name, fn)` wrapper that times and labels each phase. Step stderr messages carry the `[build:copilot-cli-plugin]` prefix.

1. **bootstrap-deps** — idempotent `npm install` for sub-packages that the build depends on (`shared/build-helpers`, `harness-adapters/engine`, `cli/`, `ui/`). Skips when `node_modules` already exists or `package.json` is absent. Skippable via `opts.skipBootstrap`.
2. **adapter-engine** — runs `harness-adapters/engine/build.js --harness=copilot-cli`. Skippable via `opts.skipAdapterEngine`.
3. **clean-output** — wipes `output/`.
4. **copy-agents** — copies adapter output from `harness-adapters/output/copilot-cli/agents/`; agent files carry the `.agent.md` suffix.
5. **copy-skills** — copies adapter output from `harness-adapters/output/copilot-cli/skills/`.
6. **copy-runtime-config** — copies `runtime-config/orchestration.yml` and `runtime-config/templates/` verbatim.
7. **emit-cli-bundle** — bundles `cli/` via `emitCliBundle`.
8. **emit-pipeline-bundle** — bundles the pipeline runtime TS via `emitPipelineBundle`.
9. **prune-scripts-sources** — removes `.ts` sources, tests, and tooling from `output/skills/rad-orchestration/scripts/`; retains only `.js`, `.mjs`, and `.gitignore`.
10. **emit-ui-bundle** — builds Next.js standalone via `emitUiBundle`.
11. **emit-hook-bundle** — bundles `hooks/bootstrap.mjs` (with `lib/install/*` inlined) and copies verbatim files via `emitHookBundle`.
12. **expand-tokens** — substitutes `${SKILLS_ROOT}` and `${PLUGIN_ROOT}` tokens in `agents/` and `skills/`. Agent namespacing (`rad-orchestration:<name>`) is a no-op for Copilot CLI — `agentNames` is not passed, so `expandTokens` performs token substitution only.
13. **copy-plugin-manifest** — copies `plugin.json` from the package root to `output/plugin.json` (not under `output/.claude-plugin/` as in the claude-plugin).
14. **synthesize-package-json** — merges wrapper `package.json` with `plugin.json`; `plugin.json.version` always wins; writes `output/package.json`. Hard-codes `name: '@rad-orchestration/copilot-cli-plugin'`.
15. **copy-manifest-catalog** — copies `manifests/v*.json` to `output/manifests/`.
16. **validate** — calls `validatePluginTree` to confirm required artifacts, agent presence, version manifest, and size budget.

**`validate.js` — `validatePluginTree(opts)`**

Four gates:
- **Gate 1** — required artifacts present (includes `plugin.json` at the output root, not under `.claude-plugin/`).
- **Gate 2** — every canonical agent appears at `output/agents/<name>.agent.md`.
- **Gate 3** — per-version manifest present (`manifests/v${version}.json`).
- **Gate 4** — tarball size within budget.

Gate 3 of the claude-plugin (namespaced-token check) is intentionally absent — no agent namespacing is applied for Copilot CLI.

**`synthesize-package-json.js`**

Hard-codes `name: '@rad-orchestration/copilot-cli-plugin'`. Merges wrapper `package.json` with `plugin.json`; `plugin.json.version` always wins.

**`parity-check.js`**

Operator-only content-equivalence check: diffs the copilot-cli-plugin `output/` against the claude-plugin `output/` modulo a known-difference allowlist (filename suffix, plugin manifest path, namespacing tokens). NOT wired into CI — run ad-hoc during migration validation or when suspecting divergence.

## Coding conventions

- Every step runs through the local `step(name, fn)` wrapper: timed, labeled with `[build:copilot-cli-plugin]`, fail-fast on throw.
- Paths are always resolved via `path.resolve` / `path.join` from `rootDir`; no hardcoded absolute paths.
- `output/` is wiped at the start of every build; the output tree is never partially updated.

## Rules for making updates

- Step order is load-bearing: adapter output must exist before `copy-agents`/`copy-skills`; bundles before `expand-tokens`; `validate` last.
- `REQUIRED_ARTIFACTS` in `validate.js` must stay in sync with build output. Gate 3 (namespaced tokens) must not be added — Copilot CLI has no agent namespacing.
- Adding a new step: place it in the correct sequence, update the step-count comment, and update `validate.js` if a new required artifact is introduced.
- `parity-check.js` is an operator tool; do not wire it into CI or import it from `build.js`.
- Tests in `tests/` cover the build orchestration end-to-end; run them after any build-script change.
