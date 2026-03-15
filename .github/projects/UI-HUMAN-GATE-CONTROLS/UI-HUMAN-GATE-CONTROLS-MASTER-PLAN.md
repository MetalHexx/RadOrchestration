---
project: "UI-HUMAN-GATE-CONTROLS"
total_phases: 2
status: "draft"
author: "architect-agent"
created: "2026-03-15"
---

# UI-HUMAN-GATE-CONTROLS — Master Plan

## Executive Summary

This project adds the first write-path to the orchestration dashboard by enabling users to approve the two pipeline-level human gates — post-planning and post-final-review — directly from the UI. Contextual "Approve" buttons appear only when a gate is pending, open a confirmation dialog that communicates irreversibility, and then invoke the existing `pipeline.js` script via a new POST API route. The dashboard auto-refreshes via the existing SSE stream (~500 ms latency), requiring no new real-time infrastructure. A prerequisite normalizer fix for v3 state schemas is included to ensure the Final Review section renders correctly. The pipeline engine itself is not modified — the UI delegates entirely to the existing script.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [UI-HUMAN-GATE-CONTROLS-BRAINSTORMING.md](.github/projects/UI-HUMAN-GATE-CONTROLS/UI-HUMAN-GATE-CONTROLS-BRAINSTORMING.md) | ✅ |
| Research | [UI-HUMAN-GATE-CONTROLS-RESEARCH-FINDINGS.md](.github/projects/UI-HUMAN-GATE-CONTROLS/UI-HUMAN-GATE-CONTROLS-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [UI-HUMAN-GATE-CONTROLS-PRD.md](.github/projects/UI-HUMAN-GATE-CONTROLS/UI-HUMAN-GATE-CONTROLS-PRD.md) | ✅ |
| Design | [UI-HUMAN-GATE-CONTROLS-DESIGN.md](.github/projects/UI-HUMAN-GATE-CONTROLS/UI-HUMAN-GATE-CONTROLS-DESIGN.md) | ✅ |
| Architecture | [UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md](.github/projects/UI-HUMAN-GATE-CONTROLS/UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md) | ✅ |

## Key Requirements (from PRD)

- **FR-1**: "Approve Plan" button displayed in the Planning Pipeline section when and only when all planning steps are complete and the plan has not yet been approved.
- **FR-2**: "Approve Final Review" button displayed in the Final Review section when and only when the pipeline is in the final-review gate pending state (`pipelineTier === 'review'`).
- **FR-3**: Clicking either Approve button opens a confirmation dialog before any pipeline action is taken — no auto-confirm.
- **FR-6**: Backend endpoint receives the approval request, invokes the pipeline engine with the appropriate gate event, and returns the outcome to the client.
- **FR-7**: Backend endpoint validates that the requested gate event is one of the two permitted values and rejects any other value.
- **FR-11**: Normalizer fix to surface v3 final-review fields (`execution.final_review_status`, `execution.final_review_doc`, `execution.final_review_approved`) — prerequisite for FR-2.
- **NFR-3**: Gate endpoint must whitelist only the two permitted gate events; project name inputs must be validated to prevent path traversal or injection.
- **NFR-4**: Confirmation dialog must be keyboard-navigable, trap focus, be Escape-dismissible, and all controls must have accessible labels.

## Key Technical Decisions (from Architecture)

- **Delegate to `pipeline.js` via `execFile`**: The API route spawns the pipeline script as a child process using `process.execPath` (not `'node'`) to avoid PATH resolution failures. No direct `state.json` writes — all pre-reads, mutations, and validations run through the pipeline engine.
- **Event whitelist enforcement**: Only `plan_approved` and `final_approved` are accepted by the gate endpoint. Combined with project name validation (`/^[A-Z0-9][A-Z0-9_-]*$/`), this prevents arbitrary event injection and path traversal.
- **No `exec`, only `execFile`**: `execFile` does not spawn a shell, preventing shell injection attacks on the project name or event parameters.
- **State-flag-derived button visibility**: Button visibility is derived from normalized state fields (`planning.status === 'complete' && !planning.human_approved` for plan; `pipelineTier === 'review'` for final) — no extra API call to compute `next_action`.
- **Local component state only**: `useApproveGate` hook uses local `useState` for `isPending` and `error`. No global state added. SSE-driven `useProjects` hook handles post-approval refresh automatically.
- **No optimistic UI**: The `isPending` loading state covers the ~500 ms gap between API response and SSE update. Source of truth is always the SSE-delivered normalized state.
- **New `Dialog` primitive**: Centered modal dialog using `@base-ui/react/dialog` (already installed), mirroring the existing `Sheet` side-panel API but with centered layout. Fills a gap in the component library.
- **v3 normalizer fallback**: `normalizeState()` updated to read `execution.final_review_*` fields when `raw.final_review` is undefined, fixing the v3 schema gap that prevents the Final Review section from rendering.

## Key Design Constraints (from Design)

- **Confirmation dialog is a centered modal** with backdrop (`bg-black/10 backdrop-blur-xs`), max-width 28rem, `role="alertdialog"`, and Cancel button receiving initial focus (safe default — Confirm is not auto-focused).
- **Cancel / Confirm only**: No extra input fields in the dialog. Dialog displays document name, consequence description, and irreversibility warning.
- **Loading state**: Approve button disabled with `Loader2` spinner and "Approving…" label while API call is in flight. Dialog prevents dismiss via backdrop click or Escape while pending.
- **Inline error display**: `GateErrorBanner` renders below the approve button with friendly message, dismiss button, and expandable `<details>` for raw pipeline output. Uses existing `--color-error-bg` / `--color-error-border` tokens.
- **Responsive behavior**: Approve buttons render at natural width on desktop/tablet, full-width (`w-full`) on mobile. Dialog uses `mx-4` on mobile instead of fixed max-width. Dialog buttons stack vertically on mobile.
- **Approve button replaces "Pending Approval" indicator**: In `FinalReviewSection`, the button replaces the existing `Circle` + "Pending Approval" text when the gate is actionable.
- **No design system additions beyond `Dialog`**: All other new components (`ApproveGateButton`, `ConfirmApprovalDialog`, `GateErrorBanner`) are domain-specific and live in `ui/components/dashboard/`, not `ui/components/ui/`.
- **Accessibility**: Focus trap in dialog, `aria-labelledby`/`aria-describedby` on dialog, `role="alert"` + `aria-live="polite"` on error banner, `aria-busy`/`aria-disabled` on loading button, `prefers-reduced-motion` respected on dialog transitions.

## Phase Outline

### Phase 1: Foundation

**Goal**: Establish the domain types, reusable Dialog primitive, v3 normalizer fix, and backend API route — the foundational pieces with no UI-component dependencies.

**Scope**:
- Add `GateEvent`, `GateApproveRequest`, `GateApproveResponse`, `GateErrorResponse` types to `ui/types/state.ts` — refs: [Architecture: Gate Types](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#contracts--interfaces), [FR-7](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements)
- Create `ui/components/ui/dialog.tsx` centered modal primitive using `@base-ui/react/dialog`, exporting `Dialog`, `DialogTrigger`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription` — refs: [Architecture: Dialog Primitive](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#dialog-primitive), [Design: Confirmation Dialog](UI-HUMAN-GATE-CONTROLS-DESIGN.md#confirmation-dialog-new-centered-modal)
- Fix `normalizeState()` in `ui/lib/normalizer.ts` to fall back to `execution.final_review_status`, `execution.final_review_doc`, `execution.final_review_approved` for v3 schemas — refs: [FR-11](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements), [Research: Section 10](UI-HUMAN-GATE-CONTROLS-RESEARCH-FINDINGS.md#section-10-critical-constraint--v3-final-review-normalizer-gap)
- Create `POST /api/projects/[name]/gate/route.ts` with event whitelist validation, project name format validation, `execFile` invocation of `pipeline.js`, and structured success/error responses — refs: [Architecture: Gate API Route](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#gate-api-route), [FR-6](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements), [FR-7](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements), [NFR-3](UI-HUMAN-GATE-CONTROLS-PRD.md#non-functional-requirements)

**Exit Criteria**:
- [ ] `GateEvent`, `GateApproveRequest`, `GateApproveResponse`, `GateErrorResponse` types exported from `ui/types/state.ts`
- [ ] `Dialog` primitive renders a centered modal with backdrop, focus trap, keyboard dismiss, and accessible roles
- [ ] `normalizeState()` correctly populates `final_review` from `execution.*` fields when `raw.final_review` is undefined
- [ ] `POST /api/projects/[name]/gate` returns 200 with pipeline result for valid `plan_approved` / `final_approved` events
- [ ] `POST /api/projects/[name]/gate` returns 400 for invalid events, 400 for malformed project names, 404 for missing projects, 409 for pipeline rejection, 500 for spawn failures
- [ ] Project compiles without type errors

**Phase Doc**: [phases/UI-HUMAN-GATE-CONTROLS-PHASE-01-FOUNDATION.md](.github/projects/UI-HUMAN-GATE-CONTROLS/phases/UI-HUMAN-GATE-CONTROLS-PHASE-01-FOUNDATION.md) *(created at execution time)*

---

### Phase 2: UI Components & Integration

**Goal**: Build the approval interaction components (`useApproveGate` hook, `GateErrorBanner`, `ConfirmApprovalDialog`, `ApproveGateButton`), integrate them into existing dashboard sections, and thread required props from `MainDashboard`.

**Scope**:
- Create `ui/hooks/use-approve-gate.ts` hook returning `{ approveGate, isPending, error, clearError }` — refs: [Architecture: useApproveGate Hook](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#useapprovegate-hook)
- Create `ui/components/dashboard/gate-error-banner.tsx` with friendly message, dismiss button, and expandable raw detail — refs: [Architecture: GateErrorBanner](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#gateerrorbanner-component), [Design: GateErrorBanner](UI-HUMAN-GATE-CONTROLS-DESIGN.md#new-components), [FR-9](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements)
- Create `ui/components/dashboard/confirm-approval-dialog.tsx` with title, document name, consequence description, Cancel/Confirm buttons, and pending state — refs: [Architecture: ConfirmApprovalDialog](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#confirmapprovaldialog-component), [Design: Confirmation Dialog](UI-HUMAN-GATE-CONTROLS-DESIGN.md#confirmation-dialog-new-centered-modal), [FR-3](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements), [FR-4](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements), [FR-5](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements)
- Create `ui/components/dashboard/approve-gate-button.tsx` compound component managing button → dialog → loading → success/error lifecycle — refs: [Architecture: ApproveGateButton](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#approvegatebutton-component), [Design: ApproveGateButton](UI-HUMAN-GATE-CONTROLS-DESIGN.md#new-components), [FR-1](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements), [FR-2](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements), [FR-8](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements)
- Update `ui/components/dashboard/planning-section.tsx` to accept `projectName` prop and conditionally render `ApproveGateButton` when `planning.status === 'complete' && !planning.human_approved` — refs: [Architecture: Updated Section Props](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#updated-section-props), [FR-1](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements)
- Update `ui/components/dashboard/final-review-section.tsx` to accept `projectName` and `pipelineTier` props, conditionally render `ApproveGateButton` when `pipelineTier === 'review'` — refs: [Architecture: Updated Section Props](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#updated-section-props), [FR-2](UI-HUMAN-GATE-CONTROLS-PRD.md#functional-requirements)
- Update `ui/components/layout/main-dashboard.tsx` to thread `projectName` and `pipelineTier` to `PlanningSection` and `FinalReviewSection` — refs: [Architecture: MainDashboard](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#module-map)
- Update `ui/components/dashboard/index.ts` to re-export new components — refs: [Architecture: File Structure](UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md#file-structure)

**Exit Criteria**:
- [ ] "Approve Plan" button appears only when `planning.status === 'complete'` and `planning.human_approved === false`; hidden in all other states
- [ ] "Approve Final Review" button appears only when `pipelineTier === 'review'`; hidden in all other states
- [ ] Clicking either Approve button opens the confirmation dialog with correct document name and consequence description
- [ ] Confirming the dialog fires `POST /api/projects/[name]/gate` and disables the button with a loading spinner
- [ ] On success, SSE state update causes the button to disappear and the approved state to display
- [ ] On failure, inline error banner appears with friendly message and expandable raw pipeline detail
- [ ] Confirmation dialog is keyboard-navigable, traps focus, Cancel receives initial focus, Escape dismisses (when not pending)
- [ ] Error banner has `role="alert"` and `aria-live="polite"`
- [ ] Responsive layout works on mobile (full-width buttons, stacked dialog buttons, `mx-4` dialog margins)
- [ ] Project compiles without type errors

**Phase Doc**: [phases/UI-HUMAN-GATE-CONTROLS-PHASE-02-UI-COMPONENTS.md](.github/projects/UI-HUMAN-GATE-CONTROLS/phases/UI-HUMAN-GATE-CONTROLS-PHASE-02-UI-COMPONENTS.md) *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from orchestration.yml)
- **Max tasks per phase**: 8
- **Max retries per task**: 2
- **Git strategy**: Single branch, sequential commits with `[orch]` prefix
- **Human gates**: Post-planning gate enabled (hard default); post-final-review gate enabled (hard default); execution mode `ask`

## Risk Register

| # | Risk | Impact | Mitigation | Owner |
|---|------|--------|------------|-------|
| 1 | v3 normalizer gap causes Final Review section to remain invisible, blocking FR-2 entirely. | High | Treat normalizer fix as a P0 prerequisite in Phase 1; it must ship before Phase 2 integration. | Coder |
| 2 | Race condition between API response and SSE state-change event causes button to re-enable briefly before updated state arrives. | Low | Button `isPending` state covers the gap; SSE re-render hides the button once updated state arrives. No optimistic UI needed. | Coder |
| 3 | Users click Approve without reading the confirmation dialog, leading to unintended pipeline advancement. | Medium | Dialog copy explicitly states irreversibility; Cancel button receives initial focus (not Confirm); no auto-dismissal. | Coder |
| 4 | Backend endpoint unavailable or pipeline script fails to spawn, leaving the user stuck at the gate. | Medium | Inline error display with expandable pipeline detail (FR-9) gives enough information to fall back to chat-based approval. | Coder |
| 5 | Approve button appears in wrong states due to stale or inconsistent client-side state. | Low | Button visibility derived from same state fields the pipeline resolver uses; backend independently validates pipeline state before acting. | Coder |
| 6 | `process.execPath` resolution fails in an edge-case Node.js/Next.js environment. | Low | Standard Next.js server always has `process.execPath` available; fallback is the existing chat-based approval. | Human |
