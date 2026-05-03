# Pipeline Scripts

`pipeline.js` is the single entry point for all deterministic pipeline operations: routing, mutation, and validation. The same `state.json` always produces the same next action — the script encodes routing decisions as tested, deterministic code so LLM agents never re-derive them from natural language.

> `pipeline.js` is called by the Orchestrator agent during pipeline execution. Users do not run it directly.

> **Note:** Commands below use `.claude` as the default orchestration root. If you've [configured a custom root](../configuration.md), adjust paths accordingly.

---

## CLI Interface

### pipeline.js

```bash
# Default .claude root shown. Adjust if you configured a custom orch_root.
node .claude/skills/rad-orchestration/scripts/pipeline.js \
  --event <event_name> \
  --project-dir <path> \
  [--config <path>] \
  [--doc-path <path>] \
  [--branch <name>] [--base-branch <name>] [--worktree-path <path>] \
  [--auto-commit <always|never>] [--auto-pr <always|never>] \
  [--gate-type <type>] [--reason <text>] \
  [--gate-mode <mode>] \
  [--commit-hash <hash>] [--pushed <true|false>] \
  [--verdict <verdict>] [--phase <N>] [--task <N>] \
  [--pr-url <url>] [--remote-url <url>] [--compare-url <url>] \
  [--template <name>] [--parse-error <json>]
```

**Required flags:**

| Flag | Description |
|------|-------------|
| `--event <name>` | Pipeline event to signal |
| `--project-dir <path>` | Path to the project directory |

**Optional flags:**

| Flag | Description |
|------|-------------|
| `--config <path>` | Path to orchestration config file |

**Context flags (all optional at parse level):**

| Flag | Context Key | Used By |
|------|-------------|---------|
| `--doc-path <path>` | `doc_path` | Document-completion events |
| `--branch <name>` | `branch` | `source_control_init` |
| `--base-branch <name>` | `base_branch` | `source_control_init` |
| `--worktree-path <path>` | `worktree_path` | `source_control_init` |
| `--auto-commit <always|never>` | `auto_commit` | `source_control_init` |
| `--auto-pr <always|never>` | `auto_pr` | `source_control_init` |
| `--gate-type <type>` | `gate_type` | `gate_rejected` |
| `--reason <text>` | `reason` | `gate_rejected`, `halt` |
| `--gate-mode <mode>` | `gate_mode` | `gate_mode_set` |
| `--commit-hash <hash>` | `commit_hash` | `commit_completed` |
| `--pushed <true|false>` | `pushed` | `commit_completed` |
| `--phase <N>` | `phase` | `commit_started`, `commit_completed` |
| `--task <N>` | `task` | `commit_started`, `commit_completed` |
| `--verdict <verdict>` | `verdict` | `code_review_completed`, `phase_review_completed`, `final_review_completed` |
| `--pr-url <url>` | `pr_url` | `pr_created` |
| `--remote-url <url>` | `remote_url` | `source_control_init` |
| `--compare-url <url>` | `compare_url` | `source_control_init` |
| `--template <name>` | `template` | `start` |
| `--parse-error <json>` | `parse_error` | `explosion_failed` |

### migrate-to-v5.ts

```bash
# Default .claude root shown. Adjust if you configured a custom orch_root.
npx tsx .claude/skills/rad-orchestration/scripts/migrate-to-v5.ts --project-dir <project-dir>
```

| Flag | Required | Description |
|----------|----------|-------------|
| `--project-dir <path>` | Yes | Absolute path to project directory containing `state.json` |
| `--dry-run` | No | Preview the migration without writing changes |

Migrates a project's `state.json` from an older schema version (v1–v4) to v5 format and validates the result against the v5 JSON Schema.

---

## Event Vocabulary

The pipeline accepts 30 events. Each maps to a mutation handler in the `MUTATIONS` lookup table.

| # | Event | Tier | Description |
|---|-------|------|-------------|
| 1 | `start` | Any | Initialize or resume the pipeline; scaffolds `state.json` when absent, otherwise re-walks the DAG |
| 2 | `requirements_started` | Planning | Requirements step begun; sets `requirements.status` → in_progress |
| 3 | `requirements_completed` | Planning | Requirements doc saved; sets `requirements.status` → completed, `requirements.doc_path` |
| 4 | `master_plan_started` | Planning | Master plan step begun; sets `master_plan.status` → in_progress |
| 5 | `master_plan_completed` | Planning | Master plan saved; sets `master_plan.status` → completed, `master_plan.doc_path` |
| 6 | `explosion_started` | Planning | Explosion step begun; sets `explode_master_plan.status` → in_progress |
| 7 | `explosion_completed` | Planning | Explosion succeeded; sets `explode_master_plan.status` → completed, clears `master_plan.last_parse_error` |
| 8 | `explosion_failed` | Planning | Explosion parse failure; increments `master_plan.parse_retry_count`; halts pipeline if cap exceeded |
| 9 | `plan_approved` | Planning | Human approved; sets `plan_approval_gate.status` → completed, transitions `pipeline.current_tier` → execution |
| 10 | `plan_rejected` | Planning | Human rejected master plan; resets `master_plan.status` → not_started for revision |
| 11 | `execution_started` | Execution | Coder execution begun; sets `task_executor.status` → in_progress |
| 12 | `task_completed` | Execution | Coder finished; sets `task_executor.status` → completed |
| 13 | `code_review_started` | Execution | Code review begun; sets `code_review.status` → in_progress |
| 14 | `code_review_completed` | Execution | Review finished; sets `code_review.doc_path`, `code_review.verdict`; resolves task outcome |
| 15 | `phase_review_started` | Execution | Phase review begun; sets `phase_review.status` → in_progress |
| 16 | `phase_review_completed` | Execution | Phase review finished; sets `phase_review.doc_path`, `phase_review.verdict`; resolves phase outcome |
| 17 | `commit_started` | Execution | Commit begun; sets `commit.status` → in_progress; `--phase` and `--task` auto-resolve from the active in-progress phase/task when omitted |
| 18 | `commit_completed` | Execution | Commit finished; sets `commit.status` → completed, stores `commit_hash`; `--phase` and `--task` auto-resolve when omitted |
| 19 | `pr_requested` | Execution | Signaled internally after `final_review_completed` when `auto_pr: always` and `pr_url` is unset |
| 20 | `pr_created` | Execution | PR created; sets `pipeline.source_control.pr_url` from `--pr-url` flag |
| 21 | `source_control_init` | Execution | One-time initialization; persists branch, base_branch, worktree_path, auto_commit, auto_pr to `pipeline.source_control` |
| 22 | `task_gate_approved` | Gate | Human approved task gate; advances task past the gate checkpoint |
| 23 | `phase_gate_approved` | Gate | Human approved phase gate; advances phase past the gate checkpoint |
| 24 | `gate_rejected` | Gate | Human rejected gate; halts task or phase depending on `--gate-type` with `--reason` |
| 25 | `gate_mode_set` | Gate | Operator selected gate mode; sets `pipeline.gate_mode` |
| 26 | `final_review_started` | Review | Final review begun; sets `final_review.status` → in_progress |
| 27 | `final_review_completed` | Review | Final review saved; sets `final_review.doc_path`, `final_review.verdict` |
| 28 | `final_approved` | Review | Human approved final review; sets `final_approval_gate.status` → completed |
| 29 | `final_rejected` | Review | Human rejected final review; resets `final_review` and `final_approval_gate` for revision |
| 30 | `halt` | Any | Halt the pipeline with a reason; sets `graph.status` → halted, `pipeline.halt_reason` |

---

## Action Vocabulary

The resolver is a pure function that returns one of 16 values based solely on the current `state.json` and config. All actions are returned to the Orchestrator for agent routing — the script performs no agent spawning itself.

### Planning Tier (4)

| Action | Meaning |
|--------|---------|
| `spawn_requirements` | Spawn Requirements agent |
| `spawn_master_plan` | Spawn Architect for master plan |
| `explode_master_plan` | Run explosion script to generate phases and tasks from the master plan |
| `request_plan_approval` | Planning complete — request human approval |

### Execution Tier — Task Lifecycle (2)

| Action | Meaning |
|--------|---------|
| `execute_task` | Task has handoff, ready to execute |
| `spawn_code_reviewer` | Task needs code review |

### Execution Tier — Phase Lifecycle (1)

| Action | Meaning |
|--------|---------|
| `spawn_phase_reviewer` | Phase needs review |

### Gate Actions (3)

| Action | Meaning |
|--------|---------|
| `gate_task` | Task gate — request human approval |
| `gate_phase` | Phase gate — request human approval |
| `ask_gate_mode` | Gate mode is `"ask"` and execution mode has not been resolved for this gate — prompt the Orchestrator to ask the human which gate mode to use |

### Review Tier (2)

| Action | Meaning |
|--------|---------|
| `spawn_final_reviewer` | Spawn final comprehensive review |
| `request_final_approval` | Final review complete — request human approval |

### Terminal (2)

| Action | Meaning |
|--------|---------|
| `display_halted` | Project is halted — display status |
| `display_complete` | Project is complete — display status |

### Source Control (2)

| Action | Meaning |
|--------|---------|
| `invoke_source_control_commit` | Spawn Source Control Agent in commit mode |
| `invoke_source_control_pr` | Spawn Source Control Agent in PR mode |

---

## Result Shapes

### Success

```json
{
  "success": true,
  "action": "execute_task",
  "context": {
    "tier": "execution",
    "phase_index": 1,
    "task_index": 3,
    "phase_id": "P01",
    "task_id": "P01-T03",
    "reason": "Task P01-T03 has handoff but stage is coding"
  },
  "mutations_applied": [
    "task.status → in_progress",
    "task.stage → coding"
  ],
  "orchRoot": ".claude"
}
```

### Error

```json
{
  "success": false,
  "action": null,
  "context": {
    "error": "Validation failed: [V6] Only one task may be in_progress"
  },
  "mutations_applied": [],
  "orchRoot": ".claude",
  "error": {
    "message": "Validation failed: [V6] Only one task may be in_progress",
    "event": "task_completed"
  }
}
```


---

## Next Steps

- [Pipeline](../pipeline.md) — Understand the pipeline stages and flow diagrams
- [Configuration](../configuration.md) — Configure pipeline settings and human gates
- [Validation](validation.md) — Run the validator and interpret results
