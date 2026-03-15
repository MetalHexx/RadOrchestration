---
project: "ORCHESTRATION-REORG"
phase: 3
task: 2
title: "Validation Gate"
status: "pending"
skills_required: ["run-tests"]
skills_optional: []
estimated_files: 0
---

# Validation Gate

## Objective

Confirm that all cross-references now point to the new `.github/orchestration/scripts/` paths, no stale `src/` references remain in agent/instruction/skill files, the migrated test suite passes, and the pipeline CLI executes end-to-end at the new location. This is a **read-only validation task** — no files may be created or modified.

## Context

Phase 3 Task 1 replaced all 15 stale `src/` path references across 4 files (`.github/agents/orchestrator.agent.md`, `.github/agents/tactical-planner.agent.md`, `.github/instructions/state-management.instructions.md`, `.github/skills/triage-report/SKILL.md`) with their `.github/orchestration/scripts/` equivalents. The code review confirmed all 15 replacements were applied correctly with zero issues. This task now performs independent end-to-end validation to confirm the cutover is complete and the pipeline operates correctly using the new paths.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| *(none)* | — | This is a validation-only task. No files are created or modified. |

## Implementation Steps

1. **Validate state script is callable at new path**: Run `node .github/orchestration/scripts/validate-state.js --current .github/projects/ORCHESTRATION-REORG/state.json --proposed .github/projects/ORCHESTRATION-REORG/state.json` (passing the same file as both `--current` and `--proposed`). Confirm exit code 0 and JSON output contains `"valid": true`.

2. **Run validate-orchestration**: Run `node .github/skills/validate-orchestration/scripts/validate-orchestration.js`. Confirm exit code 0 and output reports zero errors. Record the full output.

3. **Grep for stale `src/next-action.js` pattern**: Search all files matching `.github/agents/*.agent.md`, `.github/instructions/*.instructions.md`, and `.github/skills/*/SKILL.md` for the literal string `src/next-action.js`. Confirm exactly **0 matches**. Record the grep command and result.

4. **Grep for stale `src/validate-state.js` pattern**: Search the same file set for the literal string `src/validate-state.js`. Confirm exactly **0 matches**. Record the grep command and result.

5. **Grep for stale `src/triage.js` pattern**: Search the same file set for the literal string `src/triage.js`. Confirm exactly **0 matches**. Record the grep command and result.

6. **Run the migrated test suite**: Run `node --test .github/orchestration/scripts/tests/*.test.js`. Confirm all tests pass (expect 307/307). Record the pass/fail/total counts from test runner output.

7. **Run pipeline CLI at new path**: Run `node .github/orchestration/scripts/next-action.js --state .github/projects/ORCHESTRATION-REORG/state.json --config .github/orchestration.yml`. Confirm exit code 0 and the output is valid JSON (parseable via `JSON.parse`). Record the JSON output.

8. **Compile results**: Summarize all 7 checks in the task report with pass/fail status for each.

## Contracts & Interfaces

### validate-state.js CLI Contract

```
node .github/orchestration/scripts/validate-state.js --current <path> --proposed <path>
```

**Output** (stdout, JSON):
```json
{ "valid": true, "invariants_checked": 15 }
```
Exit code: `0` on success, `1` on validation failure.

### validate-orchestration.js CLI Contract

```
node .github/skills/validate-orchestration/scripts/validate-orchestration.js
```

**Output**: Text report. Exit code: `0` if zero errors, `1` if errors found.

### next-action.js CLI Contract

```
node .github/orchestration/scripts/next-action.js --state <state.json> --config <orchestration.yml>
```

**Output** (stdout, JSON):
```json
{ "action": "<action-name>", ... }
```
Exit code: `0` on success.

### Stale Pattern Grep Scope

Search these file globs for each pattern:
- `.github/agents/*.agent.md`
- `.github/instructions/*.instructions.md`
- `.github/skills/*/SKILL.md`

Do **NOT** search `.github/projects/**` — those are frozen artifacts that legitimately contain old paths in historical documents.

## Styles & Design Tokens

*(Not applicable — no UI components in this task.)*

## Test Requirements

- [ ] `validate-state.js` at new path returns `{ "valid": true }` with exit code 0
- [ ] `validate-orchestration.js` reports zero errors with exit code 0
- [ ] Grep for `src/next-action.js` across agent/instruction/skill files returns 0 matches
- [ ] Grep for `src/validate-state.js` across agent/instruction/skill files returns 0 matches
- [ ] Grep for `src/triage.js` across agent/instruction/skill files returns 0 matches
- [ ] Migrated test suite passes 307/307 (or all tests) with exit code 0
- [ ] `next-action.js` at new path returns valid JSON with exit code 0

## Acceptance Criteria

- [ ] validate-orchestration reports zero errors
- [ ] Stale-path grep returns 0 matches for all 3 patterns (`src/next-action.js`, `src/validate-state.js`, `src/triage.js`) in agent/instruction/skill files
- [ ] Migrated test suite passes (307/307 or all tests)
- [ ] Pipeline CLI (`next-action.js` at new path) executes successfully and returns valid JSON
- [ ] No files were modified by this task (read-only validation — diff must be empty)

## Constraints

- **Do NOT modify any files** — this task is read-only validation only
- **Do NOT create any new files** (other than the task report)
- **Do NOT search `.github/projects/`** for stale patterns — those are frozen historical artifacts
- **Do NOT modify `state.json`** — that is the Tactical Planner's responsibility after this task completes
- **If any check fails**, report the failure clearly in the task report with exact output — do NOT attempt to fix it
