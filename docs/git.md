# Git Integration

The orchestration system supports git worktree isolation for parallel project execution. Multiple projects can run simultaneously in isolated directories without file conflicts, each on its own branch, with configurable activation and cleanup behavior.

## Overview

Worktree isolation creates a separate working directory per project using `git worktree add`. Each project gets its own branch and directory, keeping the main repository checkout clean and undisturbed throughout the project lifecycle.

When worktree isolation is active, all pipeline task handoffs use the worktree directory as the `working_root`. If the `source_control` block is absent from `orchestration.yml`, or `activation` is `never`, the system behaves identically to pre-v5: no worktrees are created, no prompts are shown, and the repository root is used as before.

Four runtime behaviors are controlled by the `source_control` configuration block:

1. **When** to create a worktree (`activation`)
2. **Which branch** to use as the origin (`branch_from`)
3. **Where** to place the worktree directory (`worktree_path`)
4. **When** to clean up the worktree and branch (`cleanup`)

## Configuration

Add a `source_control` block to `orchestration.yml` to enable git integration:

```yaml
# orchestration.yml
source_control:
  isolation_mode: "worktree"      # worktree | none
  activation: "ask"               # always | never | ask
  branch_from: "ask"              # default | current | ask
  worktree_path: "../worktrees"   # Relative or absolute path
  branch_prefix: "project/"       # Branch naming prefix
  cleanup: "ask"                  # ask | on_completion | manual
```

### Key Reference

| Key | Type | Valid Values | Default | Description |
|-----|------|-------------|---------|-------------|
| `isolation_mode` | enum | `worktree`, `none` | `"none"` | How projects are isolated. `branch` is reserved for future use. |
| `activation` | enum | `always`, `never`, `ask` | `"never"` | When isolation activates. `ask` triggers a prompt at project start. |
| `branch_from` | enum | `default`, `current`, `ask` | `"ask"` | Where worktree branches originate. `default` = repo default branch. `current` = currently checked-out branch. |
| `worktree_path` | string | Relative or absolute path | `"../worktrees"` | Base directory for worktree creation. Project name is appended automatically. |
| `branch_prefix` | string | Git-safe string | `"project/"` | Prefix for branch names. Final branch name: `{prefix}{PROJECT-NAME}`. |
| `cleanup` | enum | `ask`, `on_completion`, `manual` | `"ask"` | How worktrees are cleaned up at project completion. |

> **Note:** When `source_control` is absent from the config, defaults are `isolation_mode: "none"` and `activation: "never"` — identical to pre-v5 behavior. No migration is required for existing projects that do not need worktree isolation.

## Activation Modes

The `activation` key controls whether and when a worktree is created at project start.

### `always`

A worktree is created automatically when the project starts. No prompt is shown. The pipeline creates the worktree, records its path and branch in the project state, and continues immediately. An informational notification shows the worktree path, branch name, and branch origin.

### `never`

All worktree logic is skipped. The pipeline behaves identically to pre-v5. The `working_root` in task handoffs defaults to the repository root.

### `ask`

The pipeline prompts the user at project start with two options:

- **worktree** — Create an isolated worktree directory for this project
- **none** — Run in the main repository checkout

The choice is stored in the project state and is not asked again for that project.

## Branch Origin

The `branch_from` key controls which branch the new worktree branch is created from.

### `default`

The new branch is created from the repository's default branch (e.g., `main`). This is the recommended option for new features or isolated work.

### `current`

The new branch is created from the currently checked-out HEAD. Useful when the project should continue from in-progress work.

> **Note about uncommitted changes:** When `current` is selected and the repository has uncommitted changes, the pipeline shows an informational warning before proceeding. Worktree creation itself succeeds because `git worktree add` only carries committed state — uncommitted changes remain in the main checkout.

### `ask`

The pipeline prompts the user to choose between `default` and `current` at the time the worktree is created.

## Cleanup

The `cleanup` key controls what happens when a project reaches completion.

### `ask`

At project completion, the pipeline prompts whether to remove or keep the worktree:

- **remove** — Deletes the worktree directory and removes the local branch
- **keep** — Retains both for manual inspection or cleanup

### `on_completion`

The pipeline cleans up automatically after the final review step. It verifies all work is committed to the branch, then removes the worktree directory and deletes the local branch. If uncommitted changes are detected in the worktree, cleanup fails with an error and the user is prompted to resolve them before re-running.

### `manual`

The pipeline takes no cleanup action at any point. The user manages the worktree lifecycle manually using standard git commands or the `/cleanup-worktree` prompt file.

## Manual Operations

Three prompt files enable manual worktree management directly from VS Code Chat.

> **Note:** Commands below use `.github` as the default orchestration root. If you've [configured a custom root](configuration.md), adjust paths accordingly.

### `/create-worktree`

Manually create a worktree for the current project. Reads `source_control` settings from `orchestration.yml` and applies them. Useful when `activation` is `never` but you want to create a worktree for a specific project by exception.

### `/cleanup-worktree`

Clean up a project's worktree and branch. Checks for uncommitted work before proceeding and provides options to handle any pending changes. Equivalent to the automatic `on_completion` cleanup but triggered on demand.

### `/run-migration`

Run the `migrate-to-v5.js` script interactively. Offers scope selection:

- **Single project** — Migrate one project directory
- **All projects (bulk)** — Scan and migrate all project directories under a base path
- **Config file** — Migrate an `orchestration.yml` config file to v5.0
- **Everything** — Migrate both config and all project state files in one pass

## Migration

Projects and config files created before v5 need migration. The `migrate-to-v5.js` script handles both state and config migration.

> **Note:** Commands below use `.github` as the default orchestration root. If you've [configured a custom root](configuration.md), adjust paths accordingly.

### Single Project

```bash
node .github/skills/orchestration/scripts/migrate-to-v5.js <project-dir>
```

Migrates `state.json` from v4 to v5: adds `source_control` fields and bumps the schema version. Creates a backup (`state.v4.json.bak`) before writing. The script is idempotent — running it against an already-migrated v5 state skips it with a confirmation message.

### Config File

```bash
node .github/skills/orchestration/scripts/migrate-to-v5.js --config <path>
```

Migrates `orchestration.yml` from schema version v1.0 to v5.0: adds the `source_control` section with defaults and bumps the `version` field. Creates a backup (`orchestration.v1.yml.bak`) before writing.

### Bulk Mode

```bash
node .github/skills/orchestration/scripts/migrate-to-v5.js --all <base-path>
```

Scans all subdirectories under `<base-path>` — including `_archived/` — for `state.json` files and migrates each one. Reports per-file status (migrated, skipped, error) and prints a summary at the end.

## Troubleshooting

### Version Mismatch

If the config version and state schema version do not match, the pipeline returns an error before processing any events. Resolve it by running `migrate-to-v5.js`:

```
✗ Version mismatch: config is v5.0, state is v4.
  Run: node .github/skills/orchestration/scripts/migrate-to-v5.js <project-dir>
```

### Git Operation Failures

Git errors (non-zero exit codes from `git worktree add`, `git branch -d`, etc.) are surfaced as structured pipeline failures. The error output shows:

- The git command that failed
- The exit code
- The stderr output from git
- Suggested resolution steps

Check that the repository is in a valid state (`git status`, `git fsck`) and that the target worktree path is writable.

### Worktree Already Exists

If the worktree path already exists on disk, git will refuse to create a new worktree there:

```
✗ Git error: fatal: '<path>' already exists
```

Resolution options:

- Remove the existing directory manually and retry
- Change `worktree_path` in `orchestration.yml` to a different location
- Use `/cleanup-worktree` to properly remove a previously created worktree before recreating it

## Next Steps

- [Configuration](configuration.md) — Full `orchestration.yml` reference including all keys
- [Pipeline](pipeline.md) — Pipeline execution flow, human gates, and error handling
- [Scripts](scripts.md) — CLI reference including `migrate-to-v5.js` and all flags
