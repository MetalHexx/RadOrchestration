---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 3
task: 1
title: "Delete Standalone Scripts & Tests"
status: "pending"
skills_required: []
skills_optional: ["run-tests"]
estimated_files: 6
---

# Delete Standalone Scripts & Tests

## Objective

Delete the 3 deprecated standalone CLI scripts (`next-action.js`, `triage.js`, `validate-state.js`) and their 3 corresponding test files. Then verify all 8 preserved test suites still pass.

## Context

Phase 1 introduced `pipeline.js` which internalizes all state mutation, validation, triage, and next-action resolution into a single CLI call. The 3 standalone scripts are now dead code — no module `require()`s them. The `lib/` modules they formerly wrapped (`constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`) are preserved and imported by the new pipeline modules (`pipeline-engine.js`, `mutations.js`). This task performs the deletion; no code needs to be written.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| DELETE | `.github/orchestration/scripts/next-action.js` | Standalone next-action CLI — replaced by `pipeline.js` |
| DELETE | `.github/orchestration/scripts/triage.js` | Standalone triage CLI — replaced by `pipeline.js` |
| DELETE | `.github/orchestration/scripts/validate-state.js` | Standalone validate-state CLI — replaced by `pipeline.js` |
| DELETE | `.github/orchestration/scripts/tests/next-action.test.js` | Tests for deleted `next-action.js` |
| DELETE | `.github/orchestration/scripts/tests/triage.test.js` | Tests for deleted `triage.js` |
| DELETE | `.github/orchestration/scripts/tests/validate-state.test.js` | Tests for deleted `validate-state.js` |

## Implementation Steps

1. **Delete** `.github/orchestration/scripts/next-action.js`
2. **Delete** `.github/orchestration/scripts/triage.js`
3. **Delete** `.github/orchestration/scripts/validate-state.js`
4. **Delete** `.github/orchestration/scripts/tests/next-action.test.js`
5. **Delete** `.github/orchestration/scripts/tests/triage.test.js`
6. **Delete** `.github/orchestration/scripts/tests/validate-state.test.js`
7. **Verify no dangling `require()` calls** — run a quick search across `.github/orchestration/scripts/` for `require('./next-action')`, `require('./triage')`, `require('./validate-state')`, `require('../next-action')`, `require('../triage')`, `require('../validate-state')`. Expect zero matches in any non-deleted file. If any match is found in a preserved file, stop and report in the task report — do NOT modify the importing file (that is out of scope).
8. **Run the 4 preserved lib test suites** to confirm no regression:
   ```
   node --test .github/orchestration/scripts/tests/constants.test.js .github/orchestration/scripts/tests/resolver.test.js .github/orchestration/scripts/tests/state-validator.test.js .github/orchestration/scripts/tests/triage-engine.test.js
   ```
   All must pass with 0 failures.
9. **Run the 4 new pipeline test suites** to confirm no regression:
   ```
   node --test .github/orchestration/scripts/tests/mutations.test.js .github/orchestration/scripts/tests/pipeline-engine.test.js .github/orchestration/scripts/tests/state-io.test.js .github/orchestration/scripts/tests/pipeline.test.js
   ```
   All must pass with 0 failures.
10. **Confirm the 6 files no longer exist on disk** — verify each deleted path returns "file not found" or equivalent.

## Contracts & Interfaces

No contracts apply — this task only deletes files and runs existing tests.

## Styles & Design Tokens

Not applicable — no UI work.

## Test Requirements

- [ ] The 4 preserved lib test suites pass: `constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`
- [ ] The 4 new pipeline test suites pass: `mutations.test.js`, `pipeline-engine.test.js`, `state-io.test.js`, `pipeline.test.js`
- [ ] No test suite references the deleted scripts via `require()` — the deleted test files were the only consumers

## Acceptance Criteria

- [ ] `.github/orchestration/scripts/next-action.js` does not exist
- [ ] `.github/orchestration/scripts/triage.js` does not exist
- [ ] `.github/orchestration/scripts/validate-state.js` does not exist
- [ ] `.github/orchestration/scripts/tests/next-action.test.js` does not exist
- [ ] `.github/orchestration/scripts/tests/triage.test.js` does not exist
- [ ] `.github/orchestration/scripts/tests/validate-state.test.js` does not exist
- [ ] All 4 preserved lib test suites pass (`node --test` exits 0)
- [ ] All 4 new pipeline test suites pass (`node --test` exits 0)
- [ ] No preserved `.js` file under `.github/orchestration/scripts/` contains a `require()` referencing any of the 3 deleted scripts
- [ ] No files were created or modified — only deletions

## Constraints

- **Do NOT delete any `lib/` files** — `constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js` are preserved and actively used by the pipeline
- **Do NOT delete `pipeline.js`** — it is the replacement for the 3 standalone scripts
- **Do NOT modify any file** — this task is deletion-only; if a dangling reference is found, report it but do not fix it (T04 handles reference sweeps)
- **Do NOT delete any other test file** — only the 3 test files listed above
- **Do NOT update `state.json`** — the pipeline script handles all state mutations
