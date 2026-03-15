---
project: "UI-HUMAN-GATE-CONTROLS"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-15"
---

# UI-HUMAN-GATE-CONTROLS — Design

## Design Overview

This design adds inline approval controls for the two pipeline-level human gates — post-planning and post-final-review — directly within the orchestration dashboard. Users interact with contextual "Approve" buttons that appear only when a gate is pending, confirm their intent via a centered modal dialog that communicates irreversibility, and receive immediate visual feedback through loading states, automatic SSE-driven updates, and inline error display. The interaction model is: scan status → click approve → read confirmation → confirm or cancel → observe result.

## User Flows

### Flow 1: Approve Planning Gate

```
Dashboard loads with planning complete, gate pending
  → User sees "Approve Plan" button in Planning Pipeline card
  → User clicks "Approve Plan"
  → Confirmation dialog opens (centered modal with backdrop)
  → Dialog shows master plan document name, describes pipeline advancement, warns irreversibility
  → User clicks "Confirm Approval"
  → Dialog Confirm button enters loading state (disabled + `Loader2 animate-spin`); Cancel also disabled
  → Dialog remains open; backdrop click and Escape are blocked while the request is in flight
  → POST /api/projects/[name]/gate fires
  → On success: dialog closes automatically; SSE state_change arrives (~500ms), dashboard re-renders, Approve button disappears, planning shows "Human Approved"
  → On failure: loading state clears; error display appears inside dialog above action buttons with friendly message + expandable raw detail; both buttons re-enable for retry
```

User clicks "Cancel" at the dialog step → dialog closes, no action taken, button remains visible.

### Flow 2: Approve Final Review Gate

```
Dashboard loads with pipeline in review tier, final review complete
  → User sees "Approve Final Review" button in Final Review card
  → User clicks "Approve Final Review"
  → Confirmation dialog opens (centered modal with backdrop)
  → Dialog shows final review report name, describes pipeline completion, warns irreversibility
  → User clicks "Confirm Approval"
  → Dialog Confirm button enters loading state (disabled + `Loader2 animate-spin`); Cancel also disabled
  → Dialog remains open; backdrop click and Escape are blocked while the request is in flight
  → POST /api/projects/[name]/gate fires
  → On success: dialog closes automatically; SSE state_change arrives (~500ms), dashboard re-renders, Approve button disappears, final review shows "Human Approved", pipeline tier changes to "complete"
  → On failure: loading state clears; error display appears inside dialog above action buttons with friendly message + expandable raw detail; both buttons re-enable for retry
```

### Flow 3: Error Recovery After Failed Approval

```
User confirms approval → dialog Confirm button enters loading state
  → API returns error (pipeline rejection, network failure, spawn failure)
  → Loading state clears; both buttons re-enable
  → Inline error display appears inside dialog above action buttons
  → Error shows friendly message (e.g., "Pipeline rejected the approval request.")
  → User clicks "Show pipeline detail" to expand raw pipeline output in a scrollable block
  → User reads detail, decides to retry (click Confirm again) or cancel (click Cancel to close dialog)
  → Error clears when dialog is closed or a new confirmation attempt begins
```

### Flow 4: Gate Not Pending (No Button Visible)

```
Dashboard loads with planning incomplete (or already approved)
  → No "Approve Plan" button is rendered in the Planning Pipeline card
  → User sees standard planning checklist without approval controls

Dashboard loads with pipeline NOT in review tier
  → No "Approve Final Review" button is rendered in the Final Review card
  → User sees standard final review status without approval controls
```

## Layout & Components

### Planning Pipeline Card (Updated)

**Breakpoints**: Desktop (≥1024px) | Tablet (≥768px) | Mobile (<768px)

| Region | Component | Design Token / Class | Notes |
|--------|-----------|---------------------|-------|
| Header | `CardHeader` > `CardTitle` | `text-base font-medium` | Existing — "Planning Pipeline" |
| Content | `PlanningChecklist` | — | Existing — step checklist |
| Gate action | `ApproveGateButton` | — | NEW — conditionally rendered below checklist when gate is pending |

The `ApproveGateButton` renders inside `CardContent`, below the existing `PlanningChecklist`, separated by `mt-4 flex justify-end`. Error display lives inside `ApproveGateDialog` — no separate banner rendered in the card.

### Final Review Card (Updated)

**Breakpoints**: Desktop (≥1024px) | Tablet (≥768px) | Mobile (<768px)

| Region | Component | Design Token / Class | Notes |
|--------|-----------|---------------------|-------|
| Header | `CardHeader` > `CardTitle` | `text-base font-medium` | Existing — "Final Review" |
| Content: status | `StatusIcon` + status text | — | Existing |
| Content: doc link | `DocumentLink` | — | Existing |
| Content: approval status | `CheckCircle2` / `Circle` + text | `--status-complete`, `--status-not-started` | Existing |
| Gate action | `ApproveGateButton` | — | NEW — conditionally rendered below approval status when gate is pending |

The `ApproveGateButton` replaces the "Pending Approval" indicator when the gate is actionable (i.e., `pipelineTier === 'review'`). When the gate is not pending, the existing `Circle` + "Pending Approval" text remains. Error display lives inside `ApproveGateDialog`.

### Confirmation Dialog (New Centered Modal)

**Breakpoints**: Responsive — centered on all breakpoints

| Region | Component | Design Token / Class | Notes |
|--------|-----------|---------------------|-------|
| Backdrop | `DialogOverlay` | `bg-black/10 backdrop-blur-xs` | Matches existing `SheetOverlay` pattern |
| Container | `DialogContent` | `bg-card ring-1 ring-foreground/10 rounded-xl` | Centered modal, max-width 28rem (448px) |
| Title | `DialogTitle` | `text-base font-medium text-foreground` | E.g., "Approve Master Plan" |
| Description | `DialogDescription` | `text-sm text-muted-foreground` | Consequence + irreversibility warning |
| Document name | Inline `<span>` | `font-medium text-foreground` | Highlighted document filename within description |
| Footer | Button row | `flex justify-end gap-2` | Cancel (left) + Confirm (right) |
| Cancel button | `Button variant="outline"` | — | "Cancel" — receives initial focus |
| Confirm button | `Button variant="default"` | — | "Confirm Approval" — NOT auto-focused |

### New Components

| Component | Props | Design Tokens | Description |
|-----------|-------|--------------|-------------|
| `Dialog` | `open`, `onOpenChange`, `children` | `--card`, `--foreground`, `--border`, `--ring` | Centered modal primitive using `@base-ui/react/dialog`. Mirrors `Sheet` API pattern but uses centered layout. Composed of: `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogClose`. |
| `ApproveGateButton` | `gateEvent: GateEvent`, `projectName: string`, `documentName: string`, `label: string` | `--primary`, `--primary-foreground` | Section-level trigger button. Manages only the `open` boolean for `ApproveGateDialog`; loading and error state are owned by the dialog itself. |
| `ApproveGateDialog` | `open: boolean`, `onOpenChange: (open: boolean) => void`, `gateEvent: GateEvent`, `projectName: string`, `documentName: string`, `title: string`, `description: string`, `onConfirm: () => void`, `isPending: boolean`, `error: string \| null`, `errorDetail: string \| null` | `--card`, `--foreground`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--destructive` | Confirmation dialog. Displays title, document name, consequence description, inline error display when `error` is non-null, and Cancel/Confirm footer. Confirm button shows spinner when `isPending`. Dialog cannot be dismissed while `isPending` is true. |

## Design Tokens Used

| Token | Value (Light) | Usage |
|-------|--------------|-------|
| `--primary` | `oklch(0.205 0 0)` | Confirm button background, approve button background |
| `--primary-foreground` | `oklch(0.985 0 0)` | Confirm button text, approve button text |
| `--card` | `oklch(1 0 0)` | Dialog content background |
| `--card-foreground` | `oklch(0.145 0 0)` | Dialog content text |
| `--foreground` | `oklch(0.145 0 0)` | Dialog title, document name highlight |
| `--muted-foreground` | `oklch(0.556 0 0)` | Dialog description text, disabled button text |
| `--border` | `oklch(0.922 0 0)` | Dialog footer separator (if used) |
| `--ring` | `oklch(0.708 0 0)` | Focus ring on dialog buttons |
| `--foreground/10` | 10% opacity foreground | Dialog container ring (matches `Card` pattern) |
| `--color-error-bg` | `hsl(0, 84%, 97%)` | Error banner background |
| `--color-error-border` | `hsl(0, 84%, 80%)` | Error banner border |
| `--destructive` | `oklch(0.58 0.22 27)` | Error banner icon and message text accent |
| `--status-complete` | `hsl(142, 71%, 33%)` | "Human Approved" checkmark icon color |
| `--status-not-started` | `hsl(215, 14%, 43%)` | "Pending Approval" circle icon color |
| `--radius` | `0.625rem` | Border radius base — `rounded-xl` on dialog |
| `--radius-lg` | `var(--radius)` | Button border radius via `rounded-lg` |

## States & Interactions

| Component | State | Visual Treatment |
|-----------|-------|-----------------|
| `ApproveGateButton` | Default (gate pending) | Primary button (`variant="default"`, `size="sm"`). Full opacity. Label: "Approve Plan" or "Approve Final Review". Opens `ApproveGateDialog` on click. |
| `ApproveGateButton` | Hidden (gate not pending) | Not rendered. No DOM element present. |
| `ApproveGateDialog` | Open (idle) | Centered modal with backdrop overlay (`bg-black/10 backdrop-blur-xs`). Focus trapped inside dialog. Cancel button receives initial focus. |
| `ApproveGateDialog` | Confirm pending (`isPending = true`) | Confirm button: `disabled` + `Loader2 animate-spin` spinner + label "Approving…". Cancel button: `disabled`. Backdrop click and Escape: blocked (no-op). |
| `ApproveGateDialog` | Error (`error` non-null) | Error display renders inside dialog above the footer. Container: `rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm`. Message: `text-destructive font-medium`. Expandable `<details>`/`<summary>` with `<pre className="text-xs text-muted-foreground overflow-auto max-h-32">` for raw `errorDetail`. Both buttons re-enabled. |
| `ApproveGateDialog` | Closed | No DOM in portal. Error state cleared on close (`onOpenChange(false)` resets `error` to null). |
| `Dialog` (primitive) | Opening | `data-starting-style:opacity-0` backdrop + popup `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95`. Duration 150ms. |
| `Dialog` (primitive) | Closing | `data-ending-style:opacity-0` backdrop + popup `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`. Duration 150ms. |

## Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation — Approve button | Reachable via Tab in normal document order within the card. Activatable via Enter or Space. |
| Keyboard navigation — Dialog | Tab cycles through Cancel → Confirm (and Dismiss × if present). Shift+Tab reverses. Focus does not escape the dialog while open. |
| Keyboard dismiss — Dialog | Escape key closes the dialog (when not in pending/loading state). Equivalent to clicking Cancel. |
| Focus management — Dialog open | On dialog open, focus moves to the Cancel button (the safe option, not the destructive action). |
| Focus management — Dialog close | On dialog close, focus returns to the Approve button that triggered it. |
| Focus management — Error display | When the error display appears inside the dialog, `role="alert"` on its container triggers an automatic screen reader announcement without moving focus (focus remains on the last focused button within the dialog). |
| Screen reader — Approve button | `aria-label` not needed (visible text label is sufficient). When loading: `aria-busy="true"` and `aria-disabled="true"`. |
| Screen reader — Dialog | `DialogTitle` provides `aria-labelledby`. `DialogDescription` provides `aria-describedby`. `role="alertdialog"` on the dialog container to convey that this is a confirmation requiring user action. |
| Screen reader — Error display in dialog | Error container inside `ApproveGateDialog` has `role="alert"`. Injected into the dialog's live DOM, so screen readers announce it when it appears without requiring a separate live region. Expandable `<details>`/`<summary>` uses native accessible semantics. |
| Screen reader — Loading state | Spinner has `aria-hidden="true"` (decorative). Button text "Approving…" communicates state change. |
| Color contrast | All text meets WCAG AA (4.5:1 minimum). Primary button contrast: `--primary-foreground` on `--primary` exceeds 4.5:1. Error text: `--destructive` on `--color-error-bg` exceeds 4.5:1. |
| Focus indicators | All interactive elements use the existing `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` pattern from `buttonVariants`. Dialog close button inherits the same. |
| Motion | Dialog fade transition respects `prefers-reduced-motion` via Tailwind's `motion-safe:` / `motion-reduce:` utilities (inherited from `@base-ui/react/dialog` animation handling). |

## Responsive Behavior

| Breakpoint | Layout Change |
|-----------|--------------|
| Desktop (≥1024px) | Approve buttons render at natural width within card content (not full-width). Confirmation dialog centered with `max-w-md` (28rem/448px). Error display inside dialog spans dialog content width. |
| Tablet (≥768px) | Same as desktop. Cards are within the main content scroll area. Dialog `max-w-md` still applies, providing comfortable reading width. |
| Mobile (<768px) | Approve buttons render full-width within card content (`w-full`) for easier tap targets. Confirmation dialog uses `mx-4` (16px horizontal margin) instead of fixed max-width, maintaining edge breathing room. Dialog buttons stack vertically (`flex-col`) with Confirm below Cancel for thumb-reach ergonomics. Error detail `<pre>` block inside dialog has horizontal scroll for long lines. |

## Design System Additions

| Type | Name | Value | Rationale |
|------|------|-------|-----------|
| Component | `Dialog` | Centered modal primitive | The UI library has `Sheet` (side-panel) but no centered modal dialog. `Dialog` fills this gap using the same `@base-ui/react/dialog` primitives. Composed of `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogClose` — mirroring `Sheet` API conventions. |
| Component | `ApproveGateButton` | Section-level trigger button | Opens `ApproveGateDialog`. Manages only `open` state. Domain-specific; lives in `ui/components/dashboard/`. |
| Component | `ApproveGateDialog` | Confirmation dialog with loading + error | Wraps `Dialog` with gate-specific title, document name display, consequence text, inline error display with expandable detail, and Cancel/Confirm footer. Owns `isPending`, `error`, and `errorDetail` state. Reusable for both gate types via props. Lives in `ui/components/dashboard/`. |
