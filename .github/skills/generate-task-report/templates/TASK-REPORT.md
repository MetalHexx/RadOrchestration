---
project: "{PROJECT-NAME}"
phase: {PHASE_NUMBER}
task: {TASK_NUMBER}
title: "{TASK-TITLE}"
status: "complete"   # MUST be exactly: complete | partial | failed — no synonyms
files_changed: {NUMBER}
tests_written: {NUMBER}
tests_passing: {NUMBER}
build_status: "pass|fail"
has_deviations: false               # REQUIRED boolean — true if agent deviated from handoff, false otherwise
deviation_type: null                 # REQUIRED string — "minor" | "architectural" | null (null when has_deviations is false)
---

# Task Report: {TASK-TITLE}

## Summary

{2-3 sentences. What was accomplished. Factual, past tense.}

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| CREATED | `{path}` | {N} | {Notes} |
| MODIFIED | `{path}` | +{N} | {Notes} |

## Implementation Notes

{Brief notes on implementation decisions. Only include if the agent deviated from the handoff or made a non-obvious choice. Otherwise omit this section.}

## Tests

| Test | File | Status |
|------|------|--------|
| {Test description} | `{path}` | ✅ Pass |
| {Test description} | `{path}` | ❌ Fail |

**Test summary**: {X}/{Y} passing

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | {Criterion from handoff} | ✅ Met |
| 2 | {Criterion from handoff} | ⚠️ Partial |
| 3 | {Criterion from handoff} | ❌ Not Met |

## Build & Lint

- **Build**: ✅ Pass | ❌ Fail
- **Lint**: ✅ Pass | ❌ Fail — {error count if fail}
- **Type check**: ✅ Pass | ❌ Fail — {error count if fail}

## Issues Encountered

{Only if issues occurred. Otherwise omit entire section.}

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | {Issue} | minor/critical | {Details} |

## Deviations from Handoff

{Only if the agent deviated from the handoff instructions. Otherwise omit.}

| # | Handoff Said | Agent Did | Reason |
|---|-------------|-----------|--------|
| 1 | {Original instruction} | {What was done instead} | {Why} |

## Recommendations for Next Task

{Optional. Only if the agent identified something the Planner should know for subsequent task planning.}

- {Recommendation 1}
