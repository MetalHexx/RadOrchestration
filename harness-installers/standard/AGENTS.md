# Standard Installer Package

## Purpose

This folder is a self-contained npm package that produces the publishable `rad-orchestration` tarball distributed to end users via `npx rad-orchestration`. The binary is `rad-orchestration` (matches the package name so `npx rad-orchestration` resolves under npm exec's name-match path). Contributors landing here are authoring the end-user installation experience that copies greenfield bundles to user-level harness folders (`~/.claude/`, `~/.copilot/`), generates `orchestration.yml`, and optionally sets up the dashboard.

## How it works

**Build stage** (`build-scripts/build.js`): Runs adapters over canonical sources (`harness-files/agents/`, `harness-files/skills/`) and emits per-harness bundles to `output/` (gitignored). The `npm pack` step operates from the `output/` directory, bundling the built artifacts into the tarball.

**User-facing wizard** (`lib/wizard.js`): Interactive CLI entry point whose only required output is harness selection — one or more InstallKey values plus a small set of configuration paths (AD-18). Planning-tier templates, gate behavior, and auto-commit settings are NOT collected by the wizard; they come from `runtime-config/orchestration.yml` shipping verbatim. There is no `lib/config-generator.js`.

**Per-harness install state machine** (`lib/install/`): Isolated install flow for each harness (Claude, Copilot in VS Code, Copilot CLI). Each state machine owns its own file write logic, symlink/copy decisions, and integration points with the chosen harness. The state machine ensures atomic, idempotent writes.

**Runtime user-data locations**: The installer populates `~/.radorch/` with `orchestration.yml` and `templates/`, and populates `~/.claude/` and `~/.copilot/` with agents, skills, and marketplace plugin bundles (where applicable per harness).

## Coding standards

- **ESM only**: All source code is authored as ES modules (`.mjs` in tests per Node 18+ `node --test` runner; `.js` elsewhere where context is clear).
- **Node 18+**: No backports; features like `fs.constants.copyFile` and top-level `await` are assumed available.
- **Atomic writes**: All user-data mutations use temporary files + rename pattern to avoid partial writes or corruption on interruption (NFR-3). If a write fails, no partial state is left behind.
- **Graceful error handling**: Post-install warnings (e.g., missing environment variables, dashboard setup hints) are caught and swallowed per NFR-4; they never halt the installer or return non-zero exit codes. User sees warnings, flow continues.
- **No test-only code in production**: Test utilities and mock factories live only in `tests/` and never leak into `lib/`.

## Seams to other modules

**Inputs (read at build and runtime)**:
- **`harness-adapters/output/<harness>/`** — Per-harness adapted agents, skills, and marketplace plugin definitions. The installer consumes these pre-built bundles and copies them into user-level locations. Adapters run once at build time (not at install time), so the installer always works offline.
- **`runtime-config/`** — `orchestration.yml` template and the four review-intensity tier templates (`extra-high.yml`, `high.yml`, `medium.yml`, `low.yml`). `orchestration.yml` is copied to `~/.radorch/orchestration.yml` only on fresh install (FR-14) — present files are preserved untouched so user edits survive upgrades. The four shipped tier templates always overwrite their counterparts under `~/.radorch/templates/` on every install (FR-15); any user-added templates in that folder are preserved.
- **`cli/`** — CLI parsing and launch surface (separate from the installer wizard proper). The installer is invoked by the `rad-orchestration` binary, which delegates to the wizard.
- **`ui/`** — Pre-compiled dashboard bundle (if included). Conditionally installed based on user choice in the wizard.
- **`cli/src/`** — The pipeline runtime and every other helper subcommand. `emit-cli-bundle` bundles `cli/src/` into `radorch.mjs` and ships it to `${HARNESS_ROOT}/skills/rad-orchestration/scripts/`; skills invoke the pipeline as `radorch pipeline signal`.

**Build-time helpers (no runtime imports)**:
- **`shared/build-helpers/`** — Manifest-driven file installation utilities used during the build stage to deploy adapted files to `output/`. Note: `emit-hook-bundle` exists in shared helpers but is unused here (AD-8); it is reserved for marketplace plugin builders and does not apply to the standard installer.

**Outputs (written at install time)**:
- **`~/.claude/agents/`** — Claude Code agents (if Claude harness chosen).
- **`~/.claude/skills/`** — Claude Code skills (if Claude harness chosen).
- **`~/.claude/plugins/`** — Marketplace plugin manifests and offline hooks cache (if applicable).
- **`~/.copilot/agents/`** — Copilot VS Code / CLI agents (if Copilot harness chosen).
- **`~/.copilot/skills/`** — Copilot skills (if Copilot harness chosen).
- **`~/.radorch/orchestration.yml`** — System configuration (user-owned; preserved on reinstall).
- **`~/.radorch/templates/`** — Review-intensity tier templates (refreshed on each install to pick up upstream improvements).
- **`~/.radorch/ui/`** — Dashboard code (if user opted in).
