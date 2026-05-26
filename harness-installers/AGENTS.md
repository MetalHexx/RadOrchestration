# harness-installers/

## Purpose

Top-level container for every installer variant and the shared mechanical helpers that installer builds draw on. No code lives directly in this folder — it exists to group sibling packages with a shared discipline.

## Organization

- `claude-plugin/` — self-contained npm package that builds and publishes the Claude marketplace plugin. `build-scripts/build.js` is the entry point; `npm run build` drives the full 14-step pipeline.
- `copilot-cli-plugin/` — self-contained npm package that builds and publishes the Copilot CLI marketplace plugin. Architectural sibling of `claude-plugin/`; the deltas are documented in `copilot-cli-plugin/AGENTS.md` (no `.claude-plugin/` folder, `.agent.md` agent filename suffix, no agent-namespacing transform, marker-file idempotency, two coexistence partners). `npm run build` drives the build via the same shared helpers.
- `copilot-vscode-plugin/` — self-contained npm package that builds and publishes the Copilot in VS Code marketplace plugin. Architectural sibling of `copilot-cli-plugin/` and `claude-plugin/`; the deltas are documented in `copilot-vscode-plugin/AGENTS.md` (Claude-format `.claude-plugin/plugin.json` manifest layout so VS Code injects `CLAUDE_PLUGIN_ROOT` into hooks, `.agent.md` agent filename suffix, no agent-namespacing transform, `hooks.json` self-uninstall idempotency (no marker file), three coexistence partners, PascalCase hook event names, OS-specific `agentPlugins/` install paths, and the load-bearing `(copilot)`-suffixed model identifier shape that VS Code's resolver requires). `npm run build` drives the build via the same shared helpers.
- `shared/build-helpers/` — four installer-blind helpers (`emitCliBundle`, `emitHookBundle`, `emitUiBundle`, `expandTokens`) shared by every installer build script. No installer-specific logic lives here.

## Inputs this layer consumes (but does not own)

- `harness-adapters/output/claude/` — compiled agents and skills produced by the adapter engine
- `runtime-config/` — `orchestration.yml` and `templates/` staged under each build's `_install-source/`; the bootstrap hook hydrates them to `~/.radorch/` on install and then removes the staging dir so no shadow copy remains at the plugin install root
- `cli/` and `ui/` at the repo root — bundled into the plugin output by `emitCliBundle` and `emitUiBundle`

## Coding conventions

- Each installer variant is a standalone `npm` package with its own `package.json` and test suite.
- Build outputs land in a gitignored `output/` folder inside each installer package; nothing generated is committed.
- Cross-variant sharing happens only through `shared/build-helpers/`; no other cross-installer imports.

## Rules for making updates

- Adding a new installer variant: create a sibling folder, add `package.json`, consume `shared/build-helpers/` directly via relative path.
- Changing what `shared/build-helpers/` exports: update every installer build script that imports the changed function — all callers are local to this subtree.
- Never import from `shared/build-helpers/` at runtime (in hook code or install logic); these are build-time tools only.

## Further reading

- `claude-plugin/AGENTS.md` — build orchestration, output layout, and seams
- `shared/build-helpers/AGENTS.md` — helper signatures and installer-blindness contract
