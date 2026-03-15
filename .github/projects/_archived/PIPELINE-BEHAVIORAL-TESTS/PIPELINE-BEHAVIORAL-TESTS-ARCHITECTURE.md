---
project: "PIPELINE-BEHAVIORAL-TESTS"
status: "draft"
author: "architect-agent"
created: "2026-03-14T18:00:00Z"
updated: "2026-03-14T20:00:00Z"
---

# PIPELINE-BEHAVIORAL-TESTS — Architecture

## Technical Overview

This is a pure infrastructure project modifying the pipeline engine's internal plumbing — no new modules, no UI, no new external dependencies. The three workstreams are: (1) aligning three skill template frontmatter schemas with their pipeline/triage consumers, with all new fields REQUIRED and validated at runtime; (2) changing `readDocument` from throw-on-missing to null-return and updating all 7 call sites; (3) creating a comprehensive behavioral test suite covering end-to-end pipeline execution paths. All changes target existing JavaScript files and Markdown templates, using Node.js built-in `node:test` and `node:assert` for tests.

## System Layers

This project does not introduce new system layers. All changes operate within the existing orchestration infrastructure:

```
┌────────────────────────────────────────────────────────────────────┐
│  Skill Templates (Producer Layer)                                  │
│  Markdown templates that define frontmatter contracts for agents   │
├────────────────────────────────────────────────────────────────────┤
│  Pipeline Engine (Application Layer)                               │
│  executePipeline, pre-reads, createProjectAwareReader, mutations   │
├────────────────────────────────────────────────────────────────────┤
│  Triage Engine (Domain Layer)                                      │
│  triageTask (11 rows), triagePhase (5 rows), frontmatter reads    │
├────────────────────────────────────────────────────────────────────┤
│  State IO (Infrastructure Layer)                                   │
│  readDocument, readState, writeState, extractFrontmatter           │
├────────────────────────────────────────────────────────────────────┤
│  Test Infrastructure (Verification Layer)                          │
│  Behavioral tests, mock IO, factory functions                      │
└────────────────────────────────────────────────────────────────────┘
```

## Module Map

### Files to Modify

| Module | Layer | Path | Responsibility | Change Summary |
|--------|-------|------|---------------|----------------|
| State IO | Infrastructure | `.github/orchestration/scripts/lib/state-io.js` | File reading, frontmatter extraction | Change `readDocument` from throw to null-return (lines 128–137) |
| Pipeline Engine | Application | `.github/orchestration/scripts/lib/pipeline-engine.js` | Pre-reads, mutations, triage orchestration | Add `phase_plan_created` pre-read block with required-field validation; update `createProjectAwareReader` from try/catch to null-check; add required-field validation to `task_completed` pre-read (lines 137–147, 248–270) |
| Triage Engine | Domain | `.github/orchestration/scripts/lib/triage-engine.js` | 11 task-level + 5 phase-level decision rows | Remove fallback chains for `has_deviations`/`deviation_type` and `exit_criteria_met`; validate required fields and return structured errors when absent |
| State IO Tests | Verification | `.github/orchestration/scripts/tests/state-io.test.js` | Unit tests for state-io | Update `readDocument` throw assertion → null assertion (line 209) |
| Pipeline Engine Tests | Verification | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | Unit tests for pipeline-engine | Update `createProjectAwareReader` "both fail" test from throw → null return (lines 1680–1683) |
| Phase Plan Template | Producer | `.github/skills/create-phase-plan/templates/PHASE-PLAN.md` | Frontmatter schema for phase plans | Add REQUIRED `tasks` array to YAML frontmatter |
| Phase Plan Skill | Producer | `.github/skills/create-phase-plan/SKILL.md` | Agent instructions for phase plan creation | Document `tasks` array as REQUIRED field, allowed values, purpose |
| Task Report Template | Producer | `.github/skills/generate-task-report/templates/TASK-REPORT.md` | Frontmatter schema for task reports | Add REQUIRED `has_deviations` and `deviation_type` to YAML frontmatter |
| Task Report Skill | Producer | `.github/skills/generate-task-report/SKILL.md` | Agent instructions for task report creation | Document `has_deviations` and `deviation_type` as REQUIRED fields |
| Phase Review Template | Producer | `.github/skills/review-phase/templates/PHASE-REVIEW.md` | Frontmatter schema for phase reviews | Add REQUIRED `exit_criteria_met` to YAML frontmatter |
| Phase Review Skill | Producer | `.github/skills/review-phase/SKILL.md` | Agent instructions for phase review creation | Document `exit_criteria_met` as REQUIRED field |

### Files to Create

| Module | Layer | Path | Responsibility |
|--------|-------|------|---------------|
| Behavioral Tests | Verification | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | End-to-end pipeline execution path coverage |

## Contracts & Interfaces

### `readDocument` — New Return Contract

```javascript
// .github/orchestration/scripts/lib/state-io.js

/**
 * @param {string} docPath — absolute or relative path to a markdown document
 * @returns {{ frontmatter: Object, body: string } | null} — parsed document or null if not found/unreadable
 */
function readDocument(docPath) {
  if (!exists(docPath)) {
    return null;                              // was: throw new Error('Document not found: ' + docPath)
  }
  const content = readFile(docPath);
  if (content === null) {
    return null;                              // was: throw new Error('Failed to read document: ' + docPath)
  }
  return extractFrontmatter(content);
}
```

**Contract**: `readDocument` returns `null` for any file that does not exist or cannot be read. Returns `{ frontmatter: Object, body: string }` on success. Never throws for missing/unreadable files.

### `createProjectAwareReader` — New Null-Check Pattern

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js

/**
 * @param {Function} readDocument — the IO-injected readDocument function
 * @param {string} projectDir — absolute path to the project directory
 * @returns {Function} — a reader that tries direct path, then project-relative fallback
 */
function createProjectAwareReader(readDocument, projectDir) {
  return function(docPath) {
    if (!docPath) return null;
    const result = readDocument(docPath);       // was: try { return readDocument(docPath) }
    if (result !== null) return result;          // was: catch (_) { ... }
    const resolved = path.join(projectDir, docPath);
    return readDocument(resolved);              // returns document or null
  };
}
```

**Contract**: Returns document object if found via direct path or project-relative fallback. Returns `null` if both paths fail. Never throws for missing files.

### `phase_plan_created` Pre-Read Block

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js
// Insert after the task_completed pre-read block, before config load

// Phase plan pre-read: validate required fields and enrich context
if (event === 'phase_plan_created' && context.phase_plan_path) {
  try {
    const projectAwareReader = createProjectAwareReader(io.readDocument, projectDir);
    const phasePlanDoc = projectAwareReader(context.phase_plan_path);
    if (!phasePlanDoc) {
      return makeErrorResult(
        `Phase plan not found: ${context.phase_plan_path}`,
        event, [], null, null
      );
    }
    const fm = phasePlanDoc.frontmatter || {};
    if (!Array.isArray(fm.tasks)) {
      return makeErrorResult(
        `Required frontmatter field 'tasks' missing from phase plan document`,
        event, [], null, null
      );
    }
    if (fm.tasks.length === 0) {
      return makeErrorResult(
        `Phase plan 'tasks' array must not be empty`,
        event, [], null, null
      );
    }
    context.tasks = fm.tasks;
  } catch (err) {
    return makeErrorResult(
      `Failed to pre-read phase plan: ${err.message}`,
      event, [], null, null
    );
  }
}
```

**Contract**: When `event === 'phase_plan_created'` and `context.phase_plan_path` is provided, reads the phase plan document and validates that `frontmatter.tasks` is present, is an array, and is non-empty. Copies validated `tasks` into `context.tasks`. Returns an error result if the document is missing, the `tasks` field is absent, or the `tasks` array is empty.

### `task_completed` Pre-Read — Required Field Validation

```javascript
// .github/orchestration/scripts/lib/pipeline-engine.js
// Within the existing task_completed pre-read block, after extracting frontmatter

const fm = reportDoc.frontmatter || {};
if (fm.has_deviations === undefined || fm.has_deviations === null) {
  return makeErrorResult(
    `Required frontmatter field 'has_deviations' missing from task report`,
    event, [], null, null
  );
}
if (fm.deviation_type === undefined) {
  return makeErrorResult(
    `Required frontmatter field 'deviation_type' missing from task report`,
    event, [], null, null
  );
}
context.report_status = fm.status;
context.report_severity = fm.severity;
context.report_deviations = Boolean(fm.has_deviations);
context.report_deviation_type = fm.deviation_type;
```

**Contract**: The `task_completed` pre-read validates that `has_deviations` (boolean) and `deviation_type` (string or null) are present in the task report frontmatter. Returns an error result if either field is absent. No fallback to a legacy `deviations` field.

### Triage Engine — Required Field Validation

```javascript
// .github/orchestration/scripts/lib/triage-engine.js
// triageTask: remove fallback chain, validate required fields

const hasDeviations = Boolean(reportFm.has_deviations);    // was: fallback to reportFm.deviations then false
const deviationType = reportFm.deviation_type;              // was: reportFm.deviation_type || null
// No fallback chains — fields are validated as present by the pipeline pre-read
```

```javascript
// .github/orchestration/scripts/lib/triage-engine.js
// triagePhase: remove fallback for exit_criteria_met, validate required field

if (reviewFm.exit_criteria_met === undefined || reviewFm.exit_criteria_met === null) {
  return makeError(`Required frontmatter field 'exit_criteria_met' missing from phase review`);
}
const exitCriteriaMet = reviewFm.exit_criteria_met;
const allExitCriteriaMet = exitCriteriaMet === true;        // was: also accepted undefined/null/'all' as true
```

**Contract**: The triage engine reads required frontmatter fields directly — no fallback chains, no default values. Fields are guaranteed to be present by the pipeline pre-read validation. If a field is somehow absent (e.g., triage called directly without pre-read), the triage engine returns a structured error. `exit_criteria_met` is strictly boolean (`true` or `false`); the string values `"all"` and `"partial"` are not accepted.

### Phase Plan Frontmatter Schema

```yaml
# .github/skills/create-phase-plan/templates/PHASE-PLAN.md
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
title: "{PHASE-TITLE}"
status: "active"
total_tasks: {NUMBER}
tasks:                                    # REQUIRED — consumed by pipeline engine
  - id: "{TASK-ID}"                       # e.g., "T01-AUTH"
    title: "{TASK-TITLE}"                 # e.g., "Implement authentication module"
  - id: "{TASK-ID}"
    title: "{TASK-TITLE}"
author: "tactical-planner-agent"
created: "{ISO-DATE}"
---
```

| Field | Type | Required | Consumer |
|-------|------|----------|----------|
| `tasks` | `Array<{ id: string, title: string }>` | **yes** | `handlePhasePlanCreated` via `context.tasks` |
| `tasks[].id` | `string` | **yes** (per entry) | Task identifier in state |
| `tasks[].title` | `string` | **yes** (per entry) | Task title in state |

**Validation**: Pipeline returns `{ success: false, error: "..." }` if `tasks` is missing, not an array, or empty.

### Task Report Frontmatter Schema

```yaml
# .github/skills/generate-task-report/templates/TASK-REPORT.md
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
title: "{TASK-TITLE}"
status: "complete"
files_changed: {NUMBER}
tests_written: {NUMBER}
tests_passing: {NUMBER}
build_status: "pass|fail"
has_deviations: false                     # REQUIRED — consumed by triage engine
deviation_type: null                      # REQUIRED — consumed by triage engine
---
```

| Field | Type | Required | Consumer |
|-------|------|----------|----------|
| `has_deviations` | `boolean` | **yes** | Triage `triageTask` rows 1–4, pipeline `task_completed` pre-read |
| `deviation_type` | `string` enum: `"minor"` \| `"architectural"` \| `null` | **yes** | Triage `triageTask` rows 3–4 |

**Validation**: Pipeline returns `{ success: false, error: "..." }` if `has_deviations` or `deviation_type` is absent. No fallback to a legacy `deviations` field.

### Phase Review Frontmatter Schema

```yaml
# .github/skills/review-phase/templates/PHASE-REVIEW.md
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
exit_criteria_met: true                   # REQUIRED — consumed by triage engine
author: "reviewer-agent"
created: "{ISO-DATE}"
---
```

| Field | Type | Required | Consumer |
|-------|------|----------|----------|
| `exit_criteria_met` | `boolean` | **yes** | Triage `triagePhase` rows 2–3 |

**Validation**: Triage returns an error if `exit_criteria_met` is absent. The type is strictly boolean (`true` or `false`); the string values `"all"` and `"partial"` are not accepted.

## API Endpoints

Not applicable — this project modifies internal JavaScript functions, not HTTP APIs. All "contracts" are function signatures and frontmatter schemas documented above.

## Dependencies

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `node:test` | built-in (Node.js) | Test runner for behavioral tests |
| `node:assert` | built-in (Node.js) | Assertions in behavioral tests |
| `node:path` | built-in (Node.js) | Path resolution in `createProjectAwareReader` |

No new external dependencies are introduced. All test infrastructure uses Node.js built-ins.

### Internal Dependencies (module → module)

```
pipeline-behavioral.test.js
  → pipeline-engine.js (executePipeline — the function under test)
  → constants.js (NEXT_ACTIONS, PIPELINE_TIERS, TASK_STATUSES, PHASE_STATUSES for assertions)
  → (inline) createMockIO, createBaseState, createExecutionState, makeRequest, withStrictDates

pipeline-engine.js
  → state-io.js (readDocument — via io.readDocument injection)
  → mutations.js (getMutation, needsTriage, applyTaskTriage, applyPhaseTriage)
  → triage-engine.js (executeTriage)
  → resolver.js (resolveNextAction)
  → state-validator.js (validateTransition)
  → constants.js (NEXT_ACTIONS, EXTERNAL_ACTIONS, PIPELINE_TIERS, etc.)

triage-engine.js
  → readDocument (via injection) — reads frontmatter for triage decisions
  → validates required fields: has_deviations, deviation_type, exit_criteria_met

state-io.js
  → (node:fs) exists, readFile — internal filesystem calls
  → extractFrontmatter — internal YAML parsing

Skill templates (PHASE-PLAN.md, TASK-REPORT.md, PHASE-REVIEW.md)
  → Consumed by pipeline-engine.js pre-reads and triage-engine.js at runtime
  → Consumed by agents at document-generation time via SKILL.md instructions
```

### Change Dependency Graph

Changes must be applied in a specific order to avoid breaking existing tests mid-execution:

```
                    ┌─────────────────────────────────┐
                    │  1. readDocument null-return     │
                    │     (state-io.js)                │
                    └──────────┬──────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
    ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
    │ 2a. Update        │ │ 2b. Update   │ │ 2c. Update       │
    │ createProject-    │ │ state-io     │ │ pipeline-engine  │
    │ AwareReader       │ │ tests        │ │ tests            │
    │ (pipeline-engine) │ │              │ │                  │
    └──────────┬────────┘ └──────────────┘ └──────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────┐
    │ 3. Add phase_plan_created pre-read +     │
    │    required-field validation in           │
    │    task_completed pre-read +              │
    │    triage engine field validation         │
    │ (pipeline-engine.js, triage-engine.js)   │
    └──────────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────┐
    │ 4. Update skill templates + SKILL.md     │
    │    (3 templates + 3 instructions)        │
    └──────────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────┐
    │ 5. Create behavioral test suite          │
    │    (pipeline-behavioral.test.js)         │
    └──────────────────────────────────────────┘
```

**Rationale**: Step 1 must come first because `createProjectAwareReader` (step 2a) depends on the new null-return contract. Existing test updates (2b, 2c) must be concurrent with or immediately after the code changes to keep the test suite green. Required-field validation (step 3) depends on the updated `createProjectAwareReader` and adds validation logic to both the pipeline engine and triage engine. Templates (step 4) are independent of code changes but logically follow. Behavioral tests (step 5) validate all prior changes and must come last.

## File Structure

```
.github/
├── orchestration/
│   └── scripts/
│       ├── lib/
│       │   ├── pipeline-engine.js          # MODIFY: createProjectAwareReader, add phase_plan_created pre-read, add required-field validation to task_completed pre-read
│       │   ├── state-io.js                 # MODIFY: readDocument null-return
│       │   ├── triage-engine.js            # MODIFY: remove fallback chains, add required-field validation for has_deviations/deviation_type/exit_criteria_met
│       │   ├── mutations.js                # NO CHANGE (already guards context.tasks with Array.isArray)
│       │   ├── resolver.js                 # NO CHANGE
│       │   ├── constants.js                # NO CHANGE
│       │   └── state-validator.js          # NO CHANGE
│       └── tests/
│           ├── pipeline-engine.test.js     # MODIFY: update createProjectAwareReader "both fail" test
│           ├── state-io.test.js            # MODIFY: update readDocument throw assertion → null
│           └── pipeline-behavioral.test.js # CREATE: comprehensive behavioral test suite
├── skills/
│   ├── create-phase-plan/
│   │   ├── SKILL.md                        # MODIFY: document tasks array as REQUIRED
│   │   └── templates/
│   │       └── PHASE-PLAN.md               # MODIFY: add tasks array to frontmatter
│   ├── generate-task-report/
│   │   ├── SKILL.md                        # MODIFY: document has_deviations, deviation_type as REQUIRED
│   │   └── templates/
│   │       └── TASK-REPORT.md              # MODIFY: add has_deviations, deviation_type to frontmatter
│   └── review-phase/
│       ├── SKILL.md                        # MODIFY: document exit_criteria_met as REQUIRED
│       └── templates/
│           └── PHASE-REVIEW.md             # MODIFY: add exit_criteria_met to frontmatter
└── projects/
    └── PIPELINE-BEHAVIORAL-TESTS/          # Project documents (this architecture, PRD, etc.)
```

**Total file count**: 11 modified + 1 created = 12 files touched.

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Required field enforcement** | All new frontmatter fields (`tasks`, `has_deviations`, `deviation_type`, `exit_criteria_met`) are REQUIRED. The pipeline engine and triage engine validate their presence and return structured error results (`{ success: false, error: "..." }`) when absent. No fallback values, no default assumptions, no dual code paths. Single code path: validate field exists → use it. |
| **Error handling** | `readDocument` shifts from throw-based to null-return for missing/unreadable files (file-level errors). Required frontmatter field validation (field-level errors) is handled separately: the pipeline pre-read or triage engine checks for field presence and returns a structured error result if absent. These are two distinct error categories — missing files vs. missing required fields. |
| **State validation** | No changes to the 15 state validator invariants (V1–V15). All mutations continue to be validated via `validateTransition`. The `withStrictDates` helper prevents V13 timestamp collisions in tests that trigger internal actions. |
| **Test isolation** | Each behavioral test is self-contained: creates its own mock IO, state, config, and documents. No shared mutable state between tests. Factory functions are duplicated in the behavioral test file (not imported from `pipeline-engine.test.js`) to avoid cross-file coupling, following the brainstorming guidance. |
| **Test reliability** | Tests involving triage or internal action loops use `withStrictDates` to produce strictly monotonic timestamps, avoiding V13 validation collisions. All tests use in-memory mock IO — no filesystem access. |
| **Test discoverability** | Behavioral test file is in the same directory as existing pipeline tests. Filename `pipeline-behavioral.test.js` follows the `pipeline-*.test.js` convention. Top-level `describe` blocks use `"Behavioral: {Category}"` prefix for grep-friendly filtering via `node --test --test-name-pattern "Behavioral"`. |

## Phasing Recommendations

The following phasing is advisory for the Tactical Planner. The dependency graph above constrains the ordering.

### Phase 1: Core Contract Changes (Foundation)

**Goal**: Fix `readDocument` contract and update `createProjectAwareReader`, keeping the test suite green throughout.

**Scope**:
- Change `readDocument` in `state-io.js` to return null instead of throwing (2 lines)
- Update `createProjectAwareReader` in `pipeline-engine.js` from try/catch to null-check (4 lines)
- Update `state-io.test.js`: change throw assertion to null assertion (1 test)
- Update `pipeline-engine.test.js`: change "both fail" `createProjectAwareReader` test (1 test)

**Exit criteria**: All existing tests pass. `readDocument` returns null for missing files. `createProjectAwareReader` fallback works via null-check.

### Phase 2: Frontmatter Alignment + Required-Field Validation

**Goal**: Add required frontmatter fields to templates, add `phase_plan_created` pre-read, add required-field validation to pipeline and triage engines, update SKILL.md instructions.

**Scope**:
- Add REQUIRED `tasks` array to phase plan template frontmatter
- Add REQUIRED `has_deviations` and `deviation_type` to task report template frontmatter
- Add REQUIRED `exit_criteria_met` to phase review template frontmatter
- Add `phase_plan_created` pre-read block in `pipeline-engine.js` with required-field validation
- Add required-field validation for `has_deviations` and `deviation_type` in `task_completed` pre-read
- Remove fallback chains in `triage-engine.js` for `has_deviations`/`deviation_type` and `exit_criteria_met`; add required-field validation
- Update 3 SKILL.md files with frontmatter field documentation marking fields as REQUIRED

**Exit criteria**: All existing tests pass. Templates declare all required fields. Pipeline validates required fields are present and returns error results when absent. Triage engine reads fields directly without fallback chains. SKILL.md files document all fields as REQUIRED.

### Phase 3: Behavioral Test Suite

**Goal**: Create the comprehensive behavioral test file covering all execution paths identified in the PRD.

**Scope**:
- Create `pipeline-behavioral.test.js` with factory functions
- Implement test sections: full happy path, multi-phase/multi-task, all 11 task triage rows, all 5 phase triage rows, human gate modes, retry/corrective cycles, halt paths, cold-start resume, pre-read failures (missing documents AND missing required fields), frontmatter-driven flows
- Validate all prior changes through the behavioral tests, including error results for absent required frontmatter fields

**Exit criteria**: All behavioral tests pass. 11/11 task triage rows covered. 5/5 phase triage rows covered. Full happy path verified. Missing-required-field scenarios return `{ success: false }`. Suite completes in under 5 seconds.
