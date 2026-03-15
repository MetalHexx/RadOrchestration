---
project: "V3-FIXES"
total_phases: 3
status: "draft"
author: "architect-agent"
created: "2026-03-15T00:00:00Z"
---

# V3-FIXES — Master Plan

## Executive Summary

V3-FIXES applies five surgical, backward-compatible fixes to the v3 orchestration pipeline in response to bugs surfaced during two live production runs (RAINBOW-HELLO and UI-MARKDOWN-IMPROVEMENTS). The core incident was the Orchestrator agent modifying `mutations.js` mid-run to address a corrective task stale-state bug — a source file edit that bypassed all code review and test coverage. The project confirms the existing `handleTaskHandoffCreated` fix is architecturally correct, adds the missing unit and behavioral test coverage to protect it, eliminates a `plan_approved` context mismatch that required the Orchestrator to supply an internal path, hardens `state-io.js` against CWD drift, and adds explicit self-healing hierarchy and event-loop discipline rules to the Orchestrator agent instructions. All changes land in three runtime scripts, two agent instruction files, and two existing test files — no new source files are introduced.

---

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [V3-FIXES-BRAINSTORMING.md](.github/projects/V3-FIXES/V3-FIXES-BRAINSTORMING.md) | ✅ Complete |
| Research Findings | [V3-FIXES-RESEARCH-FINDINGS.md](.github/projects/V3-FIXES/V3-FIXES-RESEARCH-FINDINGS.md) | ✅ Complete |
| PRD | [V3-FIXES-PRD.md](.github/projects/V3-FIXES/V3-FIXES-PRD.md) | ✅ Complete |
| Design | [V3-FIXES-DESIGN.md](.github/projects/V3-FIXES/V3-FIXES-DESIGN.md) | ✅ Complete |
| Architecture | [V3-FIXES-ARCHITECTURE.md](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md) | ✅ Complete |

---

## Key Requirements (from PRD)

### P0 Functional Requirements

- **FR-1**: `handleTaskHandoffCreated` in `mutations.js` shall clear `report_doc`, `report_status`, `review_doc`, `review_verdict`, and `review_action` from the current task when non-null; it shall be a no-op when those fields are already null (idempotency guarantee). The existing presence-based clearing logic is confirmed correct — no runtime change to `mutations.js` is required. See [PRD § FR-1](.github/projects/V3-FIXES/V3-FIXES-PRD.md).

- **FR-4**: A new end-to-end behavioral test category in `pipeline-behavioral.test.js` shall cover the full corrective task flow: task in `failed`/`corrective_task_issued` state → `task_handoff_created` → pipeline returns `execute_task` → resulting task state has `report_doc=null`, `review_doc=null`, `review_action=null`. See [PRD § FR-4](.github/projects/V3-FIXES/V3-FIXES-PRD.md).

- **FR-6**: The "What you do NOT do" section of `orchestrator.agent.md` shall include an explicit, first-class prohibition against modifying pipeline source files (including `mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `resolver.js`, `state-io.js`, agent `.agent.md` files, and skills) as a self-healing action, under any circumstances. See [PRD § FR-6](.github/projects/V3-FIXES/V3-FIXES-PRD.md).

- **FR-7**: The Error Handling section of `orchestrator.agent.md` shall include a positive self-healing hierarchy before the existing 3-step failure protocol: (1) re-signal the correct event; (2) clear or null stale fields in `state.json` — never set values not derived from a pipeline result; (3) log and halt. See [PRD § FR-7](.github/projects/V3-FIXES/V3-FIXES-PRD.md).

- **FR-10**: `handlePlanApproved` in `pre-reads.js` shall derive the master plan path from `state.planning.steps[4].doc_path` when `context.doc_path` is absent; if `context.doc_path` is present it shall be honored (backward compatible). See [PRD § FR-10](.github/projects/V3-FIXES/V3-FIXES-PRD.md).

- **FR-12**: The `readConfig` fallback path in `state-io.js` shall resolve relative to `__dirname` (`path.resolve(__dirname, '../../../orchestration.yml')`) rather than `process.cwd()`. See [PRD § FR-12](.github/projects/V3-FIXES/V3-FIXES-PRD.md).

### Critical Non-Functional Requirements

- **NFR-5** (No regression): All changes to `mutations.js`, `pre-reads.js`, and `state-io.js` must leave every existing test in `mutations.test.js`, `pipeline-behavioral.test.js`, and `resolver.test.js` passing without modification. See [PRD § NFR-5](.github/projects/V3-FIXES/V3-FIXES-PRD.md).

- **NFR-1** (Test framework): New tests must use the Node built-in test runner (`node:test` + `node:assert/strict`). No additional test frameworks. See [PRD § NFR-1](.github/projects/V3-FIXES/V3-FIXES-PRD.md).

---

## Key Technical Decisions (from Architecture)

- **`mutations.js` requires no runtime change**: The presence-based stale-field clearing in `handleTaskHandoffCreated` is architecturally correct and idempotent. Confirmed by full corrective flow trace in Research Findings. See [Architecture § Goal 1-A](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md).

- **`handlePlanApproved` uses hybrid Option C**: Accept `context.doc_path` if present; otherwise read `state.json` from `projectDir` and derive path from `state.planning.steps[4].doc_path`. The `preRead` entry point already passes `projectDir` — no signature change needed. Failure returns `success: false` with a descriptive error, never throws. See [Architecture § Goal 4-B](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md).

- **CWD fix is `__dirname`-relative — one line in `readConfig`**: `path.resolve(__dirname, '../../../orchestration.yml')` resolves correctly from `.github/orchestration/scripts/lib/` and eliminates the single CWD-dependent path in the codebase. `path` is already imported. See [Architecture § Goal 5-A](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md).

- **Five verbatim additions to `orchestrator.agent.md`**: Source-file prohibition (Addition A), event-loop interruption prohibition (Addition B), self-healing hierarchy (Addition C), valid pause points table (Addition D), pipeline invocation rule (Addition E). Insertion locations are precisely specified to avoid conflicts. See [Architecture § Goals 2 & 3](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md).

- **No new source files**: All test additions go inside existing test files (`mutations.test.js`, `pipeline-behavioral.test.js`). No new modules, helpers, or abstractions are introduced. See [Architecture § File Structure](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md).

- **`pre-reads.js` gains two new imports**: `path` (Node built-in) and `readFile` from `../../../skills/validate-orchestration/scripts/lib/utils/fs-helpers` — the same pattern already used in `state-io.js`. See [Architecture § Dependencies](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md).

---

## Key Design Constraints (from Design)

- **Clearing boundary is `task_handoff_created`, not `code_review_completed`**: Clearing at the new execution cycle boundary is semantically correct and keeps state consistent within each pipeline call. Clearing earlier would leave state dirty across two separate calls with no record if handoff creation fails. See [Design § Area 1](.github/projects/V3-FIXES/V3-FIXES-DESIGN.md).

- **Presence-based guards only — no `context.is_correction` check**: The clearing in `handleTaskHandoffCreated` must fire based on whether stale fields are set, not on a context flag. This is more robust against future resolver changes and is self-describing. See [Design § Area 1](.github/projects/V3-FIXES/V3-FIXES-DESIGN.md).

- **Level 2 self-healing edits are conservative**: The Orchestrator may only null or clear stale `state.json` fields — it must never set a field to a non-null value that was not returned by a pipeline result. Inventing state values produces superficially valid states that route incorrectly. See [Design § Area 2](.github/projects/V3-FIXES/V3-FIXES-DESIGN.md).

- **Exactly six valid pause points**: `display_halted`, `display_complete`, `request_plan_approval`, `request_final_approval`, `gate_task`, `gate_phase`. Any `result.action` outside this list must be actioned immediately without human check-in. See [Design § Area 2](.github/projects/V3-FIXES/V3-FIXES-DESIGN.md).

- **Agent instruction additions must be concise**: Each new rule must fit within 3–5 lines. Verbose treatises are not acceptable. Rules must be placed in the highest-attention sections ("What you do NOT do" and "Error Handling") with hard-prohibition phrasing. See [PRD § NFR-4](.github/projects/V3-FIXES/V3-FIXES-PRD.md).

---

## Phase Outline

### Phase 1: Pipeline Script Fixes + Unit Tests

**Goal**: Apply three targeted code fixes to pipeline scripts and add two unit tests to lock in the corrective task mutation behavior.

**Scope**:
- Confirm `handleTaskHandoffCreated` in `mutations.js` is correct (no runtime change) and add 2 new unit tests (T1: corrective clearing; T2: first-time idempotency) inside the existing `describe('handleTaskHandoffCreated', …)` block in `mutations.test.js` — refs: [FR-1](.github/projects/V3-FIXES/V3-FIXES-PRD.md), [FR-2](.github/projects/V3-FIXES/V3-FIXES-PRD.md), [FR-3](.github/projects/V3-FIXES/V3-FIXES-PRD.md)
- Update `handlePlanApproved` in `pre-reads.js`: add `path` and `readFile` imports; implement state-derivation fallback when `context.doc_path` is absent — refs: [FR-10](.github/projects/V3-FIXES/V3-FIXES-PRD.md), [Architecture § 4-A/4-B](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md)
- Replace `process.cwd()`-based config path in `state-io.js` `readConfig` with `path.resolve(__dirname, '../../../orchestration.yml')` — refs: [FR-12](.github/projects/V3-FIXES/V3-FIXES-PRD.md), [Architecture § 5-A](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md)

**Exit Criteria**:
- [ ] All existing tests in `mutations.test.js` pass unchanged
- [ ] T1 (corrective clearing) passes: all five stale fields nulled; mutation log entries emitted
- [ ] T2 (idempotency) passes: zero clearing mutation entries emitted for first-time handoff
- [ ] `handlePlanApproved` invoked with `context = {}` (no `doc_path`) succeeds when `state.planning.steps[4].doc_path` is set
- [ ] `readConfig` resolves correct path when CWD is not the workspace root

**Phase Doc**: [phases/V3-FIXES-PHASE-01-SCRIPT-FIXES.md](.github/projects/V3-FIXES/phases/V3-FIXES-PHASE-01-SCRIPT-FIXES.md) *(created at execution time)*

---

### Phase 2: Behavioral Test Updates

**Goal**: Add Category 11 to `pipeline-behavioral.test.js` to provide end-to-end verification of the full corrective task retry flow.

**Scope**:
- Append a new `describe` block as **Category 11 — Corrective Task Flow** at the end of `pipeline-behavioral.test.js`, using the same shared-IO sequential execution pattern as Categories 1–10 — refs: [FR-4](.github/projects/V3-FIXES/V3-FIXES-PRD.md), [Architecture § 1-D](.github/projects/V3-FIXES/V3-FIXES-ARCHITECTURE.md)
- Category 11 covers: inject task in `failed`/`corrective_task_issued` state → signal `task_handoff_created` → assert `execute_task` returned → assert all five stale fields null → assert `status=in_progress`, `handoff_doc` set to corrective path
- Reuse state-building helpers from Categories 6–9 for mid-flight state injection; follow the `delete state.project.updated` V13 bypass pattern to avoid timestamp conflicts

**Exit Criteria**:
- [ ] Category 11 passes: `execute_task` returned after corrective `task_handoff_created`
- [ ] Category 11 passes: all five stale fields are null after the event
- [ ] Category 11 passes: `task.status = 'in_progress'` and `task.handoff_doc` set to corrective path
- [ ] All existing Categories 1–10 still pass without modification
- [ ] No state leaks from Category 11 into subsequent test scope

**Phase Doc**: [phases/V3-FIXES-PHASE-02-BEHAVIORAL-TESTS.md](.github/projects/V3-FIXES/phases/V3-FIXES-PHASE-02-BEHAVIORAL-TESTS.md) *(created at execution time)*

---

### Phase 3: Agent Instruction Updates

**Goal**: Strengthen `orchestrator.agent.md` and `coder.agent.md` with explicit, concise rules that prohibit source file modification, define the self-healing hierarchy, enumerate valid pause points, and enforce CWD restoration.

**Scope**:
- **`orchestrator.agent.md` — Addition A** (What you do NOT do): source-file prohibition bullet immediately after the existing "Never write, create, or modify any file" bullet — refs: [FR-6](.github/projects/V3-FIXES/V3-FIXES-PRD.md)
- **`orchestrator.agent.md` — Addition B** (What you do NOT do): event-loop interruption prohibition bullet immediately after Addition A — refs: [FR-8](.github/projects/V3-FIXES/V3-FIXES-PRD.md)
- **`orchestrator.agent.md` — Addition C** (Error Handling): `### Self-Healing Hierarchy` sub-heading with 3-level priority list, inserted before the existing 3-step failure protocol — refs: [FR-7](.github/projects/V3-FIXES/V3-FIXES-PRD.md)
- **`orchestrator.agent.md` — Addition D** (Event Loop): `### Valid Pause and Stop Points` sub-heading with the six-row table, inserted after `### Loop Termination` — refs: [FR-9](.github/projects/V3-FIXES/V3-FIXES-PRD.md)
- **`orchestrator.agent.md` — Addition E** (Event Loop): `### Pipeline Invocation Rule` sub-heading with `cd` prefix and absolute path forms, inserted after `### First Call` — refs: [FR-13](.github/projects/V3-FIXES/V3-FIXES-PRD.md)
- **`coder.agent.md`**: CWD restoration step inserted between the current step 9 (Run build) and step 10 (Check acceptance criteria); subsequent steps renumbered — refs: [FR-14](.github/projects/V3-FIXES/V3-FIXES-PRD.md)
- Update Event Signaling Reference table `plan_approved` row in `orchestrator.agent.md` to show `doc_path` as optional — refs: [FR-11](.github/projects/V3-FIXES/V3-FIXES-PRD.md)

**Exit Criteria**:
- [ ] Reviewer confirms all five additions (A–E) are present in `orchestrator.agent.md` at the specified insertion locations
- [ ] Reviewer confirms CWD restoration step is present in `coder.agent.md` workflow
- [ ] Reviewer confirms each new rule is concise (≤5 lines) and phrased as a hard prohibition, not a guideline
- [ ] Reviewer confirms no existing instruction text in either file has been removed or broken
- [ ] Reviewer confirms the `plan_approved` event row now documents `doc_path` as optional
- [ ] Reviewer confirms no contradictions between the new additions and existing instruction text

**Phase Doc**: [phases/V3-FIXES-PHASE-03-AGENT-INSTRUCTIONS.md](.github/projects/V3-FIXES/phases/V3-FIXES-PHASE-03-AGENT-INSTRUCTIONS.md) *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from `orchestration.yml`)
- **Max tasks per phase**: 8 (from `orchestration.yml`)
- **Max retries per task**: 2 (from `orchestration.yml`)
- **Git strategy**: `single_branch` — sequential commits on one feature branch; commit prefix `[orch]` (from `orchestration.yml`)
- **Human gates**: After planning (this Master Plan) — **required**; execution mode `ask`; after final review — **required** (from `orchestration.yml`)
- **No new source files**: All additions go into existing files. This is a hard constraint, not a preference.
- **No refactoring**: Changes are strictly limited to the five fixes defined in the PRD. No surrounding cleanup, no opportunistic improvements.
- **Backward compatibility required**: All existing tests must pass without modification after every phase.

---

## Risk Register

| # | Risk | Impact | Mitigation | Owner |
|---|------|--------|-----------|-------|
| R-1 | `handlePlanApproved` state derivation fails if `state.planning.steps[4]` index is wrong (e.g., planning step order changes in a future refactor) | Medium | Phase 1 must include a unit test that exercises the fallback path with a correctly structured state object; null-check guards return descriptive `success: false` instead of throwing | Coder (Phase 1) |
| R-2 | Category 11 behavioral test has state setup complexity — requires a task in `in_progress` state with `report_doc`, `review_doc`, and `review_action` all pre-populated | Medium | Reuse the state-building helpers from Categories 6–9; follow the `delete state.project.updated` V13 bypass pattern already established in the test file | Coder (Phase 2) |
| R-3 | Agent instruction additions conflict with existing instruction text in `orchestrator.agent.md`, producing contradictory rules | Medium | Reviewer explicitly checks for contradictions as a named exit criterion; Architecture specifies exact insertion locations to minimize proximity conflicts | Reviewer (Phase 3) |
| R-4 | Presence-based clearing in `handleTaskHandoffCreated` fires unexpectedly if a future event legitimately leaves `report_doc` set before a first-time handoff | Low | Clearing emits mutation log entries, making any unintended clearing visible in pipeline output; T2 (idempotency test) detects regression if the guard is ever broken | Coder (Phase 1) |
| R-5 | `__dirname`-relative path in `state-io.js` breaks if the script is relocated | Low | Script location is stable and not in scope for relocation; the path derivation is verified by the Architecture path-resolution table | Coder (Phase 1) |
