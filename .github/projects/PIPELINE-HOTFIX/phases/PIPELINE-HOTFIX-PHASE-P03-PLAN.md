---
project: "PIPELINE-HOTFIX"
phase: 3
title: "Documentation & Instruction File Updates"
status: "active"
total_tasks: 5
author: "tactical-planner-agent"
created: "2026-03-14T00:00:00Z"
---

# Phase 3: Documentation & Instruction File Updates

## Phase Goal

Update all documentation, instruction files, and skill instructions to accurately describe the system after all pipeline engine fixes, skill additions, and agent updates from Phases 1 and 2. Every update describes current system behavior only — no references to prior behavior, migration steps, or before/after language.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-MASTER-PLAN.md) | Phase 3 scope (9 files), exit criteria, documentation constraint |
| [Architecture](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-ARCHITECTURE.md) | EXTERNAL_ACTIONS set (18 actions), internal action handling pattern, module impact map, log-error skill structure |
| [Design](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-DESIGN.md) | Data flows DF-1 through DF-4, ERROR-LOG.md document structure (EL-1), state lifecycle diagrams |
| [PRD](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-PRD.md) | FR-1 through FR-19 requirement descriptions, G5 documentation goal |
| [Phase 2 Report](.github/projects/PIPELINE-HOTFIX/phases/PIPELINE-HOTFIX-PHASE-P02-REPORT.md) | No carry-forward items; all Phase 2 scope complete |
| [Phase 2 Review](.github/projects/PIPELINE-HOTFIX/phases/PIPELINE-HOTFIX-PHASE-P02-REVIEW.md) | Recommendations: add `log-error` to docs/skills.md and docs/agents.md; add `ERROR-LOG.md` as project artifact in 4 files; add ownership row for `ERROR-LOG.md` |

## Prior Context

Phase 2 review verdict: **approved**, action: **advanced**. No carry-forward items. No corrective tasks needed. This is a normal Phase Plan.

**Phase 1 discovery note**: During Phase 1 implementation, an additional bug was discovered and fixed — `advance_task` was missing from internal action handling alongside `advance_phase`. Documentation in T1 must describe both `advance_phase` and `advance_task` as internally handled actions.

## Task Outline

| # | Task | Dependencies | Skills Required | Est. Files | Handoff Doc |
|---|------|-------------|-----------------|-----------|-------------|
| T1 | Pipeline Engine Documentation (`docs/scripts.md` + `docs/pipeline.md`) | — | — | 2 | [Link](.github/projects/PIPELINE-HOTFIX/tasks/PIPELINE-HOTFIX-TASK-P03-T01.md) |
| T2 | Agent & Skill Reference Documentation (`docs/agents.md` + `docs/skills.md`) | — | — | 2 | [Link](.github/projects/PIPELINE-HOTFIX/tasks/PIPELINE-HOTFIX-TASK-P03-T02.md) |
| T3 | Project Structure & Overview Documentation (`docs/project-structure.md` + `README.md`) | — | — | 2 | [Link](.github/projects/PIPELINE-HOTFIX/tasks/PIPELINE-HOTFIX-TASK-P03-T03.md) |
| T4 | Instruction File Updates (`.github/copilot-instructions.md` + `.github/instructions/project-docs.instructions.md`) | — | — | 2 | [Link](.github/projects/PIPELINE-HOTFIX/tasks/PIPELINE-HOTFIX-TASK-P03-T04.md) |
| T5 | Master Plan Skill Instructions (`.github/skills/create-master-plan/SKILL.md`) | — | — | 1 | [Link](.github/projects/PIPELINE-HOTFIX/tasks/PIPELINE-HOTFIX-TASK-P03-T05.md) |

### Task Details

#### T1: Pipeline Engine Documentation

**Files**: `docs/scripts.md` (MODIFY), `docs/pipeline.md` (MODIFY)

**Objective**: Update the two core pipeline documentation files to accurately describe the engine's current behavior including internal action handling, the unmapped action guard, master plan pre-read, status normalization, and auto-approve for null/null triage.

**Scope for `docs/scripts.md`**:
- Restructure the action vocabulary section to distinguish internal actions (handled by the engine — `advance_phase`, `advance_task`, `update_state_from_task`) from external actions (routed to agents — the 18-action set)
- Document the internal action handling pattern: engine applies mutations, re-validates, re-resolves, bounded to 1 internal iteration
- Document the unmapped action guard: any resolved action not in `EXTERNAL_ACTIONS` after internal handling triggers a hard error

**Scope for `docs/pipeline.md`**:
- Describe the master plan pre-read: extracts `total_phases` from master plan frontmatter on `plan_approved`, guards for missing/invalid values
- Describe status normalization: `pass` → `complete`, `fail` → `failed`, unknown → hard error
- Describe auto-approve: when triage returns null/null and a report exists, the task/phase is auto-approved
- Describe the internal action loop: `advance_phase` and `advance_task` handled internally with bounded re-resolve

#### T2: Agent & Skill Reference Documentation

**Files**: `docs/agents.md` (MODIFY), `docs/skills.md` (MODIFY)

**Objective**: Add the `log-error` skill to the skill reference documentation and document the Orchestrator's use of the `log-error` skill in the agent documentation.

**Scope for `docs/agents.md`**:
- In the Orchestrator agent section, document that the Orchestrator has the `log-error` skill
- Describe the auto-log behavior: on `success: false`, the Orchestrator invokes `log-error` to append an entry to `{NAME}-ERROR-LOG.md`

**Scope for `docs/skills.md`**:
- Add a `log-error` skill entry following the existing format
- Include: skill name, description, purpose, when it's invoked, what it produces

#### T3: Project Structure & Overview Documentation

**Files**: `docs/project-structure.md` (MODIFY), `README.md` (MODIFY)

**Objective**: Add `ERROR-LOG.md` as a project artifact in the project structure documentation and update the README's project files list to include error logging.

**Scope for `docs/project-structure.md`**:
- Add `ERROR-LOG.md` to the project artifacts listing
- Note that it is created and appended by the Orchestrator (sole writer)

**Scope for `README.md`**:
- Add `ERROR-LOG.md` to the project files list
- Mention error logging in the relevant section (brief — no lengthy explanation)

#### T4: Instruction File Updates

**Files**: `.github/copilot-instructions.md` (MODIFY), `.github/instructions/project-docs.instructions.md` (MODIFY)

**Objective**: Add `ERROR-LOG.md` to the project files list in copilot instructions and add `ERROR-LOG.md` ownership to the project docs instruction file.

**Scope for `.github/copilot-instructions.md`**:
- Add `ERROR-LOG.md` to the project files listing under the project contents section

**Scope for `.github/instructions/project-docs.instructions.md`**:
- Add `ERROR-LOG.md` row to the File Ownership (Sole Writer Policy) table
- Sole writer: Orchestrator (via `log-error` skill)

#### T5: Master Plan Skill Instructions

**Files**: `.github/skills/create-master-plan/SKILL.md` (MODIFY)

**Objective**: Document `total_phases` as a required frontmatter field in the create-master-plan skill instructions so that future master plans always include this field.

**Scope**:
- Add `total_phases` to the skill's frontmatter field documentation/instructions
- Describe it as a required positive integer indicating the number of execution phases
- The template already has the field (updated in Phase 1) — this task ensures the skill instructions explain it

## Execution Order

```
T1 (Pipeline Engine Docs)
T2 (Agent & Skill Docs)     ← parallel-ready with T1, T3, T4, T5
T3 (Project Structure Docs) ← parallel-ready with T1, T2, T4, T5
T4 (Instruction Files)      ← parallel-ready with T1, T2, T3, T5
T5 (Skill Instructions)     ← parallel-ready with T1, T2, T3, T4
```

**Sequential execution order**: T1 → T2 → T3 → T4 → T5

*Note: All 5 tasks are parallel-ready (no mutual dependencies — each modifies different files with independent content) but will execute sequentially in v1. T1 is scheduled first because it documents the most complex changes (pipeline engine behavior) and provides context that may inform the Coder's understanding for subsequent tasks, though no task reads another task's output.*

## Phase Exit Criteria

- [ ] All 9 files listed in Master Plan Phase 3 scope are updated
- [ ] No documentation references prior behavior, migration steps, or "before/after" language
- [ ] `total_phases` is documented as a required field in the `create-master-plan` skill instructions
- [ ] `ERROR-LOG.md` appears in project structure docs (`docs/project-structure.md`), copilot instructions (`.github/copilot-instructions.md`), and project-docs instructions (`.github/instructions/project-docs.instructions.md`)
- [ ] `log-error` skill appears in skills documentation (`docs/skills.md`) and agents documentation (`docs/agents.md`)
- [ ] Action vocabulary in `docs/scripts.md` clearly distinguishes internal actions (handled by engine) from external actions (routed to agents)
- [ ] `docs/pipeline.md` describes master plan pre-read, status normalization, auto-approve, and internal action loop
- [ ] Both `advance_phase` and `advance_task` are documented as internally handled actions
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **Consistency across 9 files**: Descriptions of the same feature (e.g., `ERROR-LOG.md`, internal actions) must use consistent terminology across all files. Mitigation: task handoffs will specify exact wording for shared concepts.
- **Documentation-only phase with no automated tests**: There is no test suite to validate documentation accuracy. Mitigation: phase review will cross-check every updated file against the Architecture and Design docs for factual accuracy.
- **Existing doc structure may vary**: Each doc file has its own format and conventions. Mitigation: task handoffs will instruct the Coder to read each file first and match its existing style, inserting content in the appropriate location.
