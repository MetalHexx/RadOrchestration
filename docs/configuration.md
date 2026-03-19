# Configuration

All system behavior is controlled by a single file: `.github/orchestration.yml`. This page documents every configuration option.

## Quick Setup

Run the `/configure-system` prompt in Copilot to create or update the configuration interactively. Or create the file manually:

```yaml
# .github/orchestration.yml
version: "1.0"

projects:
  base_path: ".github/projects"
  naming: "SCREAMING_CASE"

limits:
  max_phases: 10
  max_tasks_per_phase: 8
  max_retries_per_task: 2
  max_consecutive_review_rejections: 3

errors:
  severity:
    critical:
      - "build_failure"
      - "security_vulnerability"
      - "architectural_violation"
      - "data_loss_risk"
    minor:
      - "test_failure"
      - "lint_error"
      - "review_suggestion"
      - "missing_test_coverage"
      - "style_violation"
  on_critical: "halt"
  on_minor: "retry"

git:
  strategy: "single_branch"
  branch_prefix: "orch/"
  commit_prefix: "[orch]"
  auto_commit: true

human_gates:
  after_planning: true
  execution_mode: "ask"
  after_final_review: true
```

## Reference

### `projects`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `base_path` | string | `".github/projects"` | Directory where project folders are created. Each project gets a subfolder: `{base_path}/{PROJECT-NAME}/` |
| `naming` | string | `"SCREAMING_CASE"` | Naming convention for project folders and files. Options: `SCREAMING_CASE`, `lowercase`, `numbered` |

#### Path Resolution

The `base_path` setting accepts both relative and absolute paths:

- **Relative paths** (e.g., `".github/projects"`) are resolved from the workspace root. This is the default and works for standard single-workspace setups.
- **Absolute paths** (e.g., `"/shared/projects"`) are used as-is. This is useful for **git worktree setups** where multiple worktrees need to share a single project folder outside any individual worktree.

When you change `base_path`, the `applyTo` glob in `.github/instructions/project-docs.instructions.md` must also be updated to match — otherwise, Copilot's scoped instructions will silently stop applying to project files. You can either:

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

### `errors`

Error classification determines the pipeline's automatic response.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `severity.critical` | string[] | See above | Error types that halt the pipeline and require human intervention |
| `severity.minor` | string[] | See above | Error types that trigger automatic retry via corrective task |
| `on_critical` | string | `"halt"` | Response to critical errors. Options: `halt`, `report_and_continue` |
| `on_minor` | string | `"retry"` | Response to minor errors. Options: `retry`, `halt`, `skip` |

### `git`

Git strategy for orchestration branches and commits.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `strategy` | string | `"single_branch"` | Branching strategy. Options: `single_branch`, `branch_per_phase`, `branch_per_task` |
| `branch_prefix` | string | `"orch/"` | Prefix for orchestration branches |
| `commit_prefix` | string | `"[orch]"` | Prefix for commit messages |
| `auto_commit` | boolean | `true` | Whether agents commit after task completion |

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
| `ask` | Prompt the human at execution start for their preferred oversight level |
| `phase` | Require human approval before each phase begins |
| `task` | Require human approval before each task begins |
| `autonomous` | No gates during execution — all phases and tasks run without human approval |

## Configuration at Runtime

The pipeline engine reads limits and human gate settings directly from `orchestration.yml` at runtime. These values are not copied into `state.json` at project initialization — `state.json` holds only pipeline state, not configuration. This means changes to `orchestration.yml` limits take effect for all projects on the next pipeline invocation.

The initial `state.json` shape for a new project is:

```json
{
  "$schema": "orchestration-state-v4",
  "project": {
    "name": "PROJECT-NAME",
    "created": "2026-03-15T00:00:00.000Z",
    "updated": "2026-03-15T00:00:00.000Z"
  },
  "pipeline": {
    "current_tier": "planning"
  },
  "planning": {
    "status": "not_started",
    "human_approved": false,
    "steps": [
      { "name": "research", "status": "not_started", "doc_path": null },
      { "name": "prd", "status": "not_started", "doc_path": null },
      { "name": "design", "status": "not_started", "doc_path": null },
      { "name": "architecture", "status": "not_started", "doc_path": null },
      { "name": "master_plan", "status": "not_started", "doc_path": null }
    ]
  },
  "execution": {
    "status": "not_started",
    "current_phase": 0,
    "phases": []
  },
  "final_review": {
    "status": "not_started",
    "doc_path": null,
    "human_approved": false
  }
}
```

## Changing Configuration

Changes to `orchestration.yml` affect all projects on the next pipeline invocation, since limits are read at runtime rather than copied into `state.json`.

If you change `projects.base_path`, run `/configure-system` — it automatically scans the `.github/` directory for hardcoded path references and updates them. It also updates the `applyTo` glob in `.github/instructions/project-docs.instructions.md` to match the new path. If you skip this step, run the [validation tool](validation.md) — it warns if `applyTo` and `base_path` are out of sync.

## Validation

Run the [validation tool](validation.md) to check your configuration:

```bash
node .github/skills/validate-orchestration/scripts/validate-orchestration.js --category config
```

This checks:
- `orchestration.yml` exists and is valid YAML
- All required keys are present with correct types
- Values are within allowed ranges
- Error severity categories are valid
