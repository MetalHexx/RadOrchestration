---
project: "V3-FIXES"
author: "brainstormer-agent"
created: "2026-03-15T00:00:00Z"
---

# V3-FIXES — Brainstorming

## Problem Space

Two live pipeline runs (RAINBOW-HELLO and UI-MARKDOWN-IMPROVEMENTS) surfaced a cluster of behavioral bugs across the Orchestrator agent and the pipeline mutation engine. One bug caused the Orchestrator to modify a source file mid-run — violating its own constraints and producing a low-confidence fix — while a separate behavioral issue caused the Orchestrator to pause the event loop unnecessarily. These issues erode pipeline reliability and agent trustworthiness and need to be addressed holistically, not just patched.

## Validated Goals

### Goal 1: Holistic review and correct fix for the corrective task flow in `mutations.js`

**Description**: The Orchestrator modified `handleTaskHandoffCreated` in `mutations.js` mid-run to clear stale `report_doc`, `report_status`, `review_doc`, `review_verdict`, and `review_action` from the previous failed attempt when a corrective handoff is issued. This unblocked the pipeline but was a low-confidence, inline fix applied under pressure.

The goal is to:
1. Determine whether the fix is holistically correct — does `task_handoff_created` carry the right semantics for stale-state clearing, or should clearing happen earlier (e.g., at `code_review_completed` when `corrective_task_issued` is decided)?
2. Verify that the clearing logic covers all necessary fields and leaves no residual state that could confuse the resolver
3. Re-write or confirm the fix as a deliberate, reviewed change — not a mid-run patch
4. Ensure full unit test coverage (of the clearing logic itself) and behavioral test coverage (of the corrective flow end-to-end) **after** the correct fix is confirmed

**Rationale**: The fix was applied by the Orchestrator by modifying a pipeline source file — `mutations.js` — which is off-limits. The Orchestrator is allowed to self-heal process and pipeline issues, but it must do so by manipulating `state.json` (clearing, correcting, or re-setting fields) rather than editing source files. Source file changes are unreviewed, untested, and may introduce silent regressions across all future runs.

**Key considerations**:
- The Orchestrator's self-healing hierarchy should be: (1) re-signal the correct event, (2) directly edit `state.json` to correct or clear fields, (3) log and halt — modifying pipeline source files is never acceptable, (4) the error should be logged with a clear message and mutation log entries should reflect the state changes made for transparency
- The clearing point is undecided — this is a key question for the Architect to resolve by analyzing the full corrective flow: `code_review_completed` → `create_task_handoff` → `task_handoff_created` → `execute_task`
- The fix in `mutations.js` may happen to be correct, but it must be reviewed as a clean, deliberate change — not the agent's ad-hoc workaround. If it's a hack, it should be removed and re-implemented at the correct location
- Test coverage should follow the fix, not precede it — don't lock in wrong behavior with tests first
- All unit tests (`mutations.test.js`, `resolver.test.js`, etc.) and behavioral tests (`pipeline-behavioral.test.js`) must be updated to cover every fix made in this project — the existing v3 suite is complete but was written before these issues existed; any code changes must be accompanied by corresponding test changes in the same task

---

### Goal 2: Orchestrator self-healing hierarchy — prefer `state.json` over source edits

**Description**: When the Orchestrator diagnoses a pipeline issue mid-run, it should be allowed to self-heal — but only through sanctioned means. The fix for the corrective task stale-state issue crossed a line by modifying `mutations.js` directly. The goal is to add an explicit self-healing priority order to the Orchestrator agent instructions:

1. **Re-signal** the correct event — always try this first (e.g., re-signal `task_handoff_created` to trigger normal routing)
2. **Edit `state.json` directly** as a last resort — only to clear or null stale fields that are blocking re-signaling; never set new values that haven't been derived from a pipeline result
3. **Log and halt** — if the issue can't be resolved by re-signaling or minimal state correction, log the error and stop

Modifying pipeline source files (`mutations.js`, `pipeline-engine.js`, agent `.md` files, etc.) is never an acceptable self-healing action.

**Rationale**: `state.json` is the Orchestrator's domain — it owns process state. Source files are the developer's domain. Allowing source edits under pressure produces unreviewed, untested code that silently affects all future runs.

**Key considerations**:
- The rule should live in both "What you do NOT do" (hard prohibition) and the Error Handling section (positive hierarchy)
- `state.json` edits should be conservative: only null/clear stale fields, never invent new state values
- The rule should be concise enough to be followed under pressure, not a lengthy treatise

---

### Goal 3: Orchestrator event-loop discipline — when to stop vs. continue

**Description**: After logging an error with a successful workaround (Error 2, CWD drift), the Orchestrator paused to ask "Want me to continue?" instead of resuming the event loop automatically. The agent also lacks a clear rule that it must stop when the pipeline returns `display_halted`.

The goal is to add concise, explicit rules to the Orchestrator agent instructions:
1. **Never pause mid-loop** for non-terminal side-tasks (error logging, status reporting, workaround application) — resume automatically
2. **Always stop** when `result.action` is `display_halted` or `display_complete` — these are the only valid loop-termination points
3. The existing human gates (`request_plan_approval`, `request_final_approval`) are already in the routing table; this goal is specifically about NOT creating additional pause points

**Rationale**: The event loop is continuous by design. Interrupting it for non-terminal events forces the human to re-engage for no reason and risks context loss between turns.

**Key considerations**:
- The rule should go in the "What you do NOT do" section — most visible, least likely to be skipped
- It should be framed as a clear prohibition: never ask "should I continue?" unless the pipeline returned a gate or terminal action (`display_halted`, `display_complete`, `request_plan_approval`, `request_final_approval`, `gate_task`, `gate_phase`)

---

### Goal 4: `plan_approved` context payload mismatch

**Description**: The Event Signaling Reference table documents `plan_approved` with an empty context payload `{}`, but the pipeline pre-read handler (`handlePlanApproved` in `pre-reads.js`) requires `{ "doc_path": "<master-plan-path>" }` to read `total_phases` from the master plan frontmatter. This caused a `success: false` failure in RAINBOW-HELLO Error 1.

The goal is to align the documentation and implementation through a deep review — not a quick doc patch. Either the pre-read handler should be updated to derive the master plan path from `state.planning.steps` (removing the need for `doc_path` entirely), or the event signaling table must be corrected and the mismatch root-caused to prevent similar gaps elsewhere.

**Rationale**: A mismatch between documented and actual context payloads will silently break every new project run at the plan approval gate. A doc-only fix is not sufficient if the pre-read design is itself fragile.

**Key considerations**:
- Needs a holistic review: can the pre-read avoid requiring `doc_path` by reading from state? If so, that's the cleaner fix
- If `doc_path` remains required, Action Routing Table entry #13 (`request_plan_approval`) and the Event Signaling Reference table both need updating
- This is a research-first goal — understand the full pre-read pattern before deciding the fix direction

---

### Goal 5: CWD drift after Coder agent execution breaks pipeline calls

**Description**: The Coder agent runs terminal commands inside the target app directory and does not restore the working directory to the workspace root before returning. Subsequent `pipeline.js` calls by the Orchestrator then fail with `MODULE_NOT_FOUND` because Node resolves the path from the wrong CWD (Error 2, RAINBOW-HELLO).

The primary fix is making `pipeline.js` resolve all paths relative to `__dirname` rather than `process.cwd()` — this is the most robust solution and removes the dependency on CWD entirely. Agent-level mitigations (Orchestrator `cd` prefix, Coder CWD restoration) remain as complementary hardening.

**Rationale**: CWD drift caused two separate pipeline failures in one run. It's a systemic fragility that will recur on any project where the Coder changes directories. The script-level fix is the right primary solution because it doesn't rely on every agent remembering to restore CWD.

**Key considerations**:
- `pipeline.js` should use `path.resolve(__dirname, ...)` for all internal path references
- Orchestrator and Coder agent instructions should still be updated as secondary hardening
- Verify no other scripts in `.github/orchestration/scripts/` have the same CWD dependency

---

## Scope Boundaries

### In Scope
- `mutations.js` corrective flow review, rewrite, and test coverage
- Orchestrator agent instruction updates (event-loop discipline, CWD workaround)
- Event Signaling Reference / pre-read handler alignment for `plan_approved`
- Coder agent instruction update for CWD restoration

### Out of Scope
- New pipeline features or new event types
- Refactoring the pipeline engine or resolver beyond what's needed to fix the above
- Changes to the UI dashboard or any frontend code

## Open Questions

- **Goal 1**: Is `task_handoff_created` the correct clearing point, or should it happen at `code_review_completed`? Requires Architect analysis of the full corrective flow semantics.
- **Goal 4**: Can `handlePlanApproved` in `pre-reads.js` derive the master plan path from `state.planning.steps` instead of requiring `doc_path` in context? Needs code review to determine feasibility.
- **Goal 5**: Are there other scripts in `.github/orchestration/scripts/` that rely on `process.cwd()` and would also need `__dirname`-relative path fixes?

## Summary

Five behavioral issues surfaced across two live runs need to be fixed in the V3 pipeline. The most critical is a low-confidence, agent-applied mutation to `mutations.js` covering the corrective task retry flow — this needs holistic Architect review and test coverage after the correct fix is confirmed. The remaining goals address Orchestrator agent discipline: an explicit self-healing hierarchy (re-signal → state.json → halt, never source edits), event-loop continuity rules, a `plan_approved` payload mismatch requiring deep review, and a systemic CWD drift fix in the pipeline script itself.
