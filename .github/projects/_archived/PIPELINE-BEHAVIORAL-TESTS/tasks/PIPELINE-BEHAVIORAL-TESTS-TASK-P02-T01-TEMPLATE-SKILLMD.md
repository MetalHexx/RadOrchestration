---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 2
task: 1
title: "Template & SKILL.md Frontmatter Updates"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 6
---

# Template & SKILL.md Frontmatter Updates

## Objective

Add three REQUIRED frontmatter fields to their respective skill templates (`tasks` array in phase plan, `has_deviations`/`deviation_type` in task report, `exit_criteria_met` in phase review) and document each new field in the corresponding SKILL.md instruction file. These are pure Markdown changes — no JavaScript code is modified.

## Context

The pipeline and triage engines consume frontmatter fields from three skill templates, but those templates currently omit the fields. This task adds the missing REQUIRED fields to the templates (establishing the producer-consumer contract) and updates the SKILL.md files so agents know to produce them. The pipeline engine reads `tasks` from phase plan frontmatter at `phase_plan_created`, and `has_deviations`/`deviation_type` from task report frontmatter at `task_completed`. The triage engine reads `exit_criteria_met` from phase review frontmatter in `triagePhase`. All three fields will be validated as REQUIRED by subsequent tasks (T02–T04) — this task establishes the template contract that those validations enforce.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/skills/create-phase-plan/templates/PHASE-PLAN.md` | Add `tasks` array to YAML frontmatter |
| MODIFY | `.github/skills/generate-task-report/templates/TASK-REPORT.md` | Add `has_deviations` and `deviation_type` to YAML frontmatter |
| MODIFY | `.github/skills/review-phase/templates/PHASE-REVIEW.md` | Add `exit_criteria_met` to YAML frontmatter |
| MODIFY | `.github/skills/create-phase-plan/SKILL.md` | Document `tasks` array as REQUIRED field |
| MODIFY | `.github/skills/generate-task-report/SKILL.md` | Document `has_deviations` and `deviation_type` as REQUIRED fields |
| MODIFY | `.github/skills/review-phase/SKILL.md` | Document `exit_criteria_met` as REQUIRED field |

## Implementation Steps

### Step 1: Add `tasks` array to Phase Plan template frontmatter

Open `.github/skills/create-phase-plan/templates/PHASE-PLAN.md`. The current frontmatter is:

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
title: "{PHASE-TITLE}"
status: "active|complete|halted"
total_tasks: {NUMBER}
author: "tactical-planner-agent"
created: "{ISO-DATE}"
---
```

Add the `tasks` array field after `total_tasks`. The new frontmatter must be:

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
title: "{PHASE-TITLE}"
status: "active|complete|halted"
total_tasks: {NUMBER}
tasks:                              # REQUIRED — consumed by handlePhasePlanCreated via context.tasks
  - id: "{TASK-ID}"                 # string, e.g., "T01-AUTH"
    title: "{TASK-TITLE}"           # string, human-readable task title
author: "tactical-planner-agent"
created: "{ISO-DATE}"
---
```

### Step 2: Add `has_deviations` and `deviation_type` to Task Report template frontmatter

Open `.github/skills/generate-task-report/templates/TASK-REPORT.md`. The current frontmatter is:

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
title: "{TASK-TITLE}"
status: "complete"   # MUST be exactly: complete | partial | failed — no synonyms
files_changed: {NUMBER}
tests_written: {NUMBER}
tests_passing: {NUMBER}
build_status: "pass|fail"
---
```

Add `has_deviations` and `deviation_type` after `build_status`. The new frontmatter must be:

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
title: "{TASK-TITLE}"
status: "complete"   # MUST be exactly: complete | partial | failed — no synonyms
files_changed: {NUMBER}
tests_written: {NUMBER}
tests_passing: {NUMBER}
build_status: "pass|fail"
has_deviations: false               # REQUIRED boolean — true if agent deviated from handoff, false otherwise
deviation_type: null                 # REQUIRED string — "minor" | "architectural" | null (null when has_deviations is false)
---
```

### Step 3: Add `exit_criteria_met` to Phase Review template frontmatter

Open `.github/skills/review-phase/templates/PHASE-REVIEW.md`. The current frontmatter is:

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
author: "reviewer-agent"
created: "{ISO-DATE}"
---
```

Add `exit_criteria_met` after `severity`. The new frontmatter must be:

```yaml
---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
verdict: "approved|changes_requested|rejected"
severity: "none|minor|critical"
exit_criteria_met: true             # REQUIRED boolean — true if all phase exit criteria verified, false otherwise
author: "reviewer-agent"
created: "{ISO-DATE}"
---
```

### Step 4: Document `tasks` array in Create Phase Plan SKILL.md

Open `.github/skills/create-phase-plan/SKILL.md`. Add a new section titled `## Required Frontmatter Fields` immediately before the existing `## Key Rules` section. The new section must contain:

```markdown
## Required Frontmatter Fields

The Phase Plan template frontmatter includes fields consumed by the pipeline engine. These fields are **REQUIRED** — the pipeline validates their presence and returns an error if they are missing.

| Field | Type | Required | Allowed Values | Consumer | Purpose |
|-------|------|----------|---------------|----------|---------|
| `tasks` | array of `{id: string, title: string}` | **REQUIRED** | Non-empty array; each entry must have `id` (string, e.g., `"T01-AUTH"`) and `title` (string, human-readable) | `handlePhasePlanCreated` via `context.tasks` | Pipeline engine pre-reads this array at the `phase_plan_created` event to initialize the phase's task list automatically |

> **IMPORTANT: The `tasks` array in frontmatter is REQUIRED. The pipeline engine validates that `tasks` is present, is an array, and is non-empty. If `tasks` is missing or empty, the pipeline returns an error result and halts processing for the event. Every phase plan MUST include this field.**
```

### Step 5: Document `has_deviations` and `deviation_type` in Generate Task Report SKILL.md

Open `.github/skills/generate-task-report/SKILL.md`. Add a new section titled `## Required Frontmatter Fields` immediately before the existing `## Status Classification` section. The new section must contain:

```markdown
## Required Frontmatter Fields

The Task Report template frontmatter includes fields consumed by the pipeline and triage engines. These fields are **REQUIRED** — the pipeline validates their presence and returns an error if they are missing.

| Field | Type | Required | Allowed Values | Consumer | Purpose |
|-------|------|----------|---------------|----------|---------|
| `has_deviations` | boolean | **REQUIRED** | `true` or `false` | Triage engine `triageTask` rows 1–4, pipeline `task_completed` pre-read | Indicates whether the agent deviated from the task handoff instructions during implementation |
| `deviation_type` | string or null | **REQUIRED** | `"minor"` \| `"architectural"` \| `null` | Triage engine `triageTask` rows 3–4 | Classifies the severity of any deviation; must be `null` when `has_deviations` is `false` |

> **IMPORTANT: Both `has_deviations` and `deviation_type` are REQUIRED in task report frontmatter. The pipeline engine validates that both fields are present. If either is missing, the pipeline returns an error result and halts processing. Set `has_deviations: false` and `deviation_type: null` when there are no deviations — do NOT omit the fields.**
```

### Step 6: Document `exit_criteria_met` in Review Phase SKILL.md

Open `.github/skills/review-phase/SKILL.md`. Add a new section titled `## Required Frontmatter Fields` immediately before the existing `## Verdict Rules` section. The new section must contain:

```markdown
## Required Frontmatter Fields

The Phase Review template frontmatter includes fields consumed by the triage engine. These fields are **REQUIRED** — the triage engine validates their presence and returns an error if they are missing.

| Field | Type | Required | Allowed Values | Consumer | Purpose |
|-------|------|----------|---------------|----------|---------|
| `exit_criteria_met` | boolean | **REQUIRED** | `true` or `false` | Triage engine `triagePhase` rows 2–3 | Indicates whether all phase exit criteria from the Phase Plan were verified as met during the phase review |

> **IMPORTANT: The `exit_criteria_met` field is REQUIRED in phase review frontmatter. The triage engine validates that this field is present and is a boolean. If `exit_criteria_met` is missing, the triage engine returns an error. Set `exit_criteria_met: true` only when ALL exit criteria are verified as met. Set `exit_criteria_met: false` when any exit criterion is not met or only partially met.**
```

## Contracts & Interfaces

### Phase Plan Frontmatter Schema (consumed by pipeline engine)

```yaml
# .github/skills/create-phase-plan/templates/PHASE-PLAN.md frontmatter
tasks:                              # REQUIRED — array of task objects
  - id: string                      # REQUIRED — task identifier, e.g., "T01-AUTH"
    title: string                   # REQUIRED — human-readable task title
```

- **Consumer**: `handlePhasePlanCreated` reads `context.tasks` (populated from `frontmatter.tasks` by pre-read)
- **Validation** (enforced by pipeline engine in T02): `tasks` must be present, must be an array, must be non-empty
- **Error on absence**: `{ success: false, error: "Required frontmatter field 'tasks' missing from phase plan document" }`

### Task Report Frontmatter Schema (consumed by pipeline engine + triage engine)

```yaml
# .github/skills/generate-task-report/templates/TASK-REPORT.md frontmatter
has_deviations: boolean             # REQUIRED — true if agent deviated from handoff
deviation_type: string | null       # REQUIRED — "minor" | "architectural" | null
```

- **Consumer**: Pipeline `task_completed` pre-read validates presence; triage `triageTask` rows 1–4 use values
- **Validation** (enforced by pipeline engine in T03): `has_deviations` must not be `undefined`/`null`; `deviation_type` must not be `undefined`
- **Error on absence**: `{ success: false, error: "Required frontmatter field 'has_deviations' missing from task report" }`
- **No fallback**: No fallback to legacy `deviations` field — `has_deviations` and `deviation_type` are the sole contract

### Phase Review Frontmatter Schema (consumed by triage engine)

```yaml
# .github/skills/review-phase/templates/PHASE-REVIEW.md frontmatter
exit_criteria_met: boolean          # REQUIRED — true if all exit criteria verified as met
```

- **Consumer**: Triage `triagePhase` rows 2–3 use this value
- **Validation** (enforced by triage engine in T04): `exit_criteria_met` must not be `undefined`/`null`; must be strictly boolean
- **Error on absence**: `makeError("Required frontmatter field 'exit_criteria_met' missing from phase review")`
- **No fallback**: No fallback treating `undefined` as `true`; string values `"all"` and `"partial"` are not accepted

## Styles & Design Tokens

Not applicable — this task modifies only Markdown templates and SKILL.md instruction files. No visual interface or design system.

## Test Requirements

- [ ] No tests to write or run — this task modifies only Markdown template files and SKILL.md documentation files
- [ ] Verify manually that all 3 templates have valid YAML frontmatter (no syntax errors in the YAML block)

## Acceptance Criteria

- [ ] `.github/skills/create-phase-plan/templates/PHASE-PLAN.md` frontmatter contains a `tasks` array field with `id` (string) and `title` (string) entries, marked with a REQUIRED comment
- [ ] `.github/skills/generate-task-report/templates/TASK-REPORT.md` frontmatter contains `has_deviations` (boolean) and `deviation_type` (string or null) fields, both marked with REQUIRED comments
- [ ] `.github/skills/review-phase/templates/PHASE-REVIEW.md` frontmatter contains `exit_criteria_met` (boolean) field, marked with a REQUIRED comment
- [ ] `.github/skills/create-phase-plan/SKILL.md` contains a "Required Frontmatter Fields" section documenting the `tasks` array with type, allowed values, consumer, and purpose — marked REQUIRED
- [ ] `.github/skills/generate-task-report/SKILL.md` contains a "Required Frontmatter Fields" section documenting `has_deviations` and `deviation_type` with types, allowed values, consumers, and purpose — both marked REQUIRED
- [ ] `.github/skills/review-phase/SKILL.md` contains a "Required Frontmatter Fields" section documenting `exit_criteria_met` with type, allowed values, consumer, and purpose — marked REQUIRED
- [ ] All 6 modified files have valid Markdown structure (no broken frontmatter YAML, no unclosed code blocks)
- [ ] No JavaScript files are modified

## Constraints

- Do NOT modify any JavaScript files — this task is pure Markdown template and documentation changes
- Do NOT remove or reorder any existing frontmatter fields in the templates — only add new fields
- Do NOT change the existing body content of any template file (only the YAML frontmatter block is modified)
- Do NOT change the existing content of the SKILL.md files — only add new sections at the specified locations
- Do NOT add fields that are not consumed by the pipeline or triage engines
- Do NOT use placeholder type names — use exact YAML types (`true`/`false` for boolean, `null` for null, quoted strings for enum values)
