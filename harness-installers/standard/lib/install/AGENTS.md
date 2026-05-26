# Install State Machine

## Purpose

Per-harness install orchestrator consumed by `lib/wizard.js` and (via `index.js`) the CLI binary. Each harness (Claude, Copilot in VS Code, Copilot CLI) has its own isolated state machine that handles file writes, symlink/copy decisions, and integration points with the chosen harness. The state machine ensures atomic, idempotent, and user-preserving install operations.

## How it works

`install-harness.js` is the top-level orchestrator. It dispatches against four discrete install actions:

- `fresh-install` — First install on this machine; all user-data folders are created, `install.json` is written, and all shipped files are installed.
- `upgrade-complete` — Existing install being upgraded; `install.json` is mutated (version bumped, etc.), and shipped files are refreshed while preserving user customizations.
- `noop` — Requested version already installed; no write occurs.
- `downgrade-refused` — Downgrade detected; rejected loudly (distinct from the plugin's quieter `downgrade-noop`). User is informed and must act.

`install-files.js` and `remove-files.js` are manifest-driven workers: they iterate over file manifests and perform copy, symlink, or removal operations according to the manifest's instructions. `hydrate-user-data.js` enforces sole-writer rules: per AD-13, each file class (`orchestration.yml`, tier templates, shipped tiers, agents, skills, plugins) is owned by exactly one writer. Fresh installs preserve nothing. Upgrades preserve user edits in `orchestration.yml` only; shipped tier templates under `~/.radorc/templates/` are always refreshed to pick up upstream improvements, and any user-added templates outside the four shipped tiers are preserved. User-owned files (those not in the shipped manifest) are never touched.

## Coding standards

- **Atomic `install.json` writes**: All mutations use temporary file + rename to avoid partial writes on interruption (NFR-3). If a write fails, no partial state remains.
- **Best-effort post-install side effects**: Dashboard setup hints, missing environment variable warnings, and other non-critical operations are wrapped in `try`/`catch` and swallowed per NFR-4. Warnings are logged; execution continues.
- **User-data preservation rules**: Tested explicitly (NFR-10). Tests assert that fresh installs leave no prior content, upgrades preserve `orchestration.yml` untouched, and shipped tier templates are refreshed while user-added templates survive.
- **Error messages**: Always name observed state, action attempted, and recovery path per NFR-11. Example: "Detected downgrade from v1.5 to v1.3; refusing install. To proceed, uninstall then reinstall at v1.3."
- **Closed `InstallKey` values**: The four valid harness keys are `claude`, `claude-plugin`, `copilot-cli`, `copilot-vscode`. No other keys are accepted (AD-10). Note that the standard installer itself only writes the three non-plugin keys; `claude-plugin` is present in the closed set because both installers share the same `install.json` shape and the cross-channel coexistence detector consults entries written by either installer (AD-15).

## Seams to other modules

**Read by**: `index.js`, `lib/wizard.js` (which calls into `install-harness.js` after wizard selection).

**Reads**: `install.json` (sole writer per AD-13); adapters' pre-compiled bundles from `harness-adapters/output/<harness>/`; `runtime-config/orchestration.yml` and `runtime-config/templates/`.

**Writes**: `~/.claude/agents/`, `~/.claude/skills/`, `~/.claude/plugins/`, `~/.copilot/agents/`, `~/.copilot/skills/`, `~/.copilot/plugins/`, `~/.radorc/orchestration.yml` (fresh install only; preserved on upgrade), `~/.radorc/templates/`, `~/.radorc/ui/`.

**Never reads**: `cli/`, `ui/`, `build-scripts/`, or any upstream design artifact.
