---
project: "ORCHESTRATION-REORG"
phase: 1
task: 3
title: "Copy and Update CLI Scripts"
status: "complete"
files_changed: 3
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: Copy and Update CLI Scripts

## Summary

Copied the 3 CLI scripts (`next-action.js`, `triage.js`, `validate-state.js`) from `src/` to `.github/orchestration/scripts/` and updated exactly 5 cross-tree `require()` paths so they resolve correctly from the new location. All `./lib/` relative imports were preserved unchanged. Original `src/` files were verified untouched.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| CREATED | `.github/orchestration/scripts/next-action.js` | 80 | Copy from `src/next-action.js`, 2 require() paths updated |
| CREATED | `.github/orchestration/scripts/triage.js` | 117 | Copy from `src/triage.js`, 2 require() paths updated |
| CREATED | `.github/orchestration/scripts/validate-state.js` | 82 | Copy from `src/validate-state.js`, 1 require() path updated |

## Require() Transformations Applied

| # | File | Before | After |
|---|------|--------|-------|
| 1 | `next-action.js` | `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| 2 | `next-action.js` | `require('../.github/skills/validate-orchestration/scripts/lib/utils/yaml-parser')` | `require('../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')` |
| 3 | `triage.js` | `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |
| 4 | `triage.js` | `require('../.github/skills/validate-orchestration/scripts/lib/utils/frontmatter')` | `require('../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` |
| 5 | `validate-state.js` | `require('../.github/skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` |

## Unchanged Require() Paths Verified

| File | Require Path | Status |
|------|-------------|--------|
| `next-action.js` | `require('./lib/resolver')` | ✅ Unchanged |
| `triage.js` | `require('path')` | ✅ Unchanged |
| `triage.js` | `require('fs')` | ✅ Unchanged |
| `triage.js` | `require('./lib/triage-engine')` | ✅ Unchanged |
| `triage.js` | `require('./lib/constants')` | ✅ Unchanged |
| `validate-state.js` | `require('./lib/state-validator')` | ✅ Unchanged |

## Tests

No new test files were required by the handoff. Verification was performed via diff comparison:

| Test | Method | Status |
|------|--------|--------|
| New `next-action.js` exists at target | File creation confirmed | ✅ Pass |
| New `triage.js` exists at target | File creation confirmed | ✅ Pass |
| New `validate-state.js` exists at target | File creation confirmed | ✅ Pass |
| `next-action.js` has `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | grep verified | ✅ Pass |
| `next-action.js` has `require('../../skills/validate-orchestration/scripts/lib/utils/yaml-parser')` | grep verified | ✅ Pass |
| `next-action.js` has `require('./lib/resolver')` unchanged | grep verified | ✅ Pass |
| `triage.js` has `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | grep verified | ✅ Pass |
| `triage.js` has `require('../../skills/validate-orchestration/scripts/lib/utils/frontmatter')` | grep verified | ✅ Pass |
| `triage.js` has `require('./lib/triage-engine')` unchanged | grep verified | ✅ Pass |
| `triage.js` has `require('./lib/constants')` unchanged | grep verified | ✅ Pass |
| `validate-state.js` has `require('../../skills/validate-orchestration/scripts/lib/utils/fs-helpers')` | grep verified | ✅ Pass |
| `validate-state.js` has `require('./lib/state-validator')` unchanged | grep verified | ✅ Pass |
| Original `src/next-action.js` contains `require('../.github/skills/` | grep verified | ✅ Pass |
| Original `src/triage.js` contains `require('../.github/skills/` | grep verified | ✅ Pass |
| Original `src/validate-state.js` contains `require('../.github/skills/` | grep verified | ✅ Pass |

**Test summary**: 15/15 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | All 3 CLI scripts exist at `.github/orchestration/scripts/` | ✅ Met |
| 2 | Exactly 5 `require()` paths updated as specified (2 in next-action.js, 2 in triage.js, 1 in validate-state.js) | ✅ Met |
| 3 | All `./lib/` relative imports remain unchanged in every target file | ✅ Met |
| 4 | No other code modifications — only the `require()` path strings change between source and target | ✅ Met |
| 5 | Original `src/next-action.js` remains untouched | ✅ Met |
| 6 | Original `src/triage.js` remains untouched | ✅ Met |
| 7 | Original `src/validate-state.js` remains untouched | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass (no build step required — plain JS files with no compilation)
- **Lint**: N/A — no lint configuration specified in handoff
- **Type check**: N/A — plain JavaScript, no TypeScript
