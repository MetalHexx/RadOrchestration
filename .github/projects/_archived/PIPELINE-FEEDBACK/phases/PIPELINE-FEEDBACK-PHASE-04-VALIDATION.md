---
project: "PIPELINE-FEEDBACK"
phase: 4
title: "Validation & Integration Testing"
status: "active"
total_tasks: 3
author: "tactical-planner-agent"
created: "2026-03-08T23:50:00Z"
---

# Phase 4: Validation & Integration Testing

## Phase Goal

Verify all changes from Phases 1–3 work together end-to-end, confirm the triage decision table is exhaustive with deterministic coverage, validate backward compatibility with legacy state files, and prove the happy path introduces zero additional agent invocations.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-FEEDBACK-MASTER-PLAN.md) | Phase 4 scope, exit criteria, success criteria |
| [Architecture](../PIPELINE-FEEDBACK-ARCHITECTURE.md) | Decision tables (11 task-level rows, 5 phase-level rows), gatekeep pseudocode, backward compatibility policy, state schema v2 contracts |
| [PRD](../PIPELINE-FEEDBACK-PRD.md) | FR-05 (triage determinism), FR-08/FR-09 (gatekeep invariants), FR-10 (backward compat), NFR-02 (exhaustiveness), NFR-07 (re-spawn limit), success metrics |
| [Phase 3 Report](../reports/PIPELINE-FEEDBACK-PHASE-REPORT-P03.md) | Phase 3 complete — all exit criteria met, zero retries, carry-forward: pre-existing validator failure (triage-report skill missing `templates/` subdirectory) — not related to Phase 4 scope |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Integration tests — full feedback loop | — | — | 1 | [Link](../tasks/PIPELINE-FEEDBACK-TASK-P04-T01-INTEGRATION-TESTS.md) |
| T2 | Unit tests — decision table coverage | — | — | 1 | [Link](../tasks/PIPELINE-FEEDBACK-TASK-P04-T02-DECISION-TABLE-TESTS.md) |
| T3 | Backward compatibility validation | — | — | 1 | [Link](../tasks/PIPELINE-FEEDBACK-TASK-P04-T03-BACKWARD-COMPAT.md) |

## Execution Order

```
T1 (integration tests — full feedback loop)
T2 (unit tests — decision table coverage)    ← parallel-ready with T1
T3 (backward compatibility validation)       ← parallel-ready with T1, T2
```

**Sequential execution order**: T1 → T2 → T3

*Note: T1, T2, and T3 are all parallel-ready (no mutual dependencies) but will execute sequentially in v1.*

## Task Details

### T1: Integration Tests — Full Feedback Loop

**Objective**: Write tests validating the complete feedback loop sequence across the Orchestrator, Tactical Planner, and state.json.

**Scope**:
- **Happy path test**: Reviewer writes review doc → Planner (Mode 2) records `review_doc` path in state.json (`review_doc` non-null, `review_verdict` null) → Planner (Mode 4) executes triage, writes `review_verdict` and `review_action` → Orchestrator reads state.json, gatekeep check passes (`review_doc != null AND review_verdict != null` → invariant is false) → confirm Orchestrator does **not** re-spawn → verify zero additional agent invocations
- **Unhappy path test**: Planner skips triage → `review_doc != null AND review_verdict == null` (invariant true) → Orchestrator detects invariant → re-spawns Planner once with explicit instruction → Planner completes triage on re-spawn → verdict fields now populated → pipeline continues
- **Re-spawn limit test**: `review_doc != null AND review_verdict == null` after re-spawn → `triage_attempts > 1` → pipeline halts with explicit error written to `errors.active_blockers`
- **Phase-level happy path**: `phase_review` recorded → `phase_review_verdict` populated → Orchestrator gatekeep passes → no re-spawn
- **Phase-level unhappy path**: `phase_review != null AND phase_review_verdict == null` → re-spawn once → continue
- **Phase-level re-spawn limit**: verdict still null after re-spawn → halt

**Test location**: `tests/` directory — create `tests/integration-feedback-loop.test.js`

**Acceptance criteria**:
- [ ] Happy path test passes: verdict fields populated, Orchestrator does not re-spawn
- [ ] Unhappy path test passes: Orchestrator detects invariant, re-spawns Planner once, pipeline continues
- [ ] Re-spawn limit test passes: pipeline halts with `errors.active_blockers` entry when verdict still null after re-spawn
- [ ] Phase-level equivalents of all three scenarios pass
- [ ] Test confirms zero additional agent invocations on happy path

---

### T2: Unit Tests — Decision Table Coverage

**Objective**: Write unit tests covering all 11 task-level triage rows and all 5 phase-level triage rows (16 total), asserting exact expected outputs for each input combination.

**Scope**:
- **Task-level rows 1–11**: Each test provides a specific `(task_report_status, has_deviations, code_review_verdict)` input tuple and asserts the exact expected `(review_verdict, review_action)` output from the decision table
- **Phase-level rows 1–5**: Each test provides a specific `(phase_review_verdict, exit_criteria_assessment)` input tuple and asserts the exact expected `(phase_review_verdict, phase_review_action)` output
- No row should require judgment — every test asserts a deterministic, unambiguous output

**Task-level test cases (11 rows)**:

| Row | Status | Deviations | Verdict Input | Expected `review_verdict` | Expected `review_action` |
|-----|--------|-----------|---------------|---------------------------|--------------------------|
| 1 | `complete` | No | `null` | `null` (skip) | `null` (skip) |
| 2 | `complete` | No | `"approved"` | `"approved"` | `"advanced"` |
| 3 | `complete` | Yes — minor | `"approved"` | `"approved"` | `"advanced"` |
| 4 | `complete` | Yes — architectural | `"approved"` | `"approved"` | `"advanced"` |
| 5 | `complete` | Any | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` |
| 6 | `complete` | Any | `"rejected"` | `"rejected"` | `"halted"` |
| 7 | `partial` | — | `null` | `null` (skip) | `null` (skip) |
| 8 | `partial` | — | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` |
| 9 | `partial` | — | `"rejected"` | `"rejected"` | `"halted"` |
| 10 | `failed` | — | Any or `null`, minor severity, retries < max | *(recorded if review doc exists)* | `"corrective_task_issued"` |
| 11 | `failed` | — | Any or `null`, critical severity | *(recorded if review doc exists)* | `"halted"` |

**Phase-level test cases (5 rows)**:

| Row | Phase Review Verdict | Exit Criteria | Expected `phase_review_verdict` | Expected `phase_review_action` |
|-----|---------------------|---------------|--------------------------------|-------------------------------|
| 1 | `null` | — | `null` (skip) | `null` (skip) |
| 2 | `"approved"` | All met | `"approved"` | `"advanced"` |
| 3 | `"approved"` | Some unmet | `"approved"` | `"advanced"` |
| 4 | `"changes_requested"` | — | `"changes_requested"` | `"corrective_tasks_issued"` |
| 5 | `"rejected"` | — | `"rejected"` | `"halted"` |

**Test location**: `tests/` directory — create `tests/triage-decision-table.test.js`

**Acceptance criteria**:
- [ ] All 11 task-level decision table rows covered by individual test cases; all pass
- [ ] All 5 phase-level decision table rows covered by individual test cases; all pass
- [ ] No test requires judgment — each asserts exact expected values
- [ ] Both `review_verdict` and `review_action` are non-null for every triaged task in test state (rows 2–6, 8–11)
- [ ] Phase action uses `"corrective_tasks_issued"` (plural); task action uses `"corrective_task_issued"` (singular)

---

### T3: Backward Compatibility Validation

**Objective**: Validate that a legacy `state.json` (v1 schema, all six new fields absent) runs through the updated pipeline without errors or spurious gatekeep re-spawns.

**Scope**:
- Create a test fixture: a valid v1 `state.json` with `$schema: "orchestration-state-v1"`, task entries that do NOT contain `review_doc`, `review_verdict`, `review_action`, and phase entries that do NOT contain `phase_review`, `phase_review_verdict`, `phase_review_action`
- Run the legacy state through the Orchestrator's gatekeep invariant check logic
- Confirm `null != null` evaluates to `false` — absent fields treated as `null`, invariant not triggered
- Confirm no pipeline errors (no field-not-found errors, no TypeError on accessing missing fields)
- Confirm no spurious gatekeep re-spawns — `triage_attempts` stays at 0
- Confirm `errors.active_blockers` remains empty after pipeline processes legacy state

**Test location**: `tests/` directory — create `tests/backward-compat.test.js`

**Acceptance criteria**:
- [ ] Legacy v1 state.json fixture loads without errors
- [ ] Absent fields are treated as `null` — no TypeError or field-not-found errors
- [ ] `null != null` evaluates to `false` — Orchestrator invariant not triggered
- [ ] No spurious gatekeep re-spawns — `triage_attempts` remains 0
- [ ] `errors.active_blockers` remains empty
- [ ] Pipeline completes normally when processing legacy state

## Phase Exit Criteria

- [ ] Integration test for happy path passes: verdict fields populated, Orchestrator does not re-spawn
- [ ] Integration test for unhappy path passes: Orchestrator detects invariant, re-spawns Planner once, pipeline continues after triage completes
- [ ] Integration test for re-spawn limit passes: pipeline halts with `errors.active_blockers` entry when verdict is still null after re-spawn
- [ ] All 11 task-level decision table rows covered by unit tests; all pass
- [ ] All 5 phase-level decision table rows covered by unit tests; all pass
- [ ] Backward compatibility test passes: legacy state.json runs through updated pipeline without errors or spurious re-spawns
- [ ] Both `review_verdict` and `review_action` are non-null for every triaged task in test state (audit trail completeness)
- [ ] Test run confirms zero increase in agent invocations on happy path vs. baseline
- [ ] All tasks complete with status `complete`
- [ ] Build passes
- [ ] All tests pass

## Known Risks for This Phase

- **Test design may not fully simulate agent spawning**: Integration tests must simulate the Orchestrator → Planner → state.json interaction sequence without actually spawning LLM agents. Test design must accurately model the field-level gatekeep logic and state transitions.
- **Row 10 conditional logic**: Row 10 of the task-level decision table has a conditional (`retries < max_retries AND severity == "minor"` → corrective; else → halt). The unit test must cover both branches — one where the condition is true and one where it falls through to halt.
- **Pre-existing validator issue**: The triage-report skill is missing a `templates/` subdirectory (carry-forward from Phase 3 report). This does not affect Phase 4 test scope but may cause the validate-orchestration skill to report a warning.
