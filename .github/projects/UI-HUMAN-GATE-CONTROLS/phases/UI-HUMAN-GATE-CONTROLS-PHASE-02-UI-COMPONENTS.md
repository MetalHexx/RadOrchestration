---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 2
title: "UI Components & Integration"
status: "active"
total_tasks: 5
tasks:
  - id: "T01-APPROVE-HOOK"
    title: "Create useApproveGate hook"
  - id: "T02-ERROR-BANNER"
    title: "Create GateErrorBanner component"
  - id: "T03-CONFIRM-DIALOG"
    title: "Create ConfirmApprovalDialog component"
  - id: "T04-APPROVE-BUTTON"
    title: "Create ApproveGateButton compound component"
  - id: "T05-SECTION-INTEGRATION"
    title: "Integrate approve buttons into dashboard sections"
author: "tactical-planner-agent"
created: "2026-03-15"
---

# Phase 2: UI Components & Integration

## Phase Goal

Build the approval interaction layer — the `useApproveGate` hook, error banner, confirmation dialog, and compound approve button — then integrate these into the existing dashboard sections so users can approve the planning and final-review gates directly from the UI.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../UI-HUMAN-GATE-CONTROLS-MASTER-PLAN.md) | Phase 2 scope, exit criteria, risk register |
| [Architecture](../UI-HUMAN-GATE-CONTROLS-ARCHITECTURE.md) | Module map, contracts & interfaces (useApproveGate, ApproveGateButton, ConfirmApprovalDialog, GateErrorBanner, updated section props), internal dependency graph, file structure |
| [Design](../UI-HUMAN-GATE-CONTROLS-DESIGN.md) | User flows, component states & interactions, accessibility requirements, responsive behavior, design tokens |
| [PRD](../UI-HUMAN-GATE-CONTROLS-PRD.md) | FR-1 through FR-10, NFR-1 through NFR-6, user stories |
| [Phase 1 Report](../reports/UI-HUMAN-GATE-CONTROLS-PHASE-REPORT-P01.md) | All exit criteria met; carry-forward items are optional (execFile timeout, normalizer readability, API route test harness) — none blocking Phase 2 |
| [Phase 1 Review](../reports/UI-HUMAN-GATE-CONTROLS-PHASE-REVIEW-P01.md) | Verdict APPROVED; no cross-task issues; all foundational pieces verified (types, Dialog, normalizer fix, API route) |

### Phase 1 Deliverables Consumed by Phase 2

| Artifact | Path | Consumed By |
|----------|------|-------------|
| Gate types (`GateEvent`, `GateApproveResponse`, `GateErrorResponse`) | `ui/types/state.ts` | T01 (hook), T04 (button) |
| `Dialog` primitive (7 exports) | `ui/components/ui/dialog.tsx` | T03 (confirm dialog) |
| Normalizer v3 fix | `ui/lib/normalizer.ts` | T05 (FinalReviewSection renders correctly in v3) |
| Gate API route | `ui/app/api/projects/[name]/gate/route.ts` | T01 (hook calls this endpoint) |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Create `useApproveGate` hook | — (Phase 1 types only) | React hooks, fetch API | 1 | [Link](../tasks/UI-HUMAN-GATE-CONTROLS-TASK-P02-T01-APPROVE-HOOK.md) |
| T02 | Create `GateErrorBanner` component | — (Phase 1 only) | React components, accessibility | 1 | [Link](../tasks/UI-HUMAN-GATE-CONTROLS-TASK-P02-T02-ERROR-BANNER.md) |
| T03 | Create `ConfirmApprovalDialog` component | — (Phase 1 Dialog only) | React components, Dialog primitive, accessibility | 1 | [Link](../tasks/UI-HUMAN-GATE-CONTROLS-TASK-P02-T03-CONFIRM-DIALOG.md) |
| T04 | Create `ApproveGateButton` compound component | T01, T02, T03 | React composition, state management | 1 | [Link](../tasks/UI-HUMAN-GATE-CONTROLS-TASK-P02-T04-APPROVE-BUTTON.md) |
| T05 | Integrate approve buttons into dashboard sections | T04 | React props, conditional rendering | 4 | [Link](../tasks/UI-HUMAN-GATE-CONTROLS-TASK-P02-T05-SECTION-INTEGRATION.md) |

## Task Detail

### T01 — Create `useApproveGate` Hook

**Objective**: Create a React hook that encapsulates the gate approval API call, managing loading and error state locally.

**File targets**:
- CREATE `ui/hooks/use-approve-gate.ts`

**Key deliverables**:
- `useApproveGate()` returns `{ approveGate, isPending, error, clearError }`
- `approveGate(projectName, event)` calls `POST /api/projects/${projectName}/gate` with `{ event }` body
- On success (`res.ok`): returns `true`, clears error
- On failure: parses `GateErrorResponse` from body, sets `error` with `{ message, detail }`, returns `false`
- On network/unexpected error: sets generic error message, returns `false`
- `isPending` is `true` while fetch is in flight
- `clearError()` resets error to `null`
- No global state — local `useState` only
- Imports `GateEvent`, `GateApproveResponse`, `GateErrorResponse` from `@/types/state`

**Acceptance criteria**:
- Hook compiles without type errors
- Returns correct interface shape
- Does not throw — errors captured in `error` state

---

### T02 — Create `GateErrorBanner` Component

**Objective**: Create an inline error display component with a friendly message, dismiss button, and expandable raw detail section.

**File targets**:
- CREATE `ui/components/dashboard/gate-error-banner.tsx`

**Key deliverables**:
- Props: `message: string`, `detail?: string`, `onDismiss: () => void`
- Container: `role="alert"` and `aria-live="polite"` for screen reader announcement
- Styling: `rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm`
- Message: `text-destructive font-medium` with `AlertCircle` icon from `lucide-react`
- Dismiss: `X` or close button invoking `onDismiss`
- When `detail` is provided: expandable `<details>`/`<summary>` with "Show pipeline detail" label
- Detail content: `<pre className="text-xs text-muted-foreground overflow-auto max-h-32">` for raw pipeline output
- Horizontal scroll on detail for long lines (mobile support)

**Acceptance criteria**:
- Component compiles without type errors
- `role="alert"` and `aria-live="polite"` present on container
- Dismiss button calls `onDismiss`
- `<details>` section only renders when `detail` prop is provided

---

### T03 — Create `ConfirmApprovalDialog` Component

**Objective**: Create the confirmation dialog content that displays before a gate approval is committed, with title, document name, consequence text, and Cancel/Confirm buttons with pending state support.

**File targets**:
- CREATE `ui/components/dashboard/confirm-approval-dialog.tsx`

**Key deliverables**:
- Props: `open`, `onOpenChange`, `title`, `documentName`, `description`, `onConfirm`, `isPending`
- Uses `Dialog`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription` from `@/components/ui/dialog`
- `role="alertdialog"` on dialog content (conveys confirmation requirement)
- Dialog title: e.g., "Approve Master Plan" — via `DialogTitle`
- Dialog description: consequence text with highlighted document name (`font-medium text-foreground` span), irreversibility warning — via `DialogDescription`
- Footer: Cancel + Confirm buttons in `flex justify-end gap-2`
- Cancel button: `variant="outline"`, receives initial focus, calls `onOpenChange(false)`
- Confirm button: `variant="default"`, "Confirm Approval" label
- When `isPending`: Confirm disabled with `Loader2 animate-spin` spinner + "Approving…" label; Cancel disabled; backdrop click and Escape blocked (pass `modal` or handle `onOpenChange` to prevent close)
- Spinner has `aria-hidden="true"`; Confirm button has `aria-busy="true"` and `aria-disabled="true"` when pending
- Responsive: dialog buttons stack vertically (`flex-col`) on mobile (<768px); dialog uses `mx-4` on mobile instead of fixed max-width
- `prefers-reduced-motion` respected on dialog transitions (inherited from Dialog primitive)

**Acceptance criteria**:
- Component compiles without type errors
- Cancel button gets initial focus on dialog open
- Confirm and Cancel are both disabled during `isPending`
- Dialog cannot be dismissed while `isPending` is true
- Accessible roles and ARIA attributes present

---

### T04 — Create `ApproveGateButton` Compound Component

**Objective**: Create the compound component that manages the full approval lifecycle: renders the trigger button, owns the dialog open/close state, delegates to `useApproveGate` for the API call, and renders `ConfirmApprovalDialog` and `GateErrorBanner`.

**File targets**:
- CREATE `ui/components/dashboard/approve-gate-button.tsx`

**Key deliverables**:
- Props: `gateEvent: GateEvent`, `projectName: string`, `documentName: string`, `label: string`
- Imports and calls `useApproveGate()` hook
- Manages local `open` state for the dialog
- Renders trigger button: `Button variant="default" size="sm"` with provided `label`
- On trigger click: opens the dialog (`setOpen(true)`)
- Renders `ConfirmApprovalDialog` with:
  - `title`: derived from `gateEvent` (e.g., "Approve Master Plan" or "Approve Final Review")
  - `description`: consequence text describing what changes and irreversibility warning
  - `documentName`: passed through
  - `onConfirm`: calls `approveGate(projectName, gateEvent)`, on success closes dialog
  - `isPending`: from hook
- Renders `GateErrorBanner` below trigger button when `error` is not null, with:
  - `message`: `error.message`
  - `detail`: `error.detail`
  - `onDismiss`: `clearError`
- On dialog close (`onOpenChange(false)`): calls `clearError()` to reset error state
- When `isPending`: trigger button shows `Loader2 animate-spin` + "Approving…", `aria-busy="true"`, `aria-disabled="true"`
- Responsive: button renders `w-full` on mobile (<768px), natural width otherwise

**Acceptance criteria**:
- Component compiles without type errors
- Clicking button opens confirmation dialog
- Confirming fires `approveGate` with correct `projectName` and `gateEvent`
- On success, dialog closes automatically
- On failure, error banner appears with message and optional detail
- Dismissing error or closing dialog clears error state

---

### T05 — Integrate Approve Buttons into Dashboard Sections

**Objective**: Wire `ApproveGateButton` into the existing `PlanningSection`, `FinalReviewSection`, and `MainDashboard` components, and update the barrel export file.

**File targets**:
- MODIFY `ui/components/dashboard/planning-section.tsx`
- MODIFY `ui/components/dashboard/final-review-section.tsx`
- MODIFY `ui/components/layout/main-dashboard.tsx`
- MODIFY `ui/components/dashboard/index.ts`

**Key deliverables**:

*PlanningSection* (`planning-section.tsx`):
- Add `projectName: string` prop to `PlanningSectionProps`
- Conditionally render `ApproveGateButton` below the planning checklist when `planning.status === 'complete' && !planning.human_approved`
- Button config: `gateEvent="plan_approved"`, `label="Approve Plan"`, `documentName` derived from project name (e.g., `${projectName}-MASTER-PLAN.md`)
- Layout: `mt-4 flex justify-end` wrapper around the button

*FinalReviewSection* (`final-review-section.tsx`):
- Add `projectName: string` and `pipelineTier: PipelineTier` props to `FinalReviewSectionProps`
- Conditionally render `ApproveGateButton` when `pipelineTier === 'review'`, replacing the existing "Pending Approval" indicator
- Button config: `gateEvent="final_approved"`, `label="Approve Final Review"`, `documentName` derived from project name
- When gate is not pending, existing "Pending Approval" indicator remains

*MainDashboard* (`main-dashboard.tsx`):
- Thread `projectName` and `pipelineTier` props from the project state down to `PlanningSection` and `FinalReviewSection`

*Barrel exports* (`index.ts`):
- Re-export `ApproveGateButton`, `ConfirmApprovalDialog`, `GateErrorBanner` from the new files

**Acceptance criteria**:
- "Approve Plan" button appears only when `planning.status === 'complete'` and `planning.human_approved === false`; hidden in all other states
- "Approve Final Review" button appears only when `pipelineTier === 'review'`; hidden in all other states
- `projectName` and `pipelineTier` are correctly threaded from `MainDashboard` to section components
- New components are re-exported from `index.ts`
- Project compiles without type errors

## Execution Order

```
T01 (useApproveGate hook)
T02 (GateErrorBanner)       ← parallel-ready with T01 and T03
T03 (ConfirmApprovalDialog) ← parallel-ready with T01 and T02
  └─── T04 (ApproveGateButton — depends on T01, T02, T03)
         └─── T05 (Section integration — depends on T04)
```

**Sequential execution order**: T01 → T02 → T03 → T04 → T05

*Note: T01, T02, and T03 are parallel-ready (no mutual dependencies) but will execute sequentially in v1.*

## Phase Exit Criteria

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
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes

## Known Risks for This Phase

- **Stale dialog state on SSE update**: If an SSE state-change event arrives while the confirmation dialog is open but before the user confirms, the dialog may reference stale state. Mitigation: button visibility is re-derived on every render; the dialog's `onConfirm` always uses the current `projectName` and `gateEvent` props. The backend independently validates pipeline state, so a stale confirmation is safely rejected (HTTP 409).
- **Error banner rendering outside dialog viewport on mobile**: If the error detail is long, the `<pre>` block inside `<details>` could push content below the fold on small screens. Mitigation: `max-h-32 overflow-auto` on the `<pre>` constrains height; horizontal scroll prevents layout break.
- **`isPending` gap between API response and SSE refresh**: After the API returns success, the button remains in loading state until the SSE-driven state update hides it. Estimated ~500ms gap. Mitigation: this is by design — no optimistic UI; the loading state covers the gap.
