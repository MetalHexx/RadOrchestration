---
project: "PIPELINE-HOTFIX"
phase: 3
task: 1
title: "Pipeline Engine Documentation"
status: "complete"
files_changed: 2
tests_written: 0
tests_passing: 0
build_status: "pass"
---

# Task Report: Pipeline Engine Documentation

## Summary

Updated `docs/scripts.md` and `docs/pipeline.md` to document the pipeline engine's internal vs. external action distinction, internal action handling loop, unmapped action guard, master plan pre-read, status normalization, and auto-approve for null/null triage. All content was inserted at the exact locations specified in the handoff without rewriting existing accurate content.

## Files Changed

| Action | Path | Lines | Notes |
|--------|------|-------|-------|
| MODIFIED | `docs/scripts.md` | +52 | Added Type column to all 5 action vocabulary tables, intro paragraph, Internal Action Handling subsection, Unmapped Action Guard subsection |
| MODIFIED | `docs/pipeline.md` | +72 | Added Master Plan Pre-Read, Status Normalization, Auto-Approve, and Internal Action Loop subsections under Pipeline Routing |

## Tests

No test requirements — this is a documentation-only task.

**Test summary**: N/A

## Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `docs/scripts.md` action vocabulary tables include a "Type" column distinguishing internal vs. external actions for all 35 actions | ✅ Met |
| 2 | `docs/scripts.md` contains an "Internal Action Handling" subsection under "Pipeline Internals" documenting `advance_task` and `advance_phase` with the bounded loop (max 2 iterations) | ✅ Met |
| 3 | `docs/scripts.md` contains an "Unmapped Action Guard" subsection documenting the `EXTERNAL_ACTIONS` validation and hard error behavior | ✅ Met |
| 4 | `docs/pipeline.md` contains a "Master Plan Pre-Read" subsection describing `total_phases` extraction from frontmatter, context enrichment, and all 4 error conditions | ✅ Met |
| 5 | `docs/pipeline.md` contains a "Status Normalization" subsection documenting the synonym map (`pass`→`complete`, `fail`→`failed`) and hard error for unknown values | ✅ Met |
| 6 | `docs/pipeline.md` contains an "Auto-Approve" subsection documenting null/null triage handling for both task-level and phase-level, including the report existence requirement | ✅ Met |
| 7 | `docs/pipeline.md` contains an "Internal Action Loop" subsection describing the bounded re-resolve loop (max 2 iterations) handling `advance_task` and `advance_phase` | ✅ Met |
| 8 | Both `advance_task` and `advance_phase` are documented as internally handled actions in both files | ✅ Met |
| 9 | No documentation references prior behavior, migration steps, "before/after" language, or bug fix context | ✅ Met |
| 10 | No references to external planning documents (PRD, Architecture, Design, Master Plan) | ✅ Met |
| 11 | Existing accurate content in both files is preserved (not rewritten) | ✅ Met |
| 12 | New content matches each file's existing heading levels, formatting conventions, and prose style | ✅ Met |

## Build & Lint

- **Build**: N/A — documentation-only task
- **Lint**: N/A — documentation-only task
- **Type check**: N/A — documentation-only task
