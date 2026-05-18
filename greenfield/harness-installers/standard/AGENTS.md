# Standard Installer Package

## Purpose

This folder is a self-contained npm package that produces the publishable `rad-orchestration` tarball distributed to end users via `npx rad-orchestration`. The binary is `radorch-installer`, and the package coordinates remain the same as the legacy installer with the next version slot per the refactor direction. Contributors landing here are authoring the end-user installation experience that copies greenfield bundles to user-level harness folders (`~/.claude/`, `~/.copilot/`), generates `orchestration.yml`, and optionally sets up the dashboard.

## How it works

**Build stage** (`build-scripts/build.js`): Runs adapters over canonical sources (`agents/`, `skills/`) and emits per-harness bundles to `dist/` (gitignored). The `npm pack` step operates from the `dist/` directory, bundling the built artifacts into the tarball.

**User-facing wizard** (`lib/wizard.js`): Interactive CLI entry point that walks the user through harness selection, workspace root discovery, and configuration template choice (extra-high, high, medium, low review intensity).

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
- **`runtime-config/`** — `orchestration.yml` template and the four review-intensity tier templates (`extra-high.yml`, `high.yml`, `medium.yml`, `low.yml`). Copied to `~/.radorch/` on first install or when user chooses a new tier.
- **`cli/`** — CLI parsing and launch surface (separate from the installer wizard proper). The installer is invoked by `radorch-installer` binary, which delegates to the wizard.
- **`ui/`** — Pre-compiled dashboard bundle (if included). Conditionally installed based on user choice in the wizard.
- **`harness-files/skills/rad-orchestration/scripts/`** — The pipeline runtime itself (`pipeline.js`, `main.ts`, and `lib/`). Copied to user-level harness skill locations so orchestration projects can invoke `rad-orchestration` at runtime.

**Build-time helpers (no runtime imports)**:
- **`shared/build-helpers/`** — Manifest-driven file installation utilities used during the build stage to deploy adapted files to `dist/`. Note: `emit-hook-bundle` exists in shared helpers but is unused here (AD-8); it is reserved for marketplace plugin builders and does not apply to the standard installer.

**Outputs (written at install time)**:
- **`~/.claude/agents/`** — Claude Code agents (if Claude harness chosen).
- **`~/.claude/skills/`** — Claude Code skills (if Claude harness chosen).
- **`~/.claude/plugins/`** — Marketplace plugin manifests and offline hooks cache (if applicable).
- **`~/.copilot/agents/`** — Copilot VS Code / CLI agents (if Copilot harness chosen).
- **`~/.copilot/skills/`** — Copilot skills (if Copilot harness chosen).
- **`~/.radorch/orchestration.yml`** — System configuration (user-owned; preserved on reinstall).
- **`~/.radorch/templates/`** — Review-intensity tier templates (refreshed on each install to pick up upstream improvements).
- **`~/.radorch/ui/`** — Dashboard code (if user opted in).

**Freeze rule on legacy `installer/`**: The original `installer/` directory at the repo root is frozen in place. No new code is added to it; the standard installer is the sole entry point for new installations and reinstalls. Legacy installer files are not deleted (for auditing and offline reference), but all forward development happens here in `greenfield/harness-installers/standard/`.
