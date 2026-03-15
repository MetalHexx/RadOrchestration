---
project: "MONITORING-UI"
phase: 4
title: "Config Viewer + Theme + Polish"
status: "active"
total_tasks: 5
author: "tactical-planner-agent"
created: "2026-03-10T13:00:00Z"
---

# Phase 4: Config Viewer + Theme + Polish

## Phase Goal

Deliver a feature-complete dashboard with configuration viewer, three-way theme toggle with flash prevention, full keyboard navigation and ARIA compliance, section-level error boundaries, loading skeletons, and WCAG 2.1 AA contrast validation for both light and dark themes — closing all accumulated carry-forward items from Phases 2 and 3.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../MONITORING-UI-MASTER-PLAN.md) | Phase 4 scope, exit criteria, task outline, risk register (R-7) |
| [Architecture](../MONITORING-UI-ARCHITECTURE.md) | Module map (config, layout, hooks), `useTheme` contract, `useConfigDrawer` contract, file structure, cross-cutting concerns (theme management, error handling) |
| [Design](../MONITORING-UI-DESIGN.md) | View 4 (Config Viewer), View 5 (Theme Toggle), Accessibility spec (keyboard nav, screen reader, contrast), Motion & Animation, ThemeToggle states, ConfigDrawer layout |
| [PRD](../MONITORING-UI-PRD.md) | FR-25 (config viewer), FR-26 (lock badges), FR-29 (theme toggle), NFR-6 (error resilience), NFR-7 (keyboard nav), NFR-8 (no color-only indicators), NFR-9 (WCAG AA contrast) |
| [Phase 3 Report](../reports/MONITORING-UI-PHASE-REPORT-P03.md) | Carry-forward items: CF-A (unit tests), CF-B (chokidar error handler), CF-C (Architecture update), CF-D (accessibility polish), CF-E (title reconciliation) |
| [Phase 3 Review](../reports/MONITORING-UI-PHASE-REVIEW-P03.md) | Verdict: approved. Cross-task issues: chokidar error handler (minor), useSSE contract drift (minor). Carry-forwards confirmed. |

## Carry-Forward Items Addressed

| # | Item | Source | Addressed In |
|---|------|--------|-------------|
| CF-B | chokidar `watcher.on('error')` handler | P3 T01 Code Review | T04 |
| CF-D | Accessibility polish (decorative `aria-hidden`, contextual `aria-label`, progressbar restructure, empty `GateHistorySection` state) | P2 CF-4 | T03 |
| CF-E | Design doc title reconciliation ("Monitor" vs "Dashboard") | P2 CF-6 | T04 |

**Deferred to post-project or future iteration:**
- CF-A (unit test framework) — Acknowledged as risk but out of scope for this phase. Testing would add 2+ tasks and exceed the scope of "Config + Theme + Polish". Recommended as a follow-up project.
- CF-C (Architecture contract update for `useSSE`) — Documentation-only change. The canonical contract is the code itself. Low priority.

## Task Outline

| # | Task | Dependencies | Skills | Est. Files | Handoff Doc |
|---|------|-------------|--------|-----------|-------------|
| T01 | Config Viewer (ConfigDrawer, ConfigSection, useConfigDrawer hook, AppHeader wiring) | — | `react`, `shadcn`, `typescript` | 5 | [Link](../tasks/MONITORING-UI-TASK-P04-T01-CONFIG-VIEWER.md) |
| T02 | Theme Toggle + Flash Prevention (ThemeToggle, useTheme, layout inline script, AppHeader wiring) | — | `react`, `shadcn`, `typescript` | 4 | [Link](../tasks/MONITORING-UI-TASK-P04-T02-THEME-TOGGLE.md) |
| T03 | Keyboard Navigation + ARIA Attributes (sidebar listbox, phase expansion, drawer focus traps, skip link, progressbar roles, CF-D accessibility polish) | T01, T02 | `accessibility`, `react` | 12 | [Link](../tasks/MONITORING-UI-TASK-P04-T03-KEYBOARD-ARIA.md) |
| T04 | Loading States + Error Boundaries + Carry-Forward Hardening (skeletons, section-level error boundaries, reduced-motion, CF-B chokidar error handler, CF-E title fix) | T01, T02 | `react`, `next.js` | 8 | [Link](../tasks/MONITORING-UI-TASK-P04-T04-LOADING-ERRORS.md) |
| T05 | Accessibility Audit + Contrast Validation (WCAG 2.1 AA for both themes, screen reader verification, final polish fixes) | T01, T02, T03, T04 | `accessibility`, `css` | 5 | [Link](../tasks/MONITORING-UI-TASK-P04-T05-A11Y-AUDIT.md) |

## Execution Order

```
T01 (Config Viewer)
 └→ T03 (depends on T01, T02)
T02 (Theme Toggle)          ← parallel-ready with T01
 └→ T04 (depends on T01, T02)
T05 (depends on T01, T02, T03, T04)
```

**Sequential execution order**: T01 → T02 → T03 → T04 → T05

*Note: T01 and T02 are parallel-ready (no mutual dependency) but will execute sequentially in v1. T03 and T04 are also parallel-ready after T01+T02 complete.*

## Task Details

### T01: Config Viewer

**Objective**: Create the config viewer drawer system — ConfigDrawer, ConfigSection, useConfigDrawer hook — and wire it to the existing config button in AppHeader.

**Key deliverables**:
- `ui/components/config/config-drawer.tsx` — Right-side `Sheet` (560px max width), title "Pipeline Configuration", close button. Renders 5 `ConfigSection` components.
- `ui/components/config/config-section.tsx` — Collapsible card using shadcn `Collapsible` or `Accordion`. Key-value pairs inside. Accepts `title`, `children`, `defaultOpen?`.
- `ui/components/config/index.ts` — Barrel exports.
- `ui/hooks/use-config-drawer.ts` — Hook managing open/close state and config data fetching from `GET /api/config`. Similar pattern to `useDocumentDrawer`.
- Modify `ui/components/layout/app-header.tsx` — Wire existing config button to open the config drawer with fetched data.

**Config sections** (from Design View 4):
1. Project Storage — base path, naming convention
2. Pipeline Limits — max phases, max tasks/phase, max retries/task, max consecutive rejections
3. Error Handling — critical severities (→ halt), minor severities (→ retry)
4. Git Strategy — strategy, branch prefix, commit prefix, auto commit
5. Human Gates — after_planning (🔒), execution_mode, after_final_review (🔒)

**Lock badge**: The existing `LockBadge` component from `ui/components/badges/` must appear next to `after_planning` and `after_final_review` gates (hard defaults that cannot be overridden).

**Refs**: FR-25, FR-26, Design View 4, Architecture `useConfigDrawer` contract

---

### T02: Theme Toggle + Flash Prevention

**Objective**: Create the three-way theme toggle (System/Dark/Light) with localStorage persistence and an inline script preventing flash-of-wrong-theme on page load.

**Key deliverables**:
- `ui/components/layout/theme-toggle.tsx` — Segmented `ToggleGroup` with three options: System (Monitor icon), Dark (Moon icon), Light (Sun icon). Active option highlighted. Uses Lucide icons.
- `ui/hooks/use-theme.ts` — Hook implementing `useTheme(): { theme, setTheme, resolvedTheme }`. Persists to `localStorage` key `monitoring-ui-theme`. Applies `dark` class on `<html>` via Tailwind class strategy. Default: `system`. System resolves based on `prefers-color-scheme`.
- Modify `ui/app/layout.tsx` — Add inline `<script>` before body content that reads `localStorage` and sets the `dark` class on `<html>` before first paint (FOWT prevention).
- Modify `ui/components/layout/app-header.tsx` — Add `ThemeToggle` in rightmost position.

**Theme states** (from Design):
| State | Active Option | Visual |
|-------|--------------|--------|
| System (default) | Monitor icon highlighted | Follows OS preference |
| Dark | Moon icon highlighted | Dark theme applied |
| Light | Sun icon highlighted | Light theme applied |

**Refs**: FR-29, Design View 5, Architecture `useTheme` contract, cross-cutting concern "Theme management"

---

### T03: Keyboard Navigation + ARIA Attributes

**Objective**: Add comprehensive keyboard navigation and ARIA attributes across all existing and new components, including the Phase 2 carry-forward accessibility polish items (CF-D).

**Key modifications** (from Design Accessibility spec):
- **Sidebar**: Add `role="listbox"` to project list, `role="option"` + `aria-selected` to items. Arrow Up/Down navigation. Sidebar collapse toggle gets `aria-expanded` + `aria-label`.
- **Phase cards**: `Enter`/`Space` toggles expansion. Chevron gets `aria-expanded`.
- **Document drawer**: Verify focus trap (shadcn Sheet native), `Escape` closes, focus returns to trigger. Add `role="dialog"`, `aria-label="Document viewer: {title}"`, `aria-modal="true"`.
- **Config drawer** (from T01): Same focus trap and `Escape` behavior. `role="dialog"`, `aria-label="Pipeline configuration"`, `aria-modal="true"`.
- **Theme toggle**: `Tab` to group, `Arrow Left/Right` to cycle, `Enter/Space` to select.
- **Skip-to-content link**: Hidden link at top of page, visible on focus, jumps past sidebar.
- **Progress bars**: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax`, `aria-label="Phase {n} progress: {completed} of {total} tasks"`.
- **Error banner**: `role="alert"`, `aria-live="assertive"`.
- **Connection status**: `aria-live="polite"` region.
- **Pipeline tier badge**: `aria-label="Pipeline tier: {tier}"`.
- **Status icons**: `aria-label="{status}"` on every icon.
- **CF-D items**: Decorative icons get `aria-hidden="true"`. Contextual `aria-label` on interactive elements. Empty `GateHistorySection` gets accessible empty state.

**Refs**: NFR-7, NFR-8, Design Accessibility (Keyboard Navigation, Screen Reader Support), CF-D

---

### T04: Loading States + Error Boundaries + Carry-Forward Hardening

**Objective**: Add loading skeletons, section-level error boundaries, reduced-motion support, and close carry-forward items CF-B (chokidar error handler) and CF-E (title reconciliation).

**Key deliverables**:
- **Sidebar skeleton**: Pulse-animated placeholder rows during initial project list fetch.
- **Dashboard skeleton**: Placeholder cards for header, planning, execution sections during state load.
- **Section-level error boundaries**: Wrap each dashboard section (`PlanningSection`, `ExecutionSection`, `ErrorLogSection`, `FinalReviewSection`, `GateHistorySection`, `LimitsSection`, `ConfigDrawer` content) in an error boundary that renders a fallback message without crashing the full page.
- **Reduced-motion**: `prefers-reduced-motion: reduce` disables drawer slide animations, spinner animations, progress bar transitions. Replace animated `Loader2` with static "Loading..." text.
- **CF-B**: Add `watcher.on('error', ...)` handler in `ui/app/api/events/route.ts` to log chokidar OS-level errors and prevent silent failures.
- **CF-E**: Standardize title to "Orchestration Dashboard" in AppHeader (matching Design doc `AppHeader` spec).

**Refs**: NFR-6, Design (Application-Level States, Motion & Animation), CF-B, CF-E

---

### T05: Accessibility Audit + Contrast Validation

**Objective**: Perform a systematic accessibility audit of all components across both light and dark themes, fix any contrast failures, and verify screen reader announcements.

**Audit checklist**:
- [ ] All text meets WCAG 2.1 AA: 4.5:1 normal text, 3:1 large text (≥18px or ≥14px bold)
- [ ] Badge text has sufficient contrast against tinted backgrounds (15% opacity BG + full-color text)
- [ ] Focus rings visible (2px solid, 2px offset) with ≥3:1 contrast against adjacent backgrounds
- [ ] Muted text (`--color-muted-foreground`) ≥ 4.5:1 against `--color-background` in both themes
- [ ] Every color-coded status has a paired text label or icon (no color-only indicators)
- [ ] All interactive elements reachable and operable via keyboard only
- [ ] Screen reader correctly announces: pipeline tier, status changes, error banners, connection state
- [ ] Drawer focus traps work correctly (Tab cycles within, Escape closes, focus returns)
- [ ] `prefers-reduced-motion` respected for all animations

**Fix scope**: Any contrast ratio failures found during audit are fixed by adjusting CSS custom property values in `globals.css`. Any missing ARIA attributes are added. This is a validation + fix pass, not a rewrite.

**Refs**: NFR-9, Design (Color Contrast), Master Plan exit criteria

## Phase Exit Criteria

- [ ] Config drawer displays all five `orchestration.yml` sections with correct grouping and values (FR-25)
- [ ] Hard-default gates (`after_planning`, `after_final_review`) show lock icons (FR-26)
- [ ] Theme toggle cycles System → Dark → Light with immediate visual update and localStorage persistence (FR-29)
- [ ] No flash-of-wrong-theme on page load
- [ ] All interactive elements are keyboard-navigable — Tab, Arrow keys, Enter, Escape (NFR-7)
- [ ] Focus is trapped inside open drawers; Escape closes them; focus returns to trigger
- [ ] Screen reader announces pipeline tier, status changes, and error banners correctly (NFR-8)
- [ ] Section-level errors render an error boundary fallback without crashing the full page (NFR-6)
- [ ] Loading skeletons display during initial data fetch
- [ ] Both light and dark themes pass WCAG 2.1 AA contrast ratio checks (NFR-9)
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Known Risks for This Phase

- **Accessibility audit reveals contrast failures in custom design tokens** → Mitigate by validating token pairs during T01/T02 implementation, not just at T05 audit time. Fix scope in T05 is limited to CSS variable adjustments.
- **Focus trap implementation conflicts with shadcn Sheet's built-in focus management** → Mitigate by leveraging Sheet's native focus trap (Radix Dialog under the hood) rather than adding a custom one. T03 should verify, not re-implement.
- **High modification count in T03** (~12 files) → Mitigate by keeping changes surgical: ARIA attribute additions and keyboard event handlers only, no structural refactoring.
- **CF-B chokidar error handler may mask underlying OS issues** → Mitigate by logging errors at `console.error` level and including the error in a heartbeat-like diagnostic, not silently swallowing.
