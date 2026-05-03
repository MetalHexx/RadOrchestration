# Getting Started

> **Note:** Commands below use `.claude` as the default orchestration root. If you've [configured a custom root](configuration.md), adjust paths accordingly.

This guide covers prerequisites, installation, and next steps for the orchestration system.

## Prerequisites

- **Node.js v18+** — required for the installer, CLI scripts, and validation
- **VS Code** with **GitHub Copilot** and agent mode enabled
- A workspace directory where you want to install the orchestration system

## Installation

The interactive installer sets up the orchestration system in one step — no clone or repository setup required:

```bash
npx rad-orchestration
```

The installer walks you through configuration options including AI tool selection, workspace directory, pipeline limits, gate behavior, and an optional dashboard.

See [Configuration](configuration.md) for details on each option.

Alternatively, install globally and run from any project directory:

```bash
npm install -g rad-orchestration
radorch
```

## Next Steps

Once installed, explore these resources to start building:

- [Guides](guides.md) — step-by-step walkthroughs for planning and executing projects
- [Pipeline](pipeline.md) — learn how the planning and execution pipeline works
- [Agents](agents.md) — understand the specialized agents and their roles
- [Configuration](configuration.md) — customize pipeline behavior via `orchestration.yml`

## Uninstalling

Remove the orchestration system from a workspace with:

```bash
radorch uninstall
```

The command reads `package_version` from your `orchestration.yml`, looks up the bundled manifest for that version, and removes only the files it lists. `orchestration.yml` is removed last so future installer runs see a clean slate. Locally-modified files surface in a confirmation prompt before any removal proceeds.

Pass `--workspace <path>` and `--orch-root <folder>` to target a workspace other than the current directory or an `orchRoot` other than the default `.claude`. If you installed using a Copilot harness, pass `--tool copilot-vscode` or `--tool copilot-cli` so the installer loads the correct manifest — without it, the default `claude-code` manifest is used and your `*.agent.md` files will not be removed.

## Upgrading from earlier versions

Re-running `radorch` against an existing install upgrades it as `uninstall(prior version) + install(new version)` — orphans from the prior version are removed, new files are installed, and locally-modified files trigger a confirmation prompt before they are touched.

Installs from `v1.0.0-alpha.7` or earlier predate the manifest catalog and cannot be auto-upgraded. The installer detects them (no `package_version` field in `orchestration.yml`), prints a notice, and exits without modifying files. Back up any local edits, delete `.claude/` (or `.github/`), then re-run `radorch` for a clean install.

