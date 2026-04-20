---
project: "{PROJECT-NAME}"
phase: {PHASE-NUMBER}
title: "{PHASE-TITLE}"
status: "complete|partial|failed"
tasks_completed: {NUMBER}
tasks_total: {NUMBER}
author: "planner-agent"
created: "{ISO-DATE}"
---

# Phase {PHASE-NUMBER} Report: {PHASE-TITLE}

## Summary

{2-3 sentences. What was accomplished in this phase.}

## Task Results

| # | Task | Status | Retries | Key Outcome |
|---|------|--------|---------|-------------|
| T1 | {Title} | ✅ Complete | 0 | {One-line summary} |
| T2 | {Title} | ✅ Complete | 1 | {One-line summary} |
| T3 | {Title} | ⚠️ Partial | 2 | {One-line summary} |

## Exit Criteria Assessment

| # | Criterion | Result |
|---|-----------|--------|
| 1 | {From phase plan} | ✅ Met |
| 2 | {From phase plan} | ✅ Met |
| 3 | All tests pass | ✅ Met |
| 4 | Build passes | ✅ Met |

## Files Changed (Phase Total)

| Action | Count | Key Files |
|--------|-------|-----------|
| Created | {NUMBER} | `{path}`, ... |
| Modified | {NUMBER} | `{path}`, ... |

## Issues & Resolutions

| Issue | Severity | Task | Resolution |
|-------|----------|------|------------|
| {Issue} | minor | T2 | Resolved via retry |

## Carry-Forward Items

{Items the next phase must address. Empty if none.}

- {Item 1}

## Master Plan Adjustment Recommendations

{Does the Planner recommend adjusting the master plan based on what was learned? Empty if none.}

- {Recommendation 1}
