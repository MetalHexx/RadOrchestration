---
project: "EXECUTE-BEHAVIORAL-TESTS"
type: "error-log"
created: "2026-03-14T21:00:00Z"
last_updated: "2026-03-14T21:00:00Z"
entry_count: 1
---

# EXECUTE-BEHAVIORAL-TESTS — Error Log

## Error 1: code_review_completed triage fails — immutability violation on review_action

| Field | Value |
|-------|-------|
| **Entry** | 1 |
| **Timestamp** | 2026-03-14T21:00:00Z |
| **Pipeline Event** | `code_review_completed` |
| **Pipeline Action** | N/A (triage failure pre-resolution) |
| **Severity** | `critical` |
| **Phase** | 0 |
| **Task** | 0 |

### Symptom

After `code_review_completed` event, triage engine rejects with "Immutability violation: task 0 already has review_verdict='null' or review_action='spawn_code_reviewer'". The `handleCodeReviewCompleted` mutation only sets `review_doc` but does not clear `review_verdict`/`review_action` fields left over from the previous triage cycle, so the immutability guard blocks the next triage run.

### Pipeline Output

```json
{
  "success": false,
  "error": "Triage failed: Immutability violation: task 0 already has review_verdict='null' or review_action='spawn_code_reviewer'",
  "event": "code_review_completed",
  "state_snapshot": {
    "current_phase": 0
  },
  "mutations_applied": [
    "task.review_doc → tasks/EXECUTE-BEHAVIORAL-TESTS-TASK-P01-T01-TRIAGE-FIX-REVIEW.md"
  ],
  "validation_passed": true
}
```

### Root Cause

`handleCodeReviewCompleted` in `mutations.js` (line ~234) only sets `task.review_doc = context.review_path`. It does NOT clear `task.review_verdict` and `task.review_action`, which were set by the previous triage cycle (when triage routed `spawn_code_reviewer`). The triage engine's immutability check requires both fields to be null before it can run again. This issue was never triggered before because the old triage auto-approved clean tasks via the null/null fast-path, so `review_action` was already null at this point.

### Workaround Applied

Fix `handleCodeReviewCompleted` to clear `review_verdict` and `review_action` before triage runs again — same pattern used by `handleTaskHandoffCreated`.

---
