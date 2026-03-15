---
project: "MONITORING-UI"
phase: 1
task: 4
title: "Domain Utilities"
status: "pending"
skills_required: ["typescript"]
skills_optional: []
estimated_files: 2
---

# Domain Utilities

## Objective

Implement the state normalizer (`ui/lib/normalizer.ts`) that maps v1 and v2 `state.json` schemas into a uniform normalized shape, and the config transformer (`ui/lib/config-transformer.ts`) that converts raw `OrchestrationConfig` from YAML into grouped `ParsedConfig` with locked gate entries. All UI components and API routes consume only these normalized/transformed types.

## Context

The infrastructure layer (T3) provides `fs-reader.ts` which reads raw `state.json` as `RawStateJson` and `orchestration.yml` as `OrchestrationConfig`. The type definitions (T2) define both raw input types (`RawStateJson`, `RawPhase`, `RawTask`, `OrchestrationConfig`) and normalized output types (`NormalizedProjectState`, `NormalizedPhase`, `NormalizedTask`, `ParsedConfig`). The normalizer sits between `fs-reader` and API route handlers — routes call `readProjectState()` to get raw data, then `normalizeState()` to produce the normalized form. Similarly, routes call `readConfig()` then `transformConfig()`. The workspace contains real `state.json` files in both v1 and v2 formats under `.github/projects/`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `ui/lib/normalizer.ts` | State normalizer — exports 4 functions |
| CREATE | `ui/lib/config-transformer.ts` | Config transformer — exports 1 function |

## Implementation Steps

1. **Create `ui/lib/normalizer.ts`** — add imports for all raw and normalized types from `@/types/state`.

2. **Implement `detectSchemaVersion(raw: RawStateJson): 1 | 2`** — return `2` if `raw.$schema` is defined and truthy, otherwise return `1`.

3. **Implement `normalizeTask(raw: RawTask): NormalizedTask`** — map `raw.name` (v1) or `raw.title` (v2) to `title` (fall back to `"Unnamed Task"` if both are absent). Default absent v2-only fields (`review_doc`, `review_verdict`, `review_action`) to `null` using nullish coalescing (`?? null`).

4. **Implement `normalizePhase(raw: RawPhase): NormalizedPhase`** — map `raw.name` (v1) or `raw.title` (v2) to `title` (fall back to `"Unnamed Phase"`). Map `raw.plan_doc` (v1) or `raw.phase_doc` (v2) to `phase_doc`. Default absent v2-only fields (`phase_review`, `phase_review_verdict`, `phase_review_action`) to `null`. Call `normalizeTask()` on each task in `raw.tasks`.

5. **Implement `normalizeState(raw: RawStateJson): NormalizedProjectState`** — map `raw.$schema` to `schema` (default `"orchestration-state-v1"` if absent). Default `raw.project.description` and `raw.project.brainstorming_doc` to `null`. Pass through `pipeline`, `planning`, `final_review`, `errors`, `limits` unchanged. Call `normalizePhase()` on each phase in `raw.execution.phases`.

6. **Export all four functions** as named exports.

7. **Create `ui/lib/config-transformer.ts`** — add imports for `OrchestrationConfig` and `ParsedConfig` from `@/types/config`.

8. **Implement `transformConfig(raw: OrchestrationConfig): ParsedConfig`** — map each flat YAML section into the grouped camelCase structure. Wrap `after_planning` and `after_final_review` as `{ value: boolean, locked: true as const }`.

9. **Export `transformConfig`** as a named export.

10. **Verify** — run `npx tsc --noEmit` from the `ui/` directory to confirm zero type errors.

## Contracts & Interfaces

### Input Types — `ui/types/state.ts` (already exist, do NOT recreate)

```typescript
// Enum union types consumed by normalizer
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
export type PlanningStepName = 'research' | 'prd' | 'design' | 'architecture' | 'master_plan';

// Raw types (as read from disk — supports v1 and v2)
export interface RawStateJson {
  $schema?: string;
  project: {
    name: string;
    description?: string;       // v2 only
    created: string;
    updated: string;
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
```

### Output Types — `ui/types/state.ts` (already exist, do NOT recreate)

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

### Config Types — `ui/types/config.ts` (already exist, do NOT recreate)

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

### Normalizer Function Signatures — `ui/lib/normalizer.ts`

```typescript
import type {
  RawStateJson, NormalizedProjectState,
  RawPhase, NormalizedPhase,
  RawTask, NormalizedTask
} from '@/types/state';

/** Detect schema version from the $schema field. Returns 1 or 2. */
export function detectSchemaVersion(raw: RawStateJson): 1 | 2;

/** Normalize a raw task object, mapping v1 field names to v2. */
export function normalizeTask(raw: RawTask): NormalizedTask;

/** Normalize a raw phase object, mapping v1 field names to v2. */
export function normalizePhase(raw: RawPhase): NormalizedPhase;

/** Normalize a raw state.json (v1 or v2) into the canonical normalized form. */
export function normalizeState(raw: RawStateJson): NormalizedProjectState;
```

### Config Transformer Function Signature — `ui/lib/config-transformer.ts`

```typescript
import type { OrchestrationConfig, ParsedConfig } from '@/types/config';

/** Transform the raw orchestration config into the grouped display format. */
export function transformConfig(raw: OrchestrationConfig): ParsedConfig;
```

## Field Mapping Tables

### v1 → v2 Phase Field Mapping

| v1 Field | v2 / Normalized Field | Mapping Rule |
|----------|----------------------|--------------|
| `phase.name` | `title` | Use `raw.title ?? raw.name ?? "Unnamed Phase"` |
| `phase.plan_doc` | `phase_doc` | Use `raw.phase_doc ?? raw.plan_doc ?? null` |
| *(absent)* | `phase_review` | Default to `raw.phase_review ?? null` |
| *(absent)* | `phase_review_verdict` | Default to `raw.phase_review_verdict ?? null` |
| *(absent)* | `phase_review_action` | Default to `raw.phase_review_action ?? null` |

### v1 → v2 Task Field Mapping

| v1 Field | v2 / Normalized Field | Mapping Rule |
|----------|----------------------|--------------|
| `task.name` | `title` | Use `raw.title ?? raw.name ?? "Unnamed Task"` |
| *(absent)* | `review_doc` | Default to `raw.review_doc ?? null` |
| *(absent)* | `review_verdict` | Default to `raw.review_verdict ?? null` |
| *(absent)* | `review_action` | Default to `raw.review_action ?? null` |

### v1 → v2 Project-Level Mapping

| v1 Field | v2 / Normalized Field | Mapping Rule |
|----------|----------------------|--------------|
| `$schema` (absent) | `schema` | Use `raw.$schema ?? "orchestration-state-v1"` |
| *(absent)* | `project.description` | Default to `raw.project.description ?? null` |
| *(absent)* | `project.brainstorming_doc` | Default to `raw.project.brainstorming_doc ?? null` |

### OrchestrationConfig → ParsedConfig Mapping

| Raw Path | Parsed Path | Mapping Rule |
|----------|-------------|--------------|
| `projects.base_path` | `projectStorage.basePath` | Direct copy |
| `projects.naming` | `projectStorage.naming` | Direct copy |
| `limits.max_phases` | `pipelineLimits.maxPhases` | Direct copy |
| `limits.max_tasks_per_phase` | `pipelineLimits.maxTasksPerPhase` | Direct copy |
| `limits.max_retries_per_task` | `pipelineLimits.maxRetriesPerTask` | Direct copy |
| `limits.max_consecutive_review_rejections` | `pipelineLimits.maxConsecutiveReviewRejections` | Direct copy |
| `errors.severity.critical` | `errorHandling.critical` | Direct copy (string array) |
| `errors.severity.minor` | `errorHandling.minor` | Direct copy (string array) |
| `errors.on_critical` | `errorHandling.onCritical` | Direct copy |
| `errors.on_minor` | `errorHandling.onMinor` | Direct copy |
| `git.strategy` | `gitStrategy.strategy` | Direct copy |
| `git.branch_prefix` | `gitStrategy.branchPrefix` | Direct copy |
| `git.commit_prefix` | `gitStrategy.commitPrefix` | Direct copy |
| `git.auto_commit` | `gitStrategy.autoCommit` | Direct copy |
| `human_gates.after_planning` | `humanGates.afterPlanning` | Wrap: `{ value: raw.human_gates.after_planning, locked: true as const }` |
| `human_gates.execution_mode` | `humanGates.executionMode` | Direct copy |
| `human_gates.after_final_review` | `humanGates.afterFinalReview` | Wrap: `{ value: raw.human_gates.after_final_review, locked: true as const }` |

## Styles & Design Tokens

Not applicable — these are pure data-transformation modules with no UI rendering.

## Test Requirements

- [ ] `npx tsc --noEmit` passes with zero type errors
- [ ] `normalizeState()` given a v2 `RawStateJson` (with `$schema` field) returns a `NormalizedProjectState` where `schema === "orchestration-state-v2"` and all fields are populated
- [ ] `normalizeState()` given a v1 `RawStateJson` (without `$schema`, using `name` and `plan_doc`) returns a `NormalizedProjectState` where `schema === "orchestration-state-v1"`, phase titles come from `name`, and phase docs come from `plan_doc`
- [ ] `normalizeTask()` on a v1 task (has `name`, no `title`) returns `title` from `name` and `review_doc`, `review_verdict`, `review_action` all as `null`
- [ ] `normalizePhase()` on a v1 phase (has `name`/`plan_doc`, no `title`/`phase_doc`) returns `title` from `name`, `phase_doc` from `plan_doc`, and `phase_review`/`phase_review_verdict`/`phase_review_action` all as `null`
- [ ] `detectSchemaVersion()` returns `2` for a raw state with `$schema` set, `1` for one without
- [ ] `transformConfig()` returns a `ParsedConfig` with all fields mapped correctly from a sample `OrchestrationConfig`
- [ ] `transformConfig()` wraps `after_planning` and `after_final_review` as `{ value: boolean, locked: true }`
- [ ] `npm run build` succeeds with zero errors

## Acceptance Criteria

- [ ] `normalizer.ts` exports `normalizeState()`, `normalizePhase()`, `normalizeTask()`, `detectSchemaVersion()`
- [ ] v1 field mappings correct: `phase.name → title`, `phase.plan_doc → phase_doc`, `task.name → title`
- [ ] Absent v2-only fields default to `null`: `description`, `brainstorming_doc`, `phase_review`, `phase_review_verdict`, `phase_review_action`, `review_doc`, `review_verdict`, `review_action`
- [ ] `config-transformer.ts` exports `transformConfig()` mapping `OrchestrationConfig` → `ParsedConfig`
- [ ] `after_planning` and `after_final_review` gates are wrapped as `{ value: boolean, locked: true }`
- [ ] All imports use `@/types/*` path aliases — no inline type definitions duplicating domain types
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds with zero errors
- [ ] No lint errors from `npm run lint`

## Constraints

- Do NOT modify any existing files — only create the two new files
- Do NOT recreate or duplicate type definitions — import everything from `@/types/state` and `@/types/config`
- Do NOT add any npm dependencies — all required packages are already installed
- Do NOT create test files — test execution is handled by the Reviewer
- Do NOT perform any filesystem operations within these modules — they are pure synchronous transformation functions
- Do NOT reference external documents — all contracts and types are inlined above
