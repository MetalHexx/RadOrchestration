---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 2
task: 3
title: "CONFIRM-APPROVAL-DIALOG"
status: "pending"
skills: ["run-tests", "generate-task-report"]
estimated_files: 2
---

# CONFIRM-APPROVAL-DIALOG

## Objective

Create the `ConfirmApprovalDialog` component in `ui/components/dashboard/confirm-approval-dialog.tsx` — a confirmation dialog that displays before a gate approval is committed. The dialog renders a title, document name, consequence description, irreversibility warning, and Cancel/Confirm buttons with full pending-state support. It consumes the existing `Dialog` primitive from `ui/components/ui/dialog.tsx`.

## Context

The project is adding inline approval controls for two pipeline human gates. Phase 1 delivered the `Dialog` centered-modal primitive (7 exports) in `ui/components/ui/dialog.tsx` using `@base-ui/react/dialog`. This task creates the domain-specific confirmation dialog that wraps that primitive. The dialog will be consumed by `ApproveGateButton` (T04) which owns open/close state and passes `isPending` and `onConfirm`. The companion `GateErrorBanner` component (T02) already exists at `ui/components/dashboard/gate-error-banner.tsx`. The `Button` component from `ui/components/ui/button.tsx` provides `variant` and `size` props via `class-variance-authority`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/dashboard/confirm-approval-dialog.tsx` | New component — confirmation dialog content |
| CREATE | `ui/components/dashboard/confirm-approval-dialog.test.ts` | Logic-simulation tests matching existing project test pattern |

## Implementation Steps

1. **Create the component file** at `ui/components/dashboard/confirm-approval-dialog.tsx` with the `"use client"` directive at the top.

2. **Import dependencies**: `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription` from `@/components/ui/dialog`; `Button` from `@/components/ui/button`; `Loader2` from `lucide-react`; `cn` from `@/lib/utils`.

3. **Define the `ConfirmApprovalDialogProps` interface** matching the contract below exactly — `open`, `onOpenChange`, `title`, `documentName`, `description`, `onConfirm`, `isPending`.

4. **Render the dialog structure**: `Dialog` root with `open` and `onOpenChange` props → `DialogContent` → `DialogTitle` → `DialogDescription` (containing document name highlight span and irreversibility warning) → footer with Cancel and Confirm buttons.

5. **Implement Cancel button**: `Button variant="outline"`, text "Cancel", `autoFocus` attribute (receives initial focus as the safe default). On click, call `onOpenChange(false)`. Disabled when `isPending` is `true`.

6. **Implement Confirm button**: `Button variant="default"`, default text "Confirm Approval". When `isPending` is `true`: render `Loader2` icon with `className="size-3.5 animate-spin"` and `aria-hidden="true"`, label changes to "Approving…", add `disabled`, `aria-busy="true"`, and `aria-disabled="true"` attributes. On click, call `onConfirm`.

7. **Block dismiss while pending**: Wrap `onOpenChange` so that when `isPending` is `true`, the callback is a no-op. This prevents Escape key and backdrop click from closing the dialog during the API call. Pass this guarded callback to `Dialog`'s `onOpenChange` prop.

8. **Apply responsive layout**: Footer wrapper uses `flex flex-col-reverse sm:flex-row sm:justify-end gap-2` so buttons stack vertically on mobile (<640px) and sit side-by-side on desktop. On mobile, Cancel appears below Confirm due to `flex-col-reverse` (thumb-reach ergonomics).

9. **Write tests** in `ui/components/dashboard/confirm-approval-dialog.test.ts` using the project's existing logic-simulation pattern (no React rendering library — simulate props/outputs and verify structure via prop analysis). See Test Requirements below.

10. **Verify build**: Run `npx tsc --noEmit` to ensure zero type errors in the new files.

## Contracts & Interfaces

### ConfirmApprovalDialog Props

```typescript
// ui/components/dashboard/confirm-approval-dialog.tsx

interface ConfirmApprovalDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to change open state. Blocked when isPending is true. */
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

### Dialog Primitive API (from `ui/components/ui/dialog.tsx`)

The Dialog primitive is already created. It exports 7 components. Use only these for this task:

```typescript
// ui/components/ui/dialog.tsx — exports consumed by this task

/** Root — manages open/close state via `open` and `onOpenChange` props. */
export function Dialog(props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}): React.ReactElement;

/** Content — centered modal container. Renders DialogPortal + DialogOverlay internally.
 *  Classes: fixed centered, z-50, max-w-md, mx-4, rounded-xl, bg-card, text-card-foreground,
 *  ring-1 ring-foreground/10, shadow-lg, p-6, enter/exit animations.
 *  Accepts className for overrides. */
export function DialogContent(props: {
  className?: string;
  children: React.ReactNode;
}): React.ReactElement;

/** Title — dialog heading. Linked to content via aria-labelledby.
 *  Classes: text-base font-medium text-foreground. */
export function DialogTitle(props: {
  className?: string;
  children: React.ReactNode;
}): React.ReactElement;

/** Description — dialog description. Linked to content via aria-describedby.
 *  Classes: text-sm text-muted-foreground. */
export function DialogDescription(props: {
  className?: string;
  children: React.ReactNode;
}): React.ReactElement;
```

**Important**: `DialogContent` renders its own `DialogOverlay` (backdrop) and `DialogPortal` internally — do NOT render these separately.

### Button API (from `ui/components/ui/button.tsx`)

```typescript
// ui/components/ui/button.tsx — consumed exports

/** Button component using @base-ui/react/button + class-variance-authority. */
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
- `variant="default"`: `bg-primary text-primary-foreground` — for Confirm button
- `variant="outline"`: `border-border bg-background hover:bg-muted` — for Cancel button
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

### Dialog Content (inherited from primitive — no additional styling needed)
- **Background**: `bg-card` → `oklch(1 0 0)` (light)
- **Text**: `text-card-foreground` → `oklch(0.145 0 0)` (light)
- **Ring**: `ring-foreground/10` → 10% opacity foreground
- **Border radius**: `rounded-xl` → `0.625rem`
- **Padding**: `p-6`
- **Max width**: `max-w-md` → 28rem (448px)
- **Mobile margin**: `mx-4` → 16px horizontal margin (built into primitive)

### Dialog Title
- **Classes**: `text-base font-medium text-foreground` (inherited from primitive)

### Dialog Description
- **Classes**: `text-sm text-muted-foreground` (inherited from primitive)
- **Spacing**: Add `mt-2` below the title

### Document Name Highlight (within description)
- **Wrapper**: `<span>` element
- **Classes**: `font-medium text-foreground`
- **Purpose**: Visually distinguishes the document filename within the muted description text

### Irreversibility Warning (within description)
- **Text**: "This action cannot be undone."
- **Placement**: After the consequence description, on a new line or sentence within `DialogDescription`

### Footer
- **Container classes**: `mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2`
- **Cancel button**: `variant="outline"`, no additional classes needed
- **Confirm button (idle)**: `variant="default"`, no additional classes needed
- **Confirm button (pending)**: `disabled`, `Loader2` spinner with `size-3.5 animate-spin`, label "Approving…"

### Spinner Icon
- **Icon**: `Loader2` from `lucide-react`
- **Classes**: `size-3.5 animate-spin` (matches Button's `sm` size icon scaling at `3.5`)
- **ARIA**: `aria-hidden="true"` (decorative—button text "Approving…" conveys state)

### Color Tokens Summary

| Token | CSS Variable | Light Value | Usage in this component |
|-------|-------------|-------------|------------------------|
| `--primary` | `bg-primary` | `oklch(0.205 0 0)` | Confirm button background |
| `--primary-foreground` | `text-primary-foreground` | `oklch(0.985 0 0)` | Confirm button text |
| `--card` | `bg-card` | `oklch(1 0 0)` | Dialog background (via primitive) |
| `--foreground` | `text-foreground` | `oklch(0.145 0 0)` | Title text, document name highlight |
| `--muted-foreground` | `text-muted-foreground` | `oklch(0.556 0 0)` | Description text, disabled text |
| `--border` | `border-border` | `oklch(0.922 0 0)` | Cancel button border (via outline variant) |
| `--ring` | `focus-visible:ring-ring/50` | `oklch(0.708 0 0)` | Focus ring on buttons |

## Test Requirements

Write tests in `ui/components/dashboard/confirm-approval-dialog.test.ts` using the project's existing logic-simulation pattern. This means: do NOT use a React rendering library. Instead, simulate prop analysis and verify structural expectations. Follow the established pattern from `ui/components/dashboard/gate-error-banner.test.ts`.

- [ ] Component file exports a named `ConfirmApprovalDialog` function
- [ ] Props interface accepts all 7 required props: `open`, `onOpenChange`, `title`, `documentName`, `description`, `onConfirm`, `isPending`
- [ ] When `isPending` is `false`: Confirm button label is "Confirm Approval" and Cancel button label is "Cancel"
- [ ] When `isPending` is `true`: Confirm button label changes to "Approving…" and shows `Loader2` spinner
- [ ] When `isPending` is `true`: both Cancel and Confirm buttons have `disabled` attribute
- [ ] When `isPending` is `true`: `onOpenChange` calls are blocked (guarded callback is a no-op)
- [ ] Confirm button has `aria-busy="true"` and `aria-disabled="true"` when `isPending` is `true`
- [ ] Spinner icon has `aria-hidden="true"`
- [ ] Cancel button has `autoFocus` attribute (receives initial focus)
- [ ] Document name is rendered within a `<span>` with `font-medium text-foreground` classes inside `DialogDescription`
- [ ] Footer uses responsive classes: `flex flex-col-reverse sm:flex-row sm:justify-end gap-2`

## Acceptance Criteria

- [ ] File `ui/components/dashboard/confirm-approval-dialog.tsx` exists and exports `ConfirmApprovalDialog`
- [ ] Component compiles without TypeScript errors
- [ ] Props match the `ConfirmApprovalDialogProps` interface exactly (all 7 props)
- [ ] Cancel button receives initial focus on dialog open (via `autoFocus`)
- [ ] Cancel button calls `onOpenChange(false)` when clicked
- [ ] Confirm button calls `onConfirm` when clicked
- [ ] When `isPending` is `true`: Confirm button is disabled with `Loader2` spinner and "Approving…" label
- [ ] When `isPending` is `true`: Cancel button is disabled
- [ ] When `isPending` is `true`: dialog cannot be dismissed via Escape or backdrop click (`onOpenChange` is guarded)
- [ ] Confirm button has `aria-busy="true"` and `aria-disabled="true"` when pending
- [ ] Spinner has `aria-hidden="true"`
- [ ] Document name is highlighted with `font-medium text-foreground` within the description
- [ ] Description includes an irreversibility warning ("This action cannot be undone.")
- [ ] Footer buttons use responsive layout (`flex-col-reverse` on mobile, `flex-row justify-end` on `sm:` breakpoint)
- [ ] All tests pass
- [ ] Build succeeds (`npx tsc --noEmit` — zero errors)
- [ ] No lint errors

## Constraints

- Do NOT modify `ui/components/ui/dialog.tsx` — consume it as-is
- Do NOT modify `ui/components/ui/button.tsx` — consume it as-is
- Do NOT modify `ui/components/dashboard/index.ts` (barrel export update is deferred to T05)
- Do NOT add any global state, context providers, or hooks — this is a pure presentational component
- Do NOT render `DialogOverlay` or `DialogPortal` separately — `DialogContent` includes them internally
- Do NOT make the Confirm button auto-focused — Cancel must receive focus as the safe default
- Do NOT add error display inside this component — error handling is owned by the parent `ApproveGateButton` (T04)
- Use `"use client"` directive — this component uses event handlers
- Follow the existing dashboard component pattern: named export, no default export, props destructured in function signature
