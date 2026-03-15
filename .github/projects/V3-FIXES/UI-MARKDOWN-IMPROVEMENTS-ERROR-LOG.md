---
project: "UI-MARKDOWN-IMPROVEMENTS"
type: "error-log"
created: "2026-03-15T00:00:00Z"
last_updated: "2026-03-15T00:00:00Z"
entry_count: 1
---

# UI-MARKDOWN-IMPROVEMENTS — Error Log

## Error 1: Corrective Task Handoff Leaves Stale report_doc/review_doc — Resolver Halts

| Field | Value |
|-------|-------|
| **Entry** | 1 |
| **Timestamp** | 2026-03-15T00:00:00Z |
| **Pipeline Event** | `task_handoff_created` |
| **Pipeline Action** | `display_halted` |
| **Severity** | critical |
| **Phase** | 0 |
| **Task** | 1 |

### Symptom

After a code review returned `changes_requested` for P01-T02, a corrective task handoff was created and `task_handoff_created` was re-signaled. The pipeline halted with an "Unresolvable task state" error. The resolver saw `status=in_progress`, `handoff_doc` set, `report_doc` set, and `review_doc` set simultaneously — a combination that had no defined resolution path.

### Pipeline Output

```json
{
  "success": false,
  "error": "Unresolvable task state: status=in_progress with handoff, report, and review all set",
  "event": "task_handoff_created",
  "action": "display_halted",
  "state_snapshot": { "current_phase": 0, "current_task": 1 },
  "mutations_applied": ["Set task.handoff_doc", "Set task.status to \"in_progress\""],
  "validation_passed": false
}
```

### Root Cause

`handleTaskHandoffCreated` in `.github/orchestration/scripts/lib/mutations.js` only sets `task.handoff_doc` and `task.status = "in_progress"` when a corrective handoff is created. It does not clear `report_doc`, `report_status`, `review_doc`, `review_verdict`, or `review_action` from the previous failed attempt. The resolver's task-state decision tree has no branch for this combination, causing a systemic halt on ALL corrective task flows.

### Workaround Applied

Modified `handleTaskHandoffCreated` in `mutations.js` to detect when `is_correction` is true and explicitly null out `report_doc`, `report_status`, `review_doc`, `review_verdict`, and `review_action` with mutation log entries. Re-signaled `task_handoff_created` which cleared the stale fields and successfully routed to `execute_task`.

---
