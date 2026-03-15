---
project: "ORCHESTRATION-REORG"
phase: 2
task: 3
title: "Migrate Family B — Mock-Pattern Validator Tests"
status: "complete"
files_changed: 6
tests_written: 0
tests_passing: 129
build_status: "pass"
---

# Task Report: Migrate Family B — Mock-Pattern Validator Tests

## Summary

Copied 6 Family B test files (mock-pattern validator tests) from `tests/` to `.github/orchestration/scripts/tests/`, applying the path replacement `../.github/skills/` → `../../../skills/` to all static `require()` and dynamic `require.resolve()` calls. All 17 expected string replacements were applied across the 6 files. All 129 tests pass at the new location.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| CREATED | `.github/orchestration/scripts/tests/agents.test.js` | 400 | 3 path replacements (lines 18, 19, 49) |
| CREATED | `.github/orchestration/scripts/tests/config.test.js` | 647 | 3 path replacements (lines 15, 16, 45) |
| CREATED | `.github/orchestration/scripts/tests/cross-refs.test.js` | 468 | 2 path replacements (lines 14, 31) |
| CREATED | `.github/orchestration/scripts/tests/instructions.test.js` | 275 | 3 path replacements (lines 16, 17, 46) |
| CREATED | `.github/orchestration/scripts/tests/prompts.test.js` | 359 | 3 path replacements (lines 16, 17, 46) |
| CREATED | `.github/orchestration/scripts/tests/skills.test.js` | 484 | 3 path replacements (lines 19, 20, 46) |

## Path Transformations Applied

### Static `require()` — 6 transformations

| File | Line | Before | After |
|------|------|--------|-------|
| `agents.test.js` | 49 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/agents')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/agents')` |
| `config.test.js` | 45 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/config')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/config')` |
| `cross-refs.test.js` | 31 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/cross-refs')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/cross-refs')` |
| `instructions.test.js` | 46 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/instructions')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/instructions')` |
| `prompts.test.js` | 46 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/prompts')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/prompts')` |
| `skills.test.js` | 46 | `require('../.github/skills/validate-orchestration/scripts/lib/checks/skills')` | `require('../../../skills/validate-orchestration/scripts/lib/checks/skills')` |

### Dynamic `require.resolve()` — 11 transformations

| File | Line | Before | After |
|------|------|--------|-------|
| `agents.test.js` | 18 | `require.resolve('../.github/skills/.../fs-helpers')` | `require.resolve('../../../skills/.../fs-helpers')` |
| `agents.test.js` | 19 | `require.resolve('../.github/skills/.../frontmatter')` | `require.resolve('../../../skills/.../frontmatter')` |
| `config.test.js` | 15 | `require.resolve('../.github/skills/.../fs-helpers')` | `require.resolve('../../../skills/.../fs-helpers')` |
| `config.test.js` | 16 | `require.resolve('../.github/skills/.../yaml-parser')` | `require.resolve('../../../skills/.../yaml-parser')` |
| `cross-refs.test.js` | 14 | `require.resolve('../.github/skills/.../fs-helpers')` | `require.resolve('../../../skills/.../fs-helpers')` |
| `instructions.test.js` | 16 | `require.resolve('../.github/skills/.../fs-helpers')` | `require.resolve('../../../skills/.../fs-helpers')` |
| `instructions.test.js` | 17 | `require.resolve('../.github/skills/.../frontmatter')` | `require.resolve('../../../skills/.../frontmatter')` |
| `prompts.test.js` | 16 | `require.resolve('../.github/skills/.../fs-helpers')` | `require.resolve('../../../skills/.../fs-helpers')` |
| `prompts.test.js` | 17 | `require.resolve('../.github/skills/.../frontmatter')` | `require.resolve('../../../skills/.../frontmatter')` |
| `skills.test.js` | 19 | `require.resolve('../.github/skills/.../fs-helpers')` | `require.resolve('../../../skills/.../fs-helpers')` |
| `skills.test.js` | 20 | `require.resolve('../.github/skills/.../frontmatter')` | `require.resolve('../../../skills/.../frontmatter')` |

**Total: 17 string replacements (6 static + 11 dynamic)** — matches handoff exactly.

## Tests

| Test | File | Status |
|------|------|--------|
| checkAgents (20 tests) | `.github/orchestration/scripts/tests/agents.test.js` | ✅ Pass |
| checkConfig (32 tests) | `.github/orchestration/scripts/tests/config.test.js` | ✅ Pass |
| checkCrossRefs (20 tests) | `.github/orchestration/scripts/tests/cross-refs.test.js` | ✅ Pass |
| checkInstructions (13 tests) | `.github/orchestration/scripts/tests/instructions.test.js` | ✅ Pass |
| checkPrompts (19 tests) | `.github/orchestration/scripts/tests/prompts.test.js` | ✅ Pass |
| checkSkills (25 tests) | `.github/orchestration/scripts/tests/skills.test.js` | ✅ Pass |

**Test summary**: 129/129 passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | All 6 test files exist at `.github/orchestration/scripts/tests/` | ✅ Met |
| 2 | All 6 static `require()` paths updated — `../.github/skills/` → `../../../skills/` | ✅ Met |
| 3 | All 11 dynamic `require.resolve()` paths updated — `../.github/skills/` → `../../../skills/` | ✅ Met |
| 4 | Total of exactly 17 string replacements across all 6 files (6 static + 11 dynamic) | ✅ Met |
| 5 | `require.cache[]` key assignments use variable names (not string literals) — confirmed unchanged | ✅ Met |
| 6 | No test fixture data modified (e.g., `base_path: '.github/projects'` strings remain as-is) | ✅ Met |
| 7 | No other code modifications — only the `require()` and `require.resolve()` path strings change | ✅ Met |
| 8 | Original 6 `tests/` files remain untouched (`git diff` returns empty) | ✅ Met |
| 9 | At least 1 mock-pattern test passes at new location (smoke test) | ✅ Met |
| 10 | All tests pass | ✅ Met |
| 11 | Build succeeds | ✅ Met (no build step for these JS test files) |
| 12 | No lint errors | ✅ Met (no linter configured for test files) |

## Build & Lint

- **Build**: ✅ Pass — N/A for standalone JS test files (no compilation step)
- **Lint**: ✅ Pass — No linter configured for these test files
- **Type check**: ✅ Pass — N/A (plain JS, not TypeScript)

## Verification Summary

- **Old paths remaining**: 0 (verified via grep)
- **Fixture data preserved**: Confirmed `base_path: '.github/projects'` and `applyTo: '.github/projects/**'` strings unchanged in config.test.js, cross-refs.test.js, and instructions.test.js
- **require.cache keys**: All 11 cache key assignments use variable names (`fsHelpersPath`, `frontmatterPath`, `yamlParserPath`) — no string literals
- **Original files**: `git diff` on all 6 source files returns empty — untouched
