---
project: "STATE-TRANSITION-SCRIPTS"
phase: 4
task: 4
title: "End-to-End Validation"
status: "pending"
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 0
---

# End-to-End Validation

## Objective

Validate that all Phase 4 changes — agent rewrites (T1, T2) and supporting document updates (T3) — are consistent, all existing tests pass with zero regressions, no residual prose-based routing or triage logic remains in rewritten agents, and all script references in agent prose match actual file paths and CLI flags. Produce a validation report summarizing all checks.

## Context

Phase 4 rewrote two agent files and updated two supporting documents. T1 rewrote `.github/agents/orchestrator.agent.md` to delegate execution routing to `node src/next-action.js`. T2 rewrote `.github/agents/tactical-planner.agent.md` to delegate triage to `node src/triage.js` and added pre-write validation via `node src/validate-state.js` in all state-writing modes. T3 updated `.github/skills/triage-report/SKILL.md` with an authority notice and added a "Pre-Write Validation" section to `.github/instructions/state-management.instructions.md`. This task validates all four deliverables end-to-end with no new source files created.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/projects/STATE-TRANSITION-SCRIPTS/reports/STATE-TRANSITION-SCRIPTS-VALIDATION-P04-T04.md` | Validation report |
| — | No source files modified | Validation-only task; minor corrections to agent prose permitted if issues found |

## Implementation Steps

1. **Run project-specific test suites** — execute each suite individually and record pass/fail counts:
   ```bash
   node --test tests/constants.test.js
   node --test tests/state-validator.test.js
   node --test tests/validate-state.test.js
   node --test tests/resolver.test.js
   node --test tests/next-action.test.js
   node --test tests/triage-engine.test.js
   node --test tests/triage.test.js
   ```
   Expected: 189 project-specific tests pass (29 + 48 + ? + 48 + 13 + 44 + 7), 0 failures.

2. **Run validate-orchestration test suites** — these confirm no regressions from agent/skill file changes:
   ```bash
   node --test tests/agents.test.js tests/config.test.js tests/cross-refs.test.js tests/frontmatter.test.js tests/fs-helpers.test.js tests/instructions.test.js tests/prompts.test.js tests/reporter.test.js tests/skills.test.js tests/structure.test.js tests/yaml-parser.test.js
   ```
   Expected: all pass, 0 failures.

3. **Run the complete test suite** to verify aggregate count:
   ```bash
   node --test tests/*.test.js
   ```
   Expected: 330+ total tests pass, 0 failures, 0 regressions from Phase 4 changes.

4. **Audit `.github/agents/orchestrator.agent.md`** — verify script-based routing:
   - Locate the execution section (Step 2d or equivalent execution loop)
   - **CHECK-O1**: The execution loop calls `node src/next-action.js --state <path>` (optionally `--config <path>`) and parses JSON stdout
   - **CHECK-O2**: Pattern-matching on `result.action` covers all `NEXT_ACTIONS` enum values relevant to execution tier: `create_phase_plan`, `create_task_handoff`, `execute_task`, `triage_task`, `triage_phase`, `review_task`, `review_phase`, `generate_phase_report`, `advance_task`, `advance_phase`, `halt`, `complete_project`, and any others from the enum
   - **CHECK-O3**: `triage_attempts` counter logic is explicitly documented — increment on `triage_task`/`triage_phase` actions, reset to 0 on `advance_task`/`advance_phase` actions, halt pipeline if counter > 1
   - **CHECK-O4**: NO residual inline if/else decision trees remain for routing in the execution section — all routing derives from script output, not prose conditions
   - **CHECK-O5**: Script path is `src/next-action.js` (NOT `resolve-next-action.js`)
   - **CHECK-O6**: CLI flags are `--state <path>` and optionally `--config <path>` (NOT other flag names)
   - Record pass/fail for each check

5. **Audit `.github/agents/tactical-planner.agent.md`** — verify script-based triage and pre-write validation:
   - **CHECK-P1**: Mode 3 (Create Phase Plan) calls `node src/triage.js --state <path> --level phase --project-dir <dir>` — no residual inline triage table interpretation
   - **CHECK-P2**: Mode 4 (Create Task Handoff) calls `node src/triage.js --state <path> --level task --project-dir <dir>` — no residual inline triage table interpretation
   - **CHECK-P3**: Mode 2 (Update State) includes pre-write validation via `node src/validate-state.js --current <path> --proposed <path>`
   - **CHECK-P4**: Mode 3 includes pre-write validation via `node src/validate-state.js --current <path> --proposed <path>`
   - **CHECK-P5**: Mode 4 includes pre-write validation via `node src/validate-state.js --current <path> --proposed <path>`
   - **CHECK-P6**: Mode 5 (Generate Phase Report) includes pre-write validation via `node src/validate-state.js --current <path> --proposed <path>`
   - **CHECK-P7**: On validation failure, documented behavior is: do NOT commit write, record errors from `result.errors` in `errors.active_blockers`, halt pipeline, delete temp file
   - **CHECK-P8**: Skills section notes that `triage-report` is documentation-only; `src/triage.js` is the authoritative executor
   - **CHECK-P9**: Script paths are `src/triage.js` and `src/validate-state.js` (NOT `execute-triage.js` or `validate-state-transition.js`)
   - **CHECK-P10**: CLI flags for triage are `--state`, `--level task|phase`, `--project-dir`; for validate-state are `--current`, `--proposed`
   - **CHECK-P11**: Decision routing tables in Mode 3 and Mode 4 are preserved (they route on script output values, not on inline logic)
   - Record pass/fail for each check

6. **Verify `.github/skills/triage-report/SKILL.md`** — authority notice:
   - **CHECK-S1**: A prominent notice exists (after frontmatter or after the heading) stating the decision tables are **documentation-only**
   - **CHECK-S2**: The notice identifies `src/triage.js` as the **authoritative executor**
   - **CHECK-S3**: The notice states tables remain for human readability and as the specification the script was built from
   - **CHECK-S4**: The existing decision tables (task-level 11 rows, phase-level 5 rows) are intact and unmodified
   - Record pass/fail for each check

7. **Verify `.github/instructions/state-management.instructions.md`** — pre-write validation section:
   - **CHECK-I1**: A "Pre-Write Validation" section (or equivalent heading) exists
   - **CHECK-I2**: The section documents the CLI interface: `node src/validate-state.js --current <path> --proposed <path>`
   - **CHECK-I3**: The section documents the `--current` flag (path to committed state) and `--proposed` flag (path to proposed state)
   - **CHECK-I4**: The section documents JSON output format for success: `{ "valid": true, "invariants_checked": 15 }`
   - **CHECK-I5**: The section documents JSON output format for failure: `{ "valid": false, "errors": [...] }` with `invariant`, `message`, and `severity` fields
   - **CHECK-I6**: The section documents the required workflow: prepare proposed → write temp → call validator → parse output → commit on valid → halt on invalid
   - **CHECK-I7**: The section documents failure behavior: do NOT commit, record errors in `errors.active_blockers`, halt pipeline
   - Record pass/fail for each check

8. **Cross-reference script paths** — verify actual files exist in the workspace:
   - **CHECK-X1**: `src/next-action.js` exists and is a valid Node.js script
   - **CHECK-X2**: `src/triage.js` exists and is a valid Node.js script
   - **CHECK-X3**: `src/validate-state.js` exists and is a valid Node.js script
   - **CHECK-X4**: `src/lib/constants.js` exists (shared constants module)
   - **CHECK-X5**: `src/lib/resolver.js` exists (next-action resolver domain logic)
   - **CHECK-X6**: `src/lib/state-validator.js` exists (state transition validator domain logic)
   - **CHECK-X7**: `src/lib/triage-engine.js` exists (triage executor domain logic)
   - Record pass/fail for each check

9. **Produce validation report** — create `reports/STATE-TRANSITION-SCRIPTS-VALIDATION-P04-T04.md` containing:
   - **Summary**: 1-2 sentence overview of validation results
   - **Test Results**: Table with columns: Suite, Tests, Status — one row per test file
   - **Agent Audit Results**: Table with columns: Check ID, Target File, Description, Result, Notes — one row per CHECK-O and CHECK-P item
   - **Document Verification Results**: Table with columns: Check ID, Target File, Description, Result — one row per CHECK-S, CHECK-I, and CHECK-X item
   - **Conclusion**: Overall validation verdict (PASS or FAIL), total checks performed, any issues found

## Contracts & Interfaces

No new contracts or interfaces. This is a validation-only task. For reference, the scripts being validated expose these CLI interfaces:

**next-action.js**:
```
node src/next-action.js --state <path-to-state.json> [--config <path-to-orchestration.yml>]
```
Output: `{ "success": true, "action": "<NEXT_ACTIONS value>", "details": {...} }`

**triage.js**:
```
node src/triage.js --state <path-to-state.json> --level task|phase --project-dir <path>
```
Output: `{ "success": true, "action": "<verdict_action value>", ... }`

**validate-state.js**:
```
node src/validate-state.js --current <path-to-current-state.json> --proposed <path-to-proposed-state.json>
```
Output: `{ "valid": true|false, "invariants_checked": 15, "errors": [...] }`

## Styles & Design Tokens

N/A — validation-only task.

## Test Requirements

- [ ] `tests/constants.test.js` — 29 tests pass
- [ ] `tests/state-validator.test.js` — 48 tests pass
- [ ] `tests/validate-state.test.js` — all tests pass
- [ ] `tests/resolver.test.js` — 48 tests pass
- [ ] `tests/next-action.test.js` — 13 tests pass
- [ ] `tests/triage-engine.test.js` — 44 tests pass
- [ ] `tests/triage.test.js` — 7 tests pass
- [ ] `tests/agents.test.js` — all tests pass
- [ ] `tests/config.test.js` — all tests pass
- [ ] `tests/cross-refs.test.js` — all tests pass
- [ ] `tests/frontmatter.test.js` — all tests pass
- [ ] `tests/fs-helpers.test.js` — all tests pass
- [ ] `tests/instructions.test.js` — all tests pass
- [ ] `tests/prompts.test.js` — all tests pass
- [ ] `tests/reporter.test.js` — all tests pass
- [ ] `tests/skills.test.js` — all tests pass
- [ ] `tests/structure.test.js` — all tests pass
- [ ] `tests/yaml-parser.test.js` — all tests pass
- [ ] Aggregate: 330+ total tests, 0 failures

## Acceptance Criteria

- [ ] All existing tests pass (330+ tests, 0 failures, 0 regressions)
- [ ] No residual prose-based decision trees in Orchestrator execution section (CHECK-O1 through CHECK-O6 all pass)
- [ ] No residual inline triage table interpretation in Tactical Planner Mode 3 or Mode 4 (CHECK-P1, CHECK-P2 pass)
- [ ] Pre-write validation via `node src/validate-state.js` documented in Tactical Planner Modes 2, 3, 4, 5 (CHECK-P3 through CHECK-P6 pass)
- [ ] All script paths in agent prose are correct and match actual file locations (CHECK-O5, CHECK-P9, CHECK-X1 through CHECK-X7 pass)
- [ ] All CLI flags in agent prose match the actual script interfaces (CHECK-O6, CHECK-P10 pass)
- [ ] `triage-report/SKILL.md` contains authority notice (CHECK-S1 through CHECK-S4 pass)
- [ ] `state-management.instructions.md` contains pre-write validation section (CHECK-I1 through CHECK-I7 pass)
- [ ] validate-orchestration test suite passes with no structural regressions
- [ ] Validation report produced at `reports/STATE-TRANSITION-SCRIPTS-VALIDATION-P04-T04.md`

## Constraints

- Do NOT modify source files under `src/` unless a critical bug is discovered during testing
- Do NOT modify test files under `tests/` unless a test has an incorrect expectation due to Phase 4 changes
- Do NOT modify the decision tables in `.github/skills/triage-report/SKILL.md`
- Minor corrections to agent prose (typos, missing flag names, formatting) are permitted if discovered during audit — document any corrections in the validation report
- The validation report is the primary deliverable — every check listed above must appear in the report with a pass/fail result
- If any acceptance criterion fails, document the failure in the report and flag it — do NOT silently skip
