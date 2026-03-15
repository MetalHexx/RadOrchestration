---
project: "ORCHESTRATION-REORG"
phase: 3
title: "Cross-Reference Cutover"
status: "active"
total_tasks: 2
author: "tactical-planner-agent"
created: "2026-03-11T14:00:00Z"
---

# Phase 3: Cross-Reference Cutover

## Phase Goal

Update all runtime-critical path references in agent, instruction, and skill files to point to the new `.github/orchestration/scripts/` locations — executed as a single atomic unit so the pipeline never has partial references. After this phase, the pipeline uses the new paths exclusively.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../ORCHESTRATION-REORG-MASTER-PLAN.md) | Phase 3 scope: 15 replacements across 4 files; atomic cutover constraint; exit criteria |
| [Architecture](../ORCHESTRATION-REORG-ARCHITECTURE.md) | Layer 3 cross-reference inventory (Categories A, B, C); exact line numbers; Agent CLI Invocation Contracts; Instruction/Skill File Path Contracts |
| [Phase 1 Report](ORCHESTRATION-REORG-PHASE-REPORT-P01.md) | Confirms all 7 scripts exist at `.github/orchestration/scripts/` — the targets references will point to |
| [Phase 2 Report](ORCHESTRATION-REORG-PHASE-REPORT-P02.md) | Carry-forward: audit for `path.join`/`path.resolve` runtime path patterns, not just static string references |
| [Phase 1 Review](PHASE-REVIEW-P01.md) | Verdict: approved → advance; dual-path coexistence verified |
| [Phase 2 Review](PHASE-REVIEW-P02.md) | Verdict: approved → advance; 307/307 tests pass at new locations |
| [Issues Log](../ORCHESTRATION-REORG-ISSUES.md) | ISSUE-001 (premature `current_task` advancement) — applies to Orchestrator workflow, not this phase's scope; ISSUE-002 (consult reviews) — incorporated by reading prior reviews; ISSUE-003 (validator bounds) — already fixed in both copies |

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Atomic Path Reference Cutover | — | Coder (find-and-replace) | 4 | *(created at execution time)* |
| T2 | Validation Gate | T1 | Coder (validation) | 0 | *(created at execution time)* |

### T1: Atomic Path Reference Cutover

**Objective**: Replace all 15 stale `src/` script path references across 4 files with their `.github/orchestration/scripts/` equivalents in a single atomic operation.

**Scope**:

| File | Pattern | Occurrences | Replacement |
|------|---------|-------------|-------------|
| `.github/agents/orchestrator.agent.md` | `src/next-action.js` | 4 | `.github/orchestration/scripts/next-action.js` |
| `.github/agents/tactical-planner.agent.md` | `src/validate-state.js` | 4 | `.github/orchestration/scripts/validate-state.js` |
| `.github/agents/tactical-planner.agent.md` | `src/triage.js` | 3 | `.github/orchestration/scripts/triage.js` |
| `.github/instructions/state-management.instructions.md` | `src/validate-state.js` | 3 | `.github/orchestration/scripts/validate-state.js` |
| `.github/skills/triage-report/SKILL.md` | `src/triage.js` | 1 | `.github/orchestration/scripts/triage.js` |

**Total**: 15 replacements across 4 files (3 distinct patterns).

**Constraints**:
- All 15 replacements MUST be applied in a single task — never leave partial stale references
- Do NOT modify any file content other than the path references listed above
- Do NOT modify any files under `.github/projects/` (frozen artifact boundary)
- Audit each file for `path.join`/`path.resolve`/`__dirname` runtime path construction patterns (carry-forward from Phase 2 review) — these are markdown agent files so runtime patterns are unlikely, but verify

**Acceptance Criteria**:
- [ ] Zero occurrences of `src/next-action.js` in `.github/agents/orchestrator.agent.md`
- [ ] Zero occurrences of `src/validate-state.js` in `.github/agents/tactical-planner.agent.md`
- [ ] Zero occurrences of `src/triage.js` in `.github/agents/tactical-planner.agent.md`
- [ ] Zero occurrences of `src/validate-state.js` in `.github/instructions/state-management.instructions.md`
- [ ] Zero occurrences of `src/triage.js` in `.github/skills/triage-report/SKILL.md`
- [ ] Each file has the exact expected count of new-path references (4, 7, 3, 1 respectively)
- [ ] No other content in any file was modified (diff shows only path string changes)

### T2: Validation Gate

**Objective**: Confirm that all cross-references are correct, the pipeline uses the new paths, and no stale references remain.

**Scope**:
- Run `node .github/orchestration/scripts/validate-state.js` to confirm the new-path script is callable
- Run validate-orchestration: `node .github/skills/validate-orchestration/scripts/validate-orchestration.js`
- Grep for stale patterns across ALL `.github/agents/*.agent.md`, `.github/instructions/*.instructions.md`, and `.github/skills/*/SKILL.md` files:
  - Pattern 1: `src/next-action.js` → expect 0 matches
  - Pattern 2: `src/validate-state.js` → expect 0 matches
  - Pattern 3: `src/triage.js` → expect 0 matches
- Run the migrated test suite to confirm no regressions: `node --test .github/orchestration/scripts/tests/*.test.js`
- Run `node .github/orchestration/scripts/next-action.js --state .github/projects/ORCHESTRATION-REORG/state.json --config .github/orchestration.yml` to verify pipeline end-to-end with new paths

**Acceptance Criteria**:
- [ ] validate-orchestration reports zero errors
- [ ] Stale-path grep returns 0 matches for all 3 patterns across agent/instruction/skill files
- [ ] Migrated test suite passes (307/307)
- [ ] Pipeline CLI (next-action.js at new path) executes successfully and returns valid JSON
- [ ] No files were modified by this task (read-only validation)

## Execution Order

```
T1 (Atomic Path Reference Cutover)
 └→ T2 (Validation Gate)
```

**Sequential execution order**: T1 → T2

## Phase Exit Criteria

- [ ] Zero occurrences of `src/next-action.js`, `src/validate-state.js`, `src/triage.js` in any agent, instruction, or skill file
- [ ] validate-orchestration reports zero errors
- [ ] Pipeline can execute using the new script paths (end-to-end CLI check)
- [ ] Migrated test suite passes (307/307) with zero regressions
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **Partial cutover**: If T1 fails mid-way, some files may have new paths while others retain old paths. Mitigation: T1 is designed as an atomic unit — the Coder must apply all 15 replacements before reporting completion. If any replacement fails, roll back all changes in that file.
- **Undocumented references**: The Architecture line-number audit may have missed references if files were edited since the audit. Mitigation: T2's stale-path grep is exhaustive — it catches any residual `src/` references regardless of line number.
- **Phase 2 carry-forward (runtime path patterns)**: Agent/instruction/skill files are Markdown, not JavaScript — `path.join`/`path.resolve` patterns are not expected. T1 will verify this during its audit step.
