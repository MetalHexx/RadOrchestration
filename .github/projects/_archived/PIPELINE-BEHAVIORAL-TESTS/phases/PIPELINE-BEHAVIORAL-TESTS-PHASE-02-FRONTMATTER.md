---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 2
title: "Frontmatter Alignment, Required-Field Validation, and Pre-Read"
status: "active"
total_tasks: 4
tasks:
  - id: "T01-TEMPLATE-SKILLMD"
    title: "Template & SKILL.md Frontmatter Updates"
    depends_on: []
  - id: "T02-PREREAD-PHASEPLAN"
    title: "Add phase_plan_created Pre-Read Block"
    depends_on: []
  - id: "T03-PREREAD-TASKREPORT"
    title: "Add task_completed Required-Field Validation"
    depends_on: []
  - id: "T04-TRIAGE-VALIDATION"
    title: "Triage Engine Fallback Removal & Required-Field Validation"
    depends_on: ["T03-PREREAD-TASKREPORT"]
author: "tactical-planner-agent"
created: "2026-03-14T23:00:00Z"
---

# Phase 2: Frontmatter Alignment, Required-Field Validation, and Pre-Read

## Phase Goal

Add REQUIRED frontmatter fields to the three skill templates consumed by the pipeline/triage engines, implement the `phase_plan_created` pre-read block, add required-field validation to the pipeline and triage engines (removing all fallback chains), and update SKILL.md instruction files so agents produce the new fields. When complete, every pipeline/triage-consumed frontmatter field is declared REQUIRED in its template, validated at runtime, and documented in the corresponding SKILL.md.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-BEHAVIORAL-TESTS-MASTER-PLAN.md) | Phase 2 scope, exit criteria, execution constraints |
| [Architecture](../PIPELINE-BEHAVIORAL-TESTS-ARCHITECTURE.md) | Module map (files to modify), contracts (`phase_plan_created` pre-read, `task_completed` pre-read, triage engine validation), frontmatter schemas (Phase Plan, Task Report, Phase Review) |
| [Design](../PIPELINE-BEHAVIORAL-TESTS-DESIGN.md) | Contract interface schemas (exact field names, types, required status), `readDocument` call site state table (new rows for missing required fields), error feedback conventions |
| [PRD](../PIPELINE-BEHAVIORAL-TESTS-PRD.md) | FR-1 through FR-5, FR-23 (required fields, pre-read, validation, fallback removal, SKILL.md docs) |
| [Phase 1 Report](../reports/PIPELINE-BEHAVIORAL-TESTS-PHASE-01-REPORT.md) | Carry-forward: Phase 2 pre-reads must use null-return contract from `readDocument` (null-check, not try/catch); `createProjectAwareReader` wrapper now returns null on both-paths-fail |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Template & SKILL.md Frontmatter Updates | — | — | 6 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P02-T01-TEMPLATE-SKILLMD.md) |
| T02 | Add `phase_plan_created` Pre-Read Block | — | — | 1 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P02-T02-PREREAD-PHASEPLAN.md) |
| T03 | Add `task_completed` Required-Field Validation | — | — | 1–2 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P02-T03-PREREAD-TASKREPORT.md) |
| T04 | Triage Engine Fallback Removal & Required-Field Validation | T03 | — | 1–2 | [Link](../tasks/PIPELINE-BEHAVIORAL-TESTS-TASK-P02-T04-TRIAGE-VALIDATION.md) |

### T01 — Template & SKILL.md Frontmatter Updates

**Objective**: Add the three REQUIRED frontmatter fields to their respective skill templates and document each field in the corresponding SKILL.md instruction file.

**Scope**:
- **Phase Plan Template** (`.github/skills/create-phase-plan/templates/PHASE-PLAN.md`): Add REQUIRED `tasks` array with `id` (string) and `title` (string) entries — consumed by `handlePhasePlanCreated` via `context.tasks`
- **Task Report Template** (`.github/skills/generate-task-report/templates/TASK-REPORT.md`): Add REQUIRED `has_deviations` (boolean) and `deviation_type` (string enum: `minor` | `architectural` | `null`) — consumed by triage `triageTask` rows 1–4 and pipeline `task_completed` pre-read
- **Phase Review Template** (`.github/skills/review-phase/templates/PHASE-REVIEW.md`): Add REQUIRED `exit_criteria_met` (boolean) — consumed by triage `triagePhase` rows 2–3
- **Create Phase Plan SKILL.md** (`.github/skills/create-phase-plan/SKILL.md`): Document `tasks` array as REQUIRED with type, allowed values, and purpose
- **Generate Task Report SKILL.md** (`.github/skills/generate-task-report/SKILL.md`): Document `has_deviations` and `deviation_type` as REQUIRED with types, allowed values, and purpose
- **Review Phase SKILL.md** (`.github/skills/review-phase/SKILL.md`): Document `exit_criteria_met` as REQUIRED with type, allowed values, and purpose

**Key constraint**: These are pure documentation changes — no JavaScript code is modified. Templates define the producer-consumer contract; SKILL.md files instruct agents to produce the required fields.

### T02 — Add `phase_plan_created` Pre-Read Block

**Objective**: Add a new pre-read block in `pipeline-engine.js` that executes when `event === 'phase_plan_created'`, reads the phase plan document's frontmatter, validates the `tasks` array, and copies it into `context.tasks`.

**Scope**:
- **Pipeline Engine** (`.github/orchestration/scripts/lib/pipeline-engine.js`): Add `phase_plan_created` pre-read block modeled after the existing `plan_approved` pre-read pattern
- Uses `createProjectAwareReader` (null-return contract from Phase 1) to read the phase plan document
- Validates: document exists (not null), `frontmatter.tasks` is an array, `tasks` array is non-empty
- Returns `makeErrorResult(...)` with descriptive error on each failure mode
- On success: copies `fm.tasks` into `context.tasks`

**Key constraint**: The pre-read relies on the null-return contract established in Phase 1 — use null-check (not try/catch) for missing-document handling via `createProjectAwareReader`.

### T03 — Add `task_completed` Required-Field Validation

**Objective**: Add required-field validation for `has_deviations` and `deviation_type` in the existing `task_completed` pre-read block in `pipeline-engine.js`, and update any existing tests whose mock data omits these fields.

**Scope**:
- **Pipeline Engine** (`.github/orchestration/scripts/lib/pipeline-engine.js`): Within the existing `task_completed` pre-read block, after extracting frontmatter, validate that `has_deviations` is present (not `undefined`/`null`) and `deviation_type` is present (not `undefined`). Return `makeErrorResult(...)` if either is absent.
- **Pipeline Engine Tests** (`.github/orchestration/scripts/tests/pipeline-engine.test.js`): Update any existing test mocks that provide task report documents without `has_deviations`/`deviation_type` in frontmatter — these tests would now fail because the validation rejects absent fields. Add the required fields to mock data to keep existing tests green.

**Key constraint**: No fallback to a legacy `deviations` field — `has_deviations` and `deviation_type` are the sole contract. Every test that exercises the `task_completed` pre-read path must supply these fields.

### T04 — Triage Engine Fallback Removal & Required-Field Validation

**Objective**: Remove all fallback chains in the triage engine for the three newly-required frontmatter fields and add required-field validation for `exit_criteria_met` in `triagePhase`.

**Scope**:
- **Triage Engine** (`.github/orchestration/scripts/lib/triage-engine.js`):
  - `triageTask`: Remove fallback chain for `has_deviations` (no fallback to legacy `deviations` field or `false` default) and `deviation_type` (no fallback to `null` default). Read fields directly — they are guaranteed present by the pipeline pre-read from T03.
  - `triagePhase`: Remove fallback for `exit_criteria_met` (no fallback treating `undefined` as `true`). Add required-field validation: return `makeError(...)` if `exit_criteria_met` is `undefined` or `null`. The type is strictly boolean (`true` or `false`).
- **Triage Engine Tests** (if applicable): Update any existing tests that rely on fallback behavior — tests must now supply `has_deviations`, `deviation_type`, and `exit_criteria_met` explicitly in mock frontmatter data.

**Key constraint**: Depends on T03 — the pipeline pre-read must validate `has_deviations`/`deviation_type` before the triage engine reads them. The triage engine treats field absence as an error, not a scenario to handle gracefully.

## Execution Order

```
T01 (templates + SKILL.md docs)
T02 (phase_plan_created pre-read)   ← parallel-ready with T01
T03 (task_completed validation)      ← parallel-ready with T01, T02
T04 (triage fallback removal)        ← depends on T03
```

**Sequential execution order**: T01 → T02 → T03 → T04

*Note: T01, T02, and T03 are parallel-ready (no mutual dependencies) but will execute sequentially in v1. T04 must follow T03 because the triage engine relies on the pipeline pre-read having already validated `has_deviations`/`deviation_type`.*

## Phase Exit Criteria

- [ ] All 3 templates declare every pipeline/triage-consumed frontmatter field as REQUIRED
- [ ] All 3 SKILL.md files document the new fields as REQUIRED with types, allowed values, and purpose
- [ ] `phase_plan_created` pre-read extracts `tasks` array from phase plan frontmatter into `context.tasks`; returns error if `tasks` is missing or empty
- [ ] `task_completed` pre-read validates that `has_deviations` and `deviation_type` are present; returns error if either is absent
- [ ] Triage engine validates `exit_criteria_met` is present; returns error if absent — no fallback chains remain for any of the three newly-required fields
- [ ] All existing tests pass with zero regressions
- [ ] All tasks complete with status `complete`
- [ ] Build passes
- [ ] All tests pass

## Known Risks for This Phase

- **Existing tests may rely on fallback behavior**: Tests that exercise `task_completed` pre-read or triage paths without providing `has_deviations`/`deviation_type`/`exit_criteria_met` in mock data will break when validation is added and fallbacks are removed. Mitigated by T03 and T04 each including test updates as part of their scope.
- **Triage engine may have undiscovered fallback paths**: The Architecture identifies specific fallback chains to remove, but there may be additional implicit defaults (e.g., using `||` operators). Mitigated by the Coder auditing all field access patterns in `triageTask` and `triagePhase` during T04.
- **SKILL.md changes may not be picked up by agents immediately**: Agent instructions are cached in context windows. Mitigated by the fact that this is a greenfield system — no agents are currently producing documents under old templates.
