# copilot-cli-plugin/

## Purpose

A self-contained npm package (`@rad-orchestration/copilot-cli-plugin-source`) whose `npm run build` produces the publishable Copilot CLI marketplace plugin. The source package is never published; `npm pack` runs against `output/` after build.

## How it works

`build-scripts/build.js` exports `runBuild(opts)` and is the single entry point. It executes steps in fixed order, fail-fast. The build reads adapter output for the `copilot-cli` harness, bundles the pipeline runtime and UI, esbuild-bundles the bootstrap hook with `lib/install/*` inlined, runs `expand-tokens` (token substitution only — no agent namespacing for Copilot CLI), copies `plugin.json` to the output payload root (not under a `.claude-plugin/` subfolder), synthesizes `output/package.json`, and runs structural validation.

`opts.rootDir` is the repo root. `opts.greenfieldRel` (default `'greenfield'`) names the relative path to the greenfield folder; tests pass `'.'` to use a synthetic fixture tree.

## Source layout

- `build-scripts/` — `build.js`, `validate.js`, `synthesize-package-json.js`; see `build-scripts/AGENTS.md`
- `plugin.json` — plugin metadata at the package root (not nested under `.claude-plugin/`); its `version` field is the authoritative version for the published package
- `hooks/` — hook source; see `hooks/AGENTS.md`
- `lib/install/` — install state machine; see `lib/install/AGENTS.md`
- `manifests/` — per-version file manifests (`v*.json`)
- `tests/` — build orchestration and hook tests
- `output/` — gitignored build output; canonical npm-pack source

## Inputs this package reads but does not own

- `greenfield/harness-adapters/output/copilot-cli/` — compiled agents and skills produced by the adapter engine; agent filenames carry the `.agent.md` suffix for the Copilot CLI harness
- `greenfield/runtime-config/` — `orchestration.yml` and `templates/` copied verbatim
- `cli/` and `ui/` at the repo root — bundled via `emitCliBundle` and `emitUiBundle`
- `greenfield/harness-files/skills/rad-orchestration/scripts/*.ts` — pipeline TypeScript source bundled by `emitPipelineBundle`
- `greenfield/harness-installers/shared/build-helpers/` — shared `emitCliBundle`, `emitPipelineBundle`, `emitHookBundle`, `emitUiBundle`, `expandTokens` helpers

## Deltas vs the claude-plugin

| Dimension | claude-plugin | copilot-cli-plugin |
|-----------|---------------|--------------------|
| Plugin manifest location | `.claude-plugin/plugin.json` | `plugin.json` at package root |
| Agent filename suffix | `.md` | `.agent.md` |
| Agent namespacing | `rad-orchestration:<name>` injected by `expand-tokens` | No namespacing — `expand-tokens` is a no-op for that transform |
| Bootstrap idempotency | `selfUninstall` rewrites `hooks.json` in-place | Marker file at `~/.radorch/.copilot-cli-plugin-bootstrap.json` — mid-session `hooks.json` rewrites are unsafe under Copilot CLI's cache-and-read semantics |
| Coexistence partners | warns on `harnesses.claude` | warns on both `harnesses.claude` and `harnesses.claude-plugin` |
| Build step stderr prefix | `[build:claude-plugin]` | `[build:copilot-cli-plugin]` |
| Validate gate 3 | namespaced-token check | omitted (no namespacing) |

## Seams

- **Upstream**: `greenfield/harness-adapters/` produces the agent and skill files this build copies. Changes to the adapter's output layout or filename conventions flow through here.
- **Downstream**: `npm pack` against `output/` produces the tarball submitted to the Copilot CLI marketplace. The build is the sole writer of `output/`.

## Coding conventions

- `build.js` calls each step through the local `step(name, fn)` wrapper which times and labels every phase; all step failures throw with a prefixed message.
- Paths are always resolved via `path.resolve` / `path.join` from `rootDir`; no hardcoded absolute paths.
- `output/` is wiped clean at the start of every build; the output tree is never partially updated.

## Rules for making updates

- Step order is load-bearing: adapter output must exist before `copy-agents`/`copy-skills`; bundles must exist before `expand-tokens`; `validate` must run last.
- `validate.js`'s `REQUIRED_ARTIFACTS` list must stay in sync with what the build actually produces. Gate 3 (namespaced-token check) is intentionally absent.
- Adding a new step: place it in the correct position in `runBuild`, update the step-count comment, and update `validate.js` if a new required artifact is introduced.
- `synthesizePackageJson` hard-codes `name: '@rad-orchestration/copilot-cli-plugin'`; changing the published package name requires updating it there.
- Tests in `tests/` cover build orchestration end-to-end; run them after any build-script change.

## Further reading

- `hooks/AGENTS.md` — hook lifecycle and bundle/verbatim split
- `lib/install/AGENTS.md` — install state machine modules
- `build-scripts/AGENTS.md` — step sequence and validate gates
- `greenfield/harness-installers/shared/build-helpers/AGENTS.md` — shared helper signatures
