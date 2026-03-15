---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 1
task: 2
title: "Create Centered Dialog UI Primitive"
status: "pending"
skills: ["run-tests"]
estimated_files: 1
---

# Create Centered Dialog UI Primitive

## Objective

Create `ui/components/ui/dialog.tsx` — a centered modal dialog primitive using `@base-ui/react/dialog`, exporting `Dialog`, `DialogTrigger`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`. This fills a gap in the UI component library (which has a `Sheet` side-panel but no centered modal) and will be consumed by the `ConfirmApprovalDialog` component in Phase 2.

## Context

The UI component library at `ui/components/ui/` uses `@base-ui/react` (v1.2.0+, already installed) as the headless primitive layer. The existing `Sheet` component at `ui/components/ui/sheet.tsx` provides the exact pattern to follow — it imports `Dialog` from `@base-ui/react/dialog` (aliased as `SheetPrimitive`), wraps each sub-primitive in a thin function component that applies Tailwind classes via `cn()`, attaches `data-slot` attributes, and spreads remaining props. This new `Dialog` component follows the identical structure but renders as a centered modal instead of a side-panel. The `cn()` utility is imported from `@/lib/utils`. No other components or hooks are required — this is a standalone UI primitive.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/components/ui/dialog.tsx` | Centered modal dialog primitive — 7 exported components |

## Implementation Steps

1. Create `ui/components/ui/dialog.tsx` with the `"use client"` directive at the top.

2. Import `Dialog as DialogPrimitive` from `@base-ui/react/dialog` and `cn` from `@/lib/utils`.

3. Create the `Dialog` root component — a thin wrapper around `DialogPrimitive.Root` that spreads all props and sets `data-slot="dialog"`.

4. Create the `DialogTrigger` component — wraps `DialogPrimitive.Trigger` with `data-slot="dialog-trigger"` and prop spread.

5. Create the `DialogClose` component — wraps `DialogPrimitive.Close` with `data-slot="dialog-close"` and prop spread.

6. Create the `DialogOverlay` component — wraps `DialogPrimitive.Backdrop` inside a `DialogPrimitive.Portal`. Apply the backdrop classes: `fixed inset-0 z-50 bg-black/10 duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0`. Accept `className` override via `cn()`. Set `data-slot="dialog-overlay"`.

7. Create the `DialogContent` component — renders a `DialogPrimitive.Portal` containing a `DialogOverlay` and a `DialogPrimitive.Popup`. The Popup applies centered layout classes: `fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 shadow-lg p-6 duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`. Accept `className` override via `cn()`. Set `data-slot="dialog-content"`.

8. Create the `DialogTitle` component — wraps `DialogPrimitive.Title` with classes `text-base font-medium text-foreground`. Accept `className` override. Set `data-slot="dialog-title"`.

9. Create the `DialogDescription` component — wraps `DialogPrimitive.Description` with classes `text-sm text-muted-foreground`. Accept `className` override. Set `data-slot="dialog-description"`.

10. Export all seven components as named exports: `Dialog`, `DialogTrigger`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`.

## Contracts & Interfaces

The component must export these seven functions with these exact prop types:

```typescript
// ui/components/ui/dialog.tsx

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

/** Root — manages open/close state. */
function Dialog(props: DialogPrimitive.Root.Props): React.ReactElement;

/** Trigger — opens the dialog on click. */
function DialogTrigger(props: DialogPrimitive.Trigger.Props): React.ReactElement;

/** Close — closes the dialog on click. */
function DialogClose(props: DialogPrimitive.Close.Props): React.ReactElement;

/** Overlay/Backdrop — semi-transparent backdrop with blur. Rendered inside a Portal. */
function DialogOverlay(props: DialogPrimitive.Backdrop.Props): React.ReactElement;

/** Content/Popup — centered modal container. Renders its own Portal + Overlay. */
function DialogContent(props: DialogPrimitive.Popup.Props): React.ReactElement;

/** Title — dialog heading, provides aria-labelledby. */
function DialogTitle(props: DialogPrimitive.Title.Props): React.ReactElement;

/** Description — dialog description, provides aria-describedby. */
function DialogDescription(props: DialogPrimitive.Description.Props): React.ReactElement;
```

### Existing `Sheet` Component Pattern (Reference Implementation)

Follow this exact structural pattern from the existing `ui/components/ui/sheet.tsx`:

```typescript
"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// SheetContent renders a Portal containing an Overlay + Popup
function SheetContent({ className, children, ...props }: SheetPrimitive.Popup.Props & { ... }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup data-slot="sheet-content" className={cn("...", className)} {...props}>
        {children}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base font-medium text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription }
```

### `cn()` Utility

```typescript
// ui/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## Styles & Design Tokens

### DialogOverlay (Backdrop)

- Background: `bg-black/10` (10% black opacity)
- Blur: `supports-backdrop-filter:backdrop-blur-xs` (only if supported)
- Position: `fixed inset-0 z-50`
- Animation duration: `duration-150`
- Enter: `data-starting-style:opacity-0` → `data-open:animate-in data-open:fade-in-0`
- Exit: `data-ending-style:opacity-0` → `data-closed:animate-out data-closed:fade-out-0`

### DialogContent (Centered Modal)

- Position: `fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2`
- Width: `w-full max-w-md` (max 28rem / 448px)
- Mobile margin: `mx-4` (16px horizontal breathing room)
- Background: `bg-card text-card-foreground`
- Border: `ring-1 ring-foreground/10` (10% foreground opacity ring)
- Radius: `rounded-xl`
- Shadow: `shadow-lg`
- Padding: `p-6`
- Animation duration: `duration-150`
- Enter: `data-starting-style:opacity-0 data-starting-style:scale-95` → `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95`
- Exit: `data-ending-style:opacity-0 data-ending-style:scale-95` → `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`

### DialogTitle

- Typography: `text-base font-medium text-foreground`

### DialogDescription

- Typography: `text-sm text-muted-foreground`

### Design Token Values (from globals.css)

| Token | Light Mode | Usage |
|-------|-----------|-------|
| `--card` | `oklch(1 0 0)` | Dialog background |
| `--card-foreground` | `oklch(0.145 0 0)` | Dialog text |
| `--foreground` | `oklch(0.145 0 0)` | Title text, ring opacity base |
| `--muted-foreground` | `oklch(0.556 0 0)` | Description text |

## Test Requirements

- [ ] TypeScript compiles without errors — run `tsc --noEmit` from the `ui/` directory
- [ ] All seven components are exported as named exports from `ui/components/ui/dialog.tsx`
- [ ] `Dialog` wraps `DialogPrimitive.Root` and passes through all props
- [ ] `DialogOverlay` applies `bg-black/10 backdrop-blur-xs` backdrop styling
- [ ] `DialogContent` applies centered layout with `max-w-md` and `ring-1 ring-foreground/10 rounded-xl bg-card`
- [ ] `DialogContent` renders its own `DialogOverlay` inside a Portal (same pattern as `SheetContent`)
- [ ] `DialogTitle` applies `text-base font-medium text-foreground`
- [ ] `DialogDescription` applies `text-sm text-muted-foreground`
- [ ] All components accept a `className` prop that is merged via `cn()` (except `Dialog` root which has no className)

## Acceptance Criteria

- [ ] File `ui/components/ui/dialog.tsx` exists and starts with `"use client"`
- [ ] All seven exports are available: `Dialog`, `DialogTrigger`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`
- [ ] `Dialog` renders `DialogPrimitive.Root` with `data-slot="dialog"`
- [ ] `DialogTrigger` renders `DialogPrimitive.Trigger` with `data-slot="dialog-trigger"`
- [ ] `DialogClose` renders `DialogPrimitive.Close` with `data-slot="dialog-close"`
- [ ] `DialogOverlay` renders `DialogPrimitive.Backdrop` with `data-slot="dialog-overlay"` inside a `DialogPrimitive.Portal`
- [ ] `DialogContent` renders `DialogPrimitive.Popup` with `data-slot="dialog-content"` centered via `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`
- [ ] `DialogContent` automatically includes `DialogOverlay` and `DialogPrimitive.Portal` (consumer does not need to add them separately)
- [ ] `DialogTitle` renders `DialogPrimitive.Title` with `data-slot="dialog-title"`
- [ ] `DialogDescription` renders `DialogPrimitive.Description` with `data-slot="dialog-description"`
- [ ] `role="alertdialog"` can be passed via prop spread on `DialogContent` (no special handling needed — `@base-ui/react/dialog` supports it)
- [ ] Focus is trapped inside the dialog while open (built into `@base-ui/react/dialog` — no custom implementation)
- [ ] Escape key closes the dialog (native `DialogPrimitive.Root` behavior)
- [ ] `aria-labelledby` wired via `DialogTitle` and `aria-describedby` wired via `DialogDescription` (built into `@base-ui/react/dialog`)
- [ ] All `className` accepting components merge classes via `cn()` for override support
- [ ] Build succeeds (`tsc --noEmit` passes with zero errors)
- [ ] No lint errors

## Constraints

- Do NOT modify any existing files — this task creates one new file only
- Do NOT add a close button (`X`) to `DialogContent` — the close button is the consumer's responsibility (unlike `SheetContent` which includes one); consumers will use `DialogClose` explicitly
- Do NOT add `SheetHeader`, `SheetFooter`-style layout wrappers — keep the primitive minimal; consumers compose their own layout
- Do NOT install any new packages — `@base-ui/react` (v1.2.0+) is already installed
- Do NOT create test files — acceptance is verified by TypeScript compilation and visual inspection
- Follow the exact `Sheet` component structural pattern: `"use client"` directive, `data-slot` attributes, `cn()` for class merging, function components (not arrow functions), named exports at end of file
- Use `duration-150` for animation timing (not `duration-100` as in `Sheet`) — per design spec for the centered modal
