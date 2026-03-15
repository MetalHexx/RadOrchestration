---
project: "ORCHESTRATION-REORG"
phase: 2
task: 4
title: "Validation Gate"
status: "pending"
skills_required: ["testing", "validation"]
skills_optional: []
estimated_files: 0
---

# Validation Gate — Phase 2 Test Suite Migration

## Objective

Verify all 18 migrated test files pass at `.github/orchestration/scripts/tests/` with zero failures, confirm no stale path patterns remain in migrated files, and confirm original `tests/` files are untouched and still functional.

## Context

Phase 2 migrated 18 test files from `tests/` to `.github/orchestration/scripts/tests/` across three tasks: T01 migrated 7 Family A (script-targeting) tests, T02 migrated 5 Family B simple (validator-targeting) tests, and T03 migrated 6 Family B mock-pattern (dynamic require) tests. All three tasks passed individual code reviews confirming correct path transformations. This task is the final validation gate before the phase can close.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| VERIFY | `.github/orchestration/scripts/tests/*.test.js` | All 18 test files — read-only verification, no modifications |
| VERIFY | `tests/*.test.js` | All 18 original test files — confirm untouched |

**No files are created or modified in this task.** This is a verification-only task.

## Implementation Steps

1. **Count migrated test files** — Run `Get-ChildItem .github/orchestration/scripts/tests/*.test.js | Measure-Object` and confirm the count is exactly **18**.

2. **List all 18 test file names** — Confirm this exact set exists at `.github/orchestration/scripts/tests/`:
   - `agents.test.js`
   - `config.test.js`
   - `constants.test.js`
   - `cross-refs.test.js`
   - `frontmatter.test.js`
   - `fs-helpers.test.js`
   - `instructions.test.js`
   - `next-action.test.js`
   - `prompts.test.js`
   - `reporter.test.js`
   - `resolver.test.js`
   - `skills.test.js`
   - `state-validator.test.js`
   - `structure.test.js`
   - `triage-engine.test.js`
   - `triage.test.js`
   - `validate-state.test.js`
   - `yaml-parser.test.js`

3. **Run ALL 18 tests at new locations in a single command**:
   ```powershell
   node --test .github/orchestration/scripts/tests/*.test.js
   ```
   Expected: **All tests pass, 0 failures.** Record the total test count and pass/fail breakdown.

4. **If any failures in step 3**, run failing files individually to capture per-file error output:
   ```powershell
   node --test .github/orchestration/scripts/tests/<failing-file>.test.js
   ```
   Record each failure with file name, test name, and error message.

5. **Stale path grep — `../src/` pattern** — Verify no old Family A path patterns remain in migrated files:
   ```powershell
   Select-String -Path ".github/orchestration/scripts/tests/*.test.js" -Pattern "require\(.*'\.\./src/" | Format-Table -AutoSize
   ```
   Expected: **0 matches.** All `../src/` references should have been rewritten to `../` in T01.

6. **Stale path grep — `../.github/skills/` pattern** — Verify no old Family B path patterns remain in migrated files:
   ```powershell
   Select-String -Path ".github/orchestration/scripts/tests/*.test.js" -Pattern "require.*'\.\./\.github/skills/" | Format-Table -AutoSize
   ```
   Expected: **0 matches.** All `../.github/skills/` references should have been rewritten to `../../../skills/` in T02 and T03.

7. **Stale path grep — `require.resolve` variant** — Also check `require.resolve()` calls for the same stale patterns:
   ```powershell
   Select-String -Path ".github/orchestration/scripts/tests/*.test.js" -Pattern "require\.resolve\(.*'\.\./\.github/skills/" | Format-Table -AutoSize
   ```
   Expected: **0 matches.**

8. **Original integrity check** — Verify original test files are untouched:
   ```powershell
   git diff --stat tests/
   git status tests/
   ```
   Expected: **Empty output** — no changes to any file in `tests/`.

9. **Run originals to confirm they still pass**:
   ```powershell
   node --test tests/*.test.js
   ```
   Expected: **All original tests still pass**, confirming no accidental edits.

10. **Compile results** — Produce the task report with:
    - File count (must be 18)
    - Full test run results (pass/fail per file + totals)
    - Stale path grep results (must be 0 for all three checks)
    - Original integrity status (must be clean)
    - Original test run results (must all pass)

## Contracts & Interfaces

No contracts or interfaces are relevant to this verification-only task.

## Styles & Design Tokens

Not applicable — no UI work.

## Test Requirements

- [ ] All 18 test files at `.github/orchestration/scripts/tests/` execute without errors via `node --test`
- [ ] Combined test run (`node --test .github/orchestration/scripts/tests/*.test.js`) reports 0 failures
- [ ] Each individual test file produces a PASS result

### Expected Test Counts by File (from prior code reviews)

| File | Family | Expected Tests |
|------|--------|---------------|
| `constants.test.js` | A | 29 |
| `next-action.test.js` | A | 13 |
| `resolver.test.js` | A | 48 |
| `state-validator.test.js` | A | 48 |
| `triage-engine.test.js` | A | 44 |
| `triage.test.js` | A | 7 |
| `validate-state.test.js` | A | 12 |
| `frontmatter.test.js` | B-simple | 15 |
| `fs-helpers.test.js` | B-simple | 21 |
| `reporter.test.js` | B-simple | 75 |
| `structure.test.js` | B-simple | 9 |
| `yaml-parser.test.js` | B-simple | 22 |
| `agents.test.js` | B-mock | 20 |
| `config.test.js` | B-mock | 32 |
| `cross-refs.test.js` | B-mock | 20 |
| `instructions.test.js` | B-mock | 13 |
| `prompts.test.js` | B-mock | 19 |
| `skills.test.js` | B-mock | 25 |
| **Total** | | **472** |

## Acceptance Criteria

- [ ] Exactly 18 `.test.js` files exist in `.github/orchestration/scripts/tests/`
- [ ] All 18 tests pass at `.github/orchestration/scripts/tests/` with zero failures (expected ~472 individual tests)
- [ ] All `require()` paths (static and dynamic) resolve correctly at new locations
- [ ] Zero occurrences of `../src/` in `require()` calls in migrated test files
- [ ] Zero occurrences of `../.github/skills/` in `require()` or `require.resolve()` calls in migrated test files
- [ ] Original `tests/` files remain untouched (`git diff --stat tests/` returns empty)
- [ ] Original tests still pass (`node --test tests/*.test.js` succeeds)
- [ ] All tests pass
- [ ] Build succeeds (N/A — no build step for this validation task)
- [ ] No lint errors (N/A — no code changes)

## Constraints

- Do NOT modify any file — this task is verification-only
- Do NOT delete any original test files in `tests/`
- Do NOT delete or modify any migrated test files in `.github/orchestration/scripts/tests/`
- Do NOT skip individual test failures — every failure must be reported with full details
- If ANY test fails, report all failures in the task report; do not stop at the first failure
