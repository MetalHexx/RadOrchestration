---
project: "PIPELINE-HOTFIX"
phase: 3
task: 2
title: "Agent & Skill Reference Documentation"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Agent & Skill Reference Documentation

## Objective

Update `docs/agents.md` and `docs/skills.md` to document the Orchestrator's `log-error` skill and add the `log-error` skill entry to the skills reference.

## Context

The Orchestrator agent uses a `log-error` skill to append structured error entries to a per-project `{NAME}-ERROR-LOG.md` file whenever the pipeline returns `{ success: false }`. The skill is declared in `.github/agents/orchestrator.agent.md` and the skill definition lives at `.github/skills/log-error/SKILL.md`. Both `docs/agents.md` and `docs/skills.md` need to reflect this skill. All documentation describes current system behavior only — no references to prior behavior, migration steps, or before/after language.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/agents.md` | Update Orchestrator section: skills line, add auto-log behavior description |
| MODIFY | `docs/skills.md` | Add `log-error` to Execution Skills table, update Skill-Agent Composition table |

## Implementation Steps

### `docs/agents.md`

1. **Read** `docs/agents.md` in full to understand its existing structure and formatting conventions.

2. **Update the Agent Overview table** — In the table at the top of the file, change the Orchestrator's "Writes" column from `Nothing (read-only)` to `ERROR-LOG.md (via log-error skill)`.

3. **Update the Orchestrator section** — Locate the Orchestrator agent detail section. Make these changes:

   a. In the description paragraph, add a sentence about error logging. After the sentence ending with "…or display terminal messages.", add: `When the pipeline returns a failure result, the Orchestrator invokes the log-error skill to append a structured entry to the project's ERROR-LOG.md.`

   b. Change the **Skills:** line from `None (coordination only)` to `log-error`.

4. **Do NOT modify** any other agent section or any other part of the file. Preserve all existing content, formatting, heading levels, and prose style.

### `docs/skills.md`

5. **Read** `docs/skills.md` in full to understand its existing structure and formatting conventions.

6. **Add `log-error` to the Execution Skills table** — Insert a new row in the "Execution Skills" table, after the `run-tests` row:

   ```
   | `log-error` | Log pipeline errors to a structured, append-only per-project error log (`ERROR-LOG.md`) | Orchestrator |
   ```

7. **Update the Skill-Agent Composition table** — Find the Orchestrator row in the Skill-Agent Composition table. Change it from:

   ```
   | Orchestrator | *(none — coordination only)* |
   ```

   to:

   ```
   | Orchestrator | `log-error` |
   ```

8. **Do NOT modify** any other table, section, or content in the file. Preserve all existing formatting and prose style.

## Contracts & Interfaces

Not applicable — this is a documentation-only task with no code contracts.

## Styles & Design Tokens

Not applicable — no UI components.

## Test Requirements

- [ ] No automated tests — documentation-only task

## Acceptance Criteria

- [ ] `docs/agents.md` Agent Overview table shows Orchestrator writes `ERROR-LOG.md (via log-error skill)`
- [ ] `docs/agents.md` Orchestrator section description includes the auto-log behavior sentence: when the pipeline returns a failure result, the Orchestrator invokes `log-error` to append a structured entry to the project's `ERROR-LOG.md`
- [ ] `docs/agents.md` Orchestrator **Skills:** line reads `log-error` (not "None")
- [ ] `docs/skills.md` Execution Skills table contains a `log-error` row with description and "Orchestrator" as the user
- [ ] `docs/skills.md` Skill-Agent Composition table shows Orchestrator with `log-error`
- [ ] No documentation references prior behavior, migration steps, "before/after" language, or bug fix context
- [ ] No references to external planning documents (PRD, Architecture, Design, Master Plan)
- [ ] Existing accurate content in both files is preserved (not rewritten)
- [ ] New content matches each file's existing heading levels, formatting conventions, and prose style

## Constraints

- Do NOT rewrite or reorganize existing content — only insert/modify the specific items listed
- Do NOT add explanations of why the skill was added, historical context, or migration notes
- Do NOT reference any planning documents (PRD, Architecture, Design, or Master Plan)
- Do NOT modify any agent section other than the Orchestrator in `docs/agents.md`
- Do NOT add or remove any skill entries other than `log-error`
- Match the existing formatting exactly: table alignment, backtick usage, bold markers, heading levels
