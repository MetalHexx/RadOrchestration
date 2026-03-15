---
project: "PIPELINE-BEHAVIORAL-TESTS"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-14T17:00:00Z"
updated: "2026-03-14T19:00:00Z"
---

# PIPELINE-BEHAVIORAL-TESTS — Design

## Design Overview

This project has no visual user interface. The "experience" being designed is the developer and agent interaction surface for three infrastructure concerns: frontmatter contract alignment between skill templates (producers) and pipeline/triage engines (consumers), a consistent `readDocument` null-return contract, and a discoverable behavioral test suite. The design specifies contract schemas, developer workflows for running and extending tests, error feedback conventions, and file discoverability patterns.

## User Flows

### Flow 1: Agent Produces a Document with Required Frontmatter Fields

```
Agent receives skill instructions → Agent reads SKILL.md frontmatter guidance →
Agent generates document body → Agent populates YAML frontmatter per schema →
Pipeline engine pre-reads frontmatter → All required fields present →
Triage engine evaluates frontmatter fields → Pipeline advances
```

The agent (Tactical Planner, Coder, or Reviewer) follows the updated SKILL.md instructions to produce a document whose YAML frontmatter satisfies the pipeline's required contract. The pipeline engine pre-reads the frontmatter at the appropriate event, validates that all required fields are present, and the triage engine evaluates them. Missing required fields are validation errors — there is no fallback logic.

### Flow 2: `readDocument` Returns Null for Missing File

```
Caller invokes readDocument(path) → File does not exist →
readDocument returns null → Caller null-checks result → Control flow branches cleanly
```

All 7 call sites handle null returns with simple conditional checks. No try/catch wrappers needed for missing-file control flow. The `createProjectAwareReader` wrapper checks for null (not catch) before attempting project-relative fallback resolution.

### Flow 3: `createProjectAwareReader` Fallback on Null

```
Wrapper receives docPath → Calls readDocument(docPath) → Returns null →
Wrapper constructs project-relative path → Calls readDocument(resolved) →
Returns result (document or null)
```

The wrapper no longer relies on thrown exceptions to trigger fallback. A null return from the first `readDocument` call triggers the project-relative retry. If both calls return null, the wrapper returns null to the caller.

### Flow 4: Developer Runs Behavioral Tests

```
Developer makes pipeline change → Developer locates test file at
.github/orchestration/scripts/tests/pipeline-behavioral.test.js →
Developer runs `node --test pipeline-behavioral.test.js` →
Test runner reports pass/fail per scenario → Developer sees which execution paths broke
```

The behavioral test file lives alongside existing pipeline tests in the same directory, uses the same `node:test` runner, and follows the same factory pattern. A developer modifying `pipeline-engine.js`, `triage-engine.js`, or `mutations.js` discovers and runs it in the same workflow as existing tests.

### Flow 5: Developer Adds a New Behavioral Test

```
Developer identifies untested execution path → Opens pipeline-behavioral.test.js →
Uses existing factory functions (createMockIO, createBaseState, createExecutionState, makeRequest, withStrictDates) →
Creates mock state + documents → Calls executePipeline → Asserts result action + state mutations →
Runs suite to confirm → Commits
```

The test file is self-contained. All factory functions are either imported or duplicated locally. No external dependencies, no filesystem access, no shared mutable state between tests.

### Flow 6: Pipeline Rejects Document with Missing Required Frontmatter

```
Pipeline engine receives event → Pre-read extracts frontmatter →
Required field is absent → Pipeline returns structured error result →
{ success: false, error: "Required frontmatter field 'tasks' missing from phase plan document" } →
Orchestrator logs error → Pipeline halts for that event
```

When a document is present but a required frontmatter field is missing, the pipeline does NOT fall back to a default value. It returns a structured error result identifying the missing field and document type. This is a contract violation — the template defines the required fields, and the pipeline enforces them.

### Flow 7: Test Validates Error on Missing Required Frontmatter

```
Behavioral test sends event with document missing required frontmatter field →
Pipeline pre-read detects absent required field →
Pipeline returns { success: false, error: "..." } →
Test asserts success is false and error message identifies the missing field
```

Tests explicitly cover scenarios where required frontmatter fields are absent, validating that the pipeline returns error results rather than silently falling back to defaults.

### Flow 8: Test Failure Feedback on Broken Triage Path

```
Developer changes triage logic → Runs behavioral suite →
Test for specific triage row fails → Assertion message identifies:
  (a) which triage row was tested,
  (b) expected vs. actual action,
  (c) the frontmatter inputs that triggered the row →
Developer pinpoints the regression
```

Each triage row test is labeled with its row number and inputs, so failure messages directly identify which decision-table entry broke.

## Layout & Components

### Contract Interface: Phase Plan Frontmatter Schema

This is not a visual layout — it is the YAML frontmatter contract that the phase plan skill template must produce and the pipeline engine consumes.

| Field | Type | Required | Consumer |
|-------|------|----------|----------|
| `project` | string | yes | Pipeline engine (identification) |
| `phase` | integer | yes | Pipeline engine (phase routing) |
| `title` | string | yes | Display |
| `status` | string enum: `active\|complete\|halted` | yes | Pipeline engine |
| `total_tasks` | integer | yes | Pipeline engine |
| `tasks` | array of `{id: string, title: string}` | **yes** | `handlePhasePlanCreated` via `context.tasks` |
| `author` | string | yes | Provenance |
| `created` | ISO date string | yes | Provenance |

**`tasks` array entry schema**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Task identifier, e.g., `"T01-AUTH"` |
| `title` | string | yes | Human-readable task title |

**Validation**: The pipeline engine pre-read at `phase_plan_created` must validate that `tasks` is present, is an array, and is non-empty. If `tasks` is missing or empty, the pipeline returns `{ success: false, error: "..." }`.

### Contract Interface: Task Report Frontmatter Schema

| Field | Type | Required | Consumer |
|-------|------|----------|----------|
| `project` | string | yes | Pipeline engine |
| `phase` | integer | yes | Pipeline engine |
| `task` | integer | yes | Pipeline engine |
| `title` | string | yes | Display |
| `status` | string enum: `complete\|partial\|failed` | yes | Triage engine |
| `files_changed` | integer | yes | Reporting |
| `tests_written` | integer | yes | Reporting |
| `tests_passing` | integer | yes | Reporting |
| `build_status` | string enum: `pass\|fail` | yes | Reporting |
| `has_deviations` | boolean | **yes** | Triage engine `triageTask` rows 1–4 |
| `deviation_type` | string enum: `minor\|architectural` or `null` | **yes** | Triage engine `triageTask` rows 3–4 |

**Validation**: The pipeline engine pre-read at `task_completed` must validate that `has_deviations` is present (boolean) and `deviation_type` is present (string or null). If either is missing, the pipeline returns `{ success: false, error: "..." }`. There is no fallback to a legacy `deviations` field — the `has_deviations` and `deviation_type` fields are the sole contract.

### Contract Interface: Phase Review Frontmatter Schema

| Field | Type | Required | Consumer |
|-------|------|----------|----------|
| `project` | string | yes | Pipeline engine |
| `phase` | integer | yes | Pipeline engine |
| `verdict` | string enum: `approved\|changes_requested\|rejected` | yes | Triage engine `triagePhase` |
| `severity` | string enum: `none\|minor\|critical` | yes | Triage engine |
| `exit_criteria_met` | boolean | **yes** | Triage engine `triagePhase` rows 2–3 |
| `author` | string | yes | Provenance |
| `created` | ISO date string | yes | Provenance |

**Validation**: The triage engine `triagePhase` must validate that `exit_criteria_met` is present (boolean). If absent, the triage engine returns an error. There is no fallback treating undefined as "all met" — the field must be explicitly set by the Reviewer agent. The type is strictly boolean (`true` or `false`); the string values `"all"` and `"partial"` are not accepted.

### Contract Interface: `readDocument` Return Contract

| Condition | Current Behavior | New Behavior |
|-----------|-----------------|-------------|
| File does not exist | `throw new Error('Document not found: ...')` | `return null` |
| File exists but unreadable | `throw new Error('Failed to read document: ...')` | `return null` |
| File exists and readable | Returns `{ frontmatter, body }` | Returns `{ frontmatter, body }` (unchanged) |

### Contract Interface: `createProjectAwareReader` Behavior

| Step | Current Pattern | New Pattern |
|------|----------------|-------------|
| 1. Null path check | `if (!docPath) return null` | `if (!docPath) return null` (unchanged) |
| 2. First resolution | `try { return readDocument(docPath) }` | `const result = readDocument(docPath)` |
| 3. Fallback trigger | `catch (_) { ... }` | `if (result !== null) return result` |
| 4. Project-relative retry | `return readDocument(path.join(projectDir, docPath))` | `return readDocument(path.join(projectDir, docPath))` |

### Behavioral Test File Structure

**Location**: `.github/orchestration/scripts/tests/pipeline-behavioral.test.js`

| Section | Purpose | PRD Coverage |
|---------|---------|-------------|
| Factory functions / imports | Reuse `createMockIO`, `createBaseState`, `createExecutionState`, `makeRequest`, `withStrictDates`, `createDefaultConfig` | NFR-7 |
| Full Happy Path | Single-phase single-task: start → planning → approval → execution → triage → review → complete | FR-11 |
| Multi-Phase Multi-Task | ≥2 phases × ≥2 tasks, validates phase/task advancement chaining | FR-12 |
| Task Triage: Rows 1–11 | One `describe` block per row, frontmatter inputs documented in test name | FR-13 |
| Phase Triage: Rows 1–5 | One `describe` block per row, frontmatter inputs documented in test name | FR-14 |
| Human Gate Modes | `ask`, `task`, `phase`, `autonomous` — verifies gate vs. auto-advance behavior | FR-15 |
| Retry & Corrective Cycles | corrective_task_issued → retry → resolution or halt on exhaustion | FR-16 |
| Halt Paths | Rejected reviews + critical failures at task and phase level | FR-17 |
| Cold-Start Resume | `start` event with existing state at various pipeline positions | FR-18 |
| Pre-Read Failures: Missing Documents | Missing documents at pre-read → `{ success: false }` | FR-19 |
| Pre-Read Failures: Missing Required Fields | Document present but required frontmatter field absent → `{ success: false }` | FR-19, FR-23 |
| Frontmatter-Driven Flows | Required `tasks`, `has_deviations`, `deviation_type`, `exit_criteria_met` fields through triage | FR-20 |

## Design Tokens Used

Not applicable — this project has no visual interface or design system.

## States & Interactions

### `readDocument` Call Site States

| Call Site | Input State | Outcome | Error Feedback |
|-----------|-------------|---------|----------------|
| Pipeline pre-read (`plan_approved`) | Document exists, `total_phases` present | `context.total_phases` populated | — |
| Pipeline pre-read (`plan_approved`) | Document missing | `readDocument` returns null | Result: `{ success: false, error: 'Master plan document not found...' }` |
| Pipeline pre-read (`plan_approved`) | Document exists, `total_phases` absent | Pre-read returns doc but field is undefined | Result: `{ success: false, error: ... }` per existing validation |
| Pipeline pre-read (`task_completed`) | Document exists, all fields present | `context.report_status`, `context.report_severity`, `context.report_deviations` populated | — |
| Pipeline pre-read (`task_completed`) | Document missing | `readDocument` returns null, `if (!reportDoc)` triggers | Result: `{ success: false, error: 'Task report document not found...' }` |
| Pipeline pre-read (`task_completed`) | Document exists, `has_deviations` absent | Required field missing | Result: `{ success: false, error: "Required frontmatter field 'has_deviations' missing from task report" }` |
| Pipeline pre-read (`task_completed`) | Document exists, `deviation_type` absent | Required field missing | Result: `{ success: false, error: "Required frontmatter field 'deviation_type' missing from task report" }` |
| Pipeline pre-read (`phase_plan_created`) | Document exists, `tasks` array present and non-empty | `context.tasks` populated | — |
| Pipeline pre-read (`phase_plan_created`) | Document exists, `tasks` absent | Required field missing | Result: `{ success: false, error: "Required frontmatter field 'tasks' missing from phase plan document" }` |
| Pipeline pre-read (`phase_plan_created`) | Document exists, `tasks` is empty array | Validation error — `tasks` must be non-empty | Result: `{ success: false, error: "Phase plan 'tasks' array must not be empty" }` |
| Pipeline pre-read (`phase_plan_created`) | Document missing | `readDocument` returns null | Result: `{ success: false, error: 'Phase plan document not found...' }` |
| Triage engine (`triageTask`) | Report doc exists, all required fields present | Reads frontmatter for `has_deviations`, `deviation_type` | — |
| Triage engine (`triageTask`) | Report doc missing | `readDocument` returns null | `makeError('Missing task report...')` |
| Triage engine (`triagePhase`) | Phase review exists, all required fields present | Reads frontmatter for `verdict`, `exit_criteria_met` | — |
| Triage engine (`triagePhase`) | Phase review exists, `exit_criteria_met` absent | Required field missing | Error result identifying the missing field |
| Triage engine (`triagePhase`) | Phase review missing | `readDocument` returns null | Auto-approve (Row 1) |
| `createProjectAwareReader` | First path resolves | Returns document | — |
| `createProjectAwareReader` | First path null, fallback resolves | Returns document from project-relative path | — |
| `createProjectAwareReader` | Both paths null | Returns null | Caller handles null |

### Triage Engine States per Decision Row

#### Task-Level Triage (11 Rows)

| Row | Inputs | Result Action | Test Label Convention |
|-----|--------|---------------|----------------------|
| 1 | `status=complete`, `has_deviations=false`, no review doc | skip (auto-approve) | `"Row 1: complete, no deviations, no review → auto-approve"` |
| 2 | `status=complete`, `has_deviations=false`, review `verdict=approved` | `advanced` | `"Row 2: complete, no deviations, approved → advance"` |
| 3 | `status=complete`, `has_deviations=true`, `deviation_type=minor`, review `verdict=approved` | `advanced` | `"Row 3: complete, minor deviations, approved → advance"` |
| 4 | `status=complete`, `has_deviations=true`, `deviation_type=architectural`, review `verdict=approved` | `advanced` | `"Row 4: complete, architectural deviations, approved → advance"` |
| 5 | `status=complete`, review `verdict=changes_requested` | `corrective_task_issued` | `"Row 5: complete, changes_requested → corrective"` |
| 6 | `status=complete`, review `verdict=rejected` | `halted` | `"Row 6: complete, rejected → halt"` |
| 7 | `status=partial`, no review doc | skip (auto-approve) | `"Row 7: partial, no review → auto-approve"` |
| 8 | `status=partial`, review `verdict=changes_requested` | `corrective_task_issued` | `"Row 8: partial, changes_requested → corrective"` |
| 9 | `status=partial`, review `verdict=rejected` | `halted` | `"Row 9: partial, rejected → halt"` |
| 10 | `status=failed`, `severity=minor`, retries < max | `corrective_task_issued` | `"Row 10: failed, minor, retries left → corrective"` |
| 11 | `status=failed`, `severity=critical` OR retries exhausted | `halted` | `"Row 11: failed, critical or retries exhausted → halt"` |

#### Phase-Level Triage (5 Rows)

| Row | Inputs | Result Action | Test Label Convention |
|-----|--------|---------------|----------------------|
| 1 | No phase review doc | skip (auto-approve) | `"Phase Row 1: no review → auto-approve"` |
| 2 | `verdict=approved`, `exit_criteria_met=true` | `advanced` | `"Phase Row 2: approved, all exit criteria → advance"` |
| 3 | `verdict=approved`, `exit_criteria_met=false` | `advanced` (carry-forward) | `"Phase Row 3: approved, partial exit criteria → advance with carry-forward"` |
| 4 | `verdict=changes_requested` | `corrective_tasks_issued` | `"Phase Row 4: changes_requested → corrective"` |
| 5 | `verdict=rejected` | `halted` | `"Phase Row 5: rejected → halt"` |

### Behavioral Test Assertion States

| Scenario Category | Key Assertions |
|-------------------|----------------|
| Full happy path | Final `result.action` is `display_complete`; `state.pipeline.tier` is `complete`; all phases and tasks are `complete` |
| Multi-phase multi-task | Each phase transitions `in_progress` → `complete`; task counter resets per phase; `current_phase` advances |
| Triage row N | `result.action` matches expected action for row; state mutations match (e.g., `halted`, `corrective`, `advanced`) |
| Human gate mode | `autonomous` → no gate action returned; `ask`/`task`/`phase` → `gate_task` or `gate_phase` at appropriate points |
| Retry cycle | `triage_attempts` increments; corrective task handoff created; on exhaustion → `halted` |
| Cold-start resume | `result.writes` is `0`; `result.action` is correct next step for the given state |
| Pre-read failure (missing doc) | `result.success` is `false`; `result.error` describes the missing document |
| Pre-read failure (missing field) | `result.success` is `false`; `result.error` identifies the absent required frontmatter field |
| Frontmatter-driven | Required fields (`tasks`, `has_deviations`, `deviation_type`, `exit_criteria_met`) propagate through pre-read → context → triage → correct action |

## Accessibility

Not applicable — this project has no visual interface. All outputs are structured JSON results and `node:test` runner console output.

## Responsive Behavior

Not applicable — this project has no visual interface.

## Discoverability Conventions

| Concern | Convention | Rationale |
|---------|-----------|-----------|
| Test file location | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Same directory as `pipeline-engine.test.js`; discoverable by any developer or agent examining the test folder |
| Test file naming | `pipeline-behavioral.test.js` | Prefix `pipeline-` matches existing conventions; `behavioral` distinguishes it from unit tests |
| Test section naming | `describe("Behavioral: {Category}", ...)` top-level blocks | Grep-friendly; `node --test --test-name-pattern "Behavioral"` runs only behavioral tests |
| Triage test naming | Include row number and inputs in test name (see Test Label Convention above) | Failure messages immediately identify which decision-table row broke |
| SKILL.md frontmatter docs | Each updated SKILL.md lists new fields in a "Frontmatter Fields" table with field name, type, required status, allowed values, and purpose | Agents producing documents can find the contract without reading pipeline source |
| Run command | `node --test .github/orchestration/scripts/tests/pipeline-behavioral.test.js` | Matches existing test running pattern; no new tooling |

## Error Feedback Conventions

| Error Scenario | Feedback Mechanism | Content |
|----------------|-------------------|---------|
| Missing document at pre-read | `executePipeline` returns `{ success: false, error: "..." }` | Error string names the missing document type and path |
| Required frontmatter field absent | `executePipeline` returns `{ success: false, error: "..." }` | Error string names the missing field and the document type (e.g., `"Required frontmatter field 'tasks' missing from phase plan document"`) |
| Malformed frontmatter field | `executePipeline` returns `{ success: false, error: "..." }` | Error string identifies the field, expected type, and actual value |
| `tasks` array is empty | `executePipeline` returns `{ success: false, error: "..." }` | Error string: `"Phase plan 'tasks' array must not be empty"` |
| Triage with missing report | `makeError(...)` inside triage engine | Error identifies the task/phase and missing document |
| Triage with missing required field | Triage engine returns error result | Error identifies the missing field and document |
| `readDocument` file not found | Returns `null` (no error thrown) | Caller decides how to surface — either error result or fallback |
| `readDocument` file unreadable | Returns `null` (no error thrown) | Same as file not found — uniform null contract |
| State validation failure | Validator throws with invariant ID (V1–V15) | Error message includes invariant code and violated condition |
| Behavioral test failure | `node:test` assertion error | Test name includes triage row number, inputs, and expected action |

**Key principle**: Missing files and missing required fields are distinct error categories. A missing file produces a null return from `readDocument`, and the caller surfaces a "document not found" error. A missing required frontmatter field means the document exists but violates its contract — the pre-read or triage engine surfaces a "required field missing" error. Neither case falls back to default values.

## Design System Additions

Not applicable — this project has no visual design system. The "design system" equivalents are the frontmatter schema contracts defined in the Contract Interface sections above. No new tokens, components, or visual patterns are introduced.
