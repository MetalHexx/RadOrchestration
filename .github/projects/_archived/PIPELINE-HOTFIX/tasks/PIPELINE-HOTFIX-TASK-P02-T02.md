---
project: "PIPELINE-HOTFIX"
phase: 2
task: 2
title: "Update Orchestrator Agent — log-error Reference & Auto-Log"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Update Orchestrator Agent — log-error Reference & Auto-Log

## Objective

Update the Orchestrator agent definition at `.github/agents/orchestrator.agent.md` to reference the `log-error` skill in its YAML frontmatter and replace the current "display and halt" error handling instructions with a 3-step "log, display, halt" pattern that invokes the `log-error` skill on every `success: false` pipeline result.

## Context

The `log-error` skill was created in the prior task (P02-T01). It provides a structured workflow for appending numbered error entries to a per-project error log file (`{NAME}-ERROR-LOG.md`). The Orchestrator is the sole consumer of this skill — it must invoke it whenever the pipeline returns `success: false` so that pipeline failures are persistently recorded. The current Orchestrator error handling section instructs only "display and halt"; it needs to be expanded to "log, display, halt." The error log file path convention is `{PROJECT-DIR}/{NAME}-ERROR-LOG.md` (e.g., `.github/projects/MYAPP/MYAPP-ERROR-LOG.md`).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/orchestrator.agent.md` | Two changes: (1) add `skills` list to YAML frontmatter, (2) update Error Handling section |

## Implementation Steps

1. Open `.github/agents/orchestrator.agent.md`

2. **Add `skills` list to YAML frontmatter** — Insert a `skills` key after the existing `agents` list, before the closing `---`. The current frontmatter ends with:
   ```yaml
   agents:
     - Research
     - Product Manager
     - UX Designer
     - Architect
     - Tactical Planner
     - Coder
     - Reviewer
   ---
   ```
   Add `skills` so it becomes:
   ```yaml
   agents:
     - Research
     - Product Manager
     - UX Designer
     - Architect
     - Tactical Planner
     - Coder
     - Reviewer
   skills:
     - log-error
   ---
   ```

3. **Locate the `### Error Handling` section** — It is under `## Event Loop`, after the `### Loop Termination` subsection and before the `## Action Routing Table` section. The current content is:

   ````markdown
   ### Error Handling

   If the pipeline exits with code 1, parse the error result:

   ```json
   {
     "success": false,
     "error": "Validation failed: V6 — multiple in_progress tasks",
     "event": "task_completed",
     "state_snapshot": { "current_phase": 0, "current_task": 1 },
     "mutations_applied": ["task_status → complete"],
     "validation_passed": false
   }
   ```

   Display `result.error` to the human and halt. Do not attempt to recover automatically from pipeline errors.
   ````

4. **Replace the entire `### Error Handling` section** with the following content (everything from `### Error Handling` up to but not including `## Action Routing Table`):

   ````markdown
   ### Error Handling

   If the pipeline exits with code 1, parse the error result:

   ```json
   {
     "success": false,
     "error": "Validation failed: V6 — multiple in_progress tasks",
     "event": "task_completed",
     "state_snapshot": { "current_phase": 0, "current_task": 1 },
     "mutations_applied": ["task_status → complete"],
     "validation_passed": false
   }
   ```

   **On every `success: false` result, follow these 3 steps in order:**

   1. **Log the error**: Invoke the `log-error` skill to append a structured entry to `{NAME}-ERROR-LOG.md` in the project directory (e.g., `.github/projects/MYAPP/MYAPP-ERROR-LOG.md`). Populate the entry fields from the pipeline result:
      - **Pipeline Event**: from `result.event`
      - **Pipeline Action**: from `result.action` (or `N/A` if not present)
      - **Severity**: classify using the skill's severity guide (`critical` = blocks execution, `high` = incorrect state, `medium` = degraded behavior, `low` = cosmetic)
      - **Phase/Task**: from `result.state_snapshot`
      - **Symptom**: describe the observable failure from `result.error`
      - **Pipeline Output**: the full raw JSON result
      - **Root Cause**: diagnose if obvious, otherwise "Under investigation."
      - **Workaround Applied**: describe recovery action, or "None — awaiting fix."

   2. **Display**: Show `result.error` to the human

   3. **Halt**: Do not attempt automatic recovery from pipeline errors
   ````

5. **Verify** that no other sections of the file are changed — the Action Routing Table, Event Signaling Reference, Recovery section, Spawning Subagents section, and Status Reporting section must remain identical.

## Contracts & Interfaces

### Orchestrator Agent Frontmatter — Current

```yaml
---
name: Orchestrator
description: "The main orchestration agent that coordinates the entire project pipeline. Signals events to the pipeline script, parses JSON results, and routes on an 18-action table. Never writes files directly."
argument-hint: "Describe the project to start, or ask to continue an existing project."
tools:
  - read
  - search
  - agent
  - execute
  - vscode/askQuestions
agents:
  - Research
  - Product Manager
  - UX Designer
  - Architect
  - Tactical Planner
  - Coder
  - Reviewer
---
```

### Orchestrator Agent Frontmatter — After Edit

```yaml
---
name: Orchestrator
description: "The main orchestration agent that coordinates the entire project pipeline. Signals events to the pipeline script, parses JSON results, and routes on an 18-action table. Never writes files directly."
argument-hint: "Describe the project to start, or ask to continue an existing project."
tools:
  - read
  - search
  - agent
  - execute
  - vscode/askQuestions
agents:
  - Research
  - Product Manager
  - UX Designer
  - Architect
  - Tactical Planner
  - Coder
  - Reviewer
skills:
  - log-error
---
```

### Error Handling Section — Current (to be replaced)

The full text between `### Error Handling` and `## Action Routing Table`:

````markdown
### Error Handling

If the pipeline exits with code 1, parse the error result:

```json
{
  "success": false,
  "error": "Validation failed: V6 — multiple in_progress tasks",
  "event": "task_completed",
  "state_snapshot": { "current_phase": 0, "current_task": 1 },
  "mutations_applied": ["task_status → complete"],
  "validation_passed": false
}
```

Display `result.error` to the human and halt. Do not attempt to recover automatically from pipeline errors.
````

### Error Handling Section — After Edit (exact replacement)

````markdown
### Error Handling

If the pipeline exits with code 1, parse the error result:

```json
{
  "success": false,
  "error": "Validation failed: V6 — multiple in_progress tasks",
  "event": "task_completed",
  "state_snapshot": { "current_phase": 0, "current_task": 1 },
  "mutations_applied": ["task_status → complete"],
  "validation_passed": false
}
```

**On every `success: false` result, follow these 3 steps in order:**

1. **Log the error**: Invoke the `log-error` skill to append a structured entry to `{NAME}-ERROR-LOG.md` in the project directory (e.g., `.github/projects/MYAPP/MYAPP-ERROR-LOG.md`). Populate the entry fields from the pipeline result:
   - **Pipeline Event**: from `result.event`
   - **Pipeline Action**: from `result.action` (or `N/A` if not present)
   - **Severity**: classify using the skill's severity guide (`critical` = blocks execution, `high` = incorrect state, `medium` = degraded behavior, `low` = cosmetic)
   - **Phase/Task**: from `result.state_snapshot`
   - **Symptom**: describe the observable failure from `result.error`
   - **Pipeline Output**: the full raw JSON result
   - **Root Cause**: diagnose if obvious, otherwise "Under investigation."
   - **Workaround Applied**: describe recovery action, or "None — awaiting fix."

2. **Display**: Show `result.error` to the human

3. **Halt**: Do not attempt automatic recovery from pipeline errors
````

### log-error Skill — Entry Field Mapping (for reference)

The `log-error` skill (at `.github/skills/log-error/SKILL.md`) expects each error log entry to have these fields:

| Field | Type | Source from Pipeline Result |
|-------|------|---------------------------|
| Entry | integer ≥ 1 | Auto-incremented from `entry_count` in error log frontmatter |
| Timestamp | ISO-8601 | Current time when logging |
| Pipeline Event | string | `result.event` |
| Pipeline Action | string \| `'N/A'` | `result.action` (or `N/A` if absent / pre-resolution failure) |
| Severity | `critical` \| `high` \| `medium` \| `low` | Classify based on impact |
| Phase | integer \| `'N/A'` | `result.state_snapshot.current_phase` |
| Task | integer \| `'N/A'` | `result.state_snapshot.current_task` |

Plus sections: Symptom, Pipeline Output (raw JSON), Root Cause, Workaround Applied.

## Styles & Design Tokens

N/A — this is a Markdown agent definition file, not a UI component.

## Test Requirements

- [ ] YAML frontmatter parses correctly (no syntax errors in the `---` block)
- [ ] `skills` key is present in frontmatter and contains `log-error`
- [ ] Error Handling section contains the 3-step pattern (log, display, halt)
- [ ] Error Handling section mentions `log-error` skill by name
- [ ] Error Handling section includes the `{NAME}-ERROR-LOG.md` file path pattern
- [ ] Error Handling section includes field mapping guidance (Pipeline Event, Pipeline Action, Severity, Phase/Task, Symptom, Pipeline Output, Root Cause, Workaround Applied)
- [ ] No other sections of the file are modified

## Acceptance Criteria

- [ ] `.github/agents/orchestrator.agent.md` YAML frontmatter contains `skills:` list with `log-error` as an entry
- [ ] The `name`, `description`, `argument-hint`, `tools`, and `agents` frontmatter fields are **unchanged**
- [ ] Error Handling section includes step 1 to invoke `log-error` skill before displaying the error
- [ ] Error Handling section includes step 2 to display `result.error` to the human
- [ ] Error Handling section includes step 3 to halt (no automatic recovery)
- [ ] Error Handling section includes the `{NAME}-ERROR-LOG.md` file path convention
- [ ] Error Handling section includes severity classification guidance
- [ ] The JSON example in the Error Handling section is preserved (specific example or equivalent pattern)
- [ ] No changes to the Action Routing Table (18-action table is identical)
- [ ] No changes to the Event Signaling Reference
- [ ] No changes to the Recovery, Spawning Subagents, or Status Reporting sections
- [ ] No other files are created or modified

## Constraints

- Do NOT modify ANY section of `orchestrator.agent.md` other than (1) the YAML frontmatter to add `skills` and (2) the `### Error Handling` subsection
- Do NOT modify the Action Routing Table — the 18 actions must remain identical
- Do NOT modify the Event Signaling Reference — all event names must remain identical
- Do NOT add new events, actions, or routing logic
- Do NOT modify any other file — this task touches exactly 1 file
- Do NOT remove the JSON error result example from the Error Handling section — keep it as an illustrative sample
