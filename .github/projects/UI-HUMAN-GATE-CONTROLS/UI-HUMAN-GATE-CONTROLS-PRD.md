---
project: "UI-HUMAN-GATE-CONTROLS"
status: "draft"
author: "product-manager-agent"
created: "2026-03-15"
---

# UI-HUMAN-GATE-CONTROLS — Product Requirements

## Problem Statement

The orchestration dashboard displays pipeline state in real time but provides no way for a user to act on pending human gates from within the UI. To approve a planning or final-review gate, the user must context-switch to a separate chat interface, type an explicit approval message, and wait for the agent to process it — even though the relevant documents are already visible in the dashboard. This friction is unnecessary for decisions that are inherently binary (approve or not), and it becomes a recurring cost because every project passes through both gates.

## Goals

- Users can approve the post-planning human gate directly from the dashboard, completing the action without leaving the UI.
- Users can approve the post-final-review human gate directly from the dashboard, completing the action without leaving the UI.
- Every approval is gated behind an explicit confirmation step that communicates what will change and that the action is irreversible.
- After an approval is submitted, the dashboard automatically reflects the updated pipeline state within approximately one second — no manual reload required.
- If an approval fails, the user receives a clear error message with enough detail to understand what went wrong.

## Non-Goals

- Rejection or "request changes" actions — not in this iteration.
- Per-phase and per-task human gate controls.
- Recording an audit trail or timestamps for approvals.
- Authentication or authorization controls on the approval action — this is a local development tool.
- Modifications to the pipeline engine internals — the UI delegates entirely to the existing pipeline script.

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | developer reviewing a completed plan | approve the planning gate from the dashboard | I don't have to context-switch to chat to advance the pipeline to execution | P0 |
| 2 | developer reviewing a completed final review | approve the final-review gate from the dashboard | I can mark the project complete without leaving the dashboard | P0 |
| 3 | developer about to approve a gate | see a confirmation dialog before the action is committed | I have a clear last chance to review what will change and avoid accidental approvals | P0 |
| 4 | developer who just approved a gate | see the dashboard update automatically | I get immediate confirmation that my action had the intended effect | P1 |
| 5 | developer whose approval attempt failed | see a friendly error message with expandable detail | I can understand what went wrong and decide whether to retry or investigate | P1 |
| 6 | developer looking at the dashboard | only see approval buttons when a gate is actually pending | the UI does not surface actions that are not applicable in the current pipeline state | P0 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | An "Approve Plan" button is displayed in the Planning Pipeline section when and only when all planning steps are complete and the plan has not yet been approved. | P0 | Visibility derived from pipeline state; button must not appear in any other state. |
| FR-2 | An "Approve Final Review" button is displayed in the Final Review section when and only when the pipeline is in the final-review gate pending state. | P0 | Visibility derived from pipeline tier; button must not appear in any other state. |
| FR-3 | Clicking either Approve button opens a confirmation dialog before any pipeline action is taken. | P0 | The dialog must not auto-confirm; an explicit user action is required. |
| FR-4 | The confirmation dialog displays the name of the document being approved (master plan or final review report) and a plain-language description of what will change and that the action cannot be undone. | P0 | Grounds the user before the irreversible commit. |
| FR-5 | The confirmation dialog provides a Cancel option and a Confirm option; no other input fields are required. | P0 | — |
| FR-6 | After the user confirms, a backend endpoint receives the approval request, invokes the pipeline engine with the appropriate gate event, and returns the outcome to the client. | P0 | The endpoint must only accept the two defined gate events — no arbitrary event forwarding. |
| FR-7 | The backend endpoint validates that the requested gate event is one of the two permitted values and returns an error for any other value. | P0 | Prevents arbitrary pipeline event injection. |
| FR-8 | While the approval is being processed, the Approve button is disabled and a loading indicator is shown so the user knows the action is in flight. | P1 | Covers the gap between submit and SSE confirmation. |
| FR-9 | If the backend returns an error, the confirmation dialog or its parent section displays a friendly error message. A collapsed, expandable section within the error display makes the raw pipeline error output available for debugging. | P1 | Friendly default; debug detail opt-in. |
| FR-10 | After a successful approval, the dashboard automatically updates to reflect the new pipeline state without requiring a manual page reload. | P1 | Leverages the existing server-sent event stream. |
| FR-11 | The normalizer that maps raw pipeline state to dashboard-displayable state must correctly surface final-review fields for v3 state schemas, enabling the Final Review section to render and the approval button to display. | P0 | Prerequisite for FR-2 to function. Without this fix, the Final Review section is invisible in v3. |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Responsiveness | The dashboard must remain interactive during an in-flight approval request; only the Approve button in the relevant section needs to be disabled. |
| NFR-2 | Feedback latency | The dashboard should reflect a successful approval within approximately one second of the API response returning, using the existing event stream. |
| NFR-3 | Security | The gate endpoint must whitelist only the two permitted gate events and reject all others. Project name inputs must be validated to prevent path traversal or injection. |
| NFR-4 | Accessibility | The confirmation dialog must be keyboard-navigable, trap focus while open, and be dismissible via the Escape key. All interactive controls must have accessible labels. |
| NFR-5 | Error visibility | Pipeline errors must never be silently swallowed; all failures must surface at minimum a human-readable message in the UI. |
| NFR-6 | Consistency | The Approve button styling, confirmation dialog layout, and error display pattern must be consistent with existing dashboard UI components and visual conventions. |

## Assumptions

- The existing pipeline script correctly handles both gate events and writes the updated state when invoked correctly — the UI does not need to validate the pipeline's internal logic.
- The existing server-sent event stream reliably emits a state-change event within approximately 500 ms of a state file being written — no polling fallback is needed.
- Both gate approval actions are irreversible in the current pipeline engine; the UI should communicate this clearly but does not need to implement an undo mechanism.
- The dashboard is a local development tool accessed by a single authenticated developer; no multi-user concurrency controls are required.
- A centered modal dialog primitive is not yet available in the UI component library but the underlying dialog library is already installed, making it straightforward to add.

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | The v3 normalizer gap causes the Final Review section to remain invisible, blocking FR-2 entirely. | High | Treat the normalizer fix (FR-11) as a P0 prerequisite; it must ship in the same release as the final approval button. |
| 2 | A race condition between the API response and the SSE state-change event causes the button to re-enable briefly before the updated state arrives. | Low | Button `isPending` state covers the gap; re-render from SSE will hide the button once the updated state arrives. |
| 3 | Users click Approve without reading the confirmation dialog, leading to unintended pipeline advancement. | Medium | Dialog copy must be explicit about irreversibility; no auto-dismissal; Confirm is not the default focused element. |
| 4 | The backend endpoint is unavailable or the pipeline script fails to spawn, leaving the user stuck at the gate. | Medium | The inline error display with expandable pipeline detail (FR-9) gives the developer enough information to fall back to chat-based approval if needed. |
| 5 | The Approve button appears in states where the gate is not truly pending due to stale or inconsistent client-side state. | Low | Button visibility is derived from the same state fields the pipeline resolver uses, and the backend independently validates the pipeline state before acting. |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Gate approval possible from UI | Both the post-planning and post-final-review gates can be approved entirely within the dashboard. | Manual verification: complete the approval flow end-to-end for each gate type without opening a chat interface. |
| Confirmation dialog present | 100% of approval attempts pass through the confirmation dialog before the pipeline event fires. | Code review: verify no approval path bypasses the dialog. |
| Dashboard auto-updates after approval | Dashboard reflects new pipeline state within ~1 second of API response in normal operating conditions. | Manual verification: time the lag between API response and visible state change in the dashboard. |
| Error surfaced on failure | Any pipeline rejection or network failure produces a visible error message in the UI. | Manual verification: simulate a pipeline failure and confirm the error message appears. |
| No false-positive button display | Approve buttons do not appear when the corresponding gate is not pending. | Manual verification: check button visibility across all pipeline tier states (planning, execution, review, complete). |
