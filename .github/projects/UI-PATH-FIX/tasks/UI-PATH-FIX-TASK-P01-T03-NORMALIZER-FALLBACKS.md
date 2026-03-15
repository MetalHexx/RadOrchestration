---
project: "UI-PATH-FIX"
phase: 1
task: 3
title: "UI Normalizer Fallback Chains"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# UI Normalizer Fallback Chains

## Objective

Add index-based fallback chains to `normalizePhase` and `normalizeTask` in the UI normalizer so that phases and tasks display correct numbers even when `phase_number` / `task_number` are missing from raw state. Update `normalizeState` call sites to pass the array index through to these functions.

## Context

The pipeline mutation handlers now populate `phase_number` and `task_number` on newly created state objects (fixed in a prior task), but existing/historical `state.json` files may still lack these fields. The UI normalizer (`ui/lib/normalizer.ts`) must derive sensible fallback values using a priority chain: explicit field → parse numeric suffix from the `id` string → array index + 1. The `RawPhase` and `RawTask` types already type `phase_number` and `task_number` as `number` (which will be `undefined` at runtime when absent from JSON). The `NormalizedPhase` and `NormalizedTask` types require `phase_number: number` and `task_number: number` — they must never be `undefined`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/lib/normalizer.ts` | Add `index` param to `normalizePhase` and `normalizeTask`; implement fallback chains; update `normalizeState` call sites |

## Current File Content

The complete current content of `ui/lib/normalizer.ts` is below. This is the sole file to modify.

```typescript
import type {
  RawStateJson,
  NormalizedProjectState,
  RawPhase,
  NormalizedPhase,
  RawTask,
  NormalizedTask,
} from '@/types/state';

/** Detect schema version from the $schema field. Returns 1 or 2. */
export function detectSchemaVersion(raw: RawStateJson): 1 | 2 {
  return raw.$schema ? 2 : 1;
}

/** Normalize a raw task object, mapping v1 field names to v2. */
export function normalizeTask(raw: RawTask): NormalizedTask {
  return {
    task_number: raw.task_number,
    title: raw.title ?? raw.name ?? 'Unnamed Task',
    status: raw.status,
    handoff_doc: raw.handoff_doc,
    report_doc: raw.report_doc,
    retries: raw.retries,
    last_error: raw.last_error,
    severity: raw.severity,
    review_doc: raw.review_doc ?? null,
    review_verdict: raw.review_verdict ?? null,
    review_action: raw.review_action ?? null,
  };
}

/** Normalize a raw phase object, mapping v1 field names to v2. */
export function normalizePhase(raw: RawPhase): NormalizedPhase {
  return {
    phase_number: raw.phase_number,
    title: raw.title ?? raw.name ?? 'Unnamed Phase',
    status: raw.status,
    phase_doc: raw.phase_doc ?? raw.plan_doc ?? null,
    current_task: raw.current_task,
    total_tasks: raw.total_tasks,
    tasks: raw.tasks.map(normalizeTask),
    phase_report: raw.phase_report,
    human_approved: raw.human_approved,
    phase_review: raw.phase_review ?? null,
    phase_review_verdict: raw.phase_review_verdict ?? null,
    phase_review_action: raw.phase_review_action ?? null,
  };
}

/** Normalize a raw state.json (v1 or v2) into the canonical normalized form. */
export function normalizeState(raw: RawStateJson): NormalizedProjectState {
  return {
    schema: raw.$schema ?? 'orchestration-state-v1',
    project: {
      name: raw.project.name,
      description: raw.project.description ?? null,
      created: raw.project.created,
      updated: raw.project.updated,
      brainstorming_doc: raw.project.brainstorming_doc ?? null,
    },
    pipeline: raw.pipeline,
    planning: raw.planning,
    execution: {
      status: raw.execution.status,
      current_phase: raw.execution.current_phase,
      total_phases: raw.execution.total_phases,
      phases: raw.execution.phases.map(normalizePhase),
    },
    final_review: raw.final_review,
    errors: raw.errors,
    limits: raw.limits,
  };
}
```

## Contracts & Interfaces

### Updated Function Signatures

```typescript
// ui/lib/normalizer.ts — normalizePhase updated signature
export function normalizePhase(raw: RawPhase, index: number): NormalizedPhase;
```

```typescript
// ui/lib/normalizer.ts — normalizeTask updated signature
export function normalizeTask(raw: RawTask, index: number): NormalizedTask;
```

### Phase Fallback Chain (Contract 5)

| Field | Priority 1 | Priority 2 | Priority 3 |
|-------|-----------|-----------|-----------|
| `phase_number` | `raw.phase_number` | Parse numeric suffix from `raw.id` (e.g., `"P01"` → `1`) | `index + 1` |
| `title` | `raw.title` | `raw.name` | `'Unnamed Phase'` (already implemented) |
| `total_tasks` | `raw.total_tasks` | `raw.tasks?.length` | `0` |

### Task Fallback Chain (Contract 6)

| Field | Priority 1 | Priority 2 | Priority 3 |
|-------|-----------|-----------|-----------|
| `task_number` | `raw.task_number` | Parse numeric suffix from `raw.id` (e.g., `"T01"` → `1`) | `index + 1` |
| `title` | `raw.title` | `raw.name` | `'Unnamed Task'` (already implemented) |

### ID Parsing Logic

Strip leading non-digit characters from the `id` string, then parse the remaining string as a base-10 integer. If the result is `NaN`, fall through to the index-based fallback.

Examples:
- `"P01"` → strip `"P"` → `"01"` → `parseInt("01", 10)` → `1`
- `"T03"` → strip `"T"` → `"03"` → `parseInt("03", 10)` → `3`
- `"P10"` → strip `"P"` → `"10"` → `parseInt("10", 10)` → `10`
- `"phase-2"` → strip `"phase-"` → `"2"` → `parseInt("2", 10)` → `2`
- `undefined` → skip (fall through to index)
- `""` → strip → `""` → `parseInt("", 10)` → `NaN` → fall through to index

### Raw Input Types (from `ui/types/state.ts` — unchanged)

```typescript
export interface RawPhase {
  phase_number: number;       // may be undefined at runtime when absent from JSON
  title?: string;
  name?: string;
  status: PhaseStatus;
  phase_doc?: string | null;
  plan_doc?: string | null;
  current_task: number;
  total_tasks: number;        // may be undefined at runtime when absent from JSON
  tasks: RawTask[];
  phase_report: string | null;
  human_approved: boolean;
  phase_review?: string | null;
  phase_review_verdict?: ReviewVerdict | null;
  phase_review_action?: PhaseReviewAction | null;
}

export interface RawTask {
  task_number: number;        // may be undefined at runtime when absent from JSON
  title?: string;
  name?: string;
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

**Note**: `RawPhase` and `RawTask` do NOT have an `id` field in the TypeScript interface, but the actual JSON objects in `state.json` DO contain `id` fields (e.g., `"id": "T01"`). Access `(raw as any).id` to read the `id` field, since modifying the type definitions is out of scope.

### Normalized Output Types (from `ui/types/state.ts` — unchanged)

```typescript
export interface NormalizedPhase {
  phase_number: number;       // MUST be a valid number, never undefined
  title: string;
  status: PhaseStatus;
  phase_doc: string | null;
  current_task: number;
  total_tasks: number;        // MUST be a valid number, never undefined
  tasks: NormalizedTask[];
  phase_report: string | null;
  human_approved: boolean;
  phase_review: string | null;
  phase_review_verdict: ReviewVerdict | null;
  phase_review_action: PhaseReviewAction | null;
}

export interface NormalizedTask {
  task_number: number;        // MUST be a valid number, never undefined
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
```

## Styles & Design Tokens

Not applicable — this task modifies only the data transformation layer. No UI components or visual output are changed.

## Implementation Steps

1. **Add a helper function** `parseIdNumber(id: unknown): number | undefined` above `normalizeTask`. It should: check that `id` is a non-empty string; strip all leading non-digit characters using a regex like `/^\D+/`; parse the remainder with `parseInt(remainder, 10)`; return the result if it is not `NaN`, otherwise return `undefined`.

2. **Update `normalizeTask` signature** from `(raw: RawTask)` to `(raw: RawTask, index: number)`.

3. **Replace the `task_number` assignment** in `normalizeTask` from `raw.task_number` to: `raw.task_number ?? parseIdNumber((raw as any).id) ?? (index + 1)`.

4. **Update `normalizePhase` signature** from `(raw: RawPhase)` to `(raw: RawPhase, index: number)`.

5. **Replace the `phase_number` assignment** in `normalizePhase` from `raw.phase_number` to: `raw.phase_number ?? parseIdNumber((raw as any).id) ?? (index + 1)`.

6. **Replace the `total_tasks` assignment** in `normalizePhase` from `raw.total_tasks` to: `raw.total_tasks ?? raw.tasks?.length ?? 0`.

7. **Update the `tasks` mapping inside `normalizePhase`**: Change `raw.tasks.map(normalizeTask)` to `raw.tasks.map((t, i) => normalizeTask(t, i))` so each task receives its array index.

8. **Verify `normalizeState` call sites**: The existing line `phases: raw.execution.phases.map(normalizePhase)` already passes `(element, index)` as the two arguments to `normalizePhase` via `Array.prototype.map`'s callback signature — no change is needed to this line. Confirm this is correct and do not modify it.

## Test Requirements

No automated test infrastructure exists for this file. Verification is manual:

- [ ] TypeScript compiles with no errors (`npx tsc --noEmit` from the `ui/` directory)
- [ ] Given a `RawPhase` with `phase_number: 3` set, `normalizePhase` returns `phase_number: 3` (priority 1 used)
- [ ] Given a `RawPhase` with `phase_number` absent but `id: "P02"`, `normalizePhase` returns `phase_number: 2` (priority 2 used)
- [ ] Given a `RawPhase` with `phase_number` absent and no `id`, `normalizePhase` at index 0 returns `phase_number: 1` (priority 3 used)
- [ ] Given a `RawTask` with `task_number: 5` set, `normalizeTask` returns `task_number: 5` (priority 1 used)
- [ ] Given a `RawTask` with `task_number` absent but `id: "T03"`, `normalizeTask` returns `task_number: 3` (priority 2 used)
- [ ] Given a `RawTask` with `task_number` absent and no `id`, `normalizeTask` at index 0 returns `task_number: 1` (priority 3 used)
- [ ] Given a `RawPhase` with `total_tasks: 5` set, `normalizePhase` returns `total_tasks: 5`
- [ ] Given a `RawPhase` with `total_tasks` absent and `tasks` array of length 3, `normalizePhase` returns `total_tasks: 3`
- [ ] Given a `RawPhase` with `total_tasks` absent and no `tasks`, `normalizePhase` returns `total_tasks: 0`

## Acceptance Criteria

- [ ] `normalizePhase` accepts `(raw: RawPhase, index: number)` — signature updated
- [ ] `normalizeTask` accepts `(raw: RawTask, index: number)` — signature updated
- [ ] `phase_number` fallback chain: `raw.phase_number` → parse `raw.id` suffix → `index + 1`
- [ ] `task_number` fallback chain: `raw.task_number` → parse `raw.id` suffix → `index + 1`
- [ ] `total_tasks` fallback chain: `raw.total_tasks` → `raw.tasks?.length` → `0`
- [ ] ID parsing strips leading non-digit characters, parses remainder as base-10 integer, falls through on `NaN`
- [ ] Existing phases/tasks with `phase_number` / `task_number` already set use the explicit value (no regression)
- [ ] `normalizeState` call site for phases does NOT need modification (`.map()` already provides index)
- [ ] `normalizePhase` inner `.map()` for tasks passes `(t, i) => normalizeTask(t, i)` so tasks get their index
- [ ] No TypeScript compilation errors (`npx tsc --noEmit` passes)
- [ ] No lint errors

## Constraints

- Do NOT modify `ui/types/state.ts` — the raw and normalized types are unchanged
- Do NOT modify any UI components — this task is limited to `ui/lib/normalizer.ts`
- Do NOT add external dependencies
- Do NOT modify the `normalizeState` line `phases: raw.execution.phases.map(normalizePhase)` — `Array.prototype.map` already passes `(element, index)` which matches the new `(raw, index)` signature
- Do NOT modify `detectSchemaVersion` — it is unrelated
- Follow the existing code style: no semicolons are used in the existing file — **correction**: the existing file does use semicolons; follow the existing convention exactly
- The `parseIdNumber` helper must handle `undefined`, `null`, empty string, and non-string inputs without throwing
