# build-scripts/

## Purpose

Build orchestration for the Copilot in VS Code plugin. `build.js` is the single entry point; all other files here support it.

## How it works

**`build.js` — `runBuild(opts)`**

Exports `runBuild(opts)` and executes the following fixed step sequence, fail-fast via a local `step(name, fn)` wrapper that times and labels each phase. Step stderr messages carry the `[build:copilot-vscode-plugin]` prefix.

1. **bootstrap-deps** — idempotent `npm install` for sub-packages that the build depends on (`shared/build-helpers`, `harness-adapters/engine`, `cli/`, `ui/`). Skips when `node_modules` already exists or `package.json` is absent. Skippable via `opts.skipBootstrap`.
2. **adapter-engine** — runs `harness-adapters/engine/build.js --harness=copilot-vscode`. Skippable via `opts.skipAdapterEngine`.
3. **clean-output** — wipes `output/`.
4. **copy-agents** — copies adapter output from `harness-adapters/output/copilot-vscode/agents/`; agent files carry the `.agent.md` suffix.
5. **copy-skills** — copies adapter output from `harness-adapters/output/copilot-vscode/skills/`.
6. **copy-runtime-config** — copies `runtime-config/orchestration.yml` and `runtime-config/templates/` verbatim.
7. **emit-cli-bundle** — bundles `cli/` via `emitCliBundle`.
8. **emit-pipeline-bundle** — bundles the pipeline runtime TS via `emitPipelineBundle`.
9. **prune-scripts-sources** — removes `.ts` sources, tests, and tooling from `output/skills/rad-orchestration/scripts/`; retains only `.js`, `.mjs`, and `.gitignore`.
10. **emit-ui-bundle** — builds Next.js standalone via `emitUiBundle`.
11. **emit-hook-bundle** — bundles `hooks/bootstrap.mjs` (with `lib/install/*` inlined) and copies verbatim files (`drift-check.mjs`, `hooks.json`, `AGENTS.md`) via `emitHookBundle`. Hook dispatch happens via an inline `node -e` shim inside `hooks.json` — no separate launcher artifact ships.
12. **expand-tokens** — substitutes `${SKILLS_ROOT}` and `${PLUGIN_ROOT}` tokens in `agents/` and `skills/` with their `${COPILOT_VSCODE_PLUGIN_ROOT}`-rooted forms. No agent namespacing — `agentNames` is not passed. Token target is `${COPILOT_VSCODE_PLUGIN_ROOT}` (vs the CLI plugin's `${COPILOT_CLI_PLUGIN_ROOT}`).
13. **copy-plugin-manifest** — copies `plugin.json` from the package root to `output/plugin.json` (not under `output/.claude-plugin/`).
14. **synthesize-package-json** — merges wrapper `package.json` with `plugin.json`; `plugin.json.version` always wins; writes `output/package.json`. Hard-codes `name: '@rad-orchestration/copilot-vscode-plugin'`.
15. **copy-manifest-catalog** — copies `manifests/v*.json` to `output/manifests/`.
16. **validate** — calls `validatePluginTree` to confirm required artifacts, agent presence, version manifest, and size budget.

**`validate.js` — `validatePluginTree(opts)`**

Four gates:
- **Gate 1** — required artifacts present. Includes `plugin.json` at the output root, the bundled `hooks/bootstrap.mjs` and verbatim `hooks/drift-check.mjs`, and all pipeline scripts. No launcher artifact — hook dispatch is the inline `node -e` shim in `hooks.json`.
- **Gate 2** — every canonical agent appears at `output/agents/<name>.agent.md`.
- **Gate 3** — per-version manifest present (`manifests/v${version}.json`).
- **Gate 4** — tarball size within budget.

The CLI plugin's namespaced-token gate is intentionally absent — no agent namespacing is applied.

**`synthesize-package-json.js`**

Hard-codes `name: '@rad-orchestration/copilot-vscode-plugin'`. Merges wrapper `package.json` with `plugin.json`; `plugin.json.version` always wins.

## Deltas vs the copilot-cli-plugin build

| Dimension | copilot-cli-plugin | copilot-vscode-plugin |
|-----------|--------------------|-----------------------|
| `expand-tokens` token target | `${COPILOT_CLI_PLUGIN_ROOT}` | `${COPILOT_VSCODE_PLUGIN_ROOT}` |
| `emit-hook-bundle` verbatim files | `drift-check.mjs`, `hooks.json`, `AGENTS.md` | `drift-check.mjs`, `hooks.json`, `AGENTS.md` (no launcher — hook dispatch is an inline `node -e` shim in `hooks.json`) |
| `adapter-engine` flag | `--harness=copilot-cli` | `--harness=copilot-vscode` |
| `REQUIRED_ARTIFACTS` | does not include launcher | does not include launcher (hook dispatch is inline in `hooks.json`) |
| Step stderr prefix | `[build:copilot-cli-plugin]` | `[build:copilot-vscode-plugin]` |
| Published package name | `@rad-orchestration/copilot-cli-plugin` | `@rad-orchestration/copilot-vscode-plugin` |

## Model identifier shape

The `(copilot)`-suffixed model identifier shape that VS Code's resolver requires is adapter-emitted upstream (`harness-adapters/`), not build-side. The build does not translate or rewrite model identifiers (AD-3, AD-17).

## Coding conventions

- Every step runs through the local `step(name, fn)` wrapper: timed, labeled with `[build:copilot-vscode-plugin]`, fail-fast on throw.
- Paths are always resolved via `path.resolve` / `path.join` from `rootDir`; no hardcoded absolute paths.
- `output/` is wiped at the start of every build; the output tree is never partially updated.

## Rules for making updates

- Step order is load-bearing: adapter output must exist before `copy-agents`/`copy-skills`; bundles before `expand-tokens`; `validate` last.
- `REQUIRED_ARTIFACTS` in `validate.js` must stay in sync with build output. Hook dispatch is the inline `node -e` shim in `hooks.json` — no separate launcher artifact is required.
- Adding a new step: place it in the correct sequence, update the step-count comment, and update `validate.js` if a new required artifact is introduced.
- Tests in `tests/` cover the build orchestration end-to-end; run them after any build-script change.
