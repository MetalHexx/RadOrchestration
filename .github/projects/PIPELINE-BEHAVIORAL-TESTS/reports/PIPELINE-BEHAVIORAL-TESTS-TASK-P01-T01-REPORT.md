---
project: "PIPELINE-BEHAVIORAL-TESTS"
phase: 1
task: 1
title: "Change readDocument to null-return contract"
status: "complete"
has_deviations: false
deviation_type: "none"
files_changed: 2
tests_written: 0
tests_passing: 18
build_status: "pass"
---

# Task Report: Change readDocument to null-return contract

## Summary

Changed `readDocument` in `state-io.js` from throwing errors on missing/unreadable files to returning `null`. Updated the corresponding test in `state-io.test.js` to assert `null` return instead of `throws`. All 18 state-io tests and all 61 pipeline-engine tests pass.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `.github/orchestration/scripts/lib/state-io.js` | +4 -5 | Replaced two `throw` statements with `return null`; updated JSDoc to remove `@throws` and document `null` return |
| MODIFIED | `.github/orchestration/scripts/tests/state-io.test.js` | +4 -7 | Replaced `assert.throws` test with `assert.strictEqual(result, null)` test |

## Tests

| Test | File | Status |
|------|------|--------|
| returns parsed state when state.json exists | `state-io.test.js` | ✅ Pass |
| returns null when state.json does not exist | `state-io.test.js` | ✅ Pass |
| throws when state.json contains invalid JSON | `state-io.test.js` | ✅ Pass |
| writes state.json with 2-space indented JSON and trailing newline | `state-io.test.js` | ✅ Pass |
| updates state.project.updated to a valid ISO 8601 timestamp | `state-io.test.js` | ✅ Pass |
| written file can be read back and parsed as valid JSON matching input | `state-io.test.js` | ✅ Pass |
| overwrites existing state.json content | `state-io.test.js` | ✅ Pass |
| reads and parses config from an explicit path when file exists | `state-io.test.js` | ✅ Pass |
| returns DEFAULT_CONFIG when config path is omitted and auto-discovery fails | `state-io.test.js` | ✅ Pass |
| returns DEFAULT_CONFIG when explicit path does not exist | `state-io.test.js` | ✅ Pass |
| merges parsed YAML config with defaults — missing keys filled from defaults | `state-io.test.js` | ✅ Pass |
| returns DEFAULT_CONFIG when YAML file is empty or unparseable | `state-io.test.js` | ✅ Pass |
| returns { frontmatter, body } for a markdown file with valid YAML frontmatter | `state-io.test.js` | ✅ Pass |
| returns { frontmatter: null, body } for a markdown file without frontmatter | `state-io.test.js` | ✅ Pass |
| returns null when file does not exist | `state-io.test.js` | ✅ Pass |
| creates projectDir/, phases/, tasks/, reports/ when none exist | `state-io.test.js` | ✅ Pass |
| is idempotent — calling twice does not throw or change structure | `state-io.test.js` | ✅ Pass |
| all four directories exist after the call | `state-io.test.js` | ✅ Pass |

**Test summary**: 18/18 passing (state-io.test.js), 61/61 passing (pipeline-engine.test.js)

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `readDocument` returns `null` when the file does not exist (not throws) | ✅ Met |
| 2 | `readDocument` returns `null` when the file exists but cannot be read (not throws) | ✅ Met |
| 3 | `readDocument` still returns `{ frontmatter, body }` for valid files (no regression) | ✅ Met |
| 4 | The `state-io.test.js` test for missing files asserts `null` return (not `throws`) | ✅ Met |
| 5 | All `state-io.test.js` tests pass | ✅ Met |
| 6 | All `pipeline-engine.test.js` tests pass | ✅ Met |
| 7 | No lint errors | ✅ Met |

## Build & Lint

- **Build**: ✅ Pass
- **Lint**: ✅ Pass — 0 errors
