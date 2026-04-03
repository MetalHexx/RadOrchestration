# Configuration

All system behavior is controlled by a single file: `{orch_root}/orchestration.yml`. This page documents every configuration option.

> **Note:** `{orch_root}` is your orchestration root folder — `.github` by default. Set via `system.orch_root` in `orchestration.yml`. See [Orchestration Root](#orchestration-root) below.

## Quick Setup

Run the `/configure-system` prompt in Copilot to create or update the configuration interactively. See the [default configuration](../.github/skills/orchestration/config/orchestration.yml) for a complete annotated example. You can also edit configuration from the dashboard UI (gear icon).

## Reference

### `system`

Core system settings.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `orch_root` | string | `".github"` | Orchestration root folder name or absolute path. All agents, skills, prompts, instructions, and pipeline scripts live under this folder. Accepts a single folder name (relative to workspace root) or an absolute path. |

#### Orchestration Root

The `system.orch_root` setting declares where orchestration system files live. It accepts a single folder name relative to the workspace root, or an absolute path.

| Input | Resolved Root | Notes |
|-------|---------------|-------|
| _(omitted)_ | `.github` | Default — full backward compatibility; no `system` section needed |
| `".github"` | `.github` | Explicit default — same behavior as omitted |
| `".agents"` | `.agents` | VS Code alternate discovery folder |
| `".copilot"` | `.copilot` | VS Code alternate discovery folder |
| `"custom-orch"` | `custom-orch` | Any single folder name is accepted |
| `"/shared/orch"` | `/shared/orch` | Absolute path — used as-is |
| `"C:\\orch"` | `C:\orch` | Windows absolute path — used as-is |

**Validation rules:**
- Must be a non-empty string
- Relative paths: must be a single folder name (no `/` or `\` path separators)
- Absolute paths: accepted as-is via `path.isAbsolute()` — no separator restriction

**Relationship to `projects.base_path`:** The `system.orch_root` setting controls where orchestration system files live (agents, skills, prompts, instructions, scripts, config). It is independent of `projects.base_path`, which controls where project artifacts are stored. Changing `system.orch_root` does NOT move or affect project storage.

**UI bootstrap (`ORCH_ROOT` env var):** The UI dashboard needs to locate `orchestration.yml` before it can read `system.orch_root`. For non-default root deployments, set the `ORCH_ROOT` environment variable to the root folder name before starting the UI. For default `.github` deployments, no environment variable is needed.

### `projects`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `base_path` | string | `".github/projects"` | Directory where project folders are created. Each project gets a subfolder: `{base_path}/{PROJECT-NAME}/` |
| `naming` | string | `"SCREAMING_CASE"` | Naming convention for project folders and files. Options: `SCREAMING_CASE`, `lowercase`, `numbered` |

#### Path Resolution

The `base_path` setting accepts both relative and absolute paths:

- **Relative paths** (e.g., `".github/projects"`) are resolved from the workspace root. This is the default and works for standard single-workspace setups.
- **Absolute paths** (e.g., `"/shared/projects"`) are used as-is. This is useful for **git worktree setups** where multiple worktrees need to share a single project folder outside any individual worktree.

When you change `base_path`, the `applyTo` glob in `{orch_root}/instructions/project-docs.instructions.md` must also be updated to match — otherwise, Copilot's scoped instructions will silently stop applying to project files. You can either:

1. Update `applyTo` manually to `{new_base_path}/**`
2. Run `/configure-system`, which updates it automatically

The [validation tool](internals/validation.md) warns if `applyTo` and `base_path` fall out of sync.

### `limits`

Pipeline scope guards that prevent runaway execution.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `max_phases` | number | `10` | Maximum phases per project |
| `max_tasks_per_phase` | number | `8` | Maximum tasks per phase |
| `max_retries_per_task` | number | `2` | Auto-retries per task before escalation to human |
| `max_consecutive_review_rejections` | number | `3` | Consecutive reviewer rejections before human escalation |

At project initialization, these limits are snapshotted into `state.json` under `state.config.limits`. The pipeline engine and State Transition Validator read limit values from this snapshot first, falling back to `orchestration.yml` only when the snapshot is absent. This protects running projects from limit changes to `orchestration.yml` mid-execution.


### `human_gates`

Human approval checkpoints during pipeline execution.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `after_planning` | boolean | `true` | Gate after Master Plan completion. **Always enforced** — cannot be set to `false`. |
| `execution_mode` | string | `"ask"` | Gate behavior during execution. See below. |
| `after_final_review` | boolean | `true` | Gate after final review. **Always enforced** — cannot be set to `false`. |

#### Execution Modes

| Mode | Behavior |
|------|----------|
| `ask` | Prompt the human for their preferred gate level. When the pipeline encounters a gate and no mode has been resolved, it returns the [`ask_gate_mode`](internals/scripts.md#gate-actions-3) action, and the Orchestrator asks the human which mode to use for the remainder of execution. |
| `phase` | Require human approval before each phase begins |
| `task` | Require human approval before each task begins |
| `autonomous` | No gates during execution — all phases and tasks run without human approval |

### `source_control`

Source control automation settings. See [Source Control Automation](source-control.md) for full feature documentation.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `auto_commit` | string | `"ask"` | Controls automatic git commit after task approval. Values: `always` \| `ask` \| `never` |
| `auto_pr` | string | `"ask"` | Controls automatic PR creation on final approval. Values: `always` \| `ask` \| `never` |
| `provider` | string | `"github"` | Git hosting provider. Only GitHub is supported. |

## Configuration at Runtime

### Snapshot-on-Init for Limits and Human Gates

At project initialization, limits and human gates are snapshotted into state. Running projects are protected from config changes — only new projects pick up changed values. The pipeline reads snapshotted values first, falling back to `orchestration.yml` only when the snapshot is absent.

### Source Control Settings

`source_control` settings (`auto_commit`, `auto_pr`, `remote_url`, etc.) are captured separately into `pipeline.source_control` during source control initialization. They are not part of `state.config`.

### Structural Settings Are Never Snapshotted

`system.orch_root` and `projects.*` are structural settings used to locate files. They are never snapshotted into `state.json` and are always read directly from `orchestration.yml`.

### Gate Mode Resolution

Gate mode is resolved in priority order: (1) explicit operator override set during execution, (2) the snapshotted `execution_mode` from project initialization, (3) the global `orchestration.yml` default.

## Changing Configuration

Changes to `orchestration.yml` limits and human gates only affect **new** projects — existing projects read from the snapshot captured at initialization. Structural settings (`system.orch_root`, `projects.*`) are always read directly from `orchestration.yml`.

If you change `projects.base_path`, run `/configure-system` — it automatically scans the `{orch_root}/` directory for hardcoded path references and updates them. It also updates the `applyTo` glob in `{orch_root}/instructions/project-docs.instructions.md` to match the new path. If you skip this step, run the [validation tool](internals/validation.md) — it warns if `applyTo` and `base_path` are out of sync.

## Validation

Run the [validation tool](internals/validation.md) to check your configuration for missing keys, type errors, and value range issues.

## Next Steps

- [Validation](internals/validation.md) — Run the validator to check your configuration
- [Scripts](internals/scripts.md) — Pipeline scripts reference: actions, events, and CLI interface
