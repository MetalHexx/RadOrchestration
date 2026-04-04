# Configuration

The orchestration system uses two configuration files:

- **`orchestration.yml`** — The global configuration file that controls all system behavior. Lives in your orchestration root folder (`.github/` by default).
- **`state.json`** — A per-project file that tracks project progress and locks in configuration for the lifetime of that project.

Understanding how these two files interact is key to understanding how the system behaves.

## orchestration.yml

This is the single source of truth for system-wide settings. It lives at `{orch_root}/orchestration.yml` (by default `.github/orchestration.yml`). You edit this file to control how the system behaves for all future projects.

Run `/configure-system` in Copilot to create or update it interactively, or edit it directly. The dashboard UI (gear icon) also provides a visual editor.

Here is a complete example:

```yaml
version: "1.0"

# ─── System ──────────────────────────────────────────────
system:
  orch_root: ".github"          # Where orchestration files live

# ─── Project Storage ─────────────────────────────────────
projects:
  base_path: ".github/projects" # Where project folders are created
  naming: "SCREAMING_CASE"      # SCREAMING_CASE | lowercase | numbered

# ─── Pipeline Limits ─────────────────────────────────────
limits:
  max_phases: 10                          # Max phases per project
  max_tasks_per_phase: 8                  # Max tasks per phase
  max_retries_per_task: 2                 # Auto-retries before human escalation
  max_consecutive_review_rejections: 3    # Reviewer rejects before human escalation

# ─── Human Gates ─────────────────────────────────────────
human_gates:
  after_planning: true          # Gate after master plan (always enforced)
  execution_mode: "ask"         # ask | phase | task | autonomous
  after_final_review: true      # Gate after final review (always enforced)

# ─── Source Control ──────────────────────────────────────
source_control:
  auto_commit: "ask"            # always | ask | never
  auto_pr: "ask"                # always | ask | never
  provider: "github"            # GitHub only
```

### What Each Section Controls

**`system`** — Declares where orchestration system files live (agents, skills, prompts, scripts). Accepts a single folder name relative to the workspace root (e.g., `".github"`, `".agents"`) or an absolute path. Defaults to `".github"` if omitted.

**`projects`** — Controls where project folders are created and how they're named. `base_path` accepts relative paths (resolved from workspace root) or absolute paths (useful for git worktree setups where multiple worktrees share a single project folder). Each project gets a subfolder: `{base_path}/{PROJECT-NAME}/`.

**`limits`** — Scope guards that prevent runaway execution. These cap how large a project can grow in terms of phases, tasks, retries, and review cycles.

**`human_gates`** — Controls where the pipeline pauses for human approval. `after_planning` and `after_final_review` are always enforced and cannot be disabled. `execution_mode` determines gate behavior during the execution tier:

| Mode | Behavior |
|------|----------|
| `ask` | Pipeline asks the human which mode to use when execution begins |
| `phase` | Human approval required before each phase starts |
| `task` | Human approval required before each task starts |
| `autonomous` | No gates — phases and tasks execute without human approval |

**`source_control`** — Controls automatic git commits after task approval and automatic PR creation on final approval. See [Source Control](source-control.md) for full details.

## state.json

Every project gets its own `state.json` in its project folder. This file serves two purposes:

1. **Tracks project progress** — current pipeline tier, planning step status, phase/task completion, review verdicts, commit hashes, and document paths.
2. **Locks in configuration** — snapshots key settings from `orchestration.yml` at project creation so that the project runs with consistent rules from start to finish, even if you change the global config later.

Here is a representative example (trimmed for clarity):

```json
{
  "$schema": "orchestration-state-v4",
  "project": {
    "name": "MY-PROJECT",
    "created": "2026-04-01T12:00:00.000Z",
    "updated": "2026-04-02T18:30:00.000Z"
  },
  "config": {
    "limits": {
      "max_phases": 10,
      "max_tasks_per_phase": 8,
      "max_retries_per_task": 2,
      "max_consecutive_review_rejections": 3
    },
    "human_gates": {
      "after_planning": true,
      "execution_mode": "ask",
      "after_final_review": true
    }
  },
  "pipeline": {
    "current_tier": "execution",
    "gate_mode": "autonomous",
    "source_control": {
      "branch": "MY-PROJECT",
      "base_branch": "main",
      "worktree_path": "C:/dev/worktrees/MY-PROJECT",
      "auto_commit": "always",
      "auto_pr": "always",
      "remote_url": "https://github.com/user/repo",
      "compare_url": "https://github.com/user/repo/compare/main...MY-PROJECT"
    }
  },
  "planning": {
    "status": "complete",
    "human_approved": true,
    "steps": [
      { "name": "research",    "status": "complete", "doc_path": "..." },
      { "name": "prd",         "status": "complete", "doc_path": "..." },
      { "name": "design",      "status": "complete", "doc_path": "..." },
      { "name": "architecture", "status": "complete", "doc_path": "..." },
      { "name": "master_plan", "status": "complete", "doc_path": "..." }
    ]
  },
  "execution": {
    "status": "in_progress",
    "current_phase": 1,
    "phases": [
      {
        "name": "Core Implementation",
        "status": "in_progress",
        "stage": "task_execution",
        "current_task": 2,
        "tasks": [
          {
            "name": "Create data model",
            "status": "complete",
            "stage": "complete",
            "docs": {
              "handoff": ".../tasks/MY-PROJECT-TASK-P01-T01-DATA-MODEL.md",
              "review": ".../reports/MY-PROJECT-CODE-REVIEW-P01-T01-DATA-MODEL.md"
            },
            "review": { "verdict": "approved", "action": "advanced" },
            "retries": 0,
            "commit_hash": "a1b2c3d"
          }
        ],
        "docs": {
          "phase_plan": ".../phases/MY-PROJECT-PHASE-01-CORE.md"
        }
      }
    ]
  }
}
```

### How state.json Drives Execution

The pipeline reads `state.json` to determine what happens next at every step. Key behaviors:

- **`pipeline.current_tier`** tells the Orchestrator which stage the project is in: `planning`, `execution`, `review`, or `complete`.
- **`planning.steps`** tracks which planning documents have been produced. The pipeline advances through research → PRD → design → architecture → master plan in sequence.
- **`execution.current_phase`** and each phase's `current_task` tell the pipeline exactly where to resume if interrupted.
- **`review.verdict`** on each task determines whether the pipeline advances to the next task, retries the current one, or escalates to a human.
- **`pipeline.gate_mode`** records the resolved execution mode (e.g., `autonomous`) so it persists across sessions.
- **`pipeline.source_control`** tracks the branch, worktree path, and commit/PR state so the source control agent knows where to operate.

Every time the pipeline takes an action, it updates `state.json`. This makes the file a complete, resumable record of the project.

## How Configuration Flows from orchestration.yml to state.json

When a new project is created, the pipeline snapshots `limits` and `human_gates` from `orchestration.yml` into the project's `state.json` under `config`. From that point forward, the pipeline reads limits and gate settings from the snapshot — not from `orchestration.yml`. This protects running projects from mid-execution config changes.

Source control settings (`auto_commit`, `auto_pr`) follow a similar pattern but are written to `pipeline.source_control` later, when source control is initialized for the project.

Settings that are **never** snapshotted — `system.orch_root`, `projects.base_path`, `projects.naming`, and `source_control.provider` — are always read directly from `orchestration.yml`.

| Setting | Snapshotted? | Location in state.json | When written |
|---------|-------------|----------------------|-------------|
| `limits.*` | Yes | `config.limits` | Project creation |
| `human_gates.*` | Yes | `config.human_gates` | Project creation |
| `auto_commit`, `auto_pr` | Yes | `pipeline.source_control` | Source control init |
| `system.*`, `projects.*`, `provider` | No | — | Always read from orchestration.yml |

**The practical effect:** if you change `max_phases` from 10 to 5 in `orchestration.yml`, projects already in progress keep their original limit of 10. Only new projects pick up the new value.

## Changing Configuration

Edit `orchestration.yml` directly or run `/configure-system` for an interactive experience.

- **Limits and gates** — Changes only affect new projects. Existing projects use their snapshot.
- **Source control** — Changes only affect projects whose source control hasn't been initialized yet.
- **Structural settings** (`orch_root`, `base_path`, `naming`, `provider`) — Take effect immediately for all operations since they're always read from `orchestration.yml`.

If you change `projects.base_path`, run `/configure-system` — it updates path references across the orchestration root automatically. The [validation tool](internals/validation.md) warns if references fall out of sync.

## Validation

Run the [validation tool](internals/validation.md) to check your `orchestration.yml` for missing keys, type errors, and value range issues.

## Next Steps

- [Getting Started](getting-started.md) — Install and run your first project
- [Pipeline](pipeline.md) — How the orchestration pipeline executes projects
- [Validation](internals/validation.md) — Validate your configuration
- [Scripts](internals/scripts.md) — Pipeline scripts reference
