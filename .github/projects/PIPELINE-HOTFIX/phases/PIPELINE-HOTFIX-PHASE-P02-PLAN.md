---
project: "PIPELINE-HOTFIX"
phase: 2
title: "Skill Creation & Agent Updates"
status: "active"
total_tasks: 2
author: "tactical-planner-agent"
created: "2026-03-14T00:00:00Z"
---

# Phase 2: Skill Creation & Agent Updates

## Phase Goal

Create the `log-error` skill with its document template and update the Orchestrator agent definition to reference the new skill with auto-log-on-failure instructions. Three of the original six Phase 2 scope items were already completed during Phase 1 (task report vocabulary, task report template comment, master plan template frontmatter) — this phase covers only the remaining work.

## Inputs

| Source | Key Information Used |
|--------|---------------------|
| [Master Plan](../PIPELINE-HOTFIX-MASTER-PLAN.md) | Phase 2 scope, exit criteria, execution constraints |
| [Architecture](../PIPELINE-HOTFIX-ARCHITECTURE.md) | `log-error` skill structure, ERROR-LOG.md template, entry field contract, severity classification guide, Orchestrator agent update specification |
| [Design](../PIPELINE-HOTFIX-DESIGN.md) | EL-1 (ERROR-LOG.md document structure), EL-2 (append-only semantics, entry numbering) |
| [PRD](../PIPELINE-HOTFIX-PRD.md) | FR-16 (log-error skill), FR-17 (entry fields), FR-18 (append-only), FR-19 (Orchestrator auto-log on `success: false`) |
| [state.json](../state.json) | `execution.phases[1].status = "not_started"`, no `phase_review_action` → normal plan; `limits.max_tasks_per_phase = 8` |

### Scope Reduction — Work Already Completed in Phase 1

The following Phase 2 scope items were completed during Phase 1 execution and require no further action:

| Original Scope Item | Completed In | Verification |
|---------------------|-------------|--------------|
| `generate-task-report/SKILL.md` — add explicit vocabulary constraint block | Phase 1, T03 | File contains `> **IMPORTANT: The status field...` callout block |
| `generate-task-report/templates/TASK-REPORT.md` — reinforce status field comment | Phase 1, T03 | Frontmatter reads `status: "complete"   # MUST be exactly: complete \| partial \| failed — no synonyms` |
| `create-master-plan/templates/MASTER-PLAN.md` — add `total_phases` frontmatter field | Phase 1, T01 | Frontmatter includes `total_phases: {NUMBER}` |

## Task Outline

| # | Task | Dependencies | Files | Est. Files | Handoff Doc |
|---|------|-------------|-------|-----------|-------------|
| T1 | Create `log-error` Skill & Template | — | `.github/skills/log-error/SKILL.md` (CREATE), `.github/skills/log-error/templates/ERROR-LOG.md` (CREATE) | 2 | [Link](../tasks/PIPELINE-HOTFIX-TASK-P02-T01.md) |
| T2 | Update Orchestrator Agent — `log-error` Reference & Auto-Log | T1 | `.github/agents/orchestrator.agent.md` (MODIFY) | 1 | [Link](../tasks/PIPELINE-HOTFIX-TASK-P02-T02.md) |

## Task Details

### T1: Create `log-error` Skill & Template

**Objective**: Create the `log-error` skill directory with `SKILL.md` (skill definition, workflow, and entry format) and `templates/ERROR-LOG.md` (error log document template with YAML frontmatter).

**Scope**:
- `.github/skills/log-error/SKILL.md` (CREATE): Skill frontmatter with `name: log-error`, description. Body: workflow (when to invoke, file path convention, create-vs-append logic, entry numbering, append-only rule), entry template with all 7 fields (Entry, Timestamp, Pipeline Event, Pipeline Action, Severity, Phase, Task) plus Symptom, Pipeline Output, Root Cause, Workaround Applied sections. Severity classification guide table.
- `.github/skills/log-error/templates/ERROR-LOG.md` (CREATE): YAML frontmatter (`project`, `type: "error-log"`, `created`, `last_updated`, `entry_count: 0`). Empty body — entries are appended by the Orchestrator using the skill.

**Key contracts** (from Architecture — `log-error` Skill Structure):
- Skill frontmatter: `name: log-error`, description per Architecture spec
- Error log file path convention: `{PROJECT-DIR}/{NAME}-ERROR-LOG.md`
- Entry fields: Entry (integer ≥ 1), Timestamp (ISO-8601), Pipeline Event (string), Pipeline Action (string | `'N/A'`), Severity (`critical` | `high` | `medium` | `low`), Phase (integer | `'N/A'`), Task (integer | `'N/A'`)
- Entry sections: Symptom (1-3 sentences), Pipeline Output (raw JSON block), Root Cause (1-3 sentences or "Under investigation."), Workaround Applied (recovery action or "None — awaiting fix.")
- Append-only: never modify or delete existing entries; read `entry_count` from frontmatter to determine next number
- Severity classification: critical (blocks execution), high (incorrect state), medium (degraded behavior), low (cosmetic)

**Acceptance criteria**:
1. `.github/skills/log-error/SKILL.md` exists with valid frontmatter (`name: log-error`)
2. SKILL.md body contains workflow steps (when to invoke, file path, create-vs-append, numbering, append-only)
3. SKILL.md body contains entry template with all required fields and sections
4. SKILL.md body contains severity classification guide
5. `.github/skills/log-error/templates/ERROR-LOG.md` exists with valid frontmatter (`project`, `type`, `created`, `last_updated`, `entry_count`)
6. No other files are created or modified

---

### T2: Update Orchestrator Agent — `log-error` Reference & Auto-Log

**Objective**: Update the Orchestrator agent definition to reference the `log-error` skill and modify the error handling section to automatically invoke the skill when the pipeline returns `success: false`.

**Scope**:
- `.github/agents/orchestrator.agent.md` (MODIFY): Two changes:
  1. **Error handling section** (~line 82–91): Replace the current "Display and halt" error handling with the Architecture-specified 3-step pattern: (1) Log the error via `log-error` skill, (2) Display error to human, (3) Halt.
  2. **Skills reference**: The Orchestrator agent currently has no skills section in its frontmatter. The `log-error` skill should be referenced so the agent knows about it. Add a `skills` list to the frontmatter if none exists, or add `log-error` to the existing list.

**Key contracts** (from Architecture — Orchestrator Agent Update):
- Error handling pattern:
  ```
  1. Log the error: Invoke the log-error skill to append a structured entry to {NAME}-ERROR-LOG.md
  2. Display: Show result.error to the human
  3. Halt: Do not attempt automatic recovery from pipeline errors
  ```
- The `log-error` invocation is near-mandatory on every `success: false` — the Orchestrator should always log before halting

**Acceptance criteria**:
1. Orchestrator agent frontmatter references `log-error` (either in a `skills` list or equivalent reference mechanism)
2. Error handling section includes step to invoke `log-error` skill before displaying error
3. Error handling section preserves the halt behavior (no automatic recovery)
4. Error handling section includes the `{NAME}-ERROR-LOG.md` file path pattern
5. No other files are modified
6. No changes to the Action Routing Table, Event Signaling Reference, or any other section

## Execution Order

```
T1 (log-error skill creation)
 └→ T2 (Orchestrator agent update — references T1's skill)
```

**Sequential execution order**: T1 → T2

*Note: T2 depends on T1 because it references the skill created by T1. The Orchestrator's error handling instructions point to the skill that must exist first.*

## Phase Exit Criteria

- [ ] `log-error` skill directory exists at `.github/skills/log-error/` with valid `SKILL.md` and `templates/ERROR-LOG.md`
- [ ] Orchestrator agent definition references `log-error` skill
- [ ] Orchestrator error handling section includes auto-log instructions (invoke `log-error` on `success: false`)
- [ ] `generate-task-report` SKILL.md includes explicit vocabulary constraint block *(already met — Phase 1 T03)*
- [ ] `generate-task-report` template frontmatter comment reinforces `complete | partial | failed` constraint *(already met — Phase 1 T03)*
- [ ] `create-master-plan` template frontmatter includes `total_phases: {NUMBER}` field *(already met — Phase 1 T01)*
- [ ] All tasks complete with status `complete`
- [ ] Phase review passed

## Known Risks for This Phase

- **Low risk**: The `log-error` skill is a new file with no integration tests — validation is limited to structural review (correct frontmatter, required sections present). Functional validation occurs when the Orchestrator first encounters a `success: false` result.
- **Low risk**: The Orchestrator agent definition is a Markdown file parsed by Copilot — formatting changes to the error handling section must preserve the document's overall structure and readability to avoid confusing the LLM agent.
