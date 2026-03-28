# PR Operations — AUTO-PR Stub

> **This reference is reserved for the AUTO-PR project.**
> PR creation functionality has not yet been implemented. This file is a scaffold that will be populated when the AUTO-PR project is delivered.

---

## Current Status

PR mode is **not available**. The Source Control Agent may be invoked in PR mode (via `invoke_source_control_pr`), but no PR creation logic exists in this skill yet. All PR requests must return the stub result below and gracefully continue the pipeline.

---

## Agent Instructions — PR Mode

When the Source Control Agent is operating in PR mode, follow these steps **exactly**:

### Step 1: Return the Stub Result

Return this structured JSON result — all 5 fields are required, in this exact shape:

```json
{
  "committed": false,
  "pushed": false,
  "pr_created": false,
  "error": "pr_mode_not_implemented",
  "message": "AUTO-PR not yet delivered"
}
```

### Step 2: Log the Error

Invoke the `log-error` skill with the following parameters:

- **Severity**: `"minor"`
- **Source**: `"source-control-agent"`
- **Message**: `"PR mode invoked but AUTO-PR not yet delivered. Returning stub result."`

This is a **minor** severity because the stub is an expected, non-breaking response — the pipeline will continue normally.

### Step 3: Signal the Pipeline Event

After returning the stub result and logging, signal `task_committed` to advance the pipeline. **Never leave the pipeline stalled** — always signal `task_committed` regardless of mode.

Provide the stub result JSON as the event context so the pipeline has visibility into what happened.

---

## What AUTO-PR Will Populate

When the AUTO-PR project is delivered, this file will be replaced with full PR creation documentation covering:

- **PR creation workflow** — branch validation, title/body construction, label assignment
- **`gh` CLI usage** — `gh pr create` invocation, authentication prerequisites, error handling
- **PR template integration** — mapping task context to PR template fields
- **Base branch resolution** — reading `base_branch` from `pipeline.source_control` state
- **Draft vs. ready PR** — configuration-driven PR status on creation
- **Duplicate PR detection** — checking for existing open PRs on the same branch
- **PR result shape** — the full structured JSON with `pr_url`, `pr_number`, and status fields

Until then, this file serves only as a routing target to ensure the skill's routing table resolves without error.
