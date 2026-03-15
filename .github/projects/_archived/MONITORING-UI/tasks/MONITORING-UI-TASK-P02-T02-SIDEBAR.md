---
project: "MONITORING-UI"
phase: 2
task: 2
title: "Sidebar Components + useProjects Hook"
status: "pending"
skills_required: ["react", "typescript", "next.js"]
skills_optional: ["shadcn-ui"]
estimated_files: 5
---

# Sidebar Components + useProjects Hook

## Objective

Create the `useProjects` data-fetching hook and three sidebar UI components (`ProjectSidebar`, `ProjectListItem`, `SidebarSearch`) that together provide project selection, search filtering, and localStorage persistence for the monitoring dashboard.

## Context

Phase 1 built two API routes: `GET /api/projects` returns a project list and `GET /api/projects/[name]/state` returns normalized state for a single project. Phase 2 Task 1 delivered 8 badge components (exported from `@/components/badges`). This task creates the sidebar that consumes those APIs and badges. The shadcn `Sidebar` primitives are already installed at `@/components/ui/sidebar`. The `Input` component is at `@/components/ui/input`. The `Skeleton` component is at `@/components/ui/skeleton`. All new files must be `"use client"` components.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/hooks/use-projects.ts` | Data-fetching hook with localStorage persistence |
| CREATE | `ui/components/sidebar/project-sidebar.tsx` | Sidebar container: header, search, list, footer |
| CREATE | `ui/components/sidebar/project-list-item.tsx` | Single project row with tier badge |
| CREATE | `ui/components/sidebar/sidebar-search.tsx` | Filter input for project list |
| CREATE | `ui/components/sidebar/index.ts` | Barrel export for all sidebar components |

## Implementation Steps

1. **Create `ui/hooks/use-projects.ts`** — Implement the `useProjects` hook:
   - On mount, fetch `GET /api/projects` → parse `{ projects: ProjectSummary[] }` → store in state.
   - On mount, read `localStorage.getItem("monitoring-ui-selected-project")` — if a value exists and matches a project name from the fetched list, call `selectProject(name)` automatically.
   - `selectProject(name)` sets `selectedProject` state, writes to `localStorage.setItem("monitoring-ui-selected-project", name)`, then fetches `GET /api/projects/${name}/state`.
   - Handle the state endpoint responses: `200` → parse `{ state: NormalizedProjectState }` and store in `projectState`; `404` → set `projectState` to `null` (project has no state file); `422` → set `projectState` to `null` and set error to the parse error message; other errors → set `error` string.
   - Expose `isLoading` (true during any fetch), `error` (string or null).
   - When `selectProject` is called, clear the previous `projectState` and set `isLoading` to true before fetching.

2. **Create `ui/components/sidebar/sidebar-search.tsx`** — A controlled input that receives `value` and `onChange` props. Uses the shadcn `Input` component as base. Includes a `Search` icon from Lucide and a placeholder text "Filter projects…". Renders with `aria-label="Filter projects"`.

3. **Create `ui/components/sidebar/project-list-item.tsx`** — A button/interactive element for a single project. Shows project name + `PipelineTierBadge` (from `@/components/badges`). When `project.hasMalformedState` is `true`, show `WarningBadge` with message "Malformed state" instead of the tier badge. When `project.tier` is `"not_initialized"`, the `PipelineTierBadge` already renders "Not Started" in slate (handled by the badge itself). Apply selected styling when `selected` prop is `true`. Use `role="option"` and `aria-selected` for the list item.

4. **Create `ui/components/sidebar/project-sidebar.tsx`** — The full sidebar component:
   - Uses `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupContent`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSkeleton` from `@/components/ui/sidebar`.
   - Header contains "Projects" label.
   - Below header, render `SidebarSearch` with local `searchQuery` state.
   - Scrollable list of `ProjectListItem` components, filtered by `searchQuery` (case-insensitive substring match on `project.name`).
   - Footer shows project count (e.g., "7 projects") — always shows total count, not filtered count.
   - Loading state: render 5 `SidebarMenuSkeleton` components when `isLoading` is true and `projects` is empty.
   - Empty search state: show "No matching projects" when filter produces zero results.

5. **Create `ui/components/sidebar/index.ts`** — Barrel export: `ProjectSidebar`, `ProjectListItem`, `SidebarSearch`.

## Contracts & Interfaces

### useProjects Hook

```typescript
// ui/hooks/use-projects.ts
import type { ProjectSummary } from '@/types/components';
import type { NormalizedProjectState } from '@/types/state';

interface UseProjectsReturn {
  /** List of all discovered projects */
  projects: ProjectSummary[];
  /** Name of the currently selected project, or null */
  selectedProject: string | null;
  /** Normalized state for the selected project, or null if not available */
  projectState: NormalizedProjectState | null;
  /** Function to select a project by name */
  selectProject: (name: string) => void;
  /** True while any fetch is in progress */
  isLoading: boolean;
  /** Error message string, or null */
  error: string | null;
}

function useProjects(): UseProjectsReturn;
```

### ProjectSummary Type (already exists at `@/types/components`)

```typescript
import type { PipelineTier } from './state';

export interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
}
```

### NormalizedProjectState Type (already exists at `@/types/state`)

```typescript
export interface NormalizedProjectState {
  schema: string;
  project: NormalizedProjectMeta;
  pipeline: {
    current_tier: PipelineTier;
    human_gate_mode: HumanGateMode;
  };
  planning: NormalizedPlanning;
  execution: NormalizedExecution;
  final_review: NormalizedFinalReview;
  errors: NormalizedErrors;
  limits: NormalizedLimits;
}

// PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted'
// HumanGateMode = 'ask' | 'phase' | 'task' | 'autonomous'
```

### API Endpoint Signatures

**GET `/api/projects`**
```
Response 200: { projects: ProjectSummary[] }
Response 500: { error: string }
```

**GET `/api/projects/[name]/state`**
```
Response 200: { state: NormalizedProjectState }
Response 404: { error: "Project not found" }
Response 422: { error: "Malformed state.json: <parse error>" }
Response 500: { error: string }
```

### Component Props

```typescript
// ProjectSidebar
interface ProjectSidebarProps {
  projects: ProjectSummary[];
  selectedProject: string | null;
  onSelectProject: (name: string) => void;
  isLoading: boolean;
}

// ProjectListItem
interface ProjectListItemProps {
  project: ProjectSummary;
  selected: boolean;
  onClick: () => void;
}

// SidebarSearch
interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
}
```

### Badge Imports (from `@/components/badges`)

```typescript
import { PipelineTierBadge, WarningBadge } from "@/components/badges";

// PipelineTierBadge usage:
<PipelineTierBadge tier={project.tier} />
// Accepts: PipelineTier | "not_initialized"
// "not_initialized" renders as "Not Started" in slate

// WarningBadge usage:
<WarningBadge message="Malformed state" />
// Renders amber triangle icon + message text
```

### shadcn Sidebar Imports (from `@/components/ui/sidebar`)

```typescript
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
```

### Other UI Imports

```typescript
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react"; // For SidebarSearch icon
```

## Styles & Design Tokens

### Sidebar Layout
- `--sidebar-bg`: Sidebar background (maps to `--color-card`)
- `--sidebar-width`: `260px` expanded width
- `--sidebar-collapsed-width`: `48px` collapsed width

### ProjectListItem States
| State | Styles |
|-------|--------|
| Default | `text-muted-foreground`, transparent background |
| Hover | `bg-accent/50` background, pointer cursor |
| Selected | `bg-accent` background, `text-accent-foreground`, 2px left border in `var(--color-link)` |
| Focused (keyboard) | `ring-2 ring-ring ring-offset-2` |

### Typography
- Project name in sidebar item: `text-sm` (14px/20px)
- "Projects" label: `text-base` (16px/24px)
- Footer count: `text-xs text-muted-foreground` (12px/16px)
- Search input placeholder: `text-sm`

### Spacing
- List item vertical padding: `spacing-3` (12px) — use `py-3`
- Section gaps: `spacing-4` (16px) — use `p-4` or `gap-4`
- Icon-to-text gap: `spacing-1` (4px) — use `gap-1`

## Test Requirements

- [ ] `useProjects` returns `isLoading: true` during initial project list fetch
- [ ] `useProjects` fetches project list on mount from `/api/projects`
- [ ] `useProjects` restores selected project from `localStorage` on mount
- [ ] `useProjects` fetches state from `/api/projects/{name}/state` when `selectProject` is called
- [ ] `useProjects` sets `projectState` to `null` on 404 response (no state file)
- [ ] `useProjects` sets error message on 422 response (malformed state)
- [ ] `SidebarSearch` filters project list case-insensitively by substring match
- [ ] `ProjectListItem` shows `WarningBadge` when `project.hasMalformedState === true`
- [ ] `ProjectListItem` shows `PipelineTierBadge` for normal projects
- [ ] `ProjectSidebar` renders `SidebarMenuSkeleton` placeholders while loading
- [ ] `ProjectSidebar` shows "No matching projects" when search yields empty results

## Acceptance Criteria

- [ ] `useProjects` fetches project list on mount and a project's state on selection
- [ ] Selected project persists in `localStorage` (key `monitoring-ui-selected-project`) across page reloads
- [ ] Sidebar renders all workspace projects with correct tier badges via `PipelineTierBadge`
- [ ] Search input filters the project list by name (case-insensitive substring match)
- [ ] Malformed-state projects show `WarningBadge` with message "Malformed state" instead of tier badge
- [ ] Not-initialized projects show tier badge reading "Not Started" in slate color (via `PipelineTierBadge` with `tier="not_initialized"`)
- [ ] Selected project item has visual differentiation: `bg-accent` background + 2px left border in `var(--color-link)`
- [ ] Loading state shows skeleton placeholders in the sidebar
- [ ] Error state from API is captured in `error` return value
- [ ] All 3 sidebar components export from `ui/components/sidebar/index.ts`
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No lint errors (`npm run lint`)

## Constraints

- Do NOT modify any existing files — only CREATE the 5 files listed in File Targets
- Do NOT create any test files — no unit test framework is set up yet
- Do NOT install any new packages — all needed dependencies are already installed
- Do NOT use hardcoded color values — use CSS custom properties and Tailwind utility classes only
- Do NOT reference external planning/architecture/design documents — this handoff is self-contained
- Do NOT implement SSE or real-time updates — this task uses fetch-on-action only
- Every component file must start with `"use client"` directive
- Use the kebab-case file naming convention matching existing files (e.g., `project-sidebar.tsx`, not `ProjectSidebar.tsx`)
- Import types from `@/types/state` and `@/types/components` — do NOT redefine them
- The hook file goes in `ui/hooks/` (alongside existing `use-mobile.ts`), NOT in `ui/lib/hooks/`
