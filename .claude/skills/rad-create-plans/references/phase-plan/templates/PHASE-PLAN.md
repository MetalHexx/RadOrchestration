---
project: "{PROJECT-NAME}"
phase: {PHASE-NUMBER}
title: "{PHASE-TITLE}"
status: "active|complete|halted"
tasks:
  - id: "{TASK-ID}"
    title: "{TASK-TITLE}"
author: "tactical-planner-agent"
created: "{ISO-DATE}"
---

# Phase {PHASE-NUMBER}: {PHASE-TITLE}

## Phase Objective

{1-2 sentences. Expand the Master Plan's phase Objective with what this phase depends on from prior phases (if any) and what it enables for subsequent phases (if any).}

## Task Outline

| # | Task | Scope | Dependencies | Est. Files |
|---|------|-------|-------------|------------|
| T1 | {Title} | {FR-N, AD-N, Design: Section} | — | {NUMBER} |
| T2 | {Title} | {FR-N, NFR-N} | T1 | {NUMBER} |
| T3 | {Title} | {AD-N, Research: Finding} | T1 | {NUMBER} |
| T4 | {Title} | {FR-N, AD-N} | T2, T3 | {NUMBER} |

## Execution Order

```
T1 (foundation)
 ├→ T2 (depends on T1)
 └→ T3 (depends on T1)  ← parallel-ready
T4 (depends on T2, T3)
```

**Sequential execution order**: T1 → T2 → T3 → T4

*Note: T2 and T3 are parallel-ready (no mutual dependency) but will execute sequentially in v1.*

## Phase Exit Criteria

- [ ] {Criterion 1 — from Master Plan}
- [ ] {Criterion 2}
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed
- [ ] Build passes
- [ ] All tests pass
