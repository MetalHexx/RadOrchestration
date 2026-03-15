---
project: "RAINBOW-HELLO"
type: "error-log"
created: "2026-03-15"
last_updated: "2026-03-15"
entry_count: 3
---

# RAINBOW-HELLO — Error Log

## Error 1: plan_approved missing doc_path context

| Field | Value |
|-------|-------|
| **Entry** | 1 |
| **Timestamp** | 2026-03-15T05:36:00Z |
| **Pipeline Event** | `plan_approved` |
| **Pipeline Action** | `N/A` |
| **Severity** | `medium` |
| **Phase** | N/A |
| **Task** | N/A |

### Symptom

Pipeline returned `success: false` with error "Document not found at 'undefined'" when `plan_approved` event was signaled without a `doc_path` context field pointing to the master plan document.

### Pipeline Output

```json
{
  "success": false,
  "action": null,
  "context": {
    "error": "Document not found at 'undefined'",
    "event": "plan_approved"
  },
  "mutations_applied": []
}
```

### Root Cause

The `plan_approved` pre-read handler (`pre-reads.js#handlePlanApproved`) requires `context.doc_path` to read `total_phases` from the master plan frontmatter. The Orchestrator action routing table (action #13 `request_plan_approval`) does not document that `plan_approved` needs a `doc_path` context payload. The event signaling reference table shows `plan_approved` with `{}` empty context, but the pipeline implementation expects `{ "doc_path": "<master-plan-path>" }`.

### Workaround Applied

Re-signaling `plan_approved` with `{ "doc_path": ".github/projects/RAINBOW-HELLO/RAINBOW-HELLO-MASTER-PLAN.md" }` in context.

---

## Error 2: CWD drift after Coder agent execution breaks pipeline calls

| Field | Value |
|-------|-------|
| **Entry** | 2 |
| **Timestamp** | 2026-03-15T05:42:00Z |
| **Pipeline Event** | `task_completed` / `code_review_completed` |
| **Pipeline Action** | `N/A` |
| **Severity** | `medium` |
| **Phase** | 0 |
| **Task** | 0 |

### Symptom

After the Coder agent finished executing P01-T01, the shared terminal's working directory had shifted from the workspace root (`c:\dev\orchestration\v3`) to the target app directory (`c:\dev\orchestration\v3\sample-apps\rainbow-hello`). Subsequent pipeline.js calls failed with `MODULE_NOT_FOUND` because Node resolved the relative path `.github/orchestration/scripts/pipeline.js` from the wrong CWD. This happened twice — once after `task_completed` and once after `code_review_completed`.

### Pipeline Output

```json
{
  "error": "Cannot find module 'C:\\dev\\orchestration\\v3\\sample-apps\\rainbow-hello\\.github\\orchestration\\scripts\\pipeline.js'",
  "code": "MODULE_NOT_FOUND"
}
```

### Root Cause

The Coder agent runs terminal commands (e.g., `npm install`, `node --test`) inside the target app directory and does not restore the CWD to the workspace root before returning. The Orchestrator's pipeline calls use a relative path to `pipeline.js`, so they break when the CWD is no longer the workspace root.

### Workaround Applied

Prefixed subsequent pipeline calls with `cd c:\dev\orchestration\v3;` to force CWD back to workspace root before executing the pipeline script.

### Recommended Fix

Two complementary improvements should be considered:

1. **Orchestrator agent instructions**: Add a rule to always use an absolute path or always `cd` to workspace root before calling `pipeline.js`. Example: `cd $WORKSPACE_ROOT; node .github/orchestration/scripts/pipeline.js ...`
2. **Coder agent / skill instructions**: Add a post-task instruction to restore CWD to workspace root (e.g., `Push-Location`/`Pop-Location` pattern or explicit `cd` back) before the agent returns control.
3. **Pipeline script**: Consider making the script resolve paths relative to its own `__dirname` rather than relying on process CWD.

---


## Error 3: Orchestrator paused unnecessarily to ask human for confirmation to continue

| Field | Value |
|-------|-------|
| **Entry** | 3 |
| **Timestamp** | 2026-03-15T05:45:00Z |
| **Pipeline Event** | N/A |
| **Pipeline Action** | `create_task_handoff` |
| **Severity** | `low` |
| **Phase** | 0 |
| **Task** | 1 |

### Symptom

After logging Error 2 (CWD drift), the Orchestrator asked the human "Want me to continue the pipeline execution now?" instead of proceeding automatically. The human had explicitly instructed auto-approval and uninterrupted execution at project start. The Orchestrator should never pause the event loop to ask permission to continue unless the pipeline returns a human gate action (`request_plan_approval`, `request_final_approval`, `gate_task`, `gate_phase`) or a terminal action (`display_halted`, `display_complete`).

### Pipeline Output

```json
N/A — this was an Orchestrator behavioral issue, not a pipeline script error.
```

### Root Cause

The Orchestrator agent instructions do not explicitly state that after logging an error with a successful workaround, the event loop should continue automatically. The error logging workflow (3-step: log → display → halt) says "Halt" for pipeline errors, but Error 2 was a CWD issue with an immediate workaround — not a pipeline `success: false` result. The Orchestrator conflated "completed a side-task (error logging)" with a stopping point, and defaulted to asking the human.

### Recommended Fix

Add a rule to the Orchestrator agent instructions: "After completing any non-terminal side-task (error logging, status reporting), immediately resume the event loop. Never ask 'should I continue?' unless the pipeline explicitly returns a human gate or terminal action. The event loop is continuous — only `display_halted`, `display_complete`, and human gate actions pause it."

---
