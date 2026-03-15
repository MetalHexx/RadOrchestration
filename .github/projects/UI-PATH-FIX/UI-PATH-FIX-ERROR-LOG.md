---
project: "UI-PATH-FIX"
type: "error-log"
created: "2026-03-14T12:45:00Z"
last_updated: "2026-03-14T13:00:00Z"
entry_count: 2
---

# UI-PATH-FIX — Error Log

## Error 1: Triage engine crash on project-relative path after T02 normalization

| Field | Value |
|-------|-------|
| **Entry** | 1 |
| **Timestamp** | 2026-03-14T12:45:00Z |
| **Pipeline Event** | `task_completed` |
| **Pipeline Action** | N/A (uncaught exception) |
| **Severity** | `critical` |
| **Phase** | 0 |
| **Task** | 1 |

### Symptom

Signaling `task_completed` for T02 with workspace-relative `report_path` causes an uncaught `Document not found` error. The error path shown is the normalized (project-relative) form `tasks/UI-PATH-FIX-TASK-P01-T02-PATH-NORMALIZATION-REPORT.md`, indicating the triage engine attempted to read the stored project-relative path using `readDocument()` which resolves from CWD (workspace root). The pipeline process exits with code 1 via the catch-all handler in `pipeline.js`.

### Pipeline Output

```json
{
  "error": "[ERROR] pipeline: Document not found: tasks/UI-PATH-FIX-TASK-P01-T02-PATH-NORMALIZATION-REPORT.md",
  "exit_code": 1
}
```

### Root Cause

T02 added `normalizeContextPaths()` in `pipeline-engine.js` which strips workspace-relative prefixes from `context.*_path` fields before mutations store them in `state.json`. This correctly produces project-relative paths in state. However, the triage engine was not updated — it reads `task.report_doc`, `task.review_doc`, and `phase.phase_review` from state and passes them directly to `readDocument()`, which checks file existence relative to CWD (workspace root). Project-relative paths like `tasks/FILE.md` don't exist at the workspace root — they exist at `.github/projects/PROJECT/tasks/FILE.md`.

The architecture and research documents both marked `triage-engine.js` as "Unchanged" and PRD Risk 4 incorrectly stated "pipeline reads state but does not consume stored doc paths." This was a gap in the research — the triage engine IS a consumer of stored doc paths.

Additionally, the `plan_approved` pre-read in `pipeline-engine.js` reads `state.planning.steps.master_plan.output` using `readDocument()`. For future projects where planning step paths are normalized by T02, this will also fail.

**Affected consumers of stored paths in state.json:**
1. Triage task-level: `readDocument(task.report_doc)`, `readDocument(task.review_doc)`
2. Triage phase-level: `readDocument(phase.phase_review)`
3. `plan_approved` pre-read: `readDocument(state.planning.steps.master_plan.output)`

### Workaround Applied

None — blocks pipeline progression for T02 task_completed event. Requires a fix within the UI-PATH-FIX project to wrap `readDocument` calls with project-relative path resolution.

---

## Error 2: V13 timestamp race causes stuck state after triage + advance_task

| Field | Value |
|-------|-------|
| **Entry** | 2 |
| **Timestamp** | 2026-03-14T13:00:00Z |
| **Pipeline Event** | `task_completed` |
| **Pipeline Action** | `advance_task` (internal) |
| **Severity** | `critical` |
| **Phase** | 0 |
| **Task** | 1 |

### Symptom

After the triage path regression was fixed (Error 1), signaling `task_completed` for T02 succeeded through triage but failed during the internal `advance_task` action with: `Validation failed after advance_task: [V13] project.updated ('2026-03-14T06:46:10.510Z') is not newer than current ('2026-03-14T06:46:10.510Z')`. The triage path had already written state (T02 marked complete with verdict=approved), but the internal action loop's `advance_task` generated the same millisecond timestamp, causing V13 to reject the write. Result: T02 is complete but `current_task` was not advanced from 1 to 2, leaving the pipeline stuck.

### Pipeline Output

```json
{
  "success": false,
  "error": "Validation failed after advance_task: [V13] project.updated ('2026-03-14T06:46:10.510Z') is not newer than current ('2026-03-14T06:46:10.510Z')",
  "event": "task_completed",
  "state_snapshot": {
    "current_phase": 0
  },
  "mutations_applied": [
    "task.report_doc → tasks/UI-PATH-FIX-TASK-P01-T02-PATH-NORMALIZATION-REPORT.md",
    "task[P0T1].status → complete (auto-approved: clean report, no triage action)",
    "task[P0T1].review_verdict → approved",
    "task[P0T1].review_action → advanced",
    "task[P0T1].triage_attempts → 0",
    "execution.triage_attempts → 0",
    "phase.current_task → 2"
  ],
  "validation_passed": false
}
```

### Root Cause

The internal action loop in `pipeline-engine.js` sets a new timestamp via `proposedState.project.updated = new Date().toISOString()` for each iteration. V13 requires `project.updated` to be strictly newer than the previous snapshot. When the triage write and the advance_task timestamp generation happen within the same millisecond (common on fast machines), the ISO strings are identical and V13 rejects.

The triage path writes state BEFORE the internal action loop, so the state on disk already has the triage timestamp. The internal loop then clones this state as `preAdvanceState`, generates a new timestamp that matches, and V13 fails. The advance mutation is lost despite triage having succeeded.

### Workaround Applied

1. Fixed `pipeline-engine.js` internal action loop to ensure the advance timestamp is always at least 1ms newer than the snapshot: `if (advanceTs <= prevTs) advanceTs = prevTs + 1`
2. Manually fixed `state.json` to advance `current_task` from 1 to 2

---
