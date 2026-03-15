---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 2
task: 4
title: "APPROVE-GATE-BUTTON"
status: "pending"
skills: ["run-tests", "generate-task-report"]
estimated_files: 1
---

# APPROVE-GATE-BUTTON

## Objective

Create the `ApproveGateButton` compound component in `ui/components/dashboard/approve-gate-button.tsx` that manages the full gate-approval lifecycle: renders the trigger button, owns dialog open/close state, delegates to the `useApproveGate` hook for the API call, and composes `ConfirmApprovalDialog` and `GateErrorBanner` as children.

## Context

The project is adding inline approval controls for two pipeline human gates. This task's three dependencies are already built and reviewed: `useApproveGate` hook (`ui/hooks/use-approve-gate.ts`), `GateErrorBanner` (`ui/components/dashboard/gate-error-banner.tsx`), and `ConfirmApprovalDialog` (`ui/components/dashboard/confirm-approval-dialog.tsx`). The `Button` component from `ui/components/ui/button.tsx` provides `variant` and `size` props via `class-variance-authority`. The `Loader2` icon from `lucide-react` is used for the in-flight spinner. `ApproveGateButton` will be consumed by `PlanningSection` and `FinalReviewSection` in the next task (T05).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/dashboard/approve-gate-button.tsx` | Compound component — trigger button + dialog + error banner |

## Implementation Steps

1. **Create the component file** at `ui/components/dashboard/approve-gate-button.tsx` with the `"use client"` directive at the top.

2. **Import dependencies**:
   - `useState` from `react`
   - `Loader2` from `lucide-react`
   - `Button` from `@/components/ui/button`
   - `useApproveGate` from `@/hooks/use-approve-gate`
   - `ConfirmApprovalDialog` from `@/components/dashboard/confirm-approval-dialog`
   - `GateErrorBanner` from `@/components/dashboard/gate-error-banner`
   - `cn` from `@/lib/utils`
   - Type `GateEvent` from `@/types/state`

3. **Define the `ApproveGateButtonProps` interface** exactly matching the contract below — `gateEvent`, `projectName`, `documentName`, `label`, and optional `className`.

4. **Implement the component**:
   - Call `useApproveGate()` to get `{ approveGate, isPending, error, clearError }`.
   - Manage local `open` state via `useState<boolean>(false)` for the dialog.
   - Derive `dialogTitle` from `gateEvent`: `"Approve Master Plan"` when `gateEvent === 'plan_approved'`, `"Approve Final Review"` when `gateEvent === 'final_approved'`.
   - Derive `consequenceDescription` from `gateEvent`: `"This will advance the pipeline from planning to execution. You are approving"` when `gateEvent === 'plan_approved'`, `"This will mark the project as complete. You are approving"` when `gateEvent === 'final_approved'`.

5. **Implement the `handleConfirm` callback**:
   - Call `const success = await approveGate(projectName, gateEvent)`.
   - If `success` is `true`, call `setOpen(false)` to close the dialog.
   - If `success` is `false`, do nothing — error is captured in hook state and displayed by `GateErrorBanner`.

6. **Implement the `handleOpenChange` callback**:
   - When `open` changes to `false`: call `clearError()` to reset any error state, then call `setOpen(false)`.
   - When `open` changes to `true`: call `setOpen(true)`.
   - This ensures error state is always cleared when the dialog is dismissed.

7. **Render the trigger button**: `Button` with `variant="default"`, `size="sm"`. When `isPending` is `true`: render `Loader2` with `className="size-3.5 animate-spin"` and `aria-hidden="true"`, label "Approving…", add `disabled`, `aria-busy="true"`, and `aria-disabled="true"`. When idle: render the `label` prop text. On click: `setOpen(true)`. Apply `className={cn("w-full sm:w-auto", className)}` for responsive width.

8. **Render `ConfirmApprovalDialog`** as a sibling of the trigger button, passing:
   - `open={open}`
   - `onOpenChange={handleOpenChange}`
   - `title={dialogTitle}`
   - `documentName={documentName}`
   - `description={consequenceDescription}`
   - `onConfirm={handleConfirm}`
   - `isPending={isPending}`

9. **Render `GateErrorBanner`** conditionally below the trigger button (only when `error` is not `null`), wrapped in a `<div className="mt-2">`, passing:
   - `message={error.message}`
   - `detail={error.detail}`
   - `onDismiss={clearError}`

10. **Verify build**: Run `npx tsc --noEmit` to ensure zero type errors.

## Contracts & Interfaces

### ApproveGateButton Props

```typescript
// ui/components/dashboard/approve-gate-button.tsx

import type { GateEvent } from '@/types/state';

interface ApproveGateButtonProps {
  /** The pipeline gate event to fire: 'plan_approved' or 'final_approved'. */
  gateEvent: GateEvent;
  /** The project name (used in the API URL path). */
  projectName: string;
  /** Display name of the document being approved (e.g., "UI-HUMAN-GATE-CONTROLS-MASTER-PLAN.md"). */
  documentName: string;
  /** Button label text (e.g., "Approve Plan" or "Approve Final Review"). */
  label: string;
  /** Optional additional CSS classes for the wrapper element. */
  className?: string;
}

export function ApproveGateButton(props: ApproveGateButtonProps): React.ReactElement;
```

### GateEvent Type (from `ui/types/state.ts`)

```typescript
// ui/types/state.ts — already exists, DO NOT modify

/** Whitelist of allowed gate events — prevents arbitrary event forwarding. */
export type GateEvent = 'plan_approved' | 'final_approved';
```

### useApproveGate Hook API (from `ui/hooks/use-approve-gate.ts`)

```typescript
// ui/hooks/use-approve-gate.ts — already exists, DO NOT modify

export interface UseApproveGateError {
  message: string;
  detail?: string;
}

interface UseApproveGateReturn {
  /** Invoke the gate approval API. Never throws — errors captured in `error` state. */
  approveGate: (projectName: string, event: GateEvent) => Promise<boolean>;
  /** True while the API call is in flight. */
  isPending: boolean;
  /** Structured error with message and optional raw pipeline detail, or null. */
  error: UseApproveGateError | null;
  /** Clear the current error state. */
  clearError: () => void;
}

export function useApproveGate(): UseApproveGateReturn;
```

**Usage**: Call `useApproveGate()` at the top of the component. Use `approveGate(projectName, gateEvent)` in the confirm handler — it returns `Promise<boolean>` (`true` = success, `false` = error captured in `error`). Use `clearError()` to reset error state when the dialog closes or is dismissed.

### ConfirmApprovalDialog API (from `ui/components/dashboard/confirm-approval-dialog.tsx`)

```typescript
// ui/components/dashboard/confirm-approval-dialog.tsx — already exists, DO NOT modify

interface ConfirmApprovalDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to change open state. Blocked internally when isPending is true. */
  onOpenChange: (open: boolean) => void;
  /** Dialog title (e.g., "Approve Master Plan"). */
  title: string;
  /** Filename of the document being approved (highlighted in description). */
  documentName: string;
  /** Plain-language description of what will change upon approval. */
  description: string;
  /** Callback invoked when the user clicks Confirm. */
  onConfirm: () => void;
  /** Whether the approval API call is currently in flight. */
  isPending: boolean;
}

export function ConfirmApprovalDialog(props: ConfirmApprovalDialogProps): React.ReactElement;
```

**Rendering behavior**: The dialog internally renders `DialogContent` (which includes backdrop/overlay). It blocks dismiss (Escape + backdrop click) when `isPending` is `true`. Cancel button gets `autoFocus`. Dialog description renders the `documentName` in a `font-medium text-foreground` span, followed by "This action cannot be undone."

### GateErrorBanner API (from `ui/components/dashboard/gate-error-banner.tsx`)

```typescript
// ui/components/dashboard/gate-error-banner.tsx — already exists, DO NOT modify

interface GateErrorBannerProps {
  /** Friendly user-facing error message. */
  message: string;
  /** Raw pipeline output for debugging. Shown in expandable detail section. */
  detail?: string;
  /** Callback to dismiss (clear) the error. */
  onDismiss: () => void;
}

export function GateErrorBanner(props: GateErrorBannerProps): React.ReactElement;
```

**Rendering behavior**: The banner renders with `role="alert"` and `aria-live="polite"`. It shows an `AlertCircle` icon, the `message` text, an `X` dismiss button, and an optional expandable `<details>`/`<summary>` "Show pipeline detail" section for the `detail` prop. Container classes: `rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm`.

### Button API (from `ui/components/ui/button.tsx`)

```typescript
// ui/components/ui/button.tsx — consumed export

export function Button(props: {
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  autoFocus?: boolean;
  children: React.ReactNode;
  [key: string]: unknown; // Additional HTML/ARIA attributes pass through
}): React.ReactElement;
```

Button variant classes used in this task:
- `variant="default"`: `bg-primary text-primary-foreground` — for the trigger button
- `size="sm"`: `h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]` — compact button for section inline use
- Disabled state: `disabled:pointer-events-none disabled:opacity-50` (built-in)
- Focus ring: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` (built-in)

### Utility

```typescript
// ui/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]): string;
```

## Styles & Design Tokens

### Trigger Button
- **Variant**: `variant="default"` → `bg-primary text-primary-foreground`
- **Size**: `size="sm"` → `h-7 gap-1 px-2.5 text-[0.8rem]`
- **Responsive width**: `w-full sm:w-auto` — full width on mobile (<640px), natural width on desktop
- **Tokens**: `--primary: oklch(0.205 0 0)`, `--primary-foreground: oklch(0.985 0 0)`

### Trigger Button — Loading State
- **Spinner icon**: `Loader2` from `lucide-react` with `className="size-3.5 animate-spin"` and `aria-hidden="true"`
- **Label**: changes from `label` prop to `"Approving…"`
- **Attributes**: `disabled`, `aria-busy="true"`, `aria-disabled="true"`
- **Visual**: `disabled:pointer-events-none disabled:opacity-50` (built-in from button)

### Error Banner Wrapper
- **Wrapper**: `<div className="mt-2">` around `GateErrorBanner`
- **Visibility**: Only rendered when `error !== null`

### Dialog Title Derivation
- `gateEvent === 'plan_approved'` → `"Approve Master Plan"`
- `gateEvent === 'final_approved'` → `"Approve Final Review"`

### Dialog Description Derivation
- `gateEvent === 'plan_approved'` → `"This will advance the pipeline from planning to execution. You are approving"`
- `gateEvent === 'final_approved'` → `"This will mark the project as complete. You are approving"`

(The dialog component appends the `documentName` as a highlighted span and "This action cannot be undone." after the description.)

### Component Layout

```
<div>                                           ← optional wrapper for className
  <Button variant="default" size="sm">          ← trigger button
    {isPending ? <Loader2 /> + "Approving…" : label}
  </Button>
  <ConfirmApprovalDialog ... />                  ← dialog (renders in portal)
  {error && (
    <div className="mt-2">                      ← error banner wrapper
      <GateErrorBanner ... />
    </div>
  )}
</div>
```

## Test Requirements

- [ ] Component renders trigger button with the provided `label` text when not pending
- [ ] Trigger button shows `Loader2` spinner and "Approving…" text when `isPending` is `true`
- [ ] Trigger button has `aria-busy="true"` and `aria-disabled="true"` when `isPending` is `true`
- [ ] Trigger button applies `w-full sm:w-auto` for responsive width
- [ ] Clicking trigger button opens the `ConfirmApprovalDialog` (sets `open` to `true`)
- [ ] `ConfirmApprovalDialog` receives correct `title` derived from `gateEvent` — `"Approve Master Plan"` for `plan_approved`, `"Approve Final Review"` for `final_approved`
- [ ] `ConfirmApprovalDialog` receives correct `description` derived from `gateEvent`
- [ ] On confirm success (`approveGate` returns `true`), dialog closes (`open` set to `false`)
- [ ] On confirm failure (`approveGate` returns `false`), dialog remains open
- [ ] `GateErrorBanner` renders when `error` is not null, with `message` and optional `detail`
- [ ] `GateErrorBanner` does not render when `error` is null
- [ ] Dismissing the error banner calls `clearError()` from the hook
- [ ] Closing the dialog (via `onOpenChange(false)`) calls `clearError()` to reset error state

## Acceptance Criteria

- [ ] `ui/components/dashboard/approve-gate-button.tsx` exists and exports `ApproveGateButton`
- [ ] Component compiles without type errors (`npx tsc --noEmit` passes)
- [ ] Clicking the button opens the confirmation dialog
- [ ] Confirming fires `approveGate(projectName, gateEvent)` with the correct arguments
- [ ] On success (`approveGate` returns `true`), dialog closes automatically
- [ ] On failure (`approveGate` returns `false`), dialog remains open and error banner appears below the trigger button with `message` and optional `detail`
- [ ] Dismissing the error banner or closing the dialog clears the error state
- [ ] Trigger button shows `Loader2` spinner + "Approving…" with `aria-busy="true"` and `aria-disabled="true"` while `isPending` is `true`
- [ ] Trigger button renders `w-full` on mobile (<640px) and natural width on desktop (`sm:w-auto`)
- [ ] No lint errors
- [ ] Build succeeds

## Constraints

- Do NOT modify `ui/hooks/use-approve-gate.ts` — consume it as-is
- Do NOT modify `ui/components/dashboard/confirm-approval-dialog.tsx` — consume it as-is
- Do NOT modify `ui/components/dashboard/gate-error-banner.tsx` — consume it as-is
- Do NOT modify `ui/types/state.ts` — consume types as-is
- Do NOT add global state — all state is local (`useState`) or from the `useApproveGate` hook
- Do NOT add optimistic UI — the `isPending` loading state covers the gap between API response and SSE refresh
- Do NOT add any new npm dependencies — all imports (`lucide-react`, `@base-ui/react`, `class-variance-authority`) are already installed
- Do NOT update `ui/components/dashboard/index.ts` — barrel export updates happen in T05
