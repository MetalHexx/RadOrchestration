---
project: "ORCHESTRATION-REORG"
phase: 3
task: 1
title: "Atomic Path Reference Cutover"
status: "complete"
files_changed: 4
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: Atomic Path Reference Cutover

## Summary

Replaced all 15 stale `src/` script path references across 4 files with their `.github/orchestration/scripts/` equivalents. All 15 replacements were applied as a single atomic unit using a multi-replace operation. Post-replacement verification confirmed zero stale references and exact new-path counts matching the handoff specification.

## Files Changed

| Action | Path | Lines Changed | Notes |
|--------|------|---------------|-------|
| MODIFIED | `.github/agents/orchestrator.agent.md` | 4 lines | 2× `src/next-action.js` → `.github/orchestration/scripts/next-action.js`, 2× `src/triage.js` → `.github/orchestration/scripts/triage.js` |
| MODIFIED | `.github/agents/tactical-planner.agent.md` | 7 lines | 4× `src/validate-state.js` → `.github/orchestration/scripts/validate-state.js`, 3× `src/triage.js` → `.github/orchestration/scripts/triage.js` |
| MODIFIED | `.github/instructions/state-management.instructions.md` | 3 lines | 3× `src/validate-state.js` → `.github/orchestration/scripts/validate-state.js` |
| MODIFIED | `.github/skills/triage-report/SKILL.md` | 1 line | 1× `src/triage.js` → `.github/orchestration/scripts/triage.js` |

## Detailed Replacement Log

### File 1: `.github/agents/orchestrator.agent.md` (4 replacements)

| # | Line | Before | After |
|---|------|--------|-------|
| 1 | 131 | `node src/next-action.js --state {base_path}/{PROJECT-NAME}/state.json --config .github/orchestration.yml` | `node .github/orchestration/scripts/next-action.js --state {base_path}/{PROJECT-NAME}/state.json --config .github/orchestration.yml` |
| 2 | 196 | `execute triage (call `node src/triage.js --level task`)` | `execute triage (call `node .github/orchestration/scripts/triage.js --level task`)` |
| 3 | 205 | `execute triage (call `node src/triage.js --level phase`)` | `execute triage (call `node .github/orchestration/scripts/triage.js --level phase`)` |
| 4 | 220 | `` `node src/next-action.js --state {base_path}/{PROJECT-NAME}/state.json --config .github/orchestration.yml` `` | `` `node .github/orchestration/scripts/next-action.js --state {base_path}/{PROJECT-NAME}/state.json --config .github/orchestration.yml` `` |

### File 2: `.github/agents/tactical-planner.agent.md` (7 replacements)

| # | Line | Before | After |
|---|------|--------|-------|
| 1 | 76 | `` `node src/validate-state.js --current {state_path} --proposed {temp_path}` `` | `` `node .github/orchestration/scripts/validate-state.js --current {state_path} --proposed {temp_path}` `` |
| 2 | 105 | `` `node src/triage.js --state {state_path} --level phase --project-dir {project_dir}` `` | `` `node .github/orchestration/scripts/triage.js --state {state_path} --level phase --project-dir {project_dir}` `` |
| 3 | 131 | `` `node src/validate-state.js --current {state_path} --proposed {temp_path}` `` | `` `node .github/orchestration/scripts/validate-state.js --current {state_path} --proposed {temp_path}` `` |
| 4 | 147 | `` `node src/triage.js --state {state_path} --level task --project-dir {project_dir}` `` | `` `node .github/orchestration/scripts/triage.js --state {state_path} --level task --project-dir {project_dir}` `` |
| 5 | 178 | `` `node src/validate-state.js --current {state_path} --proposed {temp_path}` `` | `` `node .github/orchestration/scripts/validate-state.js --current {state_path} --proposed {temp_path}` `` |
| 6 | 215 | `` `node src/validate-state.js --current {state_path} --proposed {temp_path}` `` | `` `node .github/orchestration/scripts/validate-state.js --current {state_path} --proposed {temp_path}` `` |
| 7 | 225 | `The authoritative executor is `src/triage.js`.` | `The authoritative executor is `.github/orchestration/scripts/triage.js`.` |

### File 3: `.github/instructions/state-management.instructions.md` (3 replacements)

| # | Line | Before | After |
|---|------|--------|-------|
| 1 | 42 | `The Tactical Planner MUST call `src/validate-state.js` before every `state.json` write.` | `The Tactical Planner MUST call `.github/orchestration/scripts/validate-state.js` before every `state.json` write.` |
| 2 | 47 | `node src/validate-state.js --current <current-state.json> --proposed <proposed-state.json>` | `node .github/orchestration/scripts/validate-state.js --current <current-state.json> --proposed <proposed-state.json>` |
| 3 | 90 | `` `node src/validate-state.js --current <path-to-current-state.json> --proposed <path-to-temp-file>` `` | `` `node .github/orchestration/scripts/validate-state.js --current <path-to-current-state.json> --proposed <path-to-temp-file>` `` |

### File 4: `.github/skills/triage-report/SKILL.md` (1 replacement)

| # | Line | Before | After |
|---|------|--------|-------|
| 1 | 8 | `The authoritative executor is `src/triage.js`.` | `The authoritative executor is `.github/orchestration/scripts/triage.js`.` |

## Tests

No code tests apply — all 4 target files are Markdown documents. Verification was performed via grep:

| Test | Method | Status |
|------|--------|--------|
| Grep `orchestrator.agent.md` for `src/next-action.js` — expect 0 | Select-String | ✅ Pass (0 matches) |
| Grep `orchestrator.agent.md` for `src/triage.js` — expect 0 | Select-String | ✅ Pass (0 matches) |
| Grep `tactical-planner.agent.md` for `src/validate-state.js` — expect 0 | Select-String | ✅ Pass (0 matches) |
| Grep `tactical-planner.agent.md` for `src/triage.js` — expect 0 | Select-String | ✅ Pass (0 matches) |
| Grep `state-management.instructions.md` for `src/validate-state.js` — expect 0 | Select-String | ✅ Pass (0 matches) |
| Grep `triage-report/SKILL.md` for `src/triage.js` — expect 0 | Select-String | ✅ Pass (0 matches) |
| Count `.github/orchestration/scripts/next-action.js` in orchestrator.agent.md — expect 2 | Select-String | ✅ Pass (2) |
| Count `.github/orchestration/scripts/triage.js` in orchestrator.agent.md — expect 2 | Select-String | ✅ Pass (2) |
| Count `.github/orchestration/scripts/validate-state.js` in tactical-planner.agent.md — expect 4 | Select-String | ✅ Pass (4) |
| Count `.github/orchestration/scripts/triage.js` in tactical-planner.agent.md — expect 3 | Select-String | ✅ Pass (3) |
| Count `.github/orchestration/scripts/validate-state.js` in state-management.instructions.md — expect 3 | Select-String | ✅ Pass (3) |
| Count `.github/orchestration/scripts/triage.js` in triage-report/SKILL.md — expect 1 | Select-String | ✅ Pass (1) |
| Comprehensive grep across `.github/**/*.md` (excluding `.github/projects/`) for stale patterns | grep_search | ✅ Pass (0 matches outside frozen projects) |

**Test summary**: 13/13 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Zero occurrences of `src/next-action.js` in `.github/agents/orchestrator.agent.md` | ✅ Met |
| 2 | Zero occurrences of `src/triage.js` in `.github/agents/orchestrator.agent.md` | ✅ Met |
| 3 | Zero occurrences of `src/validate-state.js` in `.github/agents/tactical-planner.agent.md` | ✅ Met |
| 4 | Zero occurrences of `src/triage.js` in `.github/agents/tactical-planner.agent.md` | ✅ Met |
| 5 | Zero occurrences of `src/validate-state.js` in `.github/instructions/state-management.instructions.md` | ✅ Met |
| 6 | Zero occurrences of `src/triage.js` in `.github/skills/triage-report/SKILL.md` | ✅ Met |
| 7 | Exactly 4 new-path references in `.github/agents/orchestrator.agent.md` (2× next-action, 2× triage) | ✅ Met |
| 8 | Exactly 7 new-path references in `.github/agents/tactical-planner.agent.md` (4× validate-state, 3× triage) | ✅ Met |
| 9 | Exactly 3 new-path references in `.github/instructions/state-management.instructions.md` (3× validate-state) | ✅ Met |
| 10 | Exactly 1 new-path reference in `.github/skills/triage-report/SKILL.md` (1× triage) | ✅ Met |
| 11 | No other content in any file was modified (diff shows only path string changes) | ✅ Met |
| 12 | All 15 replacements applied as a single atomic unit — no partial state | ✅ Met |

## Build & Lint

- **Build**: N/A — Markdown-only changes, no compiled artifacts
- **Lint**: N/A — no code files modified
- **Type check**: N/A — no code files modified

## Anomaly Audit

Per handoff constraint — audited all 4 files for `path.join`, `path.resolve`, `__dirname` runtime path construction patterns:

- **Result**: 0 matches found. All 4 files are pure Markdown as expected.

## Constraint Compliance

| Constraint | Status |
|------------|--------|
| No content modified other than specific path strings | ✅ Compliant |
| No files under `.github/projects/` modified | ✅ Compliant |
| No old `src/` files modified | ✅ Compliant |
| No new path patterns introduced | ✅ Compliant |
| No reformatting/re-wrapping/whitespace changes | ✅ Compliant |
| Atomicity: all 15 replacements applied together | ✅ Compliant |
