---
project: "PIPELINE-SIMPLIFICATION"
phase: 4
title: "SWAP-ALIGNMENT"
status: "active"
total_tasks: 4
tasks:
  - id: "T01-SWAP"
    title: "File Swap & Pipeline Entry Point Update"
  - id: "T02-PROMPTS"
    title: "Agent & Skill Prompt Alignment"
  - id: "T03-DOCS"
    title: "Documentation & Instructions Update"
  - id: "T04-CLEANUP"
    title: "Cleanup & Final Verification"
author: "tactical-planner-agent"
created: "2026-03-15T03:00:00Z"
---

# Phase 4: SWAP-ALIGNMENT

## Phase Goal

Put the v3 engine into production position by swapping `lib-v3/` → `lib/`, align all agent/skill/template prompts with the refactored contracts (no triage layer, no internal actions, merged corrective action), update documentation to reflect the simplified architecture, and clean up old artifacts.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-SIMPLIFICATION-MASTER-PLAN.md) | Phase 4 scope and exit criteria |
| [Architecture](../PIPELINE-SIMPLIFICATION-ARCHITECTURE.md) | Delivery Swap Sequence (7-step table), module map, external action set (~18), removed actions (16), merged actions, file structure |
| [Design](../PIPELINE-SIMPLIFICATION-DESIGN.md) | Entry point readability, PipelineResult contract |
| [Research Findings](../PIPELINE-SIMPLIFICATION-RESEARCH-FINDINGS.md) | Agent definitions alignment targets, skills alignment targets, documentation update targets, instructions alignment targets |
| [PRD](../PIPELINE-SIMPLIFICATION-PRD.md) | FR-19 (swap), FR-20 (Orchestrator update), FR-21 (Tactical Planner update), FR-22 (docs update) |
| [Phase 3 Report](PIPELINE-SIMPLIFICATION-PHASE-REPORT-P03.md) | Carry-forward: V13 timestamp gap fix, dead imports cleanup, architecture doc discrepancies |
| [Phase 2 Report](PIPELINE-SIMPLIFICATION-PHASE-REPORT-P02.md) | Carry-forward: Architecture doc event count (18→17), validateTransition param count (2→3) |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T01 | File Swap & Pipeline Entry Point Update | — | `coder` | ~15 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P04-T01-SWAP.md) |
| T02 | Agent & Skill Prompt Alignment | T01 | `coder` | ~5 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P04-T02-PROMPTS.md) |
| T03 | Documentation & Instructions Update | T01 | `coder` | ~5 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P04-T03-DOCS.md) |
| T04 | Cleanup & Final Verification | T01, T02, T03 | `coder` | ~2 | [Link](../tasks/PIPELINE-SIMPLIFICATION-TASK-P04-T04-CLEANUP.md) |

## Execution Order

```
T01 (File Swap & Pipeline Entry Point)
 ├→ T02 (Agent & Skill Prompt Alignment)  ← parallel-ready
 └→ T03 (Documentation & Instructions)    ← parallel-ready
T04 (Cleanup & Final Verification — depends on T01, T02, T03)
```

**Sequential execution order**: T01 → T02 → T03 → T04

*Note: T02 and T03 are parallel-ready (no mutual dependency) but will execute sequentially in v1.*

## Task Details

### T01: File Swap & Pipeline Entry Point Update

**Objective**: Execute the Architecture's 7-step delivery swap sequence to put v3 modules into production position, update `pipeline.js` to use the v3 engine API, apply carry-forward fixes, and verify the full test suite passes from the production directory.

**Scope**:
1. Rename `.github/orchestration/scripts/lib/` → `.github/orchestration/scripts/lib-old/` (preserve for rollback)
2. Rename `.github/orchestration/scripts/lib-v3/` → `.github/orchestration/scripts/lib/` (v3 becomes active)
3. Update `.github/orchestration/scripts/pipeline.js` — change `require('./lib/pipeline-engine')` to import `processEvent` and `scaffoldInitialState` from the new v3 module (v3 exports `processEvent`, not `executePipeline`); update the `main()` function call site accordingly; keep `stateIo` require as-is (v3 `state-io.js` exports the same interface)
4. Copy all `.github/orchestration/scripts/tests-v3/*.test.js` → `.github/orchestration/scripts/tests/` (overwrite existing)
5. Copy `.github/orchestration/scripts/tests-v3/helpers/` → `.github/orchestration/scripts/tests/helpers/` (test infrastructure)
6. Delete `.github/orchestration/scripts/tests/triage-engine.test.js` (no triage module to test)
7. Apply carry-forward fix CF-V13: In `lib/pipeline-engine.js` (now the v3 engine), add `proposed.project.updated = new Date().toISOString()` between the mutation call and `validateTransition` call (~line 137) to eliminate the test timestamp workaround
8. Clean up dead imports in `tests/pipeline-engine.test.js` (carry-forward from P03)
9. Run full test suite from `tests/` directory — all 374+ tests must pass

**Key risk**: `pipeline.js` currently calls `executePipeline()` which doesn't exist in v3. The v3 engine exports `processEvent(event, projectDir, context, io, configPath)` with a different function signature. The pipeline.js update must adapt the calling convention.

---

### T02: Agent & Skill Prompt Alignment

**Objective**: Update agent definitions and skill documents that reference triage engine concepts, removed internal actions, or the old corrective handoff action — replacing with v3 equivalents.

**Scope** (from Research Findings alignment targets):

1. **Orchestrator agent** (`.github/agents/orchestrator.agent.md`) — **High impact**:
   - Update the action routing table: remove `create_corrective_handoff` row (merged into `create_task_handoff` with `context.is_correction`); consolidate individual halt actions into `display_halted`; update action count
   - Reword any `triage_attempts` references now that the field is removed from schema
   - Remove references to internal actions (the 16 removed actions)

2. **Tactical Planner agent** (`.github/agents/tactical-planner.agent.md`) — **Medium impact**:
   - Update Prior Context Routing instruction: `CREATE_CORRECTIVE_HANDOFF` → `CREATE_TASK_HANDOFF` with `is_correction` context flag
   - Verify routing tables for `corrective_task_issued` values still correct (they stay)

3. **`create-task-handoff` skill** (`.github/skills/create-task-handoff/SKILL.md`) — **Medium impact**:
   - Update Corrective Task Handoff section for `is_correction` context flag
   - Replace "triage outcomes" reference in inputs table with "mutation handler outcomes"

4. **`generate-task-report` skill** (`.github/skills/generate-task-report/SKILL.md`) — **Medium impact**:
   - Replace "triage engine" with "mutation handler" in consumer columns (2 occurrences)

5. **`review-phase` skill** (`.github/skills/review-phase/SKILL.md`) — **Medium impact**:
   - Replace "triage engine" with "mutation handler" in consumer columns (3 occurrences)

**Constraint**: Changes are editorial only — no new agent instructions, no removed responsibilities, no behavioral changes. The goal is to align terminology with v3 contracts.

---

### T03: Documentation & Instructions Update

**Objective**: Update all documentation and instruction files that reference triage layer, internal actions, removed invariants, or `triage_attempts` to reflect the simplified v3 architecture.

**Scope** (from Research Findings documentation targets):

1. **`docs/scripts.md`** — **High impact**:
   - Remove internal action tables (16 removed actions)
   - Update module inventory: remove `triage-engine.js`, add `pre-reads.js`
   - Update action count from 35 → 18 (external only)
   - Update line count / module count claims

2. **`docs/pipeline.md`** — **Medium impact**:
   - Remove triage layer section / triage-related narrative
   - Update pipeline flow description to reflect linear recipe (load → pre-read → mutate → validate → write → resolve → return)
   - Remove `triage_attempts` lifecycle explanation

3. **`docs/validation.md`** — **Medium impact**:
   - Remove V8, V9, V14, V15 from invariant catalog
   - Update "validation runs twice" → "validation runs once"
   - Update invariant count to ~11

4. **`docs/agents.md`** — **Low impact**:
   - Update Orchestrator blurb that mentions `triage_attempts`

5. **`.github/instructions/state-management.instructions.md`** — **Medium impact**:
   - Remove "after every triage mutation" clause from Pre-Write Validation section
   - Remove or update `triage_attempts` references if present

6. **Architecture doc carry-forward fixes** (`.github/projects/PIPELINE-SIMPLIFICATION/PIPELINE-SIMPLIFICATION-ARCHITECTURE.md`):
   - Fix `validateTransition` parameter count: 2 → 3 (`current, proposed, config`) — carried from P01→P02→P03
   - Fix event handler count: "18-event handler lookup table" → "17-event handler lookup table" — carried from P02→P03

---

### T04: Cleanup & Final Verification

**Objective**: Delete the old `lib-old/` directory, delete the now-empty `lib-v3/` and `tests-v3/` directories (if any remnants), and perform a comprehensive grep audit confirming no stale references remain across the entire workspace.

**Scope**:
1. Delete `.github/orchestration/scripts/lib-old/` (the preserved v2 modules)
2. Delete `.github/orchestration/scripts/tests-v3/` directory if it still exists after T01 copy
3. Run full test suite one final time — all tests must pass from production `tests/` directory
4. Grep audit across the workspace for terms that should no longer appear as live concepts:
   - `triage_engine` / `triage-engine` (module name)
   - `create_corrective_handoff` / `CREATE_CORRECTIVE_HANDOFF` (merged action)
   - `triage_attempts` (removed schema field — note: may still appear in v2 state.json schema references or historical docs, but not in any `.agent.md`, `SKILL.md`, instruction, or active doc)
   - `TRIAGE_LEVELS` (removed enum)
   - Any of the 16 removed internal actions as live references in agent/skill/doc files
   - `lib-v3/` or `tests-v3/` path references in any active files
5. Report any remaining references found — categorize as "historical/acceptable" (e.g., in project docs describing what was done) vs. "stale/must-fix"

**Key risk**: Grep audit may surface references in this project's own planning documents (PRD, Architecture, Master Plan, Phase Plans, etc.) — these are historical and acceptable. Only active operational files (agents, skills, instructions, docs, scripts) must be clean.

## Phase Exit Criteria

- [ ] Pipeline runs against its own project (`pipeline.js` invokes `lib/` which is the new v3 engine)
- [ ] Full test suite passes from the production `tests/` directory (374+ tests)
- [ ] No `.agent.md`, `SKILL.md`, or template references `triage_engine`, `create_corrective_handoff`, `triage_attempts`, or any of the 16 removed internal actions as live concepts
- [ ] `docs/scripts.md` no longer lists internal actions; `docs/validation.md` lists only ~11 invariants; `docs/pipeline.md` has no triage-layer description
- [ ] `lib-old/` deleted; `lib-v3/` directory removed; `tests-v3/` directory removed
- [ ] `state-management.instructions.md` has no "triage mutation" clause
- [ ] Carry-forward V13 timestamp gap fix applied
- [ ] Carry-forward architecture doc discrepancies fixed (validateTransition params, event handler count)
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes
- [ ] All tests pass

## Known Risks for This Phase

- **`pipeline.js` API mismatch**: The current `pipeline.js` calls `executePipeline()` which doesn't exist in v3 — the v3 engine exports `processEvent()` with a different signature. T01 must carefully adapt the calling convention and verify the result contract is unchanged.
- **Agent prompt alignment introduces unintended behavioral changes**: T02 changes are editorial only — no new instructions, no removed responsibilities. Each change must be reviewed against the actual pipeline contract.
- **Grep audit false positives in project docs**: This project's own planning documents (PRD, Architecture, Master Plan) will contain removed terms as historical context. The audit must distinguish between active operational references and historical documentation references.
- **`tests-v3/` require paths break after copy to `tests/`**: Test files in `tests-v3/` use `require('../lib-v3/...')` paths — after copying to `tests/`, these must be updated to `require('../lib/...')`. This is a critical part of T01.
