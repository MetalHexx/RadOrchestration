---
project: "UI-HUMAN-GATE-CONTROLS"
author: "brainstormer-agent"
created: "2026-03-15"
---

# UI-HUMAN-GATE-CONTROLS — Brainstorming

## Problem Space

Currently, approving a human gate in the pipeline requires the user to go back to the `@Orchestrator` chat and explicitly signal approval through conversation. The dashboard already displays gate status, but it is read-only — there is no way to act on a pending gate from the UI itself. This creates unnecessary friction: the user has context right in front of them (the planning docs, the final review report) and still has to context-switch to a chat interface to do something that amounts to a single yes/no decision.

## Validated Goals

### Goal 1: Approve planning gate from the UI

**Description**: When all planning steps are complete and the post-planning human gate is pending, show an "Approve Plan" button in the Planning Pipeline section. Clicking it (with confirmation) invokes the pipeline engine's `plan_approved` event, which updates `state.json` and advances the pipeline.

**Rationale**: This is the most common gate in the pipeline — every project hits it. Reducing the round-trip to chat for a simple approval is a clear usability win.

**Key considerations**:
- The `plan_approved` pipeline event has a pre-read requirement: it needs `total_phases` from the master plan's frontmatter. The pipeline script handles this automatically when invoked correctly — the UI should delegate entirely to the script rather than touching `state.json` directly.
- The button should only appear when the pipeline's resolved `next_action` is `request_plan_approval` — this is more precise than checking local state flags alone and avoids showing the button in edge cases where state is technically matching but the resolver disagrees.

### Goal 2: Approve final review gate from the UI

**Description**: When the final review is complete and the post-final-review human gate is pending, show an "Approve Final Review" button in the Final Review section. Clicking it (with confirmation) invokes the `final_approved` event, which marks the pipeline as complete.

**Rationale**: Same rationale as Goal 1 — it's a consequential but simple yes/no decision that should not require a chat round-trip. Final approval carries slightly more weight so a confirmation step is especially important here.

**Key considerations**:
- `final_approved` has no pre-read dependencies — it's a simpler event. Still should go through the pipeline script for consistency.
- "Complete" is a terminal state; the approval is irreversible. The confirmation dialog should make this clear.

### Goal 3: Confirmation dialog before committing any approval

**Description**: Clicking either Approve button opens a brief confirmation dialog before the pipeline event is fired. The user confirms they intend to approve, then the action proceeds.

**Rationale**: Both gates are consequential and not easily reversible. A single-click approval is too easy to trigger accidentally, especially since the buttons will live close to document links and other interactive elements.

**Key considerations**:
- The dialog should show the title of the document being approved (e.g. the master plan filename or the final review report name) so the user has one last grounding cue before committing.
- Should clearly state what will change (e.g. "Pipeline will advance to execution") and the irreversibility of the action.
- Cancel / Confirm buttons; no extra fields.

### Goal 4: Dashboard auto-refreshes after approval via SSE

**Description**: After approval is confirmed and the API call succeeds, the dashboard should update automatically without a manual reload. The existing SSE event stream already pushes `state_change` events when `state.json` is modified — this should be sufficient.

**Rationale**: The user should see immediate feedback that their action had effect. Requiring a manual reload would undermine the feeling of a live dashboard.

**Key considerations**:
- The pipeline script writes the updated `state.json`, which the file watcher should detect and broadcast via SSE. No special handling needed beyond a successful API response.
- In-flight states (button disabled, loading indicator) should cover the brief gap between the click and the SSE update arriving.

## Scope Boundaries

### In Scope
- Approve button for the post-planning human gate (`plan_approved` event)
- Approve button for the post-final-review human gate (`final_approved` event)
- Confirmation dialog before committing approval
- Loading/disabled state on the button while the API call is in flight
- Inline error display if the pipeline script rejects the event — friendly message with the raw pipeline error detail available in a collapsed/expandable section for debugging
- A new backend API route that proxies the two gate events to `pipeline.js` via `execFile`
- SSE-driven auto-refresh of the dashboard after approval

### Out of Scope
- Rejection / "Request Changes" actions (not in this iteration)
- Per-phase and per-task human gate controls
- Audit log or timestamp recording for approvals (the pipeline engine does not currently track this)
- Any authentication or authorization on the gate API (this is a local dashboard tool)
- Modifying the pipeline engine itself — the UI invokes the existing script as-is

## Key Constraints

- The pipeline script must be invoked rather than writing `state.json` directly — this ensures all pre-reads, mutations, and validations run correctly (e.g. `total_phases` extraction for `plan_approved`).
- `process.execPath` (the current Node.js binary) should be used to call the script to avoid PATH resolution issues in the Next.js server process.
- The API route must only allow the two specific gate events — no arbitrary event forwarding.

## Open Questions

*All open questions resolved during brainstorming.*

| Question | Decision |
|----------|----------|
| What should the confirmation dialog show? | The title of the document being approved (master plan / review report name), plus a description of what will change and that the action is irreversible. |
| How much error detail to surface? | Friendly message by default; raw pipeline error available in a collapsed/expandable section. |
| Button visibility: state flags or `next_action`? | `next_action` from the pipeline resolver — more precise, avoids edge-case false positives. |

## Summary

This project adds direct approval controls for the two pipeline-level human gates — post-planning and post-final-review — to the orchestration dashboard. Users will see contextual Approve buttons that trigger a confirmation dialog, then invoke the existing `pipeline.js` script via a new backend API route. The dashboard auto-updates via the existing SSE stream. The pipeline engine is not modified; the UI delegates entirely to the existing script. Rejection, per-phase gates, and auth are explicitly out of scope for this iteration.
