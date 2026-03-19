# Pipeline Scripts

The orchestration system uses a single unified pipeline script (`pipeline.js`) for all deterministic pipeline operations: routing, mutation, and validation. Without these scripts, LLM agents must re-derive routing decisions from natural language on every invocation — producing inconsistent results for identical inputs. The script encodes these decisions as tested, deterministic code, so the same `state.json` always produces the same next action. LLMs still handle all judgment-requiring work (coding, reviewing, designing); scripts handle mechanical consistency.

> `pipeline.js` is called by the Orchestrator agent during pipeline execution. It is not intended for manual use — users do not need to run it directly.

---

## CLI Interface

### pipeline.js

```bash
node .github/orchestration/scripts/pipeline.js \
  --event <event_name> \
  --project-dir <path> \
  [--config <path>] \
  [--context '<json>']
```

| Flag | Required | Description |
|------|----------|-------------|
| `--event` | Yes | One of the 17 pipeline events |
| `--project-dir` | Yes | Absolute path to the project directory containing `state.json` |
| `--config` | No | Path to `orchestration.yml`; built-in defaults used if omitted |
| `--context` | No | JSON string with event-specific context (e.g., `doc_path`, `verdict`) |

### migrate-to-v4.js

```bash
node .github/orchestration/scripts/migrate-to-v4.js <project-dir>
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<project-dir>` | Yes | Absolute path to project directory containing `state.json` |

Migrates a project’s `state.json` from an older schema version (v1–v3) to v4 format. Creates a backup of the original file (e.g., `state.3.json.bak`) before migrating and validates the result against the v4 JSON Schema.

---

## Event Vocabulary

The pipeline accepts exactly 17 events. Each maps to a mutation handler in the `MUTATIONS` lookup table.

| # | Event | Tier | Description |
|---|-------|------|-------------|
| 1 | `research_completed` | Planning | Research finished; sets `planning.steps[0].status` → complete, `planning.steps[0].doc_path` |
| 2 | `prd_completed` | Planning | PRD created; sets `planning.steps[1].status` → complete |
| 3 | `design_completed` | Planning | Design doc created; sets `planning.steps[2].status` → complete |
| 4 | `architecture_completed` | Planning | Architecture created; sets `planning.steps[3].status` → complete |
| 5 | `master_plan_completed` | Planning | Master plan created; sets `planning.steps[4].status` → complete, `planning.status` → complete |
| 6 | `plan_approved` | Planning | Human approved; sets `planning.human_approved`, transitions `pipeline.current_tier` → execution |
| 7 | `phase_plan_created` | Execution | Phase plan saved; sets `phase.docs.phase_plan`, `phase.status` → in_progress, `phase.stage` → executing |
| 8 | `task_handoff_created` | Execution | Task handoff saved; sets `task.docs.handoff`, `task.status` → in_progress, `task.stage` → coding |
| 9 | `task_completed` | Execution | Coder finished; sets `task.docs.report`, `task.stage` → reviewing (`status` stays in_progress) |
| 10 | `code_review_completed` | Execution | Review finished; sets `task.docs.review`, `task.review.verdict`, `task.review.action`; resolves task outcome |
| 11 | `phase_report_created` | Execution | Phase report saved; sets `phase.docs.phase_report`, `phase.stage` → reviewing |
| 12 | `phase_review_completed` | Execution | Phase review finished; sets `phase.docs.phase_review`, `phase.review.verdict`, `phase.review.action`; resolves phase outcome |
| 13 | `task_approved` | Execution | Human approved task gate |
| 14 | `phase_approved` | Execution | Human approved phase gate |
| 15 | `final_review_completed` | Review | Final review saved; sets `final_review.doc_path`, `final_review.status` → complete |
| 16 | `final_approved` | Review | Human approved final review; sets `final_review.human_approved`, transitions `pipeline.current_tier` → complete |
| 17 | `halt` | Any | Halt the pipeline with a reason |

---

## Action Vocabulary

The resolver is a pure function that returns one of 19 values based solely on the current `state.json` and config. All actions are returned to the Orchestrator for agent routing — the script performs no agent spawning itself.

### Planning Tier (6)

| Action | Meaning |
|--------|---------|
| `spawn_research` | Spawn Research agent |
| `spawn_prd` | Spawn Product Manager |
| `spawn_design` | Spawn UX Designer |
| `spawn_architecture` | Spawn Architect for architecture |
| `spawn_master_plan` | Spawn Architect for master plan |
| `request_plan_approval` | Planning complete — request human approval |

### Execution Tier — Task Lifecycle (4)

| Action | Meaning |
|--------|---------|
| `create_phase_plan` | Phase needs a plan |
| `create_task_handoff` | Task needs a handoff document (fresh or corrective, distinguished by `context.is_correction`) |
| `execute_task` | Task has handoff, ready to execute |
| `spawn_code_reviewer` | Task needs code review |

### Execution Tier — Phase Lifecycle (2)

| Action | Meaning |
|--------|---------|
| `generate_phase_report` | All tasks complete — generate phase report |
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
  ]
}
```

### Error

```json
{
  "success": false,
  "error": "Validation failed: [V6] Only one task may be in_progress",
  "event": "task_handoff_created",
  "state_snapshot": { "current_phase": 1 },
  "mutations_applied": []
}
```


---

## Next Steps

- [Pipeline](pipeline.md) — Understand the pipeline stages and flow diagrams
- [Configuration](configuration.md) — Configure pipeline settings and human gates
- [Validation](validation.md) — Run the validator and interpret results
