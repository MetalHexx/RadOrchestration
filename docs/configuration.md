# Configuration

All system behavior is controlled by a single file: `{orch_root}/orchestration.yml`. This page documents every configuration option.

> **Note:** `{orch_root}` is your orchestration root folder — `.github` by default. Set via `system.orch_root` in `orchestration.yml`. See [Orchestration Root](#orchestration-root) below.

## Quick Setup

Run the `/configure-system` prompt in Copilot to create or update the configuration interactively. Or create the file manually:

```yaml
# {orch_root}/orchestration.yml
version: "1.0"

# ─── System ────────────────────────────────────────────────────────
system:
  orch_root: ".github"                    # Orchestration root folder (default: .github)

projects:
  base_path: ".github/projects"
  naming: "SCREAMING_CASE"

limits:
  max_phases: 10
  max_tasks_per_phase: 8
  max_retries_per_task: 2
  max_consecutive_review_rejections: 3

human_gates:
  after_planning: true
  execution_mode: "ask"
  after_final_review: true
```

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

**UI bootstrap (`ORCH_ROOT` env var):** The UI dashboard needs to locate `orchestration.yml` before it can read `system.orch_root`. For non-default root deployments, set the `ORCH_ROOT` environment variable to the root folder name:

```bash
ORCH_ROOT=.agents npm run dev
```

For default `.github` deployments, no environment variable is needed.

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

The [validation tool](validation.md) warns if `applyTo` and `base_path` fall out of sync.

### `limits`

Pipeline scope guards that prevent runaway execution.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `max_phases` | number | `10` | Maximum phases per project |
| `max_tasks_per_phase` | number | `8` | Maximum tasks per phase |
| `max_retries_per_task` | number | `2` | Auto-retries per task before escalation to human |
| `max_consecutive_review_rejections` | number | `3` | Consecutive reviewer rejections before human escalation |

These limits are read from `orchestration.yml` at runtime by the pipeline engine — they are not copied into `state.json` at project initialization. The [State Transition Validator](scripts.md) enforces them on every state write by reading from the configuration file directly.


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
| `ask` | Prompt the human for their preferred gate level. When the pipeline encounters a gate and no mode has been resolved, it returns the [`ask_gate_mode`](scripts.md#gate-actions-3) action, and the Orchestrator asks the human which mode to use for the remainder of execution. |
| `phase` | Require human approval before each phase begins |
| `task` | Require human approval before each task begins |
| `autonomous` | No gates during execution — all phases and tasks run without human approval |

## Configuration at Runtime

The pipeline engine reads limits and human gate settings directly from `orchestration.yml` at runtime. These values are not copied into `state.json` at project initialization — `state.json` holds only pipeline state, not configuration. This means changes to `orchestration.yml` limits take effect for all projects on the next pipeline invocation.

See [state-v4.schema.json](../.github/skills/orchestration/schemas/state-v4.schema.json) for the full initial state shape and schema definition.

## Changing Configuration

Changes to `orchestration.yml` affect all projects on the next pipeline invocation, since limits are read at runtime rather than copied into `state.json`.

If you change `projects.base_path`, run `/configure-system` — it automatically scans the `{orch_root}/` directory for hardcoded path references and updates them. It also updates the `applyTo` glob in `{orch_root}/instructions/project-docs.instructions.md` to match the new path. If you skip this step, run the [validation tool](validation.md) — it warns if `applyTo` and `base_path` are out of sync.

## Validation

Run the [validation tool](validation.md) to check your configuration:

```bash
node {orch_root}/skills/orchestration/scripts/validate/validate-orchestration.js --category config
```

This checks:
- `orchestration.yml` exists and is valid YAML
- All required keys are present with correct types
- Values are within allowed ranges
- Error severity categories are valid

## Next Steps

- [Validation](validation.md) — Run the validator to check your configuration
- [Scripts](scripts.md) — Pipeline scripts reference: actions, events, and CLI interface
