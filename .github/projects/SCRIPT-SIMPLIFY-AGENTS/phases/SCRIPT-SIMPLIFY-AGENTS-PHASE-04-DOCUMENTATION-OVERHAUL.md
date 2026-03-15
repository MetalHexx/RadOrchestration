---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 4
title: "Documentation Overhaul"
status: "active"
total_tasks: 6
author: "tactical-planner-agent"
created: "2026-03-12T00:00:00Z"
---

# Phase 4: Documentation Overhaul

## Phase Goal

Rewrite all user-facing and system-facing documentation to accurately reflect the post-refactor architecture — replacing references to the 3 deleted standalone scripts, removed shadow documents, renamed skills, and the old Tactical-Planner-as-state-authority model with the new unified pipeline script (`pipeline.js`) event-driven system.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../SCRIPT-SIMPLIFY-AGENTS-MASTER-PLAN.md) | Phase 4 scope, exit criteria, affected file inventory |
| [Architecture](../SCRIPT-SIMPLIFY-AGENTS-ARCHITECTURE.md) | Pipeline engine interfaces, 4-layer module composition, 19 event vocabulary, ~18-action reduced vocabulary, `PipelineIO` interface, mutation lookup table |
| [Design](../SCRIPT-SIMPLIFY-AGENTS-DESIGN.md) | Atomic event-action contract, closed event vocabulary, uniform error result shape, context compaction recovery |
| [PRD](../SCRIPT-SIMPLIFY-AGENTS-PRD.md) | FR-11 through FR-27 (agent/skill/doc requirements), NFR-11 (no agent writes state.json) |
| [Phase 3 Report](../reports/SCRIPT-SIMPLIFY-AGENTS-PHASE-03-REPORT.md) | Carry-forward: 7 docs/ files contain stale references to old scripts, review-code, triage-report, STATUS.md |

### Carry-Forward from Phase 3

Phase 3 Task T4 (Reference Sweep) confirmed that all active system files (agents, skills, instructions, scripts) are clean, but **7 documentation files** still contain stale references. These are the primary targets of this phase, along with `README.md` and `docs/dashboard.md` (verification-only).

**Stale reference inventory from Phase 3 sweep:**

| File | Stale References Found |
|------|----------------------|
| `docs/scripts.md` | Entire file documents 3 deleted scripts (`next-action.js`, `triage.js`, `validate-state.js`) — full rewrite required |
| `docs/pipeline.md` | References to Next-Action Resolver, Triage Executor, `STATUS.md`, "Only the Tactical Planner writes state.json", ~30 actions |
| `docs/agents.md` | Tactical Planner 7-mode description, `STATUS.md`, `state.json` sole writer policy, `review-code`, `triage-report`, Next-Action Resolver, Triage Executor |
| `docs/skills.md` | `review-code` skill row, `triage-report` skill row, Tactical Planner skill composition includes `triage-report` |
| `docs/project-structure.md` | `next-action.js`, `triage.js`, `validate-state.js` in file tree, `schemas/` directory, `STATUS.md`, `state-json-schema.md`, `state-management.instructions.md`, sole writer = Tactical Planner |
| `docs/validation.md` | `validate-state.js` CLI example, State Transition Validator reference to scripts.md |
| `docs/getting-started.md` | `STATUS.md` status check reference, Next-Action Resolver reference |
| `docs/configuration.md` | Next-Action Resolver reference (1 occurrence) |
| `README.md` | "Only the Tactical Planner touches state", "~30 routing paths", Next-Action Resolver, Triage Executor, State Validator, doc table row "Deterministic Scripts" |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Major Rewrite — `scripts.md` | — | — | 1 | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P04-T01-SCRIPTS-MD.md) |
| T2 | Major Rewrite — `pipeline.md` | — | — | 1 | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P04-T02-PIPELINE-MD.md) |
| T3 | Update `agents.md` | T1, T2 | — | 1 | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P04-T03-AGENTS-MD.md) |
| T4 | Update `skills.md` + `project-structure.md` | T1 | — | 2 | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P04-T04-SKILLS-STRUCTURE-MD.md) |
| T5 | Update `configuration.md` + `validation.md` + `getting-started.md` | T1, T2 | — | 3 | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P04-T05-CONFIG-VALIDATION-STARTED-MD.md) |
| T6 | Update `README.md` + Final Reference Sweep | T1, T2, T3, T4, T5 | — | 1 | [Link](../tasks/SCRIPT-SIMPLIFY-AGENTS-TASK-P04-T06-README-SWEEP.md) |

## Task Details

### T1: Major Rewrite — `scripts.md`

**Objective**: Replace the entire contents of `docs/scripts.md` (currently 339 lines documenting 3 deleted standalone scripts) with documentation for the unified `pipeline.js` system.

**What to write**:
- New title and introduction: unified pipeline script replaces 3 scripts
- Pipeline CLI usage (`pipeline.js --event <name> --state <path> --config <path> --project-dir <path>`)
- 4-layer module architecture diagram (`pipeline.js` → `pipeline-engine.js` → `mutations.js` / preserved libs → `state-io.js`)
- Closed event vocabulary (19 events) with table
- Reduced action vocabulary (~18 external actions) with table — contrast with old 35
- Atomic event-action result shape (`{ success, action, context, mutations_applied, triage_ran, validation_passed }`)
- Error result shape
- `triage_attempts` lifecycle (init → 0, triage → increment, advance → reset, >1 → halt)
- Mutation internals overview (pure functions, lookup table pattern)
- Triage integration (dual validation passes for triage events)
- I/O isolation (dependency injection via `PipelineIO` interface)
- Testing section updated for new test files (`mutations.test.js`, `pipeline-engine.test.js`, `state-io.test.js`, `pipeline.test.js`)
- CLI conventions (unchanged — CommonJS, shebang, `require.main === module`, GNU options)
- Preserved shared constants and lib modules

**What is NOT in scope**: The file should NOT reference `next-action.js`, `triage.js`, or `validate-state.js`.

---

### T2: Major Rewrite — `pipeline.md`

**Objective**: Rewrite `docs/pipeline.md` (208 lines) to describe the event-driven pipeline architecture.

**What to change**:
- Planning pipeline section: Replace `TP: Initialize project & state.json` and `TP: Mark planning complete` with pipeline script calls; remove the Tactical Planner from the initialization sequence diagram
- Execution pipeline section: Replace `ORC->>TP: Update state from report` / `ORC->>TP: Mark task complete` with pipeline event calls; update sequence diagram
- Task lifecycle: Remove step 3 ("State update — Tactical Planner reads the report and updates state.json") — pipeline script handles this; remove step 5 Triage Executor reference
- Phase lifecycle: Remove "Triage Executor processes the phase review verdict" — pipeline script handles this
- Pipeline Routing section: Replace Next-Action Resolver description with pipeline script event-driven routing; update ~30 actions to ~18 actions
- Triage Attempts section: Update to state `triage_attempts` is persisted in `state.json` (not a runtime counter); pipeline script increments/resets
- State Management section: Replace "Only the Tactical Planner writes `state.json`" with "Only the pipeline script (`pipeline.js`) writes `state.json`"; remove `STATUS.md` line
- Remove all references to `STATUS.md`

---

### T3: Update `agents.md`

**Objective**: Update agent descriptions to match the refactored roles.

**What to change**:
- Agent overview table: Tactical Planner row — remove `state.json`, `STATUS.md` from Writes column; update role to "Task breakdown and phase reporting"
- Sole Writer Policy section: Remove Tactical Planner as state authority
- "Tactical Planner as State Authority" subsection: Delete entirely or replace with "Pipeline Script as State Authority" explaining that `pipeline.js` is the sole writer of `state.json`
- Read-Only Orchestrator: Replace Next-Action Resolver reference with "calls pipeline.js to get deterministic routing"; remove `triage_attempts` runtime counter language
- Orchestrator detail: Update description to event-driven loop, ~18-action routing table; remove Next-Action Resolver, triage_attempts counter
- Tactical Planner detail: Reduce to 3 modes (phase planning, task handoffs, phase reports); remove modes 1-4 (initialize, update state, phase triage, task triage); remove `state.json`, `STATUS.md` from outputs; remove `triage-report` from skills; update skills list
- Reviewer detail: Change `review-code` to `review-task` in skills
- Remove all `STATUS.md` references throughout

---

### T4: Update `skills.md` + `project-structure.md`

**Objective**: Update skill inventory and project file structure to reflect deletions, renames, and ownership changes.

**`docs/skills.md` changes**:
- Review Skills table: Replace `review-code` with `review-task`; delete `triage-report` row entirely
- Skill-Agent Composition table: Tactical Planner row — remove `triage-report`; Reviewer row — change `review-code` to `review-task`
- Update skill count if mentioned (was 17, verify current count)

**`docs/project-structure.md` changes**:
- Workspace layout tree: Replace `next-action.js`, `triage.js`, `validate-state.js` with `pipeline.js`; add `pipeline-engine.js`, `mutations.js`, `state-io.js` in lib/; remove `schemas/` directory and `state-json-schema.md`
- Project folder structure: Remove `STATUS.md` entry; change `state.json` sole writer comment from "Tactical Planner" to "pipeline script"
- State Files table: Remove `STATUS.md` row; change `state.json` sole writer from "Tactical Planner" to "Pipeline Script (`pipeline.js`)"
- Scoped Instructions table: Remove `state-management.instructions.md` row
- System Files table: Remove `state-management.instructions.md` example (if present)
- State Management section: Replace "Only the Tactical Planner writes" with "Only the pipeline script writes"; update invariant enforcement description; remove references to old scripts
- Update the state.json schema example if it's missing `triage_attempts` or `execution.status` fields

---

### T5: Update `configuration.md` + `validation.md` + `getting-started.md`

**Objective**: Fix stale references in three files with lighter changes.

**`docs/configuration.md` changes**:
- Line ~118: Replace "[Next-Action Resolver](scripts.md) optionally reads `orchestration.yml`" with reference to pipeline script reading config
- Line ~86: Replace "[State Transition Validator](scripts.md)" reference with pipeline script validation

**`docs/validation.md` changes**:
- Line ~136: Remove or replace `validate-state.js` CLI example in "State Validation" section
- Replace State Transition Validator reference — validation now runs inside the pipeline script
- Update "[Deterministic Scripts](scripts.md)" link text/target if scripts.md title changed

**`docs/getting-started.md` changes**:
- Line ~77: Replace "deterministic [Next-Action Resolver](scripts.md)" with pipeline script reference
- Line ~85: Replace `STATUS.md` status check description — Orchestrator reads `state.json` directly (or calls pipeline.js --event start) to report status
- Verify no other stale references

---

### T6: Update `README.md` + Final Reference Sweep

**Objective**: Update the top-level README to reflect the new architecture, then perform a final grep sweep across all docs/ files to confirm zero remaining stale references.

**`README.md` changes**:
- Line ~5: "Routing, triage, and state validation are handled by pure JavaScript functions" — update to reflect unified pipeline script
- Line ~64: "Only the Tactical Planner touches state" — change to "Only the pipeline script touches state"
- Lines ~80-84: "Deterministic Routing & Triage" section — replace Next-Action Resolver (~30 paths), Triage Executor, State Validator with pipeline script (~18 actions, internalized triage, internalized validation)
- Line ~136: Doc table "Deterministic Scripts" row — update description from "Next-Action Resolver, Triage Executor, State Validator CLIs" to "Pipeline Script — unified event-driven CLI"
- Verify Mermaid diagram doesn't reference deleted concepts

**Final sweep**:
- Grep all `docs/*.md` and `README.md` for: `STATUS.md`, `next-action.js`, `triage.js`, `validate-state.js`, `state-json-schema`, `state-management.instructions`, `triage-report`, `review-code` (as skill name, not as action like "review code")
- Confirm zero matches
- Verify all cross-links between docs files resolve correctly (e.g., `[scripts.md]` links still work with new content)

## Execution Order

```
T1 (scripts.md rewrite)
 └→ T3 (agents.md — depends on T1, T2)
T2 (pipeline.md rewrite)  ← parallel-ready with T1
 ├→ T3 (agents.md — depends on T1, T2)
 └→ T5 (config + validation + getting-started — depends on T1, T2)
T1 → T4 (skills.md + project-structure.md — depends on T1)
T1, T2, T3, T4, T5 → T6 (README + sweep — depends on all)
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5 → T6

*Note: T1 and T2 are parallel-ready (no mutual dependency) but will execute sequentially in v1. T4 and T5 are parallel-ready after T2 completes but will also execute sequentially.*

## Phase Exit Criteria

- [ ] No documentation file references `STATUS.md`, `state-json-schema.md`, `state-management.instructions.md`, `next-action.js`, `triage.js`, `validate-state.js`, or `triage-report` skill
- [ ] `docs/scripts.md` documents the `pipeline.js` CLI interface, 19-event vocabulary, and ~18-action reduced vocabulary
- [ ] `docs/pipeline.md` describes the event-driven loop, pipeline script as state authority, and `triage_attempts` persistence in `state.json`
- [ ] `docs/agents.md` accurately describes the Orchestrator event loop, Tactical Planner 3-mode structure, and `review-task` skill
- [ ] `docs/skills.md` lists `review-task` (not `review-code`) and does not list `triage-report`
- [ ] `docs/project-structure.md` shows pipeline files (not old scripts), no `schemas/` directory, no `STATUS.md`, sole writer = pipeline script
- [ ] `README.md` reflects the unified pipeline script architecture and updated agent roles
- [ ] All documentation validation tests pass
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **Cross-reference consistency**: Documentation files heavily cross-link to each other (especially to `scripts.md` and `pipeline.md`). The major rewrites in T1 and T2 may change section anchors, breaking links from other files. Mitigation: T1 and T2 execute first so that anchor targets are stable before T3–T5 update linking files; T6 performs a final sweep.
- **Scope creep from discovering additional stale content**: The Phase 3 sweep identified 7 files, but the actual content in some files (e.g., `docs/agents.md` Tactical Planner section) has extensive stale prose beyond just keyword references. Mitigation: Task handoffs will specify exact sections and changes needed; Coder should not rewrite sections that aren't stale.
- **Mermaid diagram accuracy**: `docs/pipeline.md` contains Mermaid sequence diagrams that reference the Tactical Planner in state-management roles. These need careful updating without breaking the diagram syntax. Mitigation: Task handoff for T2 will include specific diagram changes.
