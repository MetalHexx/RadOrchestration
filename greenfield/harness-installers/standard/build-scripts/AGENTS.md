# Build Scripts

## Purpose

Single end-to-end build orchestrator that consumes canonical sources (`agents/`, `skills/`, `ui/`, `cli/`, `runtime-config/`) and produces `dist/` ready for `npm pack`. Output from this stage is what the installer unpacks and deploys to user-level harness folders at install time.

## How it works

`build.js` executes a fixed 14-step sequence:

1. Validates that all source directories exist and are readable.
2. Clears prior `dist/` state.
3. Invokes `expand-tokens.js` to interpolate version strings and build metadata into manifest templates.
4. Runs per-harness adapters over canonical agent and skill sources via `emit-cli-bundle.js` (produces `dist/<harness>/agents/`, `dist/<harness>/skills/`).
5. Calls `emit-pipeline-bundle.js` to copy the pipeline runtime (`pipeline.js`, `main.ts`, `lib/`) into each harness's skills folder.
6. Runs `emit-ui-bundle.js` to compile and emit the dashboard (once at the top level per AD-9; shared across all harnesses).
7. Runs `emit-manifest.js` to generate per-harness file manifests (used by the installer to copy files to user-level).
8. Runs `synthesize-package-json.js` to generate the final `package.json` for the tarball.
9. Copies `runtime-config/orchestration.yml` and the four tier templates into `dist/runtime-config/`.
10. Copies CLI source into `dist/cli/`.
11. Validates that all expected outputs exist in `dist/`.
12. Runs final manifest integrity checks.
13. Prints build summary.
14. Exits with code 0 on success, 1 on any failure.

**Fail-fast** (AD-7): Any validation failure or missing output halts the build immediately. The installer receives either a complete, valid `dist/` or nothing at all.

All emitters that produce per-harness content delegate their harness-specific knowledge (file paths, naming rules, manifest shape) to the local helpers `emit-manifest.js` and `synthesize-package-json.js` via parameter passing, not global configuration (AD-8 — no installer-blindness).

## Coding standards

- **Fixed step order**: Steps execute in the sequence above. No conditional reordering. If a step is not applicable, it still runs (and is a noop).
- **Fail-fast validation**: Every step that produces output immediately checks for expected files. Missing outputs are fatal.
- **Shared helper contracts**: Every call to `harness-installers/shared/build-helpers/` (e.g., `emit-cli-bundle`, `emit-pipeline-bundle`, `emit-ui-bundle`, `expand-tokens`) passes all required installer-specific knowledge as parameters — no shared state, no imported config (AD-8).
- **Local helpers parameterized**: `emit-manifest.js` and `synthesize-package-json.js` accept all harness and version information as parameters so they can be reused without modification.
- **No hooks**: `emit-hook-bundle` exists in shared helpers but is unused here (AD-8); it is reserved for marketplace plugin builders and does not apply to the standard installer.
- **Token map without agent namespacing**: The token expansion in `expand-tokens.js` uses a flat namespace — no `rad-` prefix filtering or special agent-bundle handling (AD-6).
- **UI emitted once**: The dashboard is compiled and emitted once, then shared across all harnesses (AD-9); no per-harness duplication.

## Seams to other modules

**Reads**: `harness-adapters/output/<harness>/` (pre-adapted agents, skills, and plugin definitions); `runtime-config/` (orchestration.yml template and tier templates); `cli/` (CLI source); `ui/` (dashboard source for compilation); `harness-files/skills/rad-orchestration/scripts/` (pipeline runtime); canonical sources `agents/` and `skills/` are consumed indirectly via the adapters.

**Writes**: `dist/` (gitignored) with per-harness bundles, shared runtime-config, CLI, UI, and manifests.

**Consumer**: The published tarball produced by `npm pack` at the installer's package root. The installer unpacks this tarball and uses the manifests to deploy files to user-level (`~/.claude/`, `~/.copilot/`, `~/.radorch/`).

**Never reads or writes**: Project state, user-level harness folders, or any non-canonical source directory.
