# Configuration

`orchestration.yml` is the single configuration file for the orchestration system. It lives at `.claude/skills/rad-orchestration/config/orchestration.yml` (if you installed Rad Orchestration, your base directory may be .github or whatever you chose during installation.  This configuration houses your project plan storage, pipeline limits, default human-approval gates, and default source-control automation preferences. Sensible defaults ship out of the box — most teams only need to adjust a path or two before running their first project.

## orchestration.yml Reference

Run `/rad-configure-system` to create or update the file interactively, or edit it directly. The dashboard UI (gear icon) also provides a visual editor.  I recommend using the UI for the best configuration experience.  See: [dashboard](dashboard.md) for more info.

### `system`

Declares where orchestration files live relative to the workspace root.

```yaml
system:
  orch_root: ".claude"
```

`orch_root` accepts a folder name relative to the workspace root (e.g., `".github"`, `".agents"`) or an absolute path. Defaults to `".claude"` if omitted.

### `projects`

Controls where project folders are created and how they are named.

```yaml
projects:
  base_path: C:\dev\orchestration-projects
  naming: SCREAMING_CASE  //this is bugged. Everything uses SCREAMING-CASE right now. :)
```

`base_path` accepts a relative path (resolved from the workspace root) or an absolute path — absolute paths are useful when multiple git worktrees share a single project folder. Each project lands in `{base_path}/{PROJECT-NAME}/`. `naming` accepts `SCREAMING_CASE`, `lowercase`, or `numbered`.

### `default_template`

Sets how the process template is chosen when `/rad-plan` runs.

```yaml
default_template: ask
```

Accepts `ask` (prompt the user each time), `default`, or `quick`. See [Process Templates](#process-templates) below.

### `limits`

Scope guards that cap how large a project can grow and how many automatic retries fire before a human is notified.  This is important so your project doesn't end up in a neverending corrective task loop.

```yaml
limits:
  max_phases: 10
  max_tasks_per_phase: 8
  max_retries_per_task: 5
  max_consecutive_review_rejections: 3
```

All four fields are integers. These values are snapshotted into `state.json` at project creation — see [State and Snapshots](#state-and-snapshots) below.

### `human_gates`

Controls where the pipeline pauses for human approval.

```yaml
human_gates:
  after_planning: true
  execution_mode: ask
  after_final_review: true
```

`after_planning` and `after_final_review` are always enforced and cannot be disabled.  You can ask the orchestrator to skip it though. :) `execution_mode` governs approval behavior during task execution:

| Mode | Behavior |
|------|----------|
| `ask` | Pipeline asks the human which mode to use when execution begins |
| `phase` | Human approval required before each phase starts |
| `task` | Human approval required before each task starts |
| `autonomous` | No gates — phases and tasks execute without human approval |

These values are snapshotted into `state.json` at project creation.

### `source_control`

Controls automatic git commits and PR creation.

```yaml
source_control:
  auto_commit: ask
  auto_pr: ask
  provider: github
```

**`auto_commit`** and **`auto_pr`** each accept three modes:

| Mode | Behavior |
|------|----------|
| `always` | Action fires automatically without prompting |
| `ask` | Pipeline asks the human each time before acting |
| `never` | Action is never performed automatically |

`always` is pre-authorized — no per-action prompt fires. `never` means the pipeline skips the action entirely. `ask` is the safe default for teams that want a confirmation step.

`provider` is `github` (the only supported provider).

For when commits and PRs fire, commit format, and failure handling, see [pipeline.md](pipeline.md#source-control).

## Process Templates

The process template (`default` vs `quick`) is selected at `/rad-plan` time, not in `orchestration.yml` — see [pipeline.md](pipeline.md#process-templates).

## State and Snapshots

`state.json` is the resumable record of a project. It lives in the project folder (`{base_path}/{PROJECT-NAME}/state.json`) and tracks project identity, planning-step completion, phase and task progress, review verdicts, and commit references. You do not edit it directly; the pipeline writes it after every action.  If you need to change it for some reason, you can ask an agent to help you.

**Snapshot vs live-read** — when a project is created, the pipeline copies `limits`, `human_gates`, and `source_control` modes out of `orchestration.yml` and locks them into `state.json`. Every subsequent pipeline run reads those settings from the snapshot, not from `orchestration.yml`. This means changing `orchestration.yml` mid-project has no effect on that project — only new projects pick up the new values. Settings that are never snapshotted (`system.orch_root`, `projects.*`, `source_control.provider`) are always read live from `orchestration.yml`.

**`template.yml`** — when a project starts, the selected process template (`default.yml` or `quick.yml`) is copied into the project folder as `template.yml`. All subsequent pipeline reads use the project-local copy. This is the parallel snapshot mechanism for templates: the template in effect when the project was created stays in effect for its entire lifetime, even if the source template changes later.  In theory, you could ask an agent to change the process template if you need to customize it further to suit your needs, this is not officially supported (yet).
