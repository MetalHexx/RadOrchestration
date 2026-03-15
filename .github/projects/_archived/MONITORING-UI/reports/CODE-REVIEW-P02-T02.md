---
project: "MONITORING-UI"
phase: 2
task: "P02-T02"
verdict: "approved"
severity: "none"
author: "reviewer-agent"
created: "2026-03-09T00:00:00Z"
---

# Code Review: Phase 2, Task 2 — Sidebar Components + useProjects Hook

## Verdict: APPROVED

## Summary

All five files are well-implemented, correctly typed, and match the task handoff contract. The `useProjects` hook handles fetch-on-mount, localStorage persistence, and per-project state loading with proper status-code differentiation and cleanup. The three sidebar components follow shadcn/ui primitives, implement correct accessibility attributes, and apply the specified design tokens. Build, lint, and type checks pass with zero errors.

## Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Architectural consistency | ⚠️ | Hook placed at `ui/hooks/` per task handoff & existing convention; Architecture module map specifies `ui/lib/hooks/`. See Issue #1 |
| Design consistency | ⚠️ | Design doc specifies italic project name for not-initialized projects — not in task handoff, not implemented. See Issue #2 |
| Code quality | ✅ | Clean code, proper TypeScript, no `any` types, good abstractions, correct naming |
| Test coverage | ⚠️ | No tests — expected per constraints (no test framework set up) |
| Error handling | ✅ | Comprehensive: localStorage try/catch, HTTP status differentiation (200/404/422/other), network error catches, unmount cleanup |
| Accessibility | ✅ | `role="listbox"` + `role="option"` + `aria-selected`, `aria-label` on search, `focus-visible` ring on list items |
| Security | ✅ | `encodeURIComponent` on project names in URLs, no secrets exposed, read-only data flow |

## Issues Found

| # | File | Line(s) | Severity | Issue | Suggestion |
|---|------|---------|----------|-------|-----------|
| 1 | `ui/hooks/use-projects.ts` | 1 | minor | Hook lives at `ui/hooks/` but the Architecture module map specifies `ui/lib/hooks/`. The existing `use-mobile.ts` is also at `ui/hooks/` and the task handoff explicitly requested this path, so this is consistent with the current workspace but diverges from the Architecture's file structure. | Reconcile in a later task: either move all hooks to `ui/lib/hooks/` or update the Architecture. Not blocking — the Coder correctly followed the task handoff. |
| 2 | `ui/components/sidebar/project-list-item.tsx` | 28 | minor | The Design doc's "ProjectListItem States" table specifies italic project name for not-initialized projects (`italic` class when `tier === "not_initialized"`). This detail was not included in the task handoff, so the Coder had no way to implement it. | If desired, add conditional `italic` class to the project name span when `project.tier === "not_initialized"`. Can be addressed in a polish task. |
| 3 | `ui/hooks/use-projects.ts` | 97–135 | minor | The localStorage-restore logic inside the mount `useEffect` duplicates the state-fetching and status-code handling already encapsulated in `fetchProjectState`. This makes the state-fetch error handling exist in two places. | Consider calling `fetchProjectState(restored)` directly (it's stable via `useCallback` with `[]` deps) instead of re-implementing the fetch inline. This would reduce duplication and ensure both paths stay in sync. |
| 4 | `ui/hooks/use-projects.ts` | 147 | minor | `// eslint-disable-line react-hooks/exhaustive-deps` suppresses the exhaustive-deps rule on the mount effect. Since `selectProject` and `fetchProjectState` are both memoized with `useCallback`, they could safely be listed in the dependency array without causing re-runs. | Remove the eslint-disable comment and add `[fetchProjectState]` to the deps array (or call `selectProject` directly from the effect, adding it to deps). This keeps the linter active for future changes. |

## Positive Observations

- **Excellent error handling**: The hook correctly differentiates between 404 (no state → null, no error), 422 (malformed → null + error message), and other errors. Network-level failures are also caught. The `cancelled` flag in the mount effect prevents state updates after unmount.
- **Proper URL encoding**: `encodeURIComponent(name)` in fetch URLs prevents injection of path traversal characters through project names.
- **Correct contract adherence**: All five files match the task handoff's interface contracts exactly — `UseProjectsReturn`, `ProjectSidebarProps`, `ProjectListItemProps`, `SidebarSearchProps`.
- **Accessibility**: The listbox/option pattern with `aria-selected` provides correct screen reader semantics. The search input has an explicit `aria-label`. Focus rings use the standard shadcn convention.
- **Design token usage**: Selected state uses `bg-accent`, `text-accent-foreground`, and `border-l-[var(--color-link)]` as specified. No hardcoded color values.
- **Badge integration**: `PipelineTierBadge` and `WarningBadge` imports from `@/components/badges` barrel are correct and match the P02-T01 deliverables.
- **Loading and empty states**: Sidebar renders 5 skeleton items during loading and shows "No matching projects" for empty search results, both per spec.
- **Footer count**: Correctly shows total project count (not filtered count) as specified.
- **localStorage resilience**: Both read and write to localStorage are wrapped in try/catch for environments where storage is unavailable.

## Recommendations

- **Issue #1 hook location**: Track this as a carry-forward item for the Tactical Planner. When Phase 3 creates `useSSE` and Phase 4 creates `useTheme`, decide whether all hooks move to `ui/lib/hooks/` (matching Architecture) or the Architecture is updated to reflect `ui/hooks/` (matching current reality + shadcn convention). Doing this early avoids a larger refactor.
- **Issue #3 duplication**: Low priority. If a corrective task runs against this file for any reason, fold the duplication fix in at that time.
- No blocking issues — task can advance.
