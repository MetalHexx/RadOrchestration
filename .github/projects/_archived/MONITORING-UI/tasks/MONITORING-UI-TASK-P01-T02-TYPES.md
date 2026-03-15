---
project: "MONITORING-UI"
phase: 1
task: 2
title: "TypeScript Type Definitions"
status: "pending"
skills_required: ["typescript"]
skills_optional: []
estimated_files: 4
---

# TypeScript Type Definitions

## Objective

Create all four TypeScript type definition files (`ui/types/state.ts`, `ui/types/config.ts`, `ui/types/events.ts`, `ui/types/components.ts`) that define the domain model consumed by every other module in the application — raw and normalized state types, orchestration config types, SSE event types, and UI component prop types.

## Context

The `/ui` directory is a Next.js 14 App Router project with TypeScript, Tailwind CSS v4, and shadcn/ui already initialized (T1 complete). The `tsconfig.json` has a `@/*` path alias mapping to `./`. The `ui/types/` directory does not yet exist and must be created. These type definitions form the Domain Layer and have zero runtime dependencies — they are pure TypeScript type declarations. The `types/state.ts` file is the foundation: it is imported by `types/events.ts` and `types/components.ts`. The `types/config.ts` file is standalone with no cross-type imports. All downstream modules (normalizer, fs-reader, API routes, hooks, components) import from `@/types/*`.

### Carry-Forward from T1 Review

- Theme extensions should go in the `@theme inline` block in `globals.css`, not in `tailwind.config.ts` (informational — does not affect this task).
- The `@tailwindcss/typography` plugin (`^0.5.19`) is v3-era — verify compatibility when prose content is introduced in later tasks (informational — does not affect this task).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/types/state.ts` | All enum union types, planning step names, raw state interfaces (v1+v2), normalized state interfaces |
| CREATE | `ui/types/config.ts` | Raw `OrchestrationConfig` and display-grouped `ParsedConfig` interfaces |
| CREATE | `ui/types/events.ts` | SSE event types, event payloads. Imports from `./state` |
| CREATE | `ui/types/components.ts` | Sidebar summary, gate entry, document frontmatter, document response. Imports from `./state` |

## Implementation Steps

1. **Create `ui/types/` directory** if it does not exist.

2. **Create `ui/types/state.ts`** with the exact contents specified in the Contracts section below. This file defines:
   - All enum union types (`PipelineTier`, `PlanningStatus`, `PlanningStepStatus`, `PhaseStatus`, `TaskStatus`, `ReviewVerdict`, `TaskReviewAction`, `PhaseReviewAction`, `Severity`, `HumanGateMode`, `FinalReviewStatus`)
   - `PlanningStepName` type and `PLANNING_STEP_ORDER` const array
   - Raw state interfaces (`RawStateJson`, `RawPhase`, `RawTask`) with comments marking v1-only and v2-only fields
   - Normalized interfaces (`NormalizedProjectState`, `NormalizedProjectMeta`, `NormalizedPlanning`, `NormalizedExecution`, `NormalizedPhase`, `NormalizedTask`, `NormalizedFinalReview`, `NormalizedErrors`, `NormalizedLimits`)

3. **Create `ui/types/config.ts`** with the exact contents specified in the Contracts section below. This file defines:
   - `OrchestrationConfig` — mirrors the raw `orchestration.yml` structure
   - `ParsedConfig` — grouped display format for the Config Drawer, with locked gate entries

4. **Create `ui/types/events.ts`** with the exact contents specified in the Contracts section below. This file defines:
   - `SSEEventType` union type
   - `SSEEvent<T>` generic interface
   - `SSEPayloadMap` interface mapping event types to payload shapes
   - Imports `NormalizedProjectState` from `./state`

5. **Create `ui/types/components.ts`** with the exact contents specified in the Contracts section below. This file defines:
   - `ProjectSummary` — sidebar project entry
   - `GateEntry` — gate history timeline entry
   - `DocumentFrontmatter` — extracted frontmatter metadata
   - `DocumentResponse` — API response for document content
   - Imports `PipelineTier` from `./state`

6. **Verify TypeScript compilation** — run `npx tsc --noEmit` from the `ui/` directory and confirm zero errors.

## Contracts & Interfaces

### `ui/types/state.ts`

```typescript
// ─── Enum Union Types ───────────────────────────────────────────────────────
// Ported from src/lib/constants.js frozen enum objects

export type PipelineTier = 'planning' | 'execution' | 'review' | 'complete' | 'halted';

export type PlanningStatus = 'not_started' | 'in_progress' | 'complete';

export type PlanningStepStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'skipped';

export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'halted';

export type ReviewVerdict = 'approved' | 'changes_requested' | 'rejected';

export type TaskReviewAction = 'advanced' | 'corrective_task_issued' | 'halted';

export type PhaseReviewAction = 'advanced' | 'corrective_tasks_issued' | 'halted';

export type Severity = 'minor' | 'critical';

export type HumanGateMode = 'ask' | 'phase' | 'task' | 'autonomous';

export type FinalReviewStatus = 'not_started' | 'in_progress' | 'complete' | 'failed';

// ─── Planning Step Names ────────────────────────────────────────────────────

export type PlanningStepName = 'research' | 'prd' | 'design' | 'architecture' | 'master_plan';

export const PLANNING_STEP_ORDER: readonly PlanningStepName[] = [
  'research', 'prd', 'design', 'architecture', 'master_plan'
] as const;

// ─── Raw State Types (as read from disk) ────────────────────────────────────
// Supports both v1 and v2 schemas

export interface RawStateJson {
  $schema?: string;
  project: {
    name: string;
    description?: string;       // v2 only
    created: string;            // ISO 8601
    updated: string;            // ISO 8601
    brainstorming_doc?: string; // v2 only
  };
  pipeline: {
    current_tier: PipelineTier;
    human_gate_mode: HumanGateMode;
  };
  planning: {
    status: PlanningStatus;
    steps: Record<PlanningStepName, {
      status: PlanningStepStatus;
      output: string | null;
    }>;
    human_approved: boolean;
  };
  execution: {
    status: 'not_started' | 'in_progress' | 'complete' | 'halted';
    current_phase: number;
    total_phases: number;
    phases: RawPhase[];
  };
  final_review: {
    status: FinalReviewStatus;
    report_doc: string | null;
    human_approved: boolean;
  };
  errors: {
    total_retries: number;
    total_halts: number;
    active_blockers: string[];
  };
  limits: {
    max_phases: number;
    max_tasks_per_phase: number;
    max_retries_per_task: number;
  };
}

export interface RawPhase {
  phase_number: number;
  title?: string;               // v2
  name?: string;                // v1
  status: PhaseStatus;
  phase_doc?: string | null;    // v2
  plan_doc?: string | null;     // v1
  current_task: number;
  total_tasks: number;
  tasks: RawTask[];
  phase_report: string | null;
  human_approved: boolean;
  phase_review?: string | null;
  phase_review_verdict?: ReviewVerdict | null;
  phase_review_action?: PhaseReviewAction | null;
}

export interface RawTask {
  task_number: number;
  title?: string;               // v2
  name?: string;                // v1
  status: TaskStatus;
  handoff_doc: string | null;
  report_doc: string | null;
  retries: number;
  last_error: string | null;
  severity: Severity | null;
  review_doc?: string | null;
  review_verdict?: ReviewVerdict | null;
  review_action?: TaskReviewAction | null;
}

// ─── Normalized Types (consumed by all UI components) ───────────────────────
// v1 fields are mapped to v2 field names; absent fields default to null

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

export interface NormalizedProjectMeta {
  name: string;
  description: string | null;
  created: string;
  updated: string;
  brainstorming_doc: string | null;
}

export interface NormalizedPlanning {
  status: PlanningStatus;
  steps: Record<PlanningStepName, {
    status: PlanningStepStatus;
    output: string | null;
  }>;
  human_approved: boolean;
}

export interface NormalizedExecution {
  status: 'not_started' | 'in_progress' | 'complete' | 'halted';
  current_phase: number;
  total_phases: number;
  phases: NormalizedPhase[];
}

export interface NormalizedPhase {
  phase_number: number;
  title: string;
  status: PhaseStatus;
  phase_doc: string | null;
  current_task: number;
  total_tasks: number;
  tasks: NormalizedTask[];
  phase_report: string | null;
  human_approved: boolean;
  phase_review: string | null;
  phase_review_verdict: ReviewVerdict | null;
  phase_review_action: PhaseReviewAction | null;
}

export interface NormalizedTask {
  task_number: number;
  title: string;
  status: TaskStatus;
  handoff_doc: string | null;
  report_doc: string | null;
  retries: number;
  last_error: string | null;
  severity: Severity | null;
  review_doc: string | null;
  review_verdict: ReviewVerdict | null;
  review_action: TaskReviewAction | null;
}

export interface NormalizedFinalReview {
  status: FinalReviewStatus;
  report_doc: string | null;
  human_approved: boolean;
}

export interface NormalizedErrors {
  total_retries: number;
  total_halts: number;
  active_blockers: string[];
}

export interface NormalizedLimits {
  max_phases: number;
  max_tasks_per_phase: number;
  max_retries_per_task: number;
}
```

### `ui/types/config.ts`

```typescript
export interface OrchestrationConfig {
  version: string;
  projects: {
    base_path: string;
    naming: string;
  };
  limits: {
    max_phases: number;
    max_tasks_per_phase: number;
    max_retries_per_task: number;
    max_consecutive_review_rejections: number;
  };
  errors: {
    severity: {
      critical: string[];
      minor: string[];
    };
    on_critical: string;
    on_minor: string;
  };
  git: {
    strategy: string;
    branch_prefix: string;
    commit_prefix: string;
    auto_commit: boolean;
  };
  human_gates: {
    after_planning: boolean;
    execution_mode: string;
    after_final_review: boolean;
  };
}

/** Grouped config for the Config Drawer display */
export interface ParsedConfig {
  projectStorage: {
    basePath: string;
    naming: string;
  };
  pipelineLimits: {
    maxPhases: number;
    maxTasksPerPhase: number;
    maxRetriesPerTask: number;
    maxConsecutiveReviewRejections: number;
  };
  errorHandling: {
    critical: string[];
    minor: string[];
    onCritical: string;
    onMinor: string;
  };
  gitStrategy: {
    strategy: string;
    branchPrefix: string;
    commitPrefix: string;
    autoCommit: boolean;
  };
  humanGates: {
    afterPlanning: { value: boolean; locked: true };
    executionMode: string;
    afterFinalReview: { value: boolean; locked: true };
  };
}
```

### `ui/types/events.ts`

```typescript
import type { NormalizedProjectState } from './state';

/** SSE event types sent from server to client */
export type SSEEventType = 'state_change' | 'project_added' | 'project_removed' | 'connected';

export interface SSEEvent<T extends SSEEventType = SSEEventType> {
  type: T;
  timestamp: string;      // ISO 8601
  payload: SSEPayloadMap[T];
}

export interface SSEPayloadMap {
  state_change: {
    projectName: string;
    state: NormalizedProjectState;
  };
  project_added: {
    projectName: string;
  };
  project_removed: {
    projectName: string;
  };
  connected: {
    projects: string[];
  };
}
```

### `ui/types/components.ts`

```typescript
import type { PipelineTier } from './state';

/** Sidebar project entry */
export interface ProjectSummary {
  name: string;
  tier: PipelineTier | 'not_initialized';
  hasState: boolean;
  hasMalformedState: boolean;
  errorMessage?: string;
  brainstormingDoc?: string | null;
}

/** Gate history entry for the timeline */
export interface GateEntry {
  gate: string;           // e.g., "Post-Planning", "Phase 1", "Final Review"
  approved: boolean;
  timestamp?: string;     // ISO 8601 if available
}

/** Document frontmatter metadata */
export interface DocumentFrontmatter {
  [key: string]: unknown;
  project?: string;
  status?: string;
  author?: string;
  created?: string;
  verdict?: string;
  severity?: string;
  phase?: number;
  task?: number;
  title?: string;
}

/** API response for document content */
export interface DocumentResponse {
  frontmatter: DocumentFrontmatter;
  content: string;        // Markdown body (frontmatter stripped)
  filePath: string;       // Resolved absolute path (for display)
}
```

## Styles & Design Tokens

This task produces pure TypeScript type definitions with no visual output. No design tokens apply.

## Test Requirements

- [ ] `npx tsc --noEmit` passes with zero errors when run from the `ui/` directory
- [ ] `ui/types/state.ts` is syntactically valid TypeScript and exports all listed types
- [ ] `ui/types/config.ts` is syntactically valid TypeScript and exports all listed types
- [ ] `ui/types/events.ts` successfully imports `NormalizedProjectState` from `./state` and exports all listed types
- [ ] `ui/types/components.ts` successfully imports `PipelineTier` from `./state` and exports all listed types
- [ ] No circular import dependencies exist between the four type files

## Acceptance Criteria

- [ ] `ui/types/state.ts` exports all 11 enum union types (`PipelineTier`, `PlanningStatus`, `PlanningStepStatus`, `PhaseStatus`, `TaskStatus`, `ReviewVerdict`, `TaskReviewAction`, `PhaseReviewAction`, `Severity`, `HumanGateMode`, `FinalReviewStatus`), the `PlanningStepName` type, the `PLANNING_STEP_ORDER` const array, `RawStateJson`, `RawPhase`, `RawTask`, and all 9 normalized interfaces (`NormalizedProjectState`, `NormalizedProjectMeta`, `NormalizedPlanning`, `NormalizedExecution`, `NormalizedPhase`, `NormalizedTask`, `NormalizedFinalReview`, `NormalizedErrors`, `NormalizedLimits`)
- [ ] `ui/types/config.ts` exports `OrchestrationConfig` and `ParsedConfig` interfaces
- [ ] `ui/types/events.ts` exports `SSEEventType`, `SSEEvent`, `SSEPayloadMap` types/interfaces
- [ ] `ui/types/components.ts` exports `ProjectSummary`, `GateEntry`, `DocumentFrontmatter`, `DocumentResponse` interfaces
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds with zero errors
- [ ] No lint errors from `npm run lint`

## Constraints

- Do NOT create any runtime code — these files contain only type definitions and the single `PLANNING_STEP_ORDER` const array
- Do NOT import from any npm package — only cross-imports between the four type files are allowed (`./state`)
- Do NOT add `index.ts` barrel exports — downstream modules import directly from `@/types/state`, `@/types/config`, etc.
- Do NOT modify any existing files — all four files are CREATE actions
- Do NOT add JSDoc descriptions beyond what is specified in the contracts above — keep the files clean and concise
- Match the exact field names, types, and optional markers (`?`) from the contracts — downstream modules depend on these exact shapes
