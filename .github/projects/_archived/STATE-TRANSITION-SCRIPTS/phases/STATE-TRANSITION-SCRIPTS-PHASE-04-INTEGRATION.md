---
project: "STATE-TRANSITION-SCRIPTS"
phase: 4
title: "Agent & Skill Integration"
status: "active"
total_tasks: 4
author: "tactical-planner-agent"
created: "2026-03-09T22:00:00Z"
---

# Phase 4: Agent & Skill Integration

## Phase Goal

Rewrite Orchestrator and Tactical Planner agent prose to delegate routing, triage, and validation to the deterministic scripts built in Phases 1–3, update supporting documents to reflect script authority, and verify zero regressions across the existing test suite.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../STATE-TRANSITION-SCRIPTS-MASTER-PLAN.md) | Phase 4 scope and exit criteria |
| [Architecture](../STATE-TRANSITION-SCRIPTS-ARCHITECTURE.md) | Agent Prose Changes section, CLI entry point signatures, dependency graph |
| [Design](../STATE-TRANSITION-SCRIPTS-DESIGN.md) | Agent Workflows (Flows 1–4), CLI Interface Design, JSON Output Schemas |
| [PRD](../STATE-TRANSITION-SCRIPTS-PRD.md) | FR-5 through FR-8, success metrics |
| [Phase 3 Report](../reports/STATE-TRANSITION-SCRIPTS-PHASE-REPORT-P03.md) | No carry-forward items; all 14 exit criteria met, 0 retries |
| [Phase 3 Review](../reports/STATE-TRANSITION-SCRIPTS-PHASE-REVIEW-P03.md) | Approved — no issues, no carry-forward items |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Orchestrator Agent Rewrite | — | `create-task-handoff` | 1 | *(created at execution time)* |
| T2 | Tactical Planner Agent Rewrite | — | `create-task-handoff` | 1 | *(created at execution time)* |
| T3 | Supporting Document Updates | — | `create-task-handoff` | 2 | *(created at execution time)* |
| T4 | End-to-End Validation | T1, T2, T3 | `create-task-handoff`, `run-tests` | 0 | *(created at execution time)* |

## Task Details

### T1: Orchestrator Agent Rewrite

**Objective**: Replace the Orchestrator agent's prose decision tree in the execution section with script-based routing via `node src/next-action.js`.

**File Targets**:
- MODIFY `.github/agents/orchestrator.agent.md`

**Scope**:
- Replace Step 2d (execution loop) inline decision tree with: (1) call `node src/next-action.js --state <path> --config <path>`, (2) capture and parse JSON stdout, (3) pattern-match on `result.action` to determine which agent/skill to spawn
- Document `triage_attempts` counter management: increment on `triage_task`/`triage_phase` actions, reset to 0 on `advance_task`/`advance_phase` actions, halt pipeline if counter > 1
- Remove ALL residual inline routing conditions from the execution section — the script's output is the sole routing authority
- Preserve Steps 0, 1, 2a (init), 2b (halted), 2c (planning), 2e (review), 2f (complete) as-is — no script replaces these sections
- Reference correct script path: `src/next-action.js` (not `resolve-next-action.js`)
- Reference correct CLI flags: `--state <path>`, `--config <path>` (optional)

**Acceptance Criteria**:
- [ ] Orchestrator calls `node src/next-action.js --state <path>` with correct flags
- [ ] Pattern-matching covers every NEXT_ACTIONS enum value relevant to execution tier
- [ ] `triage_attempts` counter logic is explicitly documented: increment, reset, halt rules
- [ ] No residual inline routing conditions remain in the execution section
- [ ] Non-execution sections (Steps 0, 1, 2a–2c, 2e, 2f) are preserved unchanged

---

### T2: Tactical Planner Agent Rewrite

**Objective**: Replace the Tactical Planner's inline triage with script calls and add pre-write validation to all state-writing modes.

**File Targets**:
- MODIFY `.github/agents/tactical-planner.agent.md`

**Scope**:
- Mode 3 (Create Phase Plan), Step 7: Replace "Execute `triage-report` skill (phase-level decision table)" with: call `node src/triage.js --state <path> --level phase --project-dir <dir>`, parse JSON output, route on `result.action` value per the existing decision routing table
- Mode 4 (Create Task Handoff), Step 6: Replace "Execute `triage-report` skill (task-level decision table)" with: call `node src/triage.js --state <path> --level task --project-dir <dir>`, parse JSON output, route on `result.action` value per the existing decision routing table
- All state-writing Modes (2, 3, 4, 5): Add pre-write validation step — write proposed state to temp file, call `node src/validate-state.js --current <state.json> --proposed <temp-file>`, parse JSON output, commit only on `valid: true`, halt on `valid: false` with errors recorded in `errors.active_blockers`
- Update Skills section: note that `triage-report` is now a documentation-only reference; `src/triage.js` is the authoritative executor
- Reference correct script paths: `src/triage.js`, `src/validate-state.js`
- Reference correct CLI flags: `--state`, `--level task|phase`, `--project-dir`, `--current`, `--proposed`

**Acceptance Criteria**:
- [ ] Mode 3 calls `node src/triage.js --level phase` — no residual inline triage table interpretation
- [ ] Mode 4 calls `node src/triage.js --level task` — no residual inline triage table interpretation
- [ ] Modes 2, 3, 4, 5 each include pre-write validation via `node src/validate-state.js`
- [ ] On validation failure: record errors in `errors.active_blockers`, halt, do NOT commit write
- [ ] Skills section updated to note `triage-report` is documentation-only
- [ ] Decision routing tables in Mode 3 and Mode 4 are preserved (they route on script output, not on inline logic)

---

### T3: Supporting Document Updates

**Objective**: Update triage-report skill and state-management instructions to reflect script authority and validator requirement.

**File Targets**:
- MODIFY `.github/skills/triage-report/SKILL.md`
- MODIFY `.github/instructions/state-management.instructions.md`

**Scope**:
- `triage-report/SKILL.md`: Add prominent notice after the frontmatter (before "Triage Report" heading or immediately after it) stating that the decision tables are now **documentation-only** — the authoritative executor is `src/triage.js`. The script implements the exact logic described in the tables. Tables remain for human readability and as the specification the script was built from. Do NOT modify the decision tables themselves.
- `state-management.instructions.md`: Add a new section titled "## Pre-Write Validation" (or similar) documenting:
  - The Tactical Planner MUST call `node src/validate-state.js --current <current-state.json> --proposed <proposed-state.json>` before every `state.json` write
  - CLI interface: `--current` (path to committed state), `--proposed` (path to proposed state)
  - Expected output: JSON with `valid: true` (commit allowed) or `valid: false` + `errors[]` array of invariant violations
  - Required behavior on failure: do NOT commit the write, record invariant violations in `errors.active_blockers`, halt pipeline

**Acceptance Criteria**:
- [ ] `triage-report/SKILL.md` includes notice that `src/triage.js` is the authoritative executor; tables are documentation-only
- [ ] `state-management.instructions.md` includes validator requirement section with CLI interface
- [ ] `state-management.instructions.md` documents expected JSON output format (`valid`, `errors[]`)
- [ ] `state-management.instructions.md` documents failure behavior (halt, do not commit, record blockers)
- [ ] Decision tables in `triage-report/SKILL.md` are NOT modified (content preserved)

---

### T4: End-to-End Validation & Regression Check

**Objective**: Verify all Phase 4 changes are consistent, existing tests still pass, and no residual prose-based logic remains.

**File Targets**:
- No new or modified source files expected (validation-only task; minor corrections permitted if found)

**Scope**:
- Run full existing test suite: `node --test tests/*.test.js` — verify 330+ tests still pass with 0 failures
- Run `validate-orchestration` structural validation if applicable — verify updated agents/skills pass frontmatter and cross-reference checks
- Audit `.github/agents/orchestrator.agent.md` — confirm no residual inline routing conditions in the execution section; all routing derives from script output
- Audit `.github/agents/tactical-planner.agent.md` — confirm no residual inline triage table interpretation in Mode 3 or Mode 4; all triage derives from script output
- Verify script paths referenced in agent prose match actual file paths:
  - `src/next-action.js` (Orchestrator)
  - `src/triage.js` (Tactical Planner Modes 3, 4)
  - `src/validate-state.js` (Tactical Planner Modes 2, 3, 4, 5)
- Verify CLI flag names in agent prose match Architecture/Design specifications:
  - `--state`, `--config` (next-action)
  - `--state`, `--level`, `--project-dir` (triage)
  - `--current`, `--proposed` (validate-state)

**Acceptance Criteria**:
- [ ] All existing tests pass (330+ tests, 0 failures, 0 regressions)
- [ ] No residual prose-based decision trees in Orchestrator execution section
- [ ] No residual inline triage table interpretation in Tactical Planner Mode 3 or Mode 4
- [ ] All script paths in agent prose are correct and match actual file locations
- [ ] All CLI flags in agent prose match Architecture/Design specifications
- [ ] validate-orchestration passes (if applicable, no structural regressions)

## Execution Order

```
T1 (Orchestrator Rewrite) ──┐
T2 (Planner Rewrite)     ───┤ ← parallel-ready (no mutual dependencies)
T3 (Doc Updates)          ───┘
              T4 (Validation) ← depends on T1, T2, T3
```

**Sequential execution order**: T1 → T2 → T3 → T4

*Note: T1, T2, and T3 modify different files with no mutual dependencies and are parallel-ready, but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] Orchestrator agent calls `node src/next-action.js` and pattern-matches on action enum — no residual inline routing conditions remain
- [ ] Orchestrator agent documents `triage_attempts` counter logic: increment on triage actions, reset on advance actions, halt if > 1
- [ ] Tactical Planner agent calls `node src/triage.js --level task` in Mode 4 and `--level phase` in Mode 3 — no residual inline triage table interpretation
- [ ] Tactical Planner agent calls `node src/validate-state.js` before every `state.json` write in Modes 2, 3, 4, and 5
- [ ] Tactical Planner agent documents: on validation failure → record errors in `errors.active_blockers` → halt → do NOT commit write
- [ ] `triage-report/SKILL.md` includes notice that the triage script is the authoritative executor; tables are documentation-only
- [ ] `state-management.instructions.md` includes instruction to call validator before every write, with CLI interface and output format documented
- [ ] Existing tests continue to pass (330+ tests, 0 regressions)
- [ ] No residual prose-based decision trees remain in rewritten agents (confirmed by T4 audit)
- [ ] All tasks complete with status `complete`
- [ ] Build passes (no syntax errors in modified files)

## Known Risks for This Phase

- **Incomplete prose replacement**: The Orchestrator's execution section is ~60 lines of pseudocode routing logic; all inline routing must be replaced with script-based routing, not just augmented with script calls alongside the old conditions
- **Script path accuracy**: Agent prose must reference `src/next-action.js`, `src/triage.js`, `src/validate-state.js` — not the Design doc's draft names (`resolve-next-action.js`, `execute-triage.js`, `validate-state-transition.js`)
- **triage_attempts counter prose quality**: Since this counter is runtime-local (not in state.json, not scripted), the Orchestrator prose must document the increment/reset/halt logic clearly enough for an LLM to execute correctly on every invocation
- **validate-orchestration regression**: Structural changes to agent frontmatter or skill frontmatter could break the existing validation suite — T4 must catch this
