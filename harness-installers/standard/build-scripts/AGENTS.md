# Build Scripts

## Purpose

Single end-to-end build orchestrator that consumes canonical sources (`agents/`, `skills/`, `ui/`, `cli/`, `runtime-config/`) and produces `output/` ready for `npm pack`. Output from this stage is what the installer unpacks and deploys to user-level harness folders at install time.

## How it works

`build.js` executes a fixed sequence of named steps. Every step runs inside the `step()` helper, which prints `[build:standard] <name> ...` before the body and `[build:standard] <name> done (Nms)` after, re-throwing any error wrapped as `[build:standard] step "<name>" failed: <msg>` (AD-7 fail-fast). Shared helpers come from `harness-installers/shared/build-helpers/` (AD-8); the only local helper in this folder is `emit-manifest.js`. The publish `package.json` is the source-side `standard/package.json` itself — `npm pack` runs from `standard/`, so no output-side package.json synthesis is performed.

The steps, in execution order:

1. `bootstrap-deps` — conditional sub-package `npm install` for `harness-installers/shared/build-helpers`, `harness-adapters/engine`, `cli/`, and `ui/` (skipped via `opts.skipBootstrap`).
2. `adapter-engine` — runs the adapter engine per harness (skipped via `opts.skipAdapterEngine` in unit tests).
3. `clean-output` — `rm -rf output/` then `mkdir output/`.
4. `copy-adapter-output` — per-harness `cpSync` of `harness-adapters/output/<harness>/agents/` and `skills/` into `output/<harness>/`.
5. `copy-runtime-config` — per-harness copy of `runtime-config/orchestration.yml` and `runtime-config/templates/` into each `output/<harness>/`.
6. `emit-cli-bundle` — per-harness emit of the bundled `radorch.mjs` CLI into `output/<harness>/skills/rad-orchestration/scripts/`; chmod 0o755 on POSIX (NFR-6).
7. `emit-pipeline-bundle` — per-harness emit of the pipeline runtime (`pipeline.js`, `explode-master-plan.js`) into the same scripts dir.
8. `prune-scripts-sources` — per-harness prune leaving only `.js` / `.mjs` under each `output/<harness>/skills/rad-orchestration/scripts/`. `.gitignore` is excluded because `npm-packlist` hardcodes that filename as ignored; deploying it would break install with ENOENT (manifest references a file the tarball never ships).
9. `emit-ui-bundle` — single emission to `output/ui/` at the top level (AD-9 — not per-harness).
10. `expand-tokens` — per-harness token substitution over `output/<harness>/agents/` and `skills/` with `agentNames: []` (AD-6 — no `rad-orc:` namespacing rewrite).
11. `emit-manifest` — per-harness manifest write to `manifests/<harness>/v<version>.json`, then copy that file plus every prior `manifests/<harness>/v*.json` into `output/<harness>/manifests/` (AD-4).
12. `emit-per-harness-package-json` — writes a minimal `{name, version}` stub into each `output/<harness>/package.json` so `installHarness` can resolve the delivering version per harness without reading the source `standard/package.json`.
13. `validate` — structural validation gate (NFR-5, NFR-7, AD-7): confirms per-harness artifacts, canonical agents, manifests, and unpacked size budget (sized from `standard/` since that's the npm-pack cwd). Throws to abort the build.

## Coding standards

- **Fixed step order**: Steps execute in the sequence above. No conditional reordering. If a step is not applicable, it still runs (and is a noop).
- **Fail-fast validation**: Every step that produces output immediately checks for expected files. Missing outputs are fatal.
- **Shared helper contracts**: Every call to `harness-installers/shared/build-helpers/` (e.g., `emit-cli-bundle`, `emit-pipeline-bundle`, `emit-ui-bundle`, `expand-tokens`) passes all required installer-specific knowledge as parameters — no shared state, no imported config (AD-8).
- **Local helper parameterized**: `emit-manifest.js` accepts all harness and version information as parameters so it can be reused without modification.
- **No hooks**: `emit-hook-bundle` exists in shared helpers but is unused here (AD-8); it is reserved for marketplace plugin builders and does not apply to the standard installer.
- **Token map without agent namespacing**: The token expansion in `expand-tokens.js` uses a flat namespace — no `rad-` prefix filtering or special agent-bundle handling (AD-6).
- **UI emitted once**: The dashboard is compiled and emitted once, then shared across all harnesses (AD-9); no per-harness duplication.

## Seams to other modules

**Reads**: `harness-adapters/output/<harness>/` (pre-adapted agents, skills, and plugin definitions); `runtime-config/` (orchestration.yml template and tier templates); `cli/` (CLI source); `ui/` (dashboard source for compilation); `harness-files/skills/rad-orchestration/scripts/` (pipeline runtime); canonical sources `agents/` and `skills/` are consumed indirectly via the adapters.

**Writes**: `output/` (gitignored) with per-harness bundles, shared runtime-config, CLI, UI, and manifests.

**Consumer**: The published tarball produced by `npm pack` at the installer's package root. The installer unpacks this tarball and uses the manifests to deploy files to user-level (`~/.claude/`, `~/.copilot/`, `~/.radorch/`).

**Never reads or writes**: Project state, user-level harness folders, or any non-canonical source directory.
