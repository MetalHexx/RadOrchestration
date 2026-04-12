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

## Phase Goal

{1-2 sentences. What this phase delivers when complete.}

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan]({path}) | Phase {PHASE-NUMBER} scope and exit criteria |
| [Architecture]({path}) | {Specific sections referenced} |
| [Design]({path}) | {Specific sections referenced, if applicable} |
| [Previous Phase Report]({path}) | {What carried forward, if applicable} |

## Task Outline

| # | Task | Dependencies | Est. Files |
|---|------|-------------|------------|
| T1 | {Title} | — | {NUMBER} |
| T2 | {Title} | T1 | {NUMBER} |
| T3 | {Title} | T1 | {NUMBER} |
| T4 | {Title} | T2, T3 | {NUMBER} |

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

## Known Risks for This Phase

- {Risk 1}
