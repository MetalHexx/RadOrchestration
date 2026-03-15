---
project: "PIPELINE-FEEDBACK"
phase: 2
title: "Tactical Planner Updates"
status: "active"
total_tasks: 3
author: "tactical-planner-agent"
created: "2026-03-08T19:00:00Z"
---

# Phase 2: Tactical Planner Updates

## Phase Goal

Add triage steps to Tactical Planner Mode 3 and Mode 4, and extend Mode 2 with two new review-doc write operations, making triage a mandatory embedded step within existing Planner invocations — with zero additional agent invocations on the happy path.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-FEEDBACK-MASTER-PLAN.md) | Phase 2 scope, exit criteria, task breakdown (T1–T3) |
| [Architecture](../PIPELINE-FEEDBACK-ARCHITECTURE.md) | Mode 2 Extended Write Contract, Mode 3 Updated Read Sequence (9 steps), Mode 4 Updated Read Sequence (8 steps), decision routing tables, task/phase field definitions |
| [PRD](../PIPELINE-FEEDBACK-PRD.md) | FR-04 (Mode 2 writes), FR-06 (Mode 3 triage), FR-07 (Mode 4 triage), NFR-02 (determinism), NFR-04 (sole writer) |
| [Phase 1 Report](../reports/PIPELINE-FEEDBACK-PHASE-REPORT-P01.md) | Carry-forward: enum singular/plural distinction (`corrective_task_issued` vs `corrective_tasks_issued`) must be preserved; triage skill created and available at `.github/skills/triage-report/SKILL.md` |
| [Triage Skill](../../../skills/triage-report/SKILL.md) | Decision tables (11 task-level rows, 5 phase-level rows), read sequences, state write contract, verbatim transcription rule — the skill the Planner modes will reference |
| [Tactical Planner Agent](../../../agents/tactical-planner.agent.md) | Current Mode 2/3/4 structure, Corrective Task Handoff sub-flow (lines 127–134), Skills section — the file being modified |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Update Tactical Planner Mode 2 (Update State) | — | — | 1 | [Link](../tasks/PIPELINE-FEEDBACK-TASK-P02-T01-MODE2-WRITES.md) |
| T2 | Update Tactical Planner Mode 3 (Create Phase Plan) | T1 | — | 1 | [Link](../tasks/PIPELINE-FEEDBACK-TASK-P02-T02-MODE3-TRIAGE.md) |
| T3 | Update Tactical Planner Mode 4 (Create Task Handoff) | T2 | — | 1 | [Link](../tasks/PIPELINE-FEEDBACK-TASK-P02-T03-MODE4-TRIAGE.md) |

**Note:** All three tasks modify the same file (`.github/agents/tactical-planner.agent.md`) in different sections. Tasks are strictly sequential to avoid merge conflicts and ensure each task builds on the prior task's output.

## Execution Order

```
T1 (Mode 2 — add review_doc and phase_review write operations)
 └→ T2 (Mode 3 — insert triage steps 6-7, add decision routing table)
     └→ T3 (Mode 4 — insert triage steps 5-6, add decision routing table, update corrective sub-flow, update Skills)
```

**Sequential execution order**: T1 → T2 → T3

*No parallel-ready pairs — all three tasks modify the same file and T2/T3 depend on T1's changes being in place.*

## Task Details

### T1: Update Tactical Planner Mode 2 (Update State)

**Objective:** Add two explicit write operations to Mode 2's "Apply the update" bullet list — one for recording `task.review_doc` after code review completes, and one for recording `phase.phase_review` after phase review completes.

**File:** `.github/agents/tactical-planner.agent.md` (MODIFY — Mode 2 section only)

**What to add to the "Apply the update" bullet list:**
- `Code review complete → write task.review_doc path to state.json (review_verdict and review_action remain null — triage has not yet run)`
- `Phase review complete → write phase.phase_review path to state.json (phase_review_verdict and phase_review_action remain null — triage has not yet run)`

**Architecture reference (inline):** Mode 2 Extended Write Contract from Architecture doc:
```
// New operation A: Record review_doc after Reviewer saves Code Review
WHEN: Orchestrator informs Planner that code review is complete
WRITE: execution.phases[N].tasks[M].review_doc = "{PROJECT-DIR}/reports/CODE-REVIEW-P{NN}-T{NN}.md"
NOTE: review_verdict and review_action remain null — triage has not run yet

// New operation B: Record phase_review after Reviewer saves Phase Review
WHEN: Orchestrator informs Planner that phase review is complete
WRITE: execution.phases[N].phase_review = "{PROJECT-DIR}/reports/PHASE-REVIEW-P{NN}.md"
NOTE: phase_review_verdict and phase_review_action remain null — triage has not run yet
```

**Acceptance criteria:**
- [ ] Mode 2 "Apply the update" section contains a bullet for "Code review complete → write `task.review_doc`" with note that verdict/action remain null
- [ ] Mode 2 "Apply the update" section contains a bullet for "Phase review complete → write `phase.phase_review`" with note that verdict/action remain null
- [ ] No other Mode 2 content is removed or re-ordered
- [ ] Existing Mode 2 bullets are unchanged

---

### T2: Update Tactical Planner Mode 3 (Create Phase Plan)

**Objective:** Insert triage steps into Mode 3's read sequence as steps 6–7, renumber subsequent steps, and add a decision routing table keyed on `phase_review_action`. The final read sequence must have exactly 9 numbered steps.

**File:** `.github/agents/tactical-planner.agent.md` (MODIFY — Mode 3 section only)

**Current Mode 3 steps (1–13):** The current Mode 3 has 13 steps. The Architecture specifies a consolidated 9-step sequence. The mapping is:

| New Step | Content | Source |
|----------|---------|--------|
| 1 | Read the Master Plan | Current step 1 |
| 2 | Read the Architecture | Current step 2 |
| 3 | Read the Design (if applicable) | Current step 3 |
| 4 | Read `state.json` — current state, limits, `phase.phase_review` path | Current step 4 (expanded) |
| 5 | Read previous Phase Report (skip if first phase) | Current step 5 |
| 6 | **NEW — Conditional Phase Review read** | Architecture Mode 3 step 6 |
| 7 | **NEW — Execute `triage-report` skill (phase-level), write verdict/action to state.json** | Architecture Mode 3 step 7 |
| 8 | **Produce Phase Plan** based on triage outcome (consolidates old steps 6–12: check limits, break into tasks, map dependencies, define execution order, set exit criteria, use skill, save) | Architecture Mode 3 step 8 |
| 9 | **Update state.json**: create phase entry with tasks, set phase status to "in_progress" | Current step 13 → renumbered |

**New step 6 text (from Architecture):**
```
6. **IF `state.json → phase.phase_review != null`**:
   Read the Phase Review at the path from `state.json → phase.phase_review`
```

**New step 7 text (from Architecture):**
```
7. **Execute `triage-report` skill** (phase-level decision table):
   - Write `phase.phase_review_verdict` ← verdict from Phase Review frontmatter (or skip if `phase_review` is null)
   - Write `phase.phase_review_action` ← resolved from phase-level decision table (or skip if `phase_review` is null)
```

**Decision routing table to add after step 7 (from Architecture):**

| `phase_review_action` value | What to produce in step 8 |
|-----------------------------|--------------------------|
| `"advanced"` or `null` (no review) | Normal Phase Plan for the next phase |
| `"advanced"` (some exit criteria unmet) | Phase Plan with explicit carry-forward task section addressing unmet criteria |
| `"corrective_tasks_issued"` | Phase Plan that opens with corrective tasks addressing the review's Cross-Task Issues; new tasks come after |
| `"halted"` | DO NOT produce a Phase Plan — write halt to state.json; stop |

**Acceptance criteria:**
- [ ] Mode 3 read sequence has exactly 9 numbered steps
- [ ] Step 6 is: conditional Phase Review read (only if `state.json → phase.phase_review != null`)
- [ ] Step 7 is: execute `triage-report` skill (phase-level), write `phase_review_verdict` and `phase_review_action` to state.json
- [ ] Step 8 consolidates the plan production steps (check limits, break into tasks, map dependencies, execution order, exit criteria, use skill, save)
- [ ] Step 9 is: update state.json (create phase entry with tasks, set status)
- [ ] Decision routing table present, keyed on `phase_review_action` with all four rows
- [ ] No Mode 3 functionality is lost — all 13 original steps are accounted for in the new 9-step sequence

---

### T3: Update Tactical Planner Mode 4 (Create Task Handoff)

**Objective:** Insert triage steps into Mode 4's read sequence as steps 5–6, add a decision routing table keyed on `review_action`, update the Corrective Task Handoff sub-flow note, and add `triage-report` to the Skills section. The final read sequence must have exactly 8 numbered steps.

**File:** `.github/agents/tactical-planner.agent.md` (MODIFY — Mode 4 section, Corrective Task Handoff sub-section, Skills section)

**Current Mode 4 steps (1–8):** The current Mode 4 has 8 steps. The Architecture specifies a consolidated 8-step sequence with triage inserted. The mapping is:

| New Step | Content | Source |
|----------|---------|--------|
| 1 | Read the Phase Plan | Current step 1 |
| 2 | Read the Architecture | Current step 2 |
| 3 | Read the Design (if UI task) | Current step 3 |
| 4 | Read Task Report(s) for dependent completed tasks | Current step 4 (expanded: read from `task.report_doc`) |
| 5 | **NEW — Conditional Code Review read** | Architecture Mode 4 step 5 |
| 6 | **NEW — Execute `triage-report` skill (task-level), write verdict/action to state.json** | Architecture Mode 4 step 6 |
| 7 | **Produce Task Handoff** (or corrective handoff, or halt) based on triage outcome (consolidates old step 5: write self-contained handoff + use skill) | Architecture Mode 4 step 7 |
| 8 | **Update state.json**: set `task.handoff_doc` path | Current step 8 → renumbered |

**New step 5 text (from Architecture):**
```
5. **IF `state.json → task.review_doc != null`** (for the relevant completed task):
   Read the Code Review at the path from `state.json → task.review_doc`
```

**New step 6 text (from Architecture):**
```
6. **Execute `triage-report` skill** (task-level decision table):
   - Write `task.review_verdict` ← verdict from Code Review frontmatter (or skip if no review doc)
   - Write `task.review_action` ← resolved from task-level decision table (or skip if no review doc)
```

**Decision routing table to add after step 6 (from Architecture):**

| `review_action` value | What to produce in step 7 |
|-----------------------|--------------------------|
| `"advanced"` | Normal Task Handoff for next task; include any carry-forward items in context section |
| `"corrective_task_issued"` | Corrective Task Handoff; inline all Issues from Code Review; include original acceptance criteria |
| `"halted"` | DO NOT produce a Task Handoff — write halt to state.json; stop |
| `null` (no review doc) | Normal Task Handoff; include Task Report Recommendations in context section |

**Corrective Task Handoff sub-flow update:** The existing sub-section must be updated to note that it is subsumed by the triage step. Specifically: when triage produces `review_action: "corrective_task_issued"`, the Planner follows the same corrective handoff construction rules (read original handoff, focus on fixing issues, include original acceptance criteria). The sub-flow is no longer a separate parallel path — it is the output of triage row 5 or row 8 from the task-level decision table.

**Skills section update:** Add `triage-report` to the Skills list:
```
- **`triage-report`**: Triage decision tables for task-level (Mode 4) and phase-level (Mode 3) review routing
```

**Acceptance criteria:**
- [ ] Mode 4 read sequence has exactly 8 numbered steps
- [ ] Step 5 is: conditional Code Review read (only if `state.json → task.review_doc != null`)
- [ ] Step 6 is: execute `triage-report` skill (task-level), write `review_verdict` and `review_action` to state.json
- [ ] Step 7 consolidates handoff production (self-contained handoff content + use skill + save)
- [ ] Step 8 is: update state.json (set `task.handoff_doc` path)
- [ ] Decision routing table present, keyed on `review_action` with all four rows
- [ ] Corrective Task Handoff sub-flow updated to note it is subsumed by triage (rows 5 and 8)
- [ ] Skills section lists `triage-report` with description
- [ ] No Mode 4 functionality is lost — all original steps accounted for in new sequence

## Phase Exit Criteria

- [ ] Mode 2 "Apply the update" section explicitly lists "Code review complete → write `task.review_doc`" and "Phase review complete → write `phase.phase_review`" as named write operations
- [ ] Mode 3 read sequence has exactly 9 steps; steps 6–7 implement the conditional Phase Review read and triage execution
- [ ] Mode 3 includes a decision routing table keyed on `phase_review_action`
- [ ] Mode 4 read sequence has exactly 8 steps; steps 5–6 implement the conditional Code Review read and triage execution
- [ ] Mode 4 includes a decision routing table keyed on `review_action`
- [ ] Corrective Task Handoff sub-flow section updated to note it is subsumed by triage
- [ ] Skills section lists `triage-report`
- [ ] All tasks complete with status `complete`
- [ ] Enum value consistency preserved: `corrective_task_issued` (singular, task-level) vs `corrective_tasks_issued` (plural, phase-level)

## Known Risks for This Phase

- **Same-file sequential edits**: All three tasks modify `.github/agents/tactical-planner.agent.md`. Each task must build on the prior task's output. If a task handoff references line numbers, they may shift after preceding edits — tasks should reference section headings and content patterns rather than line numbers.
- **Step count precision**: Architecture mandates exactly 9 steps for Mode 3 and exactly 8 steps for Mode 4. The Coder must consolidate existing granular steps (e.g., "check limits", "break into tasks", "map dependencies") into single production steps per the Architecture spec. Over- or under-consolidation will fail exit criteria.
- **Decision routing table fidelity**: The singular/plural distinction (`corrective_task_issued` vs `corrective_tasks_issued`) is intentional and must not be normalized. Carry-forward from Phase 1 Report.
