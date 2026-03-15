---
project: "PIPELINE-FEEDBACK"
status: "draft"
author: "architect-agent"
created: "2026-03-08T00:00:00Z"
---

# PIPELINE-FEEDBACK — Master Plan

## Executive Summary

The PIPELINE-FEEDBACK project closes a critical gap in the orchestration system's review-feedback loop: the Tactical Planner currently plans future work from factual completion records (task reports) but is blind to evaluative judgments — code reviews and phase reviews are produced by the Reviewer but are invisible to downstream planning because their paths are not tracked in `state.json`. This project delivers three coordinated, additive changes: (1) six new fields in `state.json` (three per task, three per phase) that give the Planner deterministic read paths to review documents and give the Orchestrator a mechanical, document-free gatekeep signal; (2) a new `triage-report` skill with an exhaustive 16-row decision table that maps every combination of task-report status and review verdict to exactly one Planner action; (3) targeted instruction additions to the Tactical Planner (Modes 2, 3, and 4) and the Orchestrator (execution loop gatekeep with a one-re-spawn limit). No new agents are introduced, no pipeline tiers are added, and the happy path requires zero additional agent invocations — all changes are additive modifications to four existing or new instruction files.

---

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [PIPELINE-FEEDBACK-BRAINSTORMING.md](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-BRAINSTORMING.md) | ✅ |
| Research Findings | [PIPELINE-FEEDBACK-RESEARCH-FINDINGS.md](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [PIPELINE-FEEDBACK-PRD.md](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md) | ✅ |
| Design | *(none — no UI; this is a configuration and instruction-file project)* | N/A |
| Architecture | [PIPELINE-FEEDBACK-ARCHITECTURE.md](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-ARCHITECTURE.md) | ✅ |

---

## Key Requirements (from PRD)

The following P0 functional and critical non-functional requirements drive the phasing and implementation constraints. See the [PRD](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md) for the full list.

- **FR-01 / FR-02 — Six new state fields**: Each task entry gains `review_doc`, `review_verdict`, `review_action`; each phase entry gains `phase_review`, `phase_review_verdict`, `phase_review_action`. All default to `null`. All written exclusively by the Tactical Planner.
- **FR-04 — Mode 2 extended write contract**: The Tactical Planner's Mode 2 (Update State) must explicitly cover writing `task.review_doc` after a code review completes and `phase.phase_review` after a phase review completes. Preserves sole-writer rule.
- **FR-05 — `triage-report` skill**: A new skill defining two read sequences (task-level and phase-level), a complete task-level decision table (11 rows covering all status × deviation × verdict combinations), a complete phase-level decision table (5 rows), and the two triage outputs (state.json field writes + next Planner action). No separate document is produced — triage is a decision step.
- **FR-06 / FR-07 — Mandatory triage in Mode 3 and Mode 4**: Before producing any Phase Plan (Mode 3) or Task Handoff (Mode 4), the Planner must check for a non-null review doc path in state.json, read the review if present, apply the appropriate decision table, and write verdict and action fields to state.json. Triage and planning occur in the same invocation.
- **FR-08 / FR-09 — Orchestrator gatekeep invariants**: After the Planner records a review doc path (Mode 2), the Orchestrator checks `review_doc != null AND review_verdict == null` (task-level) and `phase_review != null AND phase_review_verdict == null` (phase-level). A true invariant triggers a targeted re-spawn with an explicit instruction naming the review doc path and the fields to write.
- **FR-10 — Backward compatibility**: Any `state.json` missing the new fields must be treated as if all absent fields are `null`. The invariant `null != null` evaluates to `false` — legacy state files never trigger the gatekeep. No migration tooling is required.
- **NFR-02 — Triage determinism**: The decision table must be exhaustive. Every input combination maps to exactly one action. No row may require the Planner to exercise discretion.
- **NFR-07 — Re-spawn limit**: If the triage invariant remains true after one re-spawn (verdict still null), the pipeline must halt with an explicit error added to `errors.active_blockers`. No infinite loops.

---

## Key Technical Decisions (from Architecture)

The following architectural decisions constrain implementation and must be honored by all agents executing this plan. See the [Architecture](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-ARCHITECTURE.md) for full rationale.

- **Additive-only changes**: All modifications are additive. No existing fields, modes, or agent behaviors are removed. The Corrective Task Handoff sub-flow (Planner agent lines 127–134) is not deleted — it is subsumed by the triage step and its note updated accordingly.
- **Tactical Planner is sole writer of all six new fields**: The Reviewer produces review documents and saves them to `reports/`; the Planner records the path in state.json (Mode 2). No other agent writes `review_doc`, `review_verdict`, `review_action`, `phase_review`, `phase_review_verdict`, or `phase_review_action`.
- **Triage is a step, not a mode**: The `triage-report` skill is embedded within Mode 3 and Mode 4 — it is not a standalone invocation or a new pipeline mode. This design ensures zero additional agent invocations on the happy path.
- **Gatekeep is field-level only**: The Orchestrator compares two state.json fields per invariant check. It never reads, parses, or interprets review documents. All routing information needed by the Orchestrator is available in state.json fields alone.
- **Verbatim verdict transcription**: `review_verdict` and `phase_review_verdict` values must be transcribed verbatim from the Reviewer's frontmatter `verdict` field (`"approved"`, `"changes_requested"`, `"rejected"`). No casing normalization or mapping is permitted.
- **Schema version bump is informational**: The `$schema` string bumps from `"orchestration-state-v1"` to `"orchestration-state-v2"`. No migration tooling is required; null-treatment policy handles backward compatibility.
- **One re-spawn maximum**: The Orchestrator's `triage_attempts` counter is local to the current invocation for a given task or phase transition. If the invariant is still true after one re-spawn, the Orchestrator halts the pipeline — it does not loop.

---

## Key Design Constraints (from Architecture)

This project has no UI and no Design document. The following structural constraints, derived from the Architecture and Research Findings, affect implementation:

- **File scope is exactly four**: Two files created/modified in Phase 1 (`state-json-schema.md` — modified, `triage-report/SKILL.md` — created), one in Phase 2 (`tactical-planner.agent.md` — modified), one in Phase 3 (`orchestrator.agent.md` — modified). No other files change.
- **Decision table must be exhaustive before Planner modes reference it**: Phase 1 (skill creation) must be complete before Phase 2 (Planner updates), because the Planner's Mode 3 and Mode 4 instructions explicitly reference the `triage-report` skill's decision table.
- **State write ordering within a triage step**: Verdict and action fields must be written to state.json before the handoff or phase plan document is saved. The Planner must not write `task.handoff_doc` without having first written `task.review_verdict` and `task.review_action` (when a review doc is present).
- **Audit trail immutability**: Once `review_verdict` and `review_action` are written for a specific task (or `phase_review_verdict`/`phase_review_action` for a phase), subsequent triage of a different task or phase must not overwrite them. Each write targets the specific indexed entry.
- **Error propagation on missing review doc**: If the Planner cannot read the review document at the path stored in state.json, it must report a specific error and halt rather than silently skipping triage. The error message must name the path.

---

## Project Scope

### In Scope

| # | What | File Path | Action |
|---|------|-----------|--------|
| 1 | State schema — add 6 new fields, bump to v2 | `plan/schemas/state-json-schema.md` | MODIFY |
| 2 | Triage skill — full decision tables, read sequences, write contract | `.github/skills/triage-report/SKILL.md` | CREATE |
| 3 | Tactical Planner — Mode 2 new writes, Mode 3 triage step, Mode 4 triage step | `.github/agents/tactical-planner.agent.md` | MODIFY |
| 4 | Orchestrator — task-level + phase-level gatekeep, re-spawn limit | `.github/agents/orchestrator.agent.md` | MODIFY |

### Out of Scope

- Planning document feedback loop (updating PRD, Design, or Architecture from execution findings) — deferred
- Changes to Reviewer agent behavior or review document formats — unchanged
- Per-task mandatory review enforcement — existing two-level model preserved
- Migration tooling for existing state.json files — null-treatment policy is sufficient
- Any UI, dashboard, or visualization of review tracking
- Changes to any other skill files (`create-phase-plan`, `create-task-handoff`, `generate-phase-report`)
- Changes to any review, report, or handoff template schemas

---

## Phase Outline

### Phase 1: Schema Foundation

**Goal**: Establish the foundational contracts — the updated state schema (v2) and the triage skill with exhaustive decision tables — that all subsequent phases depend on.

**Scope**:
- **T1: Update `state-json-schema.md`** — add `review_doc`, `review_verdict`, `review_action` to the task entry JSON block and Field Reference; add `phase_review`, `phase_review_verdict`, `phase_review_action` to the phase entry JSON block and Field Reference; bump `$schema` to `"orchestration-state-v2"`; add invariant documentation to Validation Rules section; update pseudocode to show gatekeep check placeholder — refs: [FR-01](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-01), [FR-02](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-02), [FR-03](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-03), [FR-10](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-10)
- **T2: Create `.github/skills/triage-report/SKILL.md`** — skill header (name, invocation context: embedded in Mode 3/4 only, produces-no-document note); Mode 4 read sequence (task-level triage: always read Task Report, conditionally read Code Review if `review_doc` non-null); Mode 3 read sequence (phase-level triage: always read Phase Report if not first phase, conditionally read Phase Review if `phase_review` non-null); complete task-level decision table (11 rows covering all `status` × `deviations` × `verdict` combinations); complete phase-level decision table (5 rows covering all `phase_review_verdict` × exit-criteria combinations); state write contract (what fields are written, when, with what values); verbatim transcription rule for verdict values — refs: [FR-05](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-05), [NFR-02](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#nfr-02), [Architecture: Decision Tables](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-ARCHITECTURE.md#task-level-triage-decision-table)

**Exit Criteria**:
- [ ] `state-json-schema.md` JSON block contains all six new fields in their correct parent entries (3 per task, 3 per phase)
- [ ] All six fields documented in Field Reference with type, written-when, and enum values
- [ ] `$schema` value reads `"orchestration-state-v2"`
- [ ] Invariant documentation added to Validation Rules section (both task-level and phase-level)
- [ ] `triage-report/SKILL.md` exists at `.github/skills/triage-report/SKILL.md`
- [ ] Skill contains task-level decision table with exactly 11 rows; all rows have exactly one `review_action` value (no "use judgment" rows)
- [ ] Skill contains phase-level decision table with exactly 5 rows; all rows have exactly one `phase_review_action` value
- [ ] Skill documents state write contract specifying verbatim transcription rule

**Phase Doc**: [phases/PIPELINE-FEEDBACK-PHASE-01-SCHEMA-FOUNDATION.md](.github/projects/PIPELINE-FEEDBACK/phases/PIPELINE-FEEDBACK-PHASE-01-SCHEMA-FOUNDATION.md) *(created at execution time)*

---

### Phase 2: Tactical Planner Updates

**Goal**: Add triage steps to Mode 3 and Mode 4 and extend Mode 2 with the two new review-doc write operations, making triage a mandatory, embedded step within existing Planner invocations.

**Scope**:
- **T1: Update Tactical Planner Mode 2 (Update State)** in `.github/agents/tactical-planner.agent.md` — add two explicit new write operations to the "Apply the update" section: (a) after Orchestrator reports code review complete → write `task.review_doc` path to state.json (leaving `review_verdict` and `review_action` null — triage has not run yet); (b) after Orchestrator reports phase review complete → write `phase.phase_review` path to state.json (leaving verdict and action null) — refs: [FR-04](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-04), [Architecture: Mode 2 Extended Write Contract](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-ARCHITECTURE.md#tactical-planner--mode-2-extended-write-contract)
- **T2: Update Tactical Planner Mode 3 (Create Phase Plan)** — insert steps 6 and 7 into the read sequence: step 6 = conditional Phase Review read (only if `state.json → phase.phase_review != null`); step 7 = execute `triage-report` skill (phase-level decision table), then write `phase_review_verdict` and `phase_review_action` to state.json before producing Phase Plan; add decision routing table showing what to produce based on `phase_review_action` value (`"advanced"` → normal plan; `"corrective_tasks_issued"` → plan with corrective tasks; `"halted"` → do not produce plan) — refs: [FR-06](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-06), [Architecture: Mode 3 Updated Read Sequence](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-ARCHITECTURE.md#tactical-planner--mode-3-updated-read-sequence)
- **T3: Update Tactical Planner Mode 4 (Create Task Handoff)** — insert steps 5 and 6 into the read sequence: step 5 = conditional Code Review read (only if `state.json → task.review_doc != null`); step 6 = execute `triage-report` skill (task-level decision table), then write `review_verdict` and `review_action` to state.json before producing Task Handoff; add decision routing table showing what to produce based on `review_action` value; update Corrective Task Handoff sub-flow note (the sub-flow is now subsumed by triage row 5/row 8 — it is no longer a separate parallel path); add `triage-report` to Skills section listing — refs: [FR-07](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-07), [Architecture: Mode 4 Updated Read Sequence](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-ARCHITECTURE.md#tactical-planner--mode-4-updated-read-sequence)

**Exit Criteria**:
- [ ] Mode 2 "Apply the update" section explicitly lists "Code review complete → write `task.review_doc`" and "Phase review complete → write `phase.phase_review`" as named write operations
- [ ] Mode 3 read sequence has exactly 9 steps; steps 6–7 implement the conditional Phase Review read and triage execution
- [ ] Mode 3 includes a decision routing table keyed on `phase_review_action`
- [ ] Mode 4 read sequence has exactly 8 steps; steps 5–6 implement the conditional Code Review read and triage execution
- [ ] Mode 4 includes a decision routing table keyed on `review_action`
- [ ] Corrective Task Handoff sub-flow section updated to note it is subsumed by triage
- [ ] Skills section lists `triage-report`

**Phase Doc**: [phases/PIPELINE-FEEDBACK-PHASE-02-TACTICAL-PLANNER-UPDATES.md](.github/projects/PIPELINE-FEEDBACK/phases/PIPELINE-FEEDBACK-PHASE-02-TACTICAL-PLANNER-UPDATES.md) *(created at execution time)*

---

### Phase 3: Orchestrator Gatekeep

**Goal**: Add the mechanical gatekeep invariant checks to the Orchestrator's execution loop, with explicit re-spawn instructions and a one-re-spawn hard limit to prevent infinite loops.

**Scope**:
- **T1: Update Orchestrator agent** in `.github/agents/orchestrator.agent.md` — in the section 2d execution loop, within the `task.status == "complete"` branch: add task-level gatekeep block after the Planner Mode 2 write of `review_doc` (re-read state.json, check `task.review_doc != null AND task.review_verdict == null`, if true increment `triage_attempts`, if `triage_attempts > 1` → halt pipeline with explicit error message written to `errors.active_blockers`, else re-spawn Planner Mode 4 with named instruction template specifying review doc path + field names + continuation instruction); in the phase-complete branch: add symmetric phase-level gatekeep block after Planner Mode 2 write of `phase_review` (same counter logic, re-spawn Planner Mode 3 with named instruction template); add `triage_attempts` counter definition and reset rule (counter is local to a single task or phase transition, resets for each new task/phase) — refs: [FR-08](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-08), [FR-09](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-09), [NFR-07](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#nfr-07), [Architecture: Orchestrator Gatekeep Pseudocode](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-ARCHITECTURE.md#orchestrator-gatekeep--pseudocode-contract)

**Exit Criteria**:
- [ ] Orchestrator section 2d execution loop contains a task-level gatekeep block in the task-complete branch
- [ ] Task-level gatekeep check uses the exact invariant: `task.review_doc != null AND task.review_verdict == null`
- [ ] Re-spawn instruction template names the review doc path, the fields to write, and the continuation instruction (produce next task handoff)
- [ ] Orchestrator section 2d execution loop contains a phase-level gatekeep block in the phase-complete branch
- [ ] Phase-level gatekeep check uses the exact invariant: `phase.phase_review != null AND phase.phase_review_verdict == null`
- [ ] Both gatekeep blocks enforce the one-re-spawn limit: halt pipeline if `triage_attempts > 1`
- [ ] Halt path writes an explicit error to `errors.active_blockers` (via Tactical Planner Mode 2)
- [ ] `triage_attempts` counter documented as local to each task/phase transition

**Phase Doc**: [phases/PIPELINE-FEEDBACK-PHASE-03-ORCHESTRATOR-GATEKEEP.md](.github/projects/PIPELINE-FEEDBACK/phases/PIPELINE-FEEDBACK-PHASE-03-ORCHESTRATOR-GATEKEEP.md) *(created at execution time)*

---

### Phase 4: Validation & Integration Testing

**Goal**: Verify all changes work together end-to-end, confirm the triage decision table is exhaustive, validate backward compatibility, and prove the happy path introduces zero additional agent invocations.

**Scope**:
- **T1: Integration tests — full feedback loop** — write tests that validate the complete sequence: Reviewer writes review doc → Planner (Mode 2) records path in state.json (`review_doc` non-null, `review_verdict` null) → Orchestrator reads state.json and gatekeep check passes when Planner (Mode 4) has already written verdict → confirm verdict and action fields are populated → confirm Orchestrator does not re-spawn on happy path; also test the unhappy path: Planner skips triage → Orchestrator detects invariant → Planner re-spawned with explicit instruction → verdict fields now populated → confirm one-re-spawn limit: if verdict still null after re-spawn → pipeline halts with blocker — refs: [FR-08](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-08), [FR-09](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-09), [PRD: Success Metrics](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#success-metrics)
- **T2: Unit tests — decision table coverage** — write tests for all 11 task-level triage rows and all 5 phase-level triage rows (16 total combinations); each test provides a specific (task report status, deviations, code review verdict) or (phase review verdict, exit criteria assessment) input and asserts the exact expected (`review_verdict`, `review_action`) or (`phase_review_verdict`, `phase_review_action`) output; no row should require judgment — refs: [FR-05](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-05), [NFR-02](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#nfr-02), [Architecture: Decision Tables](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-ARCHITECTURE.md#task-level-triage-decision-table)
- **T3: Backward compatibility validation** — test a legacy `state.json` (v1 schema, all six new fields absent) through the updated pipeline; confirm no pipeline errors, no spurious gatekeep re-spawns, and no field-not-found errors; confirm that `null != null` evaluates to `false` for the invariant check — refs: [FR-10](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#fr-10), [NFR-05](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#nfr-05), [Architecture: Backward Compatibility](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-ARCHITECTURE.md#backward-compatibility)

**Exit Criteria**:
- [ ] Integration test for happy path passes: verdict fields populated, Orchestrator does not re-spawn
- [ ] Integration test for unhappy path passes: Orchestrator detects invariant, re-spawns Planner once, pipeline continues after triage completes
- [ ] Integration test for re-spawn limit passes: pipeline halts with `errors.active_blockers` entry when verdict is still null after re-spawn
- [ ] All 11 task-level decision table rows covered by unit tests; all pass
- [ ] All 5 phase-level decision table rows covered by unit tests; all pass
- [ ] Backward compatibility test passes: legacy state.json runs through updated pipeline without errors or spurious re-spawns
- [ ] Both `review_verdict` and `review_action` are non-null for every triaged task in test state (audit trail completeness)
- [ ] Test run confirms zero increase in agent invocations on happy path vs. baseline

**Phase Doc**: [phases/PIPELINE-FEEDBACK-PHASE-04-VALIDATION.md](.github/projects/PIPELINE-FEEDBACK/phases/PIPELINE-FEEDBACK-PHASE-04-VALIDATION.md) *(created at execution time)*

---

## Dependencies

| Phase | Depends On | Reason |
|-------|-----------|--------|
| Phase 2 | Phase 1 | Tactical Planner Modes 3 and 4 reference the `triage-report` skill by name — the skill file must exist and contain the decision tables before the Planner instructions are updated to use them |
| Phase 3 | Phase 2 | The Orchestrator's gatekeep re-spawn instruction directs the Planner to "execute the triage decision table from the `triage-report` skill" — the Planner's triage step must be in place for re-spawn to have the intended effect |
| Phase 4 | Phases 1–3 | Integration tests validate the end-to-end loop across all four changed/created files; all changes must be in place before validation runs |

---

## Execution Constraints

- **Max phases**: 4 (this plan uses all 4)
- **Max tasks per phase**: 8 (Phase 1: 2 tasks; Phase 2: 3 tasks; Phase 3: 1 task; Phase 4: 3 tasks — all within limit)
- **Git strategy**: Single feature branch, sequential commits per task
- **Human gates**: Approve Master Plan before execution begins (hard gate); subsequent gates per configured `human_gate_mode`
- **Sole-writer rule**: Tactical Planner is the only agent that writes `state.json` and `STATUS.md` throughout execution — this constraint applies to this project's own execution pipeline as well
- **No new agents**: This project spawns no new agent types; all execution uses the existing agent roster

---

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Tactical Planner skips the triage step despite Mode 3/4 instruction updates (LLMs can skip steps) | High — review findings don't feed forward; pipeline advances on incomplete information | Orchestrator gatekeep (Phase 3) catches the skip via the state field invariant and re-spawns with an explicit, path-named instruction | Orchestrator (automated) |
| Orchestrator gatekeep re-spawns the Planner, but Planner fails to complete triage again (e.g., review doc unreadable, instruction not followed) | High — without the one-re-spawn limit, the pipeline loops indefinitely | NFR-07 enforced in Phase 3: if invariant is still true after one re-spawn, pipeline halts with an explicit error in `errors.active_blockers`; human intervention required | Orchestrator (automated) / Human |
| Review document missing or at an unexpected path when Planner attempts triage read | Medium — triage cannot complete, verdict cannot be written, gatekeep blocks pipeline | Planner must report a specific error ("review document not found at `{path}`") and halt rather than silently skipping; error written to `errors.active_blockers` | Tactical Planner |
| `review_verdict` enum values in new state fields diverge from Reviewer frontmatter values (e.g., casing differences) | Medium — Orchestrator gatekeep may misread state; routing decisions corrupt | Architecture mandates verbatim transcription; triage skill specifies exact enum values matching Reviewer frontmatter; covered by decision table unit tests in Phase 4 | Coder / Tests |
| Triage decision table has gaps — an input combination not covered causes the Planner to improvise routing | Medium — routing becomes non-deterministic for the uncovered combination | Phase 1 exit criteria require 11 task-level rows and 5 phase-level rows with no "use judgment" rows; Phase 4 unit tests assert all 16 combinations | Architect / Tests |
| Schema version bump breaks existing tooling or validation that reads `$schema` field | Low — the bump is informational; null-treatment policy handles field absence | FR-03 and FR-10 specify the bump is informational only; Phase 4 backward compat test validates legacy state files run without errors | Tests |

---

## Success Criteria

The following criteria, derived from the [PRD Success Metrics](.github/projects/PIPELINE-FEEDBACK/PIPELINE-FEEDBACK-PRD.md#success-metrics), define done for this project:

| Criterion | Target | How to Verify |
|-----------|--------|---------------|
| All deliverables created/modified | Exactly 4 files: `state-json-schema.md` (modified), `triage-report/SKILL.md` (created), `tactical-planner.agent.md` (modified), `orchestrator.agent.md` (modified) | File existence and diff review |
| Verdict fields populated for all reviewed tasks | `review_verdict` and `phase_review_verdict` are never null when corresponding `review_doc` / `phase_review` fields are non-null (after pipeline completes) | Inspect state.json: count tasks/phases with non-null review doc; all must have non-null verdict |
| Audit trail completeness | Both `review_verdict` and `review_action` populated for every triaged task; no task where `review_verdict != null AND review_action == null` | Inspect state.json: no task or phase with asymmetric null/non-null verdict+action pair |
| Decision table exhaustiveness | All 16 combinations covered (11 task-level + 5 phase-level); no row requires judgment | Phase 4 unit tests pass for all 16 rows |
| Zero additional invocations on happy path | No increase in total agent spawns per task cycle when Planner follows the triage skill correctly | Count spawns per task cycle vs. baseline; gatekeep fires 0 times |
| Backward compatibility | Existing (legacy) state.json files run through updated pipeline without errors or spurious gatekeep re-spawns | Phase 4 backward compat test passes; pipeline completes, `errors.active_blockers` remains empty |
| Triage invariant violation rate (steady-state) | 0% Orchestrator re-spawns per pipeline run after initial stabilization | Monitor re-spawn count per run; should trend to zero once Planner instructions are stable |

---

## Delivery Timeline

*In terms of tasks, not calendar time. Each task is a single Coder session.*

| Phase | Tasks | Cumulative Tasks | Key Milestone |
|-------|-------|-----------------|---------------|
| Phase 1: Schema Foundation | 2 | 2 | Foundational contracts locked: v2 schema + exhaustive decision tables |
| Phase 2: Tactical Planner Updates | 3 | 5 | Planner modes carry triage; triage-and-plan is one invocation |
| Phase 3: Orchestrator Gatekeep | 1 | 6 | Mechanical safety net in place; pipeline self-corrects triage skips |
| Phase 4: Validation & Integration Testing | 3 | 9 | All 16 decision table combinations verified; backward compat confirmed |
| **Total** | **9** | **9** | All success criteria met; project complete |
