---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
title: "Agent & Skill Refactoring"
status: "active"
total_tasks: 7
author: "tactical-planner-agent"
created: "2026-03-12T00:00:00Z"
---

# Phase 2: Agent & Skill Refactoring

## Phase Goal

Update all agent definitions, skills, and instruction files to match the new pipeline architecture — removing state-write responsibilities from the Tactical Planner, rewriting the Orchestrator for event-driven operation, renaming/deleting skills, and aligning instruction files with the new control flow. Also resolve Phase 1 carry-forward items (V8/V9 validation timing, V1 sentinel, V13 timestamp, minor code quality fixes) that are prerequisites for the new agent definitions to function correctly.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../SCRIPT-SIMPLIFY-AGENTS-MASTER-PLAN.md) | Phase 2 scope and exit criteria — agent definitions, skills, instruction files |
| [Architecture](../SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md) | Agent Definition Changes section (Orchestrator event loop, Tactical Planner 3 modes, Reviewer rename), Skill Changes section (Prior Context content, triage-report deletion), ~18-action reduced vocabulary table |
| [Design](../SCRIPT-SIMPLIFY-AGENTS-DESIGN.md) | Reduced Action Vocabulary table (~18 actions), event vocabulary (19 events), Pipeline Result Schema, Orchestrator Event Loop flow |
| [PRD](../SCRIPT-SIMPLIFY-AGENTS-PRD.md) | FR-11 through FR-26 (agent, skill, instruction requirements) |
| [Phase 1 Report](../reports/SCRIPT-SIMPLIFY-AGENTS-PHASE-01-REPORT.md) | Carry-forward items: V8/V9 pre-triage validation (critical), V1 sentinel, V13 timestamp, hardcoded string, pre-read error handling, unused imports |
| [Phase 1 Review](../reports/SCRIPT-SIMPLIFY-AGENTS-PHASE-01-REVIEW.md) | Cross-task issues #1-#8, recommendations for Phase 2: fix V8/V9 first, then V13, V1, minor items |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Pipeline Engine Carry-Forward Fixes | — | — | 3 | *(created at execution time)* |
| T2 | Orchestrator Agent Rewrite | T1 | — | 1 | *(created at execution time)* |
| T3 | Tactical Planner Agent Rewrite | T1 | — | 1 | *(created at execution time)* |
| T4 | Reviewer Agent + review-task Skill Rename | — | — | 3 | *(created at execution time)* |
| T5 | Other Agent Updates + triage-report Deletion | — | — | 8 | *(created at execution time)* |
| T6 | Planning Skill Updates | — | — | 2 | *(created at execution time)* |
| T7 | Instruction & Configuration File Updates | — | — | 2 | *(created at execution time)* |

## Task Details

### T1: Pipeline Engine Carry-Forward Fixes

**Objective**: Resolve all carry-forward items from Phase 1 — fix the critical V8/V9 pre-triage validation timing, V1 last-phase gate sentinel, V13 timestamp ordering, hardcoded `display_halted` string, pre-read error handling, and unused imports.

**Files**: `pipeline-engine.js` (MODIFY), `mutations.js` (MODIFY), `pipeline-engine.test.js` (MODIFY — update/add tests for fixed paths)

**Key changes**:
- **V8/V9 fix (critical)**: Reorder the engine to run triage BEFORE validation for events that trigger triage (`task_completed`, `code_review_completed`, `phase_review_completed`). The combined mutation + triage mutation result is validated once against the pre-mutation state, rather than validating the intermediate state.
- **V1 fix**: Adjust `handleGateApproved` in `mutations.js` to avoid setting `current_phase` out of bounds on the last phase — either keep at `phases.length - 1` when transitioning to review tier, or use a sentinel approach.
- **V13 fix**: Add `proposedState.project.updated = new Date().toISOString()` in `pipeline-engine.js` before calling `validateTransition`, so timestamps flow correctly.
- **Hardcoded string**: Replace `'display_halted'` with `NEXT_ACTIONS.DISPLAY_HALTED` from constants.
- **Pre-read error handling**: Wrap `io.readDocument()` call for task report pre-read in try-catch, returning `makeErrorResult()` on failure.
- **Unused imports**: Remove `REVIEW_VERDICTS` and `SEVERITY_LEVELS` from `mutations.js` import.

**Acceptance criteria**:
- All 19 events produce correct deterministic output (V8/V9 paths now reachable)
- All existing pipeline test suites pass (178 tests)
- All 4 preserved lib test suites pass unmodified (141 tests)

---

### T2: Orchestrator Agent Rewrite

**Objective**: Rewrite `.github/agents/orchestrator.agent.md` to an event-driven controller that calls `pipeline.js`, parses JSON results, and routes on an ~18-action table.

**Files**: `orchestrator.agent.md` (MODIFY — full content replacement)

**Key changes**:
- Replace 35-action mapping table with ~18-action routing table (from Architecture: Reduced Action Vocabulary)
- Replace script-based execution loop with event-driven loop: call pipeline.js → parse result → act → signal event → loop
- Add event signaling reference (which event to signal after each action completes)
- Add recovery instructions: `pipeline.js --event start` to recover from compaction
- Remove `STATUS.md` references throughout
- Remove runtime `triage_attempts` counter (now persisted in state.json, managed by pipeline script)
- Remove all intermediate mechanical actions (update_state_from_task, triage_task, etc.)
- Keep tools: `read`, `search`, `agent`, `execute`

**Acceptance criteria**:
- Orchestrator has exactly ~18 actions in routing table
- No `STATUS.md` references anywhere in file
- No runtime `triage_attempts` counter
- No references to `next-action.js`, `triage.js`, or `validate-state.js`
- Event-driven loop is clearly documented with pipeline.js CLI calls

---

### T3: Tactical Planner Agent Rewrite

**Objective**: Rewrite `.github/agents/tactical-planner.agent.md` to a pure planning agent with 3 modes: Phase Plan, Task Handoff, Phase Report. Remove all state-write responsibilities.

**Files**: `tactical-planner.agent.md` (MODIFY — full content replacement)

**Key changes**:
- Remove Mode 1 (Initialize Project) — handled by pipeline script
- Remove Mode 2 (Update State) — handled by pipeline script
- Renumber: Mode 3→1 (Phase Plan), Mode 4→2 (Task Handoff), Mode 5→3 (Phase Report)
- Remove `execute` from tools list (retain: `read`, `search`, `edit`, `todo`)
- Remove all `validate-state.js` invocation instructions
- Remove all `triage.js` invocation instructions from modes
- Remove all state.json write instructions (proposed state, pre-write validation, etc.)
- Remove `STATUS.md` references throughout
- Remove "sole writer of state.json and STATUS.md" language
- Remove `triage-report` from skills list
- Add "Prior Context" reading pattern: each mode reads `state.json` for computed fields (`review_action`, `phase_review_action`) and adjusts output accordingly
- Phase Plan mode: read `phase_review_action` from state.json, route based on value
- Task Handoff mode: read `review_action` from state.json, route based on value
- Keep read-only access to state.json for planning decisions

**Acceptance criteria**:
- Tactical Planner has exactly 3 modes
- No `execute` tool in frontmatter
- Zero references to `state.json` writes, `validate-state.js`, `triage.js`, or `STATUS.md`
- No "sole writer" language for state.json
- Each mode has Prior Context routing table

---

### T4: Reviewer Agent + review-task Skill Rename

**Objective**: Update the Reviewer agent to reference `review-task` instead of `review-code`, and rename the `review-code` skill directory to `review-task` with updated metadata.

**Files**: `reviewer.agent.md` (MODIFY), `.github/skills/review-code/SKILL.md` → `.github/skills/review-task/SKILL.md` (RENAME+MODIFY), `.github/skills/review-code/templates/CODE-REVIEW.md` → `.github/skills/review-task/templates/CODE-REVIEW.md` (RENAME — content unchanged)

**Key changes**:
- In `reviewer.agent.md`: replace all `review-code` references with `review-task`. Remove "only the Tactical Planner does that" language for state.json/STATUS.md. Replace with language indicating pipeline script manages state.
- Rename `.github/skills/review-code/` directory to `.github/skills/review-task/`
- Update `SKILL.md`: change `name: review-code` to `name: review-task` in frontmatter, update description to reflect task-level scope
- Preserve the `templates/CODE-REVIEW.md` template content (just move with directory)

**Acceptance criteria**:
- `review-task` skill directory exists with updated SKILL.md
- `review-code` skill directory does not exist
- Reviewer agent references `review-task` (not `review-code`)
- No STATUS.md or sole-writer language in reviewer agent

---

### T5: Other Agent Updates + triage-report Deletion

**Objective**: Update 6 remaining agent definitions (brainstormer, research, product-manager, ux-designer, architect, coder) to remove `STATUS.md` references and outdated sole-writer language. Delete the `triage-report` skill directory.

**Files**: `brainstormer.agent.md` (MODIFY), `research.agent.md` (MODIFY), `product-manager.agent.md` (MODIFY), `ux-designer.agent.md` (MODIFY), `architect.agent.md` (MODIFY), `coder.agent.md` (MODIFY), `.github/skills/triage-report/` (DELETE entire directory)

**Key changes**:
- In each of 6 agent files: remove any "only the Tactical Planner writes state.json and STATUS.md" language. Replace with "No agent directly writes `state.json` — all state mutations flow through the pipeline script." Remove any `STATUS.md` references.
- Delete the entire `.github/skills/triage-report/` directory (SKILL.md and any contents)

**Acceptance criteria**:
- No agent definition in the project mentions `STATUS.md`
- No agent definition contains "only the Tactical Planner" sole-writer language for `state.json`
- `.github/skills/triage-report/` directory does not exist
- All 6 agent files modified without breaking other content

---

### T6: Planning Skill Updates

**Objective**: Add "Prior Context" sections to the `create-task-handoff` and `create-phase-plan` skills, guiding the Tactical Planner to read computed triage outcomes from `state.json` and adjust planning accordingly.

**Files**: `.github/skills/create-task-handoff/SKILL.md` (MODIFY), `.github/skills/create-phase-plan/SKILL.md` (MODIFY)

**Key changes**:
- `create-task-handoff/SKILL.md`: Add "Prior Context (Corrective Handling)" section to the workflow. Describes: read `review_action` from state.json → if `corrective_task_issued`, read code review + extract issues → if `advanced`/null, proceed normally.
- `create-phase-plan/SKILL.md`: Add "Prior Context (Corrective Handling)" section to the workflow. Describes: read `phase_review_action` from state.json → if `corrective_tasks_issued`, read phase review + extract Cross-Task Issues → if `advanced`/null, proceed normally.
- Add `state.json` to each skill's Inputs Required table

**Acceptance criteria**:
- Both skills contain "Prior Context" sections with corrective handling instructions
- Instructions match the Architecture's specified content exactly
- Skills reference `review_action` / `phase_review_action` from `state.json`

---

### T7: Instruction & Configuration File Updates

**Objective**: Update `copilot-instructions.md` and `project-docs.instructions.md` to reflect the new state-write authority (pipeline script) and remove `STATUS.md` references.

**Files**: `.github/copilot-instructions.md` (MODIFY), `.github/instructions/project-docs.instructions.md` (MODIFY)

**Key changes**:
- `copilot-instructions.md`:
  - Remove "Check status" line referencing STATUS.md (or change to: reads state.json for status)
  - Change Tactical Planner description from "manages state — **sole writer of state.json and STATUS.md**" to "Breaks phases into tasks, creates task handoffs, generates phase reports"
  - Replace Key Rule #3 "Only the Tactical Planner writes state.json and STATUS.md" with "No agent directly writes state.json — all state mutations flow through the pipeline script"
  - Remove `STATUS.md` from Project Files section
  - Remove `State: state.json, STATUS.md` → `State: state.json`
- `project-docs.instructions.md`:
  - Change `state.json` sole writer from "Tactical Planner" to "Pipeline Script (`pipeline.js`)"
  - Remove the entire `STATUS.md` row from the ownership table
  - Remove any STATUS.md references from quality standards

**Acceptance criteria**:
- `copilot-instructions.md` references pipeline script as state authority
- No `STATUS.md` references in either file
- `state.json` ownership updated to pipeline script in `project-docs.instructions.md`

## Execution Order

```
T1 (Pipeline Engine Carry-Forward Fixes)
 ├→ T2 (Orchestrator Rewrite — depends on T1)
 └→ T3 (Tactical Planner Rewrite — depends on T1)  ← parallel-ready with T2
T4 (Reviewer + review-task Rename — independent)     ← parallel-ready with T2/T3
T5 (Other Agents + triage-report Deletion — independent)  ← parallel-ready with T4
T6 (Planning Skill Updates — independent)             ← parallel-ready with T4/T5
T7 (Instruction File Updates — independent)           ← parallel-ready with T6
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5 → T6 → T7

*Notes:*
- T2 and T3 are parallel-ready (no mutual dependency), but both depend on T1 (the V8/V9 fix changes pipeline behavior that the new agent definitions reference)
- T4, T5, T6, T7 are all parallel-ready after T1 completes — they modify independent files with no content dependencies
- Sequential ordering T4→T5→T6→T7 is arbitrary; the Coder can handle them in any order after T3

## Phase Exit Criteria

- [ ] Orchestrator agent definition has ~18-action routing table and event-driven loop
- [ ] Tactical Planner has exactly 3 modes, no `execute` tool, no state-write instructions
- [ ] No agent definition mentions `STATUS.md`
- [ ] No agent definition contains "only the Tactical Planner" sole-writer language for `state.json`
- [ ] `triage-report` skill directory does not exist
- [ ] `review-task` skill directory exists with updated SKILL.md; `review-code` directory does not exist
- [ ] `create-task-handoff` and `create-phase-plan` skills contain "Prior Context" sections
- [ ] `copilot-instructions.md` references pipeline script as state authority
- [ ] `project-docs.instructions.md` reflects updated ownership and has no `STATUS.md` row
- [ ] All 19 pipeline events produce correct output (V8/V9 paths now work)
- [ ] All preserved lib test suites pass unmodified (141 tests)
- [ ] All new pipeline test suites pass (178+ tests, updated for carry-forward fixes)
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors, all imports resolve)
- [ ] Phase review passed

## Known Risks for This Phase

- **Orchestrator agent rewrite scope**: The Orchestrator definition is ~260 lines with complex routing logic. The rewrite must cover all ~18 actions with correct event signaling. Risk of missing edge cases (halted states, human gates, final review). Mitigated by using the Architecture's action table as the canonical source.
- **review-code → review-task rename may miss cross-references**: Other documents (docs/skills.md, docs/agents.md, cross-refs.test.js) reference `review-code`. Phase 2 only handles agent/skill/instruction files — remaining cross-references are handled in Phase 3 (cleanup) and Phase 4 (docs). Risk of inconsistency during Phase 2. Mitigated by Phase 3 validation test updates catching dangling references.
- **V8/V9 fix complexity**: Three resolution options exist (reorder validate/triage, combine mutation+triage, exempt V8/V9 from pre-triage validation). The preferred approach (reorder) changes the engine's core flow. Risk of introducing regressions. Mitigated by comprehensive existing test suite (178 tests) and preserved lib tests (141 tests).
- **Agent definition content may still reference old concepts after rewrite**: Agents are Markdown files loaded by Copilot — subtle references to old patterns (validate-state.js calls, triage.js invocations, STATUS.md) may be missed. Mitigated by explicit acceptance criteria and grep-based verification.
