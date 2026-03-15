---
project: "ORCHESTRATION-REORG"
phase: 2
task: 1
title: "Create Tests Directory & Migrate Family A Tests"
status: "pending"
skills_required: ["file creation", "file copy", "path rewrite"]
skills_optional: []
estimated_files: 7
---

# Create Tests Directory & Migrate Family A Tests

## Objective

Create the target test directory at `.github/orchestration/scripts/tests/` and copy the 7 script-targeting test files ("Family A") into it with corrected `require()` paths. After migration, tests at the new location import from `../` instead of `../src/` because both tests and scripts now live inside `.github/orchestration/scripts/`.

## Context

Phase 1 moved all runtime scripts from `src/` to `.github/orchestration/scripts/` and lib modules to `.github/orchestration/scripts/lib/`. The new directory structure is:

```
.github/orchestration/scripts/
├── next-action.js
├── triage.js
├── validate-state.js
└── lib/
    ├── constants.js
    ├── resolver.js
    ├── state-validator.js
    └── triage-engine.js
```

Tests are being moved to `.github/orchestration/scripts/tests/`. From that location, `../` reaches `.github/orchestration/scripts/` — so `require('../src/<module>')` becomes `require('../<module>')`. Original `tests/` files must remain untouched.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/tests/` | New directory for migrated tests |
| CREATE | `.github/orchestration/scripts/tests/constants.test.js` | Copy from `tests/constants.test.js` with 1 path fix |
| CREATE | `.github/orchestration/scripts/tests/next-action.test.js` | Copy from `tests/next-action.test.js` with 2 path fixes |
| CREATE | `.github/orchestration/scripts/tests/resolver.test.js` | Copy from `tests/resolver.test.js` with 2 path fixes |
| CREATE | `.github/orchestration/scripts/tests/state-validator.test.js` | Copy from `tests/state-validator.test.js` with 1 path fix |
| CREATE | `.github/orchestration/scripts/tests/triage-engine.test.js` | Copy from `tests/triage-engine.test.js` with 2 path fixes |
| CREATE | `.github/orchestration/scripts/tests/triage.test.js` | Copy from `tests/triage.test.js` with 1 path fix |
| CREATE | `.github/orchestration/scripts/tests/validate-state.test.js` | Copy from `tests/validate-state.test.js` with 2 path fixes |

## Implementation Steps

1. **Create the target directory**: `.github/orchestration/scripts/tests/`

2. **For each of the 7 source files listed below**, read the file from `tests/`, apply the exact `require()` transformations specified, and write the result to `.github/orchestration/scripts/tests/`. Do NOT modify any code other than the `require()` path strings.

3. **Apply the transformation pattern**: Every occurrence of `require('../src/` must become `require('../`. This is a simple string replacement: `../src/` → `../` inside require() calls. There are exactly 11 occurrences total across the 7 files — see the table below for the exact locations.

4. **After creating all 7 files**, run a smoke test to verify at least one loads correctly:
   ```
   node --test .github/orchestration/scripts/tests/constants.test.js
   ```

5. **Verify original files are untouched**: Confirm that the original `tests/` directory files have not been modified (do not delete, rename, or edit any file in `tests/`).

## Contracts & Interfaces

Not applicable — this task copies and adjusts test files only. No new interfaces or contracts are introduced.

## Exact `require()` Transformations (11 total)

These are the ONLY changes to make. Each row is one string replacement within the specified file.

### `constants.test.js` (1 change)

| Line | Current | New |
|------|---------|-----|
| — | `require('../src/lib/constants')` | `require('../lib/constants')` |

### `next-action.test.js` (2 changes)

| Line | Current | New |
|------|---------|-----|
| 8 | `require('../src/next-action.js')` | `require('../next-action.js')` |
| 182 | `require('../src/next-action.js')` | `require('../next-action.js')` |

### `resolver.test.js` (2 changes)

| Line | Current | New |
|------|---------|-----|
| 5 | `require('../src/lib/resolver.js')` | `require('../lib/resolver.js')` |
| 6 | `require('../src/lib/constants.js')` | `require('../lib/constants.js')` |

### `state-validator.test.js` (1 change)

| Line | Current | New |
|------|---------|-----|
| 5 | `require('../src/lib/state-validator.js')` | `require('../lib/state-validator.js')` |

### `triage-engine.test.js` (2 changes)

| Line | Current | New |
|------|---------|-----|
| 5 | `require('../src/lib/triage-engine.js')` | `require('../lib/triage-engine.js')` |
| 6 | `require('../src/lib/constants.js')` | `require('../lib/constants.js')` |

### `triage.test.js` (1 change)

| Line | Current | New |
|------|---------|-----|
| 8 | `require('../src/triage')` | `require('../triage')` |

### `validate-state.test.js` (2 changes)

| Line | Current | New |
|------|---------|-----|
| 8 | `require('../src/validate-state.js')` | `require('../validate-state.js')` |
| 169 | `require('../src/validate-state.js')` | `require('../validate-state.js')` |

## Styles & Design Tokens

Not applicable — no UI work in this task.

## Test Requirements

- [ ] Run `node --test .github/orchestration/scripts/tests/constants.test.js` — must exit 0
- [ ] Run `node --test .github/orchestration/scripts/tests/resolver.test.js` — must exit 0
- [ ] Run `node --test .github/orchestration/scripts/tests/triage.test.js` — must exit 0
- [ ] Run `node --test .github/orchestration/scripts/tests/next-action.test.js` — must exit 0
- [ ] Run `node --test .github/orchestration/scripts/tests/validate-state.test.js` — must exit 0
- [ ] Run `node --test .github/orchestration/scripts/tests/state-validator.test.js` — must exit 0
- [ ] Run `node --test .github/orchestration/scripts/tests/triage-engine.test.js` — must exit 0

## Acceptance Criteria

- [ ] Directory `.github/orchestration/scripts/tests/` exists
- [ ] All 7 test files exist at their target locations under `.github/orchestration/scripts/tests/`
- [ ] Exactly 11 `require()` paths updated — every `../src/` replaced with `../` inside require() calls
- [ ] No other code modifications — only the `require()` path strings change
- [ ] Original `tests/` files remain untouched (byte-identical to before)
- [ ] At least 1 Family A test passes at the new location via `node --test` (smoke test)

## Constraints

- Do NOT modify any file in the original `tests/` directory
- Do NOT modify any code other than the `require()` path strings listed above
- Do NOT change `require('node:test')`, `require('node:assert')`, `require('fs')`, `require('path')`, or any other standard library imports — only the `../src/` project imports change
- Do NOT create an index file or barrel export — just copy the 7 test files
- Do NOT rename any test files — keep the original filenames exactly
