---
project: "PIPELINE-FEEDBACK"
phase: 1
title: "Schema Foundation"
status: "active"
total_tasks: 2
author: "tactical-planner-agent"
created: "2026-03-08T00:00:00Z"
---

# Phase 1: Schema Foundation

## Phase Goal

Establish the foundational contracts — the updated state schema (v2) with six new review-tracking fields and the triage-report skill with exhaustive decision tables — that all subsequent phases depend on.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-FEEDBACK-MASTER-PLAN.md) | Phase 1 scope (T1: state schema update, T2: triage skill creation) and exit criteria |
| [Architecture](../PIPELINE-FEEDBACK-ARCHITECTURE.md) | State Schema v2 task/phase entry JSON blocks, field definitions, decision tables (11 task-level rows, 5 phase-level rows), triage skill interface contract, verbatim transcription rule |
| [PRD](../PIPELINE-FEEDBACK-PRD.md) | FR-01 through FR-03 (new state fields, schema version bump), FR-05 (triage skill requirements), FR-10 (backward compatibility), NFR-02 (determinism) |

*No Design document — this is an infrastructure/instruction-file project with no UI.*
*No previous Phase Report — this is Phase 1.*

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Update state-json-schema.md — add 6 new fields, bump to v2, add invariant docs | — | — | 1 | [Link](../tasks/PIPELINE-FEEDBACK-TASK-P01-T01-STATE-SCHEMA-V2.md) |
| T2 | Create triage-report/SKILL.md — full decision tables, read sequences, write contract | — | `create-skill` | 1 | [Link](../tasks/PIPELINE-FEEDBACK-TASK-P01-T02-TRIAGE-REPORT-SKILL.md) |

## Execution Order

```
T1 (state schema v2)
T2 (triage-report skill)  ← parallel-ready with T1
```

**Sequential execution order**: T1 → T2

*Note: T1 and T2 are parallel-ready (no mutual dependency) but will execute sequentially in v1.*

## Task Details

### T1: Update state-json-schema.md

**File**: `plan/schemas/state-json-schema.md` (MODIFY)

**Objective**: Update the canonical state schema definition to v2 by adding six new review-tracking fields and documenting invariants.

**Changes required**:
1. **Bump `$schema`** value from `"orchestration-state-v1"` to `"orchestration-state-v2"` in the root JSON block
2. **Add 3 fields to the task entry JSON block** (`execution.phases[].tasks[]`):
   - `"review_doc": null` — string|null, path to the Code Review document
   - `"review_verdict": null` — string|null, enum: `"approved"` | `"changes_requested"` | `"rejected"`
   - `"review_action": null` — string|null, enum: `"advanced"` | `"corrective_task_issued"` | `"halted"`
3. **Add 3 fields to the phase entry JSON block** (`execution.phases[]`):
   - `"phase_review": null` — string|null, path to the Phase Review document
   - `"phase_review_verdict": null` — string|null, enum: `"approved"` | `"changes_requested"` | `"rejected"`
   - `"phase_review_action": null` — string|null, enum: `"advanced"` | `"corrective_tasks_issued"` | `"halted"`
4. **Add Field Reference entries** for all 6 fields with: type, written-when, enum values (per Architecture field definitions tables)
5. **Add invariant documentation** to Validation Rules section:
   - Task-level: `task.review_doc != null AND task.review_verdict == null → triage was skipped`
   - Phase-level: `phase.phase_review != null AND phase.phase_review_verdict == null → phase triage was skipped`
   - Backward compatibility: absent fields treated as `null`; `null != null` = `false` → invariant not triggered
6. **Update pseudocode** to show gatekeep check placeholder (from Architecture: Orchestrator Gatekeep Pseudocode Contract)

**Acceptance criteria**:
- JSON block for task entry contains `review_doc`, `review_verdict`, `review_action` with `null` defaults
- JSON block for phase entry contains `phase_review`, `phase_review_verdict`, `phase_review_action` with `null` defaults
- `$schema` reads `"orchestration-state-v2"`
- All 6 fields in Field Reference with type, written-when, and enum values
- Validation Rules section documents both invariants and backward-compat null-treatment
- Pseudocode shows gatekeep check placeholder

---

### T2: Create triage-report/SKILL.md

**File**: `.github/skills/triage-report/SKILL.md` (CREATE)

**Objective**: Create a complete triage-report skill that encodes exhaustive decision tables for task-level and phase-level triage, with read sequences, state write contract, and verbatim transcription rule.

**Contents required**:
1. **Skill header** — name: `triage-report`; invocation context: embedded step within Mode 3 and Mode 4 only (never standalone); produces-no-document note (triage writes state.json fields, not a separate report)
2. **Mode 4 read sequence** (task-level triage):
   - ALWAYS read: Task Report at path from `state.json → task.report_doc`
   - CONDITIONAL read: Code Review at path from `state.json → task.review_doc` (only if non-null)
3. **Mode 3 read sequence** (phase-level triage):
   - ALWAYS read: Phase Report at path from `state.json → phase.phase_report` (if not first phase)
   - CONDITIONAL read: Phase Review at path from `state.json → phase.phase_review` (only if non-null)
4. **Complete task-level decision table** — exactly 11 rows:

   | # | Task Report Status | Has Deviations? | Code Review Verdict | `review_verdict` Written | `review_action` Written | Planner Next Action |
   |---|---|---|---|---|---|---|
   | 1 | `complete` | No | `null` (no review) | *(skip)* | *(skip)* | Next task handoff; carry Recommendations |
   | 2 | `complete` | No | `"approved"` | `"approved"` | `"advanced"` | Next task handoff normally |
   | 3 | `complete` | Yes — minor | `"approved"` | `"approved"` | `"advanced"` | Next task handoff; surface minor deviations |
   | 4 | `complete` | Yes — architectural | `"approved"` | `"approved"` | `"advanced"` | Next task handoff; carry-forward item |
   | 5 | `complete` | Any | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` | Corrective handoff; inline review Issues |
   | 6 | `complete` | Any | `"rejected"` | `"rejected"` | `"halted"` | Halt pipeline |
   | 7 | `partial` | — | `null` (no review) | *(skip)* | *(skip)* | Assess severity → corrective or halt |
   | 8 | `partial` | — | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` | Corrective handoff; merge issues |
   | 9 | `partial` | — | `"rejected"` | `"rejected"` | `"halted"` | Halt pipeline |
   | 10 | `failed` | — | Any or `null` | *(record if review exists)* | See note | Retry-budget check → corrective or halt |
   | 11 | `failed` | — | Any — critical | *(record if review exists)* | `"halted"` | Halt immediately |

5. **Complete phase-level decision table** — exactly 5 rows:

   | # | Phase Review Verdict | Exit Criteria Assessment | `phase_review_verdict` Written | `phase_review_action` Written | Planner Next Action |
   |---|---|---|---|---|---|
   | 1 | `null` (no review) | — | *(skip)* | *(skip)* | Skip triage; use Phase Report only |
   | 2 | `"approved"` | All met | `"approved"` | `"advanced"` | Next phase normally |
   | 3 | `"approved"` | Some unmet | `"approved"` | `"advanced"` | Next phase; carry-forward unmet criteria |
   | 4 | `"changes_requested"` | — | `"changes_requested"` | `"corrective_tasks_issued"` | Corrective tasks for integration issues |
   | 5 | `"rejected"` | — | `"rejected"` | `"halted"` | Halt pipeline |

6. **State write contract** — specify exactly which fields are written, when, by whom (Tactical Planner only), and with what values
7. **Verbatim transcription rule** — `review_verdict` and `phase_review_verdict` values must be transcribed verbatim from Reviewer frontmatter `verdict` field; no casing normalization, no mapping

**Acceptance criteria**:
- Skill file exists at `.github/skills/triage-report/SKILL.md`
- Contains task-level decision table with exactly 11 rows; every row maps to exactly one `review_action`
- Contains phase-level decision table with exactly 5 rows; every row maps to exactly one `phase_review_action`
- Documents state write contract with verbatim transcription rule
- Specifies invocation context (embedded in Mode 3/4 only)
- Specifies read sequences for both Mode 3 and Mode 4 contexts

## Phase Exit Criteria

- [ ] `state-json-schema.md` JSON block contains all six new fields in their correct parent entries (3 per task, 3 per phase)
- [ ] All six fields documented in Field Reference with type, written-when, and enum values
- [ ] `$schema` value reads `"orchestration-state-v2"`
- [ ] Invariant documentation added to Validation Rules section (both task-level and phase-level invariants, plus backward-compat null-treatment)
- [ ] `triage-report/SKILL.md` exists at `.github/skills/triage-report/SKILL.md`
- [ ] Skill contains task-level decision table with exactly 11 rows; all rows have exactly one `review_action` value (no "use judgment" rows)
- [ ] Skill contains phase-level decision table with exactly 5 rows; all rows have exactly one `phase_review_action` value
- [ ] Skill documents state write contract specifying verbatim transcription rule
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **Decision table gap risk**: If any input combination is missed in the triage skill's decision tables, downstream phases (2 and 3) will inherit the gap. Mitigation: the Architecture document specifies exact row counts (11 task-level, 5 phase-level) — the Coder must verify the count matches.
- **Field enum mismatch risk**: If the enum values in the schema doc diverge from the values in the triage skill's decision table, the system will be inconsistent. Mitigation: both T1 and T2 pull enum values from the same Architecture source; the review step should cross-check.
- **Phase-level action plural vs singular**: `phase_review_action` uses `"corrective_tasks_issued"` (plural) while `review_action` uses `"corrective_task_issued"` (singular). Coder must not accidentally normalize these — they are intentionally different per Architecture.
