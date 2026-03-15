---
project: "STATE-TRANSITION-SCRIPTS"
phase: 4
task: 2
title: "Tactical Planner Agent Rewrite"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Tactical Planner Agent Rewrite

## Objective

Rewrite the Tactical Planner agent definition at `.github/agents/tactical-planner.agent.md` to: (1) replace inline triage-report skill invocation in Mode 3 and Mode 4 with calls to `node src/triage.js`, (2) add pre-write state validation via `node src/validate-state.js` to all state-writing modes (2, 3, 4, 5), and (3) update the Skills section to note that `triage-report` is now documentation-only.

## Context

The orchestration system has three deterministic CLI scripts at `src/next-action.js`, `src/triage.js`, and `src/validate-state.js`. The Orchestrator agent was already rewritten in P4-T1 to call `src/next-action.js`. This task rewrites the Tactical Planner agent to call `src/triage.js` and `src/validate-state.js`, removing the last prose-derived triage and adding validation guard-rails to every state write. The Tactical Planner remains the sole writer of `state.json` and `STATUS.md`. Its mode structure (Modes 1–5), document creation responsibilities, frontmatter, and all non-triage/non-state-write logic are preserved unchanged.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/tactical-planner.agent.md` | Replace triage invocations in Mode 3 & 4; add pre-write validation in Modes 2, 3, 4, 5; update Skills section |

## Implementation Steps

### Step 1: Mode 3 (Create Phase Plan) — Replace Triage Invocation

In Mode 3, replace **Step 7** entirely. The current Step 7 reads:

```
7. **Execute `triage-report` skill** (phase-level decision table):
   - Write `phase.phase_review_verdict` ← verdict from Phase Review frontmatter (or skip if `phase_review` is null)
   - Write `phase.phase_review_action` ← resolved from phase-level decision table (or skip if `phase_review` is null)
```

Replace with:

```
7. **Execute triage script** (phase-level):
   - Call: `node src/triage.js --state {state_path} --level phase --project-dir {project_dir}`
   - Parse JSON stdout: `result = JSON.parse(stdout)`
   - **If `result.success === true`**: The script has written `phase_review_verdict` and `phase_review_action` to `state.json`. Use `result.action` to determine the routing in step 8.
   - **If `result.success === false`**: Record `result.error` in `errors.active_blockers`, halt pipeline — do NOT proceed to step 8.
   - **If `phase.phase_review` is `null`**: Skip this step entirely (no triage needed).
```

Keep the **"Decision routing after triage (step 7→8)"** table exactly as-is — it routes on the action value regardless of whether it came from a script or inline logic.

### Step 2: Mode 4 (Create Task Handoff) — Replace Triage Invocation

In Mode 4, replace **Step 6** entirely. The current Step 6 reads:

```
6. **Execute `triage-report` skill** (task-level decision table):
   - Write `task.review_verdict` ← verdict from Code Review frontmatter (or skip if no review doc)
   - Write `task.review_action` ← resolved from task-level decision table (or skip if no review doc)
```

Replace with:

```
6. **Execute triage script** (task-level):
   - Call: `node src/triage.js --state {state_path} --level task --project-dir {project_dir}`
   - Parse JSON stdout: `result = JSON.parse(stdout)`
   - **If `result.success === true`**: The script has written `review_verdict` and `review_action` to `state.json`. Use `result.action` to determine the routing in step 7.
   - **If `result.success === false`**: Record `result.error` in `errors.active_blockers`, halt pipeline — do NOT proceed to step 7.
   - **If `task.review_doc` is `null`** (for the relevant completed task): Skip this step entirely (no triage needed).
```

Keep the **"Decision routing after triage (step 6→7)"** table exactly as-is.

### Step 3: Mode 2 (Update State) — Add Pre-Write Validation

In Mode 2, insert a new validation step between the current Step 3 and Step 4. The current flow is:

```
3. **Update `project.updated`** timestamp
4. **Write `state.json`**
5. **Update `STATUS.md`** to reflect the new state
```

Replace with:

```
3. **Update `project.updated`** timestamp
4. **Validate proposed state** — pre-write check:
   - Write proposed state to a temporary file (e.g., `state.json.proposed`)
   - Call: `node src/validate-state.js --current {state_path} --proposed {temp_path}`
   - Parse JSON stdout: `result = JSON.parse(stdout)`
   - **If `result.valid === true`**: Commit — replace `state.json` with the proposed file
   - **If `result.valid === false`**: Do NOT commit the write. Record each entry from `result.errors` in `errors.active_blockers`. Halt pipeline. Delete temp file.
5. **Update `STATUS.md`** to reflect the new state
```

### Step 4: Mode 3 (Create Phase Plan) — Add Pre-Write Validation

In Mode 3, Step 9 currently reads:

```
9. **Update `state.json`**: Create phase entry with tasks, set phase status to `"in_progress"`
```

Replace with:

```
9. **Update `state.json`** (with pre-write validation):
   - Prepare proposed state: create phase entry with tasks, set phase status to `"in_progress"`, update `project.updated` timestamp
   - Write proposed state to a temporary file (e.g., `state.json.proposed`)
   - Call: `node src/validate-state.js --current {state_path} --proposed {temp_path}`
   - Parse JSON stdout: `result = JSON.parse(stdout)`
   - **If `result.valid === true`**: Commit — replace `state.json` with the proposed file
   - **If `result.valid === false`**: Do NOT commit the write. Record each entry from `result.errors` in `errors.active_blockers`. Halt pipeline. Delete temp file.
```

### Step 5: Mode 4 (Create Task Handoff) — Add Pre-Write Validation

In Mode 4, Step 8 currently reads:

```
8. **Update `state.json`**: Set task `handoff_doc` path
```

Replace with:

```
8. **Update `state.json`** (with pre-write validation):
   - Prepare proposed state: set task `handoff_doc` path, update `project.updated` timestamp
   - Write proposed state to a temporary file (e.g., `state.json.proposed`)
   - Call: `node src/validate-state.js --current {state_path} --proposed {temp_path}`
   - Parse JSON stdout: `result = JSON.parse(stdout)`
   - **If `result.valid === true`**: Commit — replace `state.json` with the proposed file
   - **If `result.valid === false`**: Do NOT commit the write. Record each entry from `result.errors` in `errors.active_blockers`. Halt pipeline. Delete temp file.
```

### Step 6: Mode 5 (Generate Phase Report) — Add Pre-Write Validation

In Mode 5, Step 13 currently reads:

```
13. **Update `state.json`**: Set phase_report path
```

Replace with:

```
13. **Update `state.json`** (with pre-write validation):
   - Prepare proposed state: set `phase_report` path, update `project.updated` timestamp
   - Write proposed state to a temporary file (e.g., `state.json.proposed`)
   - Call: `node src/validate-state.js --current {state_path} --proposed {temp_path}`
   - Parse JSON stdout: `result = JSON.parse(stdout)`
   - **If `result.valid === true`**: Commit — replace `state.json` with the proposed file
   - **If `result.valid === false`**: Do NOT commit the write. Record each entry from `result.errors` in `errors.active_blockers`. Halt pipeline. Delete temp file.
```

### Step 7: Update Skills Section

The current Skills section reads:

```
## Skills

- **`create-phase-plan`**: Guides phase planning and provides template
- **`create-task-handoff`**: Guides task handoff creation and provides template
- **`generate-phase-report`**: Guides phase report generation and provides template
- **`triage-report`**: Decision tables for task-level and phase-level triage — read sequences, verdict/action resolution, state write contract
```

Replace the `triage-report` bullet with:

```
- **`triage-report`**: Decision tables for task-level and phase-level triage — **documentation-only reference**. The authoritative executor is `src/triage.js`. The tables remain for human readability and as the specification the script implements. Agents call the script, not the tables directly.
```

### Step 8: Preserve Everything Else

Do NOT modify any of the following:
- YAML frontmatter (the `---` block at the top)
- `# Tactical Planner Agent` heading and introductory paragraph
- `## Role & Constraints` section (What you do / What you do NOT do / Write access)
- `## Mode 1: Initialize Project` — no pre-write validation needed (creates initial state, no current state to compare)
- Mode 2's `### State Update Rules` subsection
- Mode 3 Steps 1–6, Step 8, or the **Decision routing after triage** table
- Mode 4 Steps 1–5, Step 7, or the **Decision routing after triage** table
- `### Corrective Task Handoffs` subsection
- Mode 5 Steps 1–12
- `## Output Contract` table
- `## Quality Standards` section

## Contracts & Interfaces

### Triage Script CLI — `src/triage.js`

```
node src/triage.js --state <path> --level <task|phase> --project-dir <dir>
```

| Flag | Required | Type | Description |
|------|----------|------|-------------|
| `--state` | Yes | File path | Path to `state.json`. Script reads AND writes this file. |
| `--level` | Yes | `task` or `phase` | Which decision table to evaluate. |
| `--project-dir` | Yes | Directory path | Base directory of the project, used to resolve relative document paths. |

#### Success Output (JSON on stdout)

```json
{
  "success": true,
  "level": "task | phase",
  "verdict": "approved | changes_requested | rejected | null",
  "action": "advanced | corrective_task_issued | corrective_tasks_issued | halted | null",
  "phase_index": 0,
  "task_index": 0,
  "row_matched": 2,
  "details": "Row 2: task complete, no deviations, review approved → advanced"
}
```

#### Error Output (JSON on stdout)

```json
{
  "success": false,
  "level": "task | phase",
  "error": "structured error message",
  "error_code": "DOCUMENT_NOT_FOUND | INVALID_VERDICT | IMMUTABILITY_VIOLATION | INVALID_STATE | INVALID_LEVEL",
  "phase_index": 0,
  "task_index": 0
}
```

**Exit codes**: `0` = success (state.json updated), `1` = error (state.json NOT modified).

**Script behavior**: The triage script writes `review_verdict`/`review_action` (task-level) or `phase_review_verdict`/`phase_review_action` (phase-level) directly to `state.json`. The Tactical Planner does NOT need to write these fields manually after the script runs.

### State Validator CLI — `src/validate-state.js`

```
node src/validate-state.js --current <path> --proposed <path>
```

| Flag | Required | Type | Description |
|------|----------|------|-------------|
| `--current` | Yes | File path | Path to the current (committed) `state.json`. |
| `--proposed` | Yes | File path | Path to the proposed (uncommitted) `state.json` temp file. |

#### Pass Output (JSON on stdout)

```json
{
  "valid": true,
  "invariants_checked": 15
}
```

#### Fail Output (JSON on stdout)

```json
{
  "valid": false,
  "invariants_checked": 15,
  "errors": [
    {
      "invariant": "V6",
      "message": "Multiple tasks have status 'in_progress': P01-T02, P02-T01",
      "severity": "critical"
    }
  ]
}
```

**Exit codes**: `0` = all invariants pass, `1` = one or more violations (or unexpected error).

**Integration pattern**:
1. Prepare proposed state changes in memory
2. Write proposed state to temporary file (e.g., `state.json.proposed`)
3. Call: `node src/validate-state.js --current {state_path} --proposed {temp_path}`
4. Parse: `result = JSON.parse(stdout)`
5. If `result.valid === true`: Move proposed file to `state.json` (atomic replace)
6. If `result.valid === false`: Record `result.errors` in `errors.active_blockers`, delete temp file, halt — do NOT commit

### Invariants Checked by the Validator (V1–V15)

| # | Check |
|---|-------|
| V1 | `current_phase` is valid index into `phases[]` |
| V2 | Each phase's `current_task` is valid index into `tasks[]` |
| V3 | No task's `retries` exceeds `max_retries_per_task` |
| V4 | `phases.length` does not exceed `max_phases` |
| V5 | Each phase's `tasks.length` does not exceed `max_tasks_per_phase` |
| V6 | At most one task across entire project has `status: "in_progress"` |
| V7 | `planning.human_approved == true` if `current_tier == "execution"` |
| V8 | No task has `review_doc != null AND review_verdict == null` |
| V9 | No phase has `phase_review != null AND phase_review_verdict == null` |
| V10 | Absent fields treated as `null`; no false triggers |
| V11 | No task's `retries` decreased from current state |
| V12 | Task status transitions follow allowed paths |
| V13 | `project.updated` timestamp is newer than current |
| V14 | Write ordering: if `review_doc` changed, verdict/action must not change in same write |
| V15 | Immutability: verdict/action for task N not overwritten by triage of task M |

## Styles & Design Tokens

Not applicable — this task modifies a markdown agent definition, not source code or UI.

## Test Requirements

No automated tests are required for this task (the file is a markdown agent definition, not executable code).

**Manual verification**:
- [ ] Mode 3 Step 7 contains the triage script invocation: `node src/triage.js --state <path> --level phase --project-dir <dir>`
- [ ] Mode 4 Step 6 contains the triage script invocation: `node src/triage.js --state <path> --level task --project-dir <dir>`
- [ ] Mode 2 contains the validator invocation: `node src/validate-state.js --current <path> --proposed <path>`
- [ ] Mode 3 Step 9 contains the validator invocation
- [ ] Mode 4 Step 8 contains the validator invocation
- [ ] Mode 5 Step 13 contains the validator invocation
- [ ] Skills section notes `triage-report` is documentation-only with `src/triage.js` as authoritative executor
- [ ] File renders as valid markdown (no broken fences, no unclosed blocks)
- [ ] Orchestration validation passes for `tactical-planner.agent.md`

## Acceptance Criteria

- [ ] Mode 3 calls `node src/triage.js --level phase` with correct flags — no residual "Execute `triage-report` skill" text
- [ ] Mode 4 calls `node src/triage.js --level task` with correct flags — no residual "Execute `triage-report` skill" text
- [ ] Mode 2 includes pre-write validation step calling `node src/validate-state.js --current <path> --proposed <path>` before committing `state.json`
- [ ] Mode 3 includes pre-write validation in Step 9 before committing `state.json`
- [ ] Mode 4 includes pre-write validation in Step 8 before committing `state.json`
- [ ] Mode 5 includes pre-write validation in Step 13 before committing `state.json`
- [ ] On validation failure: instructions state to record errors in `errors.active_blockers`, halt, do NOT commit the write
- [ ] Decision routing tables in Mode 3 (step 7→8) and Mode 4 (step 6→7) are preserved unchanged
- [ ] Skills section updated: `triage-report` noted as documentation-only, `src/triage.js` is authoritative executor
- [ ] Mode 1 is NOT modified (no pre-write validation on initial state creation)
- [ ] YAML frontmatter is preserved unchanged
- [ ] Role & Constraints, Corrective Task Handoffs, Output Contract, and Quality Standards sections are preserved unchanged
- [ ] The script paths are `src/triage.js` and `src/validate-state.js` (NOT `execute-triage.js` or `validate-state-transition.js`)
- [ ] The CLI flags are `--state`, `--level`, `--project-dir` (triage) and `--current`, `--proposed` (validator)
- [ ] File renders as valid markdown with no syntax errors
- [ ] Build succeeds (orchestration validation passes)

## Constraints

- Do NOT modify Mode 1 (Initialize Project) — initial state creation has no prior state to validate against
- Do NOT modify the State Update Rules subsection in Mode 2
- Do NOT modify the Decision routing tables in Mode 3 or Mode 4 — these route on action values and work identically whether the value comes from a script or inline logic
- Do NOT modify the Corrective Task Handoffs subsection
- Do NOT modify the Output Contract or Quality Standards sections
- Do NOT modify the YAML frontmatter block
- Do NOT add any new modes or sections — only modify within existing mode boundaries
- Do NOT reference the Architecture, Design, PRD, or any other planning document — this handoff is self-contained
- Use exact script paths: `src/triage.js` and `src/validate-state.js` — not the Design doc's draft names
- Use exact CLI flag names: `--state`, `--level`, `--project-dir`, `--current`, `--proposed`
