# copilot-vscode-plugin/

## Purpose

A self-contained npm package (`@rad-orchestration/copilot-vscode-plugin-source`) whose `npm run build` produces the publishable Copilot in VS Code marketplace plugin. The source package is never published; `npm pack` runs against `output/` after build.

## How it works

`build-scripts/build.js` exports `runBuild(opts)` and is the single entry point. It executes steps in fixed order, fail-fast. The build reads adapter output for the `copilot-vscode` harness, bundles the pipeline runtime and UI, esbuild-bundles `bootstrap.mjs` with `lib/install/*` inlined, runs `expand-tokens` (destination-token substitution only — no agent namespacing for VS Code either), copies `plugin.json` to the payload root (not under `.claude-plugin/`), synthesizes `output/package.json`, and runs structural validation.

`opts.rootDir` is the repo root. Three optional boolean flags — `opts.skipAdapterEngine`, `opts.skipUiRunner`, and `opts.skipBootstrap` — let tests bypass slow or environment-dependent steps when exercising the build orchestrator against a synthetic fixture tree.

## Source layout

- `build-scripts/` — `build.js`, `validate.js`, `synthesize-package-json.js`; see `build-scripts/AGENTS.md`
- `plugin.json` — plugin metadata at the package root (not nested under `.claude-plugin/`); its `version` field is the authoritative version for the published package
- `hooks/` — hook source; see `hooks/AGENTS.md`
- `lib/install/` — install state machine; see `lib/install/AGENTS.md`
- `manifests/` — per-version file manifests (`v*.json`)
- `tests/` — build orchestration and hook tests
- `output/` — gitignored build output; canonical npm-pack source

## Inputs this package reads but does not own

- `harness-adapters/output/copilot-vscode/` — compiled agents and skills produced by the adapter engine; agent filenames carry the `.agent.md` suffix for the VS Code harness
- `runtime-config/` — `orchestration.yml` and `templates/` copied verbatim
- `cli/` and `ui/` at the repo root — bundled via `emitCliBundle` and `emitUiBundle`
- `harness-files/skills/rad-orchestration/scripts/*.ts` — pipeline TypeScript source bundled by `emitPipelineBundle`
- `harness-installers/shared/build-helpers/` — shared `emitCliBundle`, `emitPipelineBundle`, `emitHookBundle`, `emitUiBundle`, `expandTokens` helpers

## Deltas vs the copilot-cli-plugin

| Dimension | copilot-cli-plugin | copilot-vscode-plugin |
|-----------|--------------------|-----------------------|
| Hook event names | camelCase (`userPromptSubmitted`, `sessionStart`) | **PascalCase** (`UserPromptSubmit`, `SessionStart`) — VS Code's native form |
| Hook dispatch layer | scripts self-resolve via `import.meta.url` | `launcher.cjs` dispatches to `bootstrap.mjs` / `drift-check.mjs`; docs are silent on whether `COPILOT_PLUGIN_ROOT` is injected for Copilot-format plugins (§5 of `docs/research/copilot-vscode-plugin-system.md`) |
| Bootstrap env var | `COPILOT_CLI_PLUGIN_ROOT` | `COPILOT_VSCODE_PLUGIN_ROOT` |
| Coexistence partners | two (`copilot-cli`, `copilot-vscode`) | three (`copilot-cli`, `copilot-vscode`, `copilot-cli-plugin`) |
| Model identifier shape | standard CLI-shaped | `(copilot)`-suffixed — the shape VS Code's model resolver requires; adapter-emitted upstream, not build-side |
| Install paths | single flat `~/.copilot/` path | OS-specific `agentPlugins/` paths; the runtime handles them automatically |
| Build step stderr prefix | `[build:copilot-cli-plugin]` | `[build:copilot-vscode-plugin]` |
| Token target | `${COPILOT_CLI_PLUGIN_ROOT}` | `${COPILOT_VSCODE_PLUGIN_ROOT}` |

## Seams

- **Upstream**: `harness-adapters/` produces the agent and skill files this build copies. The `(copilot)`-suffixed model identifier shape is emitted there, not here — the build does not translate model identifiers.
- **Downstream**: `npm pack` against `output/` produces the tarball submitted to the Copilot in VS Code marketplace. The build is the sole writer of `output/`.

## Coding conventions

- `build.js` calls each step through the local `step(name, fn)` wrapper which times and labels every phase; all step failures throw with a prefixed message.
- Paths are always resolved via `path.resolve` / `path.join` from `rootDir`; no hardcoded absolute paths.
- `output/` is wiped clean at the start of every build; the output tree is never partially updated.

## Rules for making updates

- Step order is load-bearing: adapter output must exist before `copy-agents`/`copy-skills`; bundles must exist before `expand-tokens`; `validate` must run last.
- `validate.js`'s `REQUIRED_ARTIFACTS` list must stay in sync with what the build actually produces. `hooks/launcher.cjs` is a required artifact.
- Adding a new step: place it in the correct position in `runBuild`, update the step-count comment, and update `validate.js` if a new required artifact is introduced.
- `synthesizePackageJson` hard-codes `name: '@rad-orchestration/copilot-vscode-plugin'`; changing the published package name requires updating it there.
- Tests in `tests/` cover build orchestration end-to-end; run them after any build-script change.

## Further reading

- `hooks/AGENTS.md` — hook lifecycle, launcher dispatch, and bundle/verbatim split
- `lib/install/AGENTS.md` — install state machine modules
- `build-scripts/AGENTS.md` — step sequence and validate gates
- `harness-installers/shared/build-helpers/AGENTS.md` — shared helper signatures
