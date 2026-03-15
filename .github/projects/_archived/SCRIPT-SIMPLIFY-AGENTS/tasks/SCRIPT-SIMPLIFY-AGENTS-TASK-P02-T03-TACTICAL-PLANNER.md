---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
task: 3
title: "Tactical Planner Agent Rewrite"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Tactical Planner Agent Rewrite

## Objective

Rewrite `.github/agents/tactical-planner.agent.md` to a pure planning agent with 3 modes (Phase Plan, Task Handoff, Phase Report). Remove all state-write responsibilities, triage invocation, `STATUS.md` references, and the `execute` tool — the pipeline script now handles all state mutations, validation, and triage.

## Context

The orchestration system has been refactored so that a unified pipeline script (`pipeline.js`) handles all state mutations, validation, triage, and next-action resolution. The Tactical Planner no longer writes `state.json` or `STATUS.md`, no longer calls `validate-state.js` or `triage.js`, and no longer initializes projects. Instead, triage outcomes (`review_action`, `phase_review_action`) are pre-computed by the pipeline script and stored in `state.json` — the Tactical Planner reads these values to make planning decisions. The Orchestrator agent was already rewritten (T02) to an event-driven controller with an 18-action table and `pipeline.js` calls.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/tactical-planner.agent.md` | Full content replacement — rewrite from 5-mode state-writer to 3-mode pure planner |

## Implementation Steps

1. **Replace the frontmatter**: Set `name: Tactical Planner`, update `description` to "Plan phase execution, create task handoffs, and generate phase reports. Use when breaking phases into tasks, creating task handoffs for the Coder, or generating phase reports after task completion.", set `tools: [read, search, edit, todo]` (remove `execute`), keep `agents: []`.

2. **Replace the opening section**: Change the intro paragraph to describe a pure planning agent. Remove "manage project state" and "sole writer of state.json and STATUS.md" language. State that the pipeline script handles all state mutations.

3. **Rewrite "Role & Constraints"**:
   - **What you do**: Create Phase Plan documents, create Task Handoff documents (normal and corrective), generate Phase Report documents, enforce scope guards (read-only — flag violations but don't halt the state yourself).
   - **What you do NOT do**: Write source code or run tests, review code, make product/design/architecture decisions, spawn other agents, write `state.json` (pipeline script does this), call `validate-state.js` / `triage.js` / `pipeline.js`.
   - **Write access**: Phase Plans, Task Handoffs, Phase Reports — project docs ONLY. Remove state.json and STATUS.md from write access.

4. **Write Mode 1: Create Phase Plan** (formerly Mode 3):
   - Inputs: Master Plan (phase outline), Architecture (module map, contracts), Design (if applicable), `state.json` (read-only — current state, limits).
   - Read previous Phase Report (if not first phase) for carry-forward items.
   - **Prior Context routing**: Read `phase_review_action` from `state.json` for the current phase. Route using this table:

     | `phase_review_action` value | What to produce |
     |-----------------------------|-----------------|
     | `"advance"` or `null` (no review) | Normal Phase Plan for the next phase |
     | `"advance"` (some exit criteria unmet) | Phase Plan with explicit carry-forward task section |
     | `"corrective_tasks_issued"` | Phase Plan opening with corrective tasks addressing phase review Cross-Task Issues |
     | `"halted"` | DO NOT produce a Phase Plan — inform Orchestrator the pipeline is halted |

   - Break the phase into tasks (each achievable in one Coder session).
   - Map dependencies, define execution order, set exit criteria.
   - Use the `create-phase-plan` skill to produce the document.
   - Save to `{PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}.md`.

5. **Write Mode 2: Create Task Handoff** (formerly Mode 4):
   - Inputs: Phase Plan (task outline, dependencies), Architecture (contracts, interfaces), Design (if UI task), previous Task Report(s) for dependent tasks.
   - **Prior Context routing**: Read `review_action` from `state.json` for the most recently completed task. Route using this table:

     | `review_action` value | What to produce |
     |-----------------------|-----------------|
     | `"advanced"` / `"advance"` | Normal Task Handoff; include carry-forward items in context |
     | `"corrective_task_issued"` | Corrective Task Handoff; inline Issues from Code Review; include original acceptance criteria |
     | `"halted"` | DO NOT produce a Task Handoff — inform Orchestrator the pipeline is halted |
     | `null` (no review doc) | Normal Task Handoff; include Task Report Recommendations in context |

   - Write a self-contained handoff with: Objective, Context, File Targets, Implementation Steps, inlined Contracts, inlined Design Tokens, Test Requirements, Acceptance Criteria, Constraints.
   - Use the `create-task-handoff` skill to produce the document.
   - Save to `{PROJECT-DIR}/tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md`.

6. **Write Mode 3: Generate Phase Report** (formerly Mode 5):
   - Inputs: Phase Plan (exit criteria), all Task Reports for this phase, all Code Reviews for this phase, `state.json` (read-only — retry counts, error aggregation).
   - Summarize accomplishments, aggregate task results, assess exit criteria, aggregate files changed, document issues, identify carry-forward items.
   - Use the `generate-phase-report` skill to produce the document.
   - Save to `{PROJECT-DIR}/reports/{NAME}-PHASE-REPORT-P{NN}.md`.

7. **Write the Skills section**: List exactly 3 skills: `create-phase-plan`, `create-task-handoff`, `generate-phase-report`. Do NOT include `triage-report`.

8. **Write the Output Contract table**: List 3 document types only: Phase Plan, Task Handoff, Phase Report. Do NOT include `state.json` or `STATUS.md`.

9. **Write Quality Standards**: Keep "Task handoffs are self-contained", "Carry-forward items are concrete", "Inline everything in handoffs". Remove any reference to state consistency or limit enforcement via state writes.

10. **Verify removals**: Ensure zero occurrences across the entire file of: `STATUS.md`, `validate-state.js`, `triage.js`, `state.json.proposed`, `execute` (as a tool), sole writer, Mode 1: Initialize, Mode 2: Update State, `triage-report` skill.

## Contracts & Interfaces

### Frontmatter (chatagent format)

```yaml
---
name: Tactical Planner
description: "Plan phase execution, create task handoffs, and generate phase reports. Use when breaking phases into tasks, creating task handoffs for the Coder, or generating phase reports after task completion."
argument-hint: "Provide the project name, current mode (phase-plan/task-handoff/phase-report), and relevant file paths."
tools:
  - read
  - search
  - edit
  - todo
agents: []
---
```

### Prior Context Routing — Phase Plan (Mode 1)

The Tactical Planner reads `state.json → execution.phases[current].phase_review_action` and routes:

| `phase_review_action` | Routing |
|------------------------|---------|
| `null` | Normal Phase Plan |
| `"advance"` | Normal Phase Plan (may include carry-forward) |
| `"corrective_tasks_issued"` | Phase Plan with corrective tasks first |
| `"halted"` | Do not produce Phase Plan |

### Prior Context Routing — Task Handoff (Mode 2)

The Tactical Planner reads `state.json → execution.phases[current].tasks[previous].review_action` and routes:

| `review_action` | Routing |
|-----------------|---------|
| `null` | Normal Task Handoff |
| `"advanced"` / `"advance"` | Normal Task Handoff (carry-forward items in context) |
| `"corrective_task_issued"` | Corrective Task Handoff |
| `"halted"` | Do not produce Task Handoff |

### Output Contract

| Document | Path | Format |
|----------|------|--------|
| Phase Plan | `{PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}.md` | Markdown per template |
| Task Handoff | `{PROJECT-DIR}/tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md` | Markdown per template |
| Phase Report | `{PROJECT-DIR}/reports/{NAME}-PHASE-REPORT-P{NN}.md` | Markdown per template |

## Styles & Design Tokens

*Not applicable — this is a Markdown agent definition file, not a UI component.*

## Test Requirements

- [ ] Verify the file is valid chatagent format (frontmatter parses, has required fields)
- [ ] `grep -c "STATUS.md" tactical-planner.agent.md` returns 0
- [ ] `grep -c "validate-state" tactical-planner.agent.md` returns 0
- [ ] `grep -c "triage.js" tactical-planner.agent.md` returns 0
- [ ] `grep -c "state.json.proposed" tactical-planner.agent.md` returns 0
- [ ] `grep -c "triage-report" tactical-planner.agent.md` returns 0
- [ ] `grep -c "sole writer" tactical-planner.agent.md` returns 0 (case-insensitive)
- [ ] `grep -c "Mode 1: Initialize" tactical-planner.agent.md` returns 0
- [ ] `grep -c "Mode 2: Update State" tactical-planner.agent.md` returns 0
- [ ] Tools list in frontmatter contains exactly `[read, search, edit, todo]` — no `execute`
- [ ] File contains exactly 3 modes (Mode 1: Create Phase Plan, Mode 2: Create Task Handoff, Mode 3: Generate Phase Report)
- [ ] Each mode contains a "Prior Context" routing table
- [ ] All 8 existing script test suites still pass (no regressions)

## Acceptance Criteria

- [ ] Tactical Planner agent has exactly 3 modes: Phase Plan, Task Handoff, Phase Report
- [ ] Frontmatter `tools` list is `[read, search, edit, todo]` — `execute` is not present
- [ ] Zero references to `STATUS.md` anywhere in the file
- [ ] Zero references to `validate-state.js` anywhere in the file
- [ ] Zero references to `triage.js` anywhere in the file
- [ ] Zero references to `state.json.proposed` or proposed-state writing workflow
- [ ] No "sole writer" language for `state.json` or `STATUS.md`
- [ ] No `triage-report` skill reference
- [ ] No Mode 1 (Initialize Project) content
- [ ] No Mode 2 (Update State) content
- [ ] Each mode has a Prior Context routing table reading computed fields from `state.json`
- [ ] Skills section lists exactly: `create-phase-plan`, `create-task-handoff`, `generate-phase-report`
- [ ] Output Contract table has 3 rows (Phase Plan, Task Handoff, Phase Report) — no `state.json`, no `STATUS.md`
- [ ] `state.json` is referenced ONLY as a read-only input for planning decisions
- [ ] All 8 existing script test suites pass (0 regressions)
- [ ] Build check passes (Markdown lints clean)

## Constraints

- Do NOT add any new tools — the tool list is exactly `[read, search, edit, todo]`
- Do NOT reference the pipeline script (`pipeline.js`) as something the Tactical Planner calls — the planner never calls scripts
- Do NOT include any state-write instructions (no `state.json` writing, no `writeState`, no `proposed` files)
- Do NOT include any `STATUS.md` generation or update instructions
- Do NOT reference `triage.js`, `validate-state.js`, or `next-action.js`
- Do NOT reference the `triage-report` skill
- Do NOT modify any other files — only `.github/agents/tactical-planner.agent.md`
- KEEP the corrective handoff pattern — but frame it as reading `review_action` from `state.json`, not running triage yourself
- KEEP scope guard awareness — but frame it as "verify limits from `state.json`" not "enforce via state writes"
