---
project: "V3-FIXES"
phase: 3
title: "Agent Instruction Updates"
status: "active"
total_tasks: 2
tasks:
  - id: "T01-ORCHESTRATOR-INSTRUCTIONS"
    title: "Add five instruction additions and update plan_approved row in orchestrator.agent.md"
  - id: "T02-CODER-CWD-RESTORE"
    title: "Add CWD restoration step to coder.agent.md workflow"
author: "tactical-planner-agent"
created: "2026-03-15T00:00:00Z"
---

# Phase 3: Agent Instruction Updates

## Phase Goal

Strengthen `orchestrator.agent.md` with five explicit instruction additions (source-file prohibition, event-loop interruption prohibition, self-healing hierarchy, valid pause points table, pipeline invocation rule) and update the `plan_approved` event row, then add a CWD restoration step to `coder.agent.md`. All changes are text-only insertions into existing agent instruction files — no runtime code is modified.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../V3-FIXES-MASTER-PLAN.md) | Phase 3 scope, exit criteria, execution constraints |
| [Architecture](../V3-FIXES-ARCHITECTURE.md) | Goals 2, 3, 4-C, 5-B — verbatim addition text, precise insertion locations, event signaling reference update |
| [Design](../V3-FIXES-DESIGN.md) | Design Areas 2 and 4 — self-healing hierarchy flow, valid pause points, "never do" list, CWD hardening layers 2–3 |
| [Phase 2 Report](../reports/V3-FIXES-PHASE-REPORT-P02.md) | Carry-forward: uncommitted `mutations.js` change (non-blocking); `handlePlanApproved` unit test gap (out of scope) |
| [Phase 2 Review](../reviews/V3-FIXES-PHASE-REVIEW-P02.md) | Verdict: approved; action: advanced; no cross-task issues; recommendation to verify no existing text removed or contradicted |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | Add five instruction additions (A–E) + update `plan_approved` event row in `orchestrator.agent.md` | — | — | 1 | [V3-FIXES-TASK-P03-T01-ORCHESTRATOR-INSTRUCTIONS.md](../tasks/V3-FIXES-TASK-P03-T01-ORCHESTRATOR-INSTRUCTIONS.md) |
| T02 | Add CWD restoration step to `coder.agent.md` workflow | — | — | 1 | [V3-FIXES-TASK-P03-T02-CODER-CWD-RESTORE.md](../tasks/V3-FIXES-TASK-P03-T02-CODER-CWD-RESTORE.md) |

## Execution Order

```
T01 (orchestrator.agent.md — Additions A–E + plan_approved row)
T02 (coder.agent.md — CWD restoration step)  ← parallel-ready
```

**Sequential execution order**: T01 → T02

*Note: T01 and T02 are parallel-ready (no mutual dependency — they target different files) but will execute sequentially in v1.*

## Task Details

### T01 — Orchestrator Agent Instruction Updates

**Objective**: Apply all five verbatim instruction additions to `orchestrator.agent.md` at the Architecture-specified insertion locations, and update the `plan_approved` event row in the Event Signaling Reference table to show `doc_path` as optional.

**Target file**: `.github/agents/orchestrator.agent.md` (MODIFY)

**Changes**:

1. **Addition A** — "What you do NOT do" section: Insert source-file prohibition bullet immediately after the existing "Never write, create, or modify any file" bullet. Refs: FR-6, Architecture § Addition A.

2. **Addition B** — "What you do NOT do" section: Insert event-loop interruption prohibition bullet immediately after Addition A. Refs: FR-8, Architecture § Addition B.

3. **Addition C** — "Error Handling" section: Insert `### Self-Healing Hierarchy` sub-heading with 3-level priority list immediately before the existing "On every `success: false` result" paragraph. Refs: FR-7, Architecture § Addition C.

4. **Addition D** — "Event Loop" section: Insert `### Valid Pause and Stop Points` sub-heading with six-row table immediately after the `### Loop Termination` sub-section. Refs: FR-9, Architecture § Addition D.

5. **Addition E** — "Event Loop" section: Insert `### Pipeline Invocation Rule` sub-heading with `cd` prefix and absolute path forms immediately after the `### First Call` sub-section. Refs: FR-13, Architecture § Addition E.

6. **Event row update** — Event Signaling Reference table: Update the `plan_approved` row to document `doc_path` as optional (handler derives from state if absent). Refs: FR-11, Architecture § 4-C.

**Acceptance criteria**:
- All five additions (A–E) present at the specified insertion locations
- Each new rule is concise (≤5 lines of content) and phrased as a hard prohibition
- `plan_approved` event row updated to show `doc_path` as optional
- No existing instruction text removed or broken
- No contradictions between new additions and existing text

### T02 — Coder Agent CWD Restoration Step

**Objective**: Insert a CWD restoration step into the `coder.agent.md` workflow between the current step 9 (Run build) and step 10 (Check acceptance criteria), renumbering subsequent steps.

**Target file**: `.github/agents/coder.agent.md` (MODIFY)

**Changes**:

1. Insert new step 10 directing the Coder to restore the working directory to the workspace root after running terminal commands. Renumber current steps 10–12 to 11–13. Refs: FR-14, Architecture § 5-B.

**Acceptance criteria**:
- CWD restoration step present between the build step and the acceptance criteria step
- Step phrased as a hard requirement with consequence ("Failure to restore CWD will silently break subsequent pipeline.js invocations")
- Subsequent steps correctly renumbered
- No existing workflow text removed or broken

## Phase Exit Criteria

- [ ] Reviewer confirms all five additions (A–E) are present in `orchestrator.agent.md` at the specified insertion locations
- [ ] Reviewer confirms CWD restoration step is present in `coder.agent.md` workflow
- [ ] Reviewer confirms each new rule is concise (≤5 lines) and phrased as a hard prohibition, not a guideline
- [ ] Reviewer confirms no existing instruction text in either file has been removed or broken
- [ ] Reviewer confirms the `plan_approved` event row now documents `doc_path` as optional
- [ ] Reviewer confirms no contradictions between the new additions and existing instruction text
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed

## Carry-Forward Items (from Phase 2)

- **Uncommitted `mutations.js` working tree change** (from Phase 1): The Orchestrator's mid-run edit to `mutations.js` is still uncommitted. Non-blocking for Phase 3 but must be committed before the final review gate.
- **`handlePlanApproved` unit test gap** (from Phase 1): No dedicated unit tests for the state-derivation fallback paths. Remains out of scope per Master Plan.

## Known Risks for This Phase

- **R-3 (from Master Plan)**: Agent instruction additions may conflict with existing instruction text, producing contradictory rules. Mitigation: Architecture specifies exact insertion locations; Reviewer explicitly checks for contradictions as a named exit criterion.
- **Text-only changes may not trigger test regressions**: Unlike Phases 1–2, this phase modifies no runtime code, so the test suite is not a direct verification mechanism. The Reviewer is the primary quality gate.
