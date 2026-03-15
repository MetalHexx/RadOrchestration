---
project: "UI-MARKDOWN-IMPROVEMENTS"
phase: 1
task: 2
title: "LAYOUT-SCROLL"
type: "corrective"
status: "pending"
skills_required: ["Tailwind CSS"]
skills_optional: []
estimated_files: 1
---

# CORRECTIVE: Fix SheetContent Width Override CSS Specificity

## Correction Context

This is a **corrective task** triggered by Code Review verdict `changes_requested`. The original task (P01-T02 — LAYOUT-SCROLL) was implemented correctly except for one CSS specificity issue. This handoff addresses ONLY that issue.

### Issue from Code Review

| # | File | Line(s) | Severity | Issue |
|---|------|---------|----------|-------|
| 1 | `ui/components/documents/document-drawer.tsx` | 63 | minor | Width override classes `md:w-[50vw] md:max-w-[50vw]` have CSS specificity 0,1,0, which loses to the base `SheetContent` data-attribute variants `data-[side=right]:w-3/4` (specificity 0,2,0) and `data-[side=right]:sm:max-w-sm` (specificity 0,2,0). `tailwind-merge` does not remove the base classes because the modifier sets differ. The drawer stays at `min(75%, 24rem)` ≈ 384px instead of the intended 50vw on desktop. |

## Objective

Fix the CSS specificity conflict on `SheetContent` by adding Tailwind `!important` modifiers (`md:!w-[50vw] md:!max-w-[50vw]`) so the drawer pane achieves the intended 50vw width on viewports ≥768px.

## Context

The `SheetContent` base component (`ui/components/ui/sheet.tsx`) applies data-attribute selectors for the `side="right"` variant: `data-[side=right]:w-3/4` and `data-[side=right]:sm:max-w-sm`. These have CSS specificity 0,2,0. The current className override `md:w-[50vw] md:max-w-[50vw]` has specificity 0,1,0 and therefore loses. Tailwind's `!` prefix emits `!important` declarations that override regardless of specificity.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/components/documents/document-drawer.tsx` | Fix width classes on `SheetContent` |

## Implementation Steps

1. **Open `ui/components/documents/document-drawer.tsx`**.

2. **Locate the `SheetContent` className** — find this exact line:
   ```tsx
   className="w-full md:w-[50vw] md:max-w-[50vw] overflow-hidden"
   ```

3. **Replace `md:w-[50vw] md:max-w-[50vw]` with `md:!w-[50vw] md:!max-w-[50vw]`** — the corrected line should be:
   ```tsx
   className="w-full md:!w-[50vw] md:!max-w-[50vw] overflow-hidden"
   ```
   The `!` prefix is Tailwind's `!important` modifier. This ensures the 50vw width overrides the base `data-[side=right]:w-3/4` (specificity 0,2,0) and `data-[side=right]:sm:max-w-sm` (specificity 0,2,0) styles from the Sheet component.

4. **Verify build** — run `npm run build` from the `ui/` directory and confirm zero new errors or warnings.

## Contracts & Interfaces

No interface changes. The component props and hook return types remain identical to the original task implementation.

## Styles & Design Tokens

- **SheetContent width (desktop ≥768px)**: `md:!w-[50vw] md:!max-w-[50vw]` (with `!important` to defeat data-attribute specificity)
- **SheetContent width (mobile <768px)**: `w-full` (unchanged)
- **SheetContent overflow**: `overflow-hidden` (unchanged)

### SheetContent Base Styles (from `ui/components/ui/sheet.tsx` — DO NOT MODIFY)

The base `SheetContent` for `side="right"` includes these data-attribute variants:
```
data-[side=right]:w-3/4          → specificity 0,2,0
data-[side=right]:sm:max-w-sm    → specificity 0,2,0
```

The `!important` modifier on `md:!w-[50vw]` and `md:!max-w-[50vw]` ensures the override wins regardless of selector specificity.

## Test Requirements

- [ ] Open a document in the drawer at a viewport ≥768px wide — verify the pane width is approximately 50% of the viewport (not ~384px)
- [ ] Verify at a 1280px viewport — pane should be ~640px wide
- [ ] Verify at a 1920px viewport — pane should be ~960px wide
- [ ] Resize to <768px — verify pane takes full width (unchanged behavior)
- [ ] Run `npm run build` from `ui/` — verify zero new errors or warnings

## Acceptance Criteria

- [ ] `SheetContent` className contains `md:!w-[50vw] md:!max-w-[50vw]` (with `!` prefix)
- [ ] Pane width is ~50vw on viewports ≥768px (not constrained to ~384px)
- [ ] Pane width is full-width on viewports <768px
- [ ] All other scroll, layout, and reset behavior from the original task remains intact
- [ ] Build passes with no new warnings or errors

## Constraints

- Do NOT modify `ui/components/ui/sheet.tsx` — the fix is applied via `className` prop only
- Do NOT change any other classes on `SheetContent` — only the `md:w-[50vw]` and `md:max-w-[50vw]` classes need the `!` prefix
- Do NOT re-implement any other part of P01-T02 — the scroll reset, flex layout, header border, and inner padding are all correct
- Do NOT add any new npm packages
