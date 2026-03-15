---
project: "UI-HUMAN-GATE-CONTROLS"
phase: 1
task: 3
title: "Fix normalizer v3 final-review fallback"
status: "pending"
skills: ["run-tests", "generate-task-report"]
estimated_files: 1
---

# Fix normalizer v3 final-review fallback

## Objective

Update `normalizeState()` in `ui/lib/normalizer.ts` so that when `raw.final_review` is undefined (v3 state schema), it constructs the normalized `final_review` object from `execution.final_review_status`, `execution.final_review_doc`, and `execution.final_review_approved` fields instead of returning a hard-coded default. This is a prerequisite for the Final Review section to render in v3 and for the final approval button to work in Phase 2.

## Context

The v3 state schema does not have a top-level `final_review` object. Instead, the pipeline's `mutations.js` stores final review data inside the `execution` object: `execution.final_review_status`, `execution.final_review_doc`, and `execution.final_review_approved`. The current normalizer falls back to a hard-coded `{ status: 'not_started', report_doc: null, human_approved: false }` default when `raw.final_review` is undefined, which means the Final Review section never renders in v3 — even after the final review is completed and approved. The `RawStateJson` TypeScript interface does not declare these v3 execution-embedded fields, so a typed cast is needed to access them.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/lib/normalizer.ts` | Update the `final_review` mapping in `normalizeState()` to fall back to `execution.*` fields for v3 |

## Implementation Steps

1. Open `ui/lib/normalizer.ts` and locate the `normalizeState()` function.

2. Find the current `final_review` mapping (near the end of the returned object):
   ```typescript
   final_review: raw.final_review ?? {
     status: 'not_started' as FinalReviewStatus,
     report_doc: null,
     human_approved: false,
   },
   ```

3. Replace it with logic that, when `raw.final_review` is undefined, reads the v3 execution-embedded fields via a typed cast of `raw.execution`:
   ```typescript
   final_review: raw.final_review ?? {
     status:
       (raw.execution as Record<string, unknown>).final_review_status as FinalReviewStatus
       ?? 'not_started' as FinalReviewStatus,
     report_doc:
       ((raw.execution as Record<string, unknown>).final_review_doc as string) ?? null,
     human_approved:
       ((raw.execution as Record<string, unknown>).final_review_approved as boolean) ?? false,
   },
   ```

4. Verify the logic handles all three v3 scenarios:
   - **v3 after `final_review_completed` mutation**: `execution.final_review_status = 'complete'`, `execution.final_review_doc = '...'`, `execution.final_review_approved` may be `false` or `true`.
   - **v3 after `final_approved` mutation**: All three fields are set, with `final_review_approved = true`.
   - **v3 before any final review activity**: None of the `execution.final_review_*` fields exist → defaults apply (`'not_started'`, `null`, `false`).

5. Verify the v4+ path is unchanged: when `raw.final_review` exists, it is used as-is (the `??` operator short-circuits).

6. Run `npx tsc --noEmit` to verify the project compiles with zero type errors.

## Contracts & Interfaces

### `RawStateJson.execution` (existing — from `ui/types/state.ts`)

```typescript
// ui/types/state.ts — existing interface (relevant excerpt)
export interface RawStateJson {
  // ... other fields ...
  execution: {
    status: 'not_started' | 'in_progress' | 'complete' | 'halted';
    current_tier?: PipelineTier;    // v3: tier moved here from pipeline
    current_phase: number;
    total_phases: number;
    phases: RawPhase[];
    // NOTE: These v3 fields are NOT declared in the interface but exist at runtime:
    //   final_review_status?: FinalReviewStatus;
    //   final_review_doc?: string | null;
    //   final_review_approved?: boolean;
  };
  final_review?: {                  // optional — absent in v3
    status: FinalReviewStatus;
    report_doc: string | null;
    human_approved: boolean;
  };
  // ... other fields ...
}
```

### `NormalizedFinalReview` (existing — from `ui/types/state.ts`)

```typescript
// ui/types/state.ts — the target normalized shape
export interface NormalizedFinalReview {
  status: FinalReviewStatus;        // 'not_started' | 'in_progress' | 'complete' | 'failed'
  report_doc: string | null;
  human_approved: boolean;
}
```

### `FinalReviewStatus` (existing — from `ui/types/state.ts`)

```typescript
export type FinalReviewStatus = 'not_started' | 'in_progress' | 'complete' | 'failed';
```

### Current `normalizeState()` function (full — from `ui/lib/normalizer.ts`)

```typescript
/** Normalize a raw state.json (v1, v2, or v3) into the canonical normalized form. */
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
    pipeline: raw.pipeline ?? {
      current_tier: raw.execution.current_tier ?? 'planning',
      human_gate_mode: 'ask' as HumanGateMode,
    },
    planning: {
      status: raw.planning.status,
      steps: normalizePlanningSteps(raw.planning.steps),
      human_approved: raw.planning.human_approved,
    },
    execution: {
      status: raw.execution.status,
      current_phase: raw.execution.current_phase,
      total_phases: raw.execution.total_phases,
      phases: raw.execution.phases.map((p, i) => normalizePhase(p, i)),
    },
    final_review: raw.final_review ?? {
      status: 'not_started' as FinalReviewStatus,
      report_doc: null,
      human_approved: false,
    },
    errors: raw.errors ?? {
      total_retries: 0,
      total_halts: 0,
      active_blockers: [],
    },
    limits: raw.limits ?? {
      max_phases: 10,
      max_tasks_per_phase: 20,
      max_retries_per_task: 3,
    },
  };
}
```

### v3 mutation patterns (from pipeline `mutations.js` — what writes these fields)

```javascript
// After final_review_completed event:
state.execution.final_review_doc = context.doc_path;
state.execution.final_review_status = 'complete';

// After final_approved event:
state.execution.final_review_approved = true;
state.execution.current_tier = 'complete';
```

## Styles & Design Tokens

Not applicable — this is a data normalization task with no UI rendering.

## Test Requirements

- [ ] **v3 with final review complete and approved**: Given a `RawStateJson` where `final_review` is undefined and `execution` contains `{ final_review_status: 'complete', final_review_doc: '.github/projects/X/reports/FINAL-REVIEW.md', final_review_approved: true }`, `normalizeState()` returns `final_review` as `{ status: 'complete', report_doc: '.github/projects/X/reports/FINAL-REVIEW.md', human_approved: true }`.
- [ ] **v3 with final review complete but not yet approved**: Given a `RawStateJson` where `final_review` is undefined and `execution` contains `{ final_review_status: 'complete', final_review_doc: '.github/projects/X/reports/FINAL-REVIEW.md' }` (no `final_review_approved`), returns `{ status: 'complete', report_doc: '.github/projects/X/reports/FINAL-REVIEW.md', human_approved: false }`.
- [ ] **v3 before any final review activity**: Given a `RawStateJson` where `final_review` is undefined and `execution` has no `final_review_*` fields, returns `{ status: 'not_started', report_doc: null, human_approved: false }`.
- [ ] **v4+ with top-level `final_review`**: Given a `RawStateJson` where `final_review` is `{ status: 'complete', report_doc: 'path/to/report.md', human_approved: true }`, the function returns that object as-is — no fallback logic runs.
- [ ] **All other normalized fields unchanged**: The `schema`, `project`, `pipeline`, `planning`, `execution`, `errors`, and `limits` sections of the normalized output must not be affected by this change.
- [ ] **TypeScript compilation**: `npx tsc --noEmit` passes with zero errors.

## Acceptance Criteria

- [ ] `normalizeState()` returns correct `final_review` when `raw.final_review` is undefined and `execution.final_review_*` fields are present (v3 complete + approved)
- [ ] `normalizeState()` returns correct `final_review` when `raw.final_review` is undefined and `execution.final_review_*` fields are partially present (v3 complete, not yet approved)
- [ ] `normalizeState()` returns default `final_review` (`status: 'not_started'`, `report_doc: null`, `human_approved: false`) when both `raw.final_review` and `execution.final_review_*` fields are absent
- [ ] When `raw.final_review` exists (v4+ schema), it is used as-is — no fallback logic executes
- [ ] All other fields produced by `normalizeState()` are unchanged
- [ ] Build succeeds (`npx tsc --noEmit` passes with zero errors)
- [ ] No lint errors

## Constraints

- **Modify ONLY `ui/lib/normalizer.ts`** — do not modify `ui/types/state.ts` or any other file
- **Do NOT add `final_review_status`, `final_review_doc`, or `final_review_approved` to the `RawStateJson` TypeScript interface** — these are v3-only undeclared fields; access them via a typed cast (`raw.execution as Record<string, unknown>`)
- **Do NOT change the behavior of any other field** in the `normalizeState()` return value — only the `final_review` mapping changes
- **Do NOT modify `normalizePhase()`, `normalizeTask()`, `normalizePlanningSteps()`, or `detectSchemaVersion()`** — they are unrelated to this fix
- **Do NOT create new files** — this is a single-function fix in an existing file
- **Do NOT install any new packages**
