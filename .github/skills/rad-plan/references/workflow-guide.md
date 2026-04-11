# Workflow Guide — Plan Project

Detailed reference for the agent executing the `rad-plan` skill. Covers question schemas, value resolution, the pipeline call template, audit loop instructions, and post-plan handoff.

---

## Conventions (Applied Automatically)

| Value | Rule | Example |
|---|---|---|
| Project directory | `{projectsBasePath}/{projectName}` | `C:\dev\orchestration-projects\MY-FEATURE` |
| Template default | First template returned by `find-templates.js` | `full` |

---

## Question Schemas

Build **one** `askQuestions` call covering all upfront decisions. Include only the questions whose condition is met, in the order listed below.

---

### Q: `project_name` — only if the project was NOT identified from context

```json
{
  "header": "project_name",
  "question": "Which project should be planned?",
  "options": [
    {
      "label": "{projects[0].name}",
      "recommended": true,
      "description": "{projects[0].hasBrainstorming ? 'Has brainstorming doc' : 'Has goals doc'}"
    },
    {
      "label": "{projects[1].name}",
      "description": "..."
    }
  ],
  "allowFreeformInput": true
}
```

Build one option per project from `find-projects.js` output. Mark the first as `recommended`. Use the description to indicate which planning docs exist (`"Has brainstorming doc"`, `"Has goals doc"`, or `"Has goals + brainstorming"`). Always add a **New project** option at the end with description `"Enter a new project name"`. If no projects were found, show only New project.

**Resolve:**
- Named option → `projectName` = that label
- Freeform text treated as `projectName` directly

---

### Q: `project_template` — always include

```json
{
  "header": "project_template",
  "question": "Which planning template should be used?",
  "options": [
    {
      "label": "full",
      "recommended": true,
      "description": "Complete orchestration pipeline — planning, execution, review, source control"
    },
    {
      "label": "quick",
      "description": "Lean pipeline for features and bug fixes. Omits PRD, Design, phase reports, and phase reviews."
    }
  ],
  "allowFreeformInput": false
}
```

Build one option per template from `find-templates.js` output. Use the `description` field from the template YAML as the option description. Mark the first template as `recommended`. If `find-templates.js` fails or returns no templates, fall back to hardcoded `full` and `quick` options.

---

## Value Resolution

After answers are returned, derive these values before proceeding:

| Value | Source |
|---|---|
| `projectName` | From conversation context or `project_name` answer |
| `projectDir` | `{projectsBasePath}/{projectName}` |
| `templateId` | `project_template` answer |
| `pipelinePath` | `{repoRoot}/{orchRoot}/skills/orchestration/scripts/pipeline.ts` |
| `planningDocs` | Determined by template — see Planning Docs by Template below |

---

## Planning Docs by Template

Use this to tell subagents which documents to audit:

| Template | Documents to audit |
|---|---|
| `full` | RESEARCH-FINDINGS, PRD, DESIGN, ARCHITECTURE, MASTER-PLAN |
| `quick` | RESEARCH-FINDINGS, ARCHITECTURE, MASTER-PLAN |
| Custom | Read the template's YAML to identify active planning steps |

Document filenames follow the pattern `{projectName}-{DOC-SLUG}.md` in `{projectDir}`.

---

## Pipeline Start Command

After resolving values, signal the pipeline to start planning:

```
npx --yes tsx "{pipelinePath}" --event research_started --project-dir "{projectDir}" --template "{templateId}"
```

Parse the JSON response. Verify it contains `"success": true`. If it fails, display the error message and stop — do not proceed.

---

## Audit Loop

After `master_plan_completed` is signalled, run up to 3 audit passes. For each pass:

1. Spawn a fresh subagent with the `rad-plan-audit` skill.
2. Tell the subagent:
   - The names of all planning docs to check (derived from the template — see Planning Docs by Template above)
   - To use the `rad-plan-audit` skill for auditing instructions
3. After the subagent returns, evaluate its findings:
   - **No issues** → mark cleam, stop early
   - **Issues found** → apply fixes, note what changed, continue to next pass
4. Show the user a one-paragraph summary after each pass: what was checked, what was found, what was fixed.

If all 3 passes complete with remaining unresolved issues, proceed to Finalize.

---

## Post-Plan Question

After the audit loop, show the user a compact audit summary table:

| Pass | Result |
|---|---|
| 1 | ✓ Clean *or* N issues found, M fixed |
| 2 | *(if run)* |
| 3 | *(if run)* |

Then ask the post-plan question. Build it conditionally based on whether issues remain:

### If plan is clean (all issues resolved or none found):

```json
{
  "header": "post_plan_action",
  "question": "The plan is ready. What would you like to do next?",
  "options": [
    {
      "label": "Execute in current branch",
      "recommended": true,
      "description": "Start orchestration execution here — use /rad-execute"
    },
    {
      "label": "Execute in a new worktree",
      "description": "Spin up an isolated branch — use /rad-execute-parallel"
    },
    {
      "label": "Done for now",
      "description": "I'll kick off execution manually later"
    }
  ],
  "allowFreeformInput": false
}
```

### If unresolved issues remain:

```json
{
  "header": "post_plan_action",
  "question": "3 audit passes completed with unresolved issues. What would you like to do?",
  "options": [
    {
      "label": "Continue iterating on the audit",
      "recommended": true,
      "description": "Run more audit passes until the plan is clean"
    },
    {
      "label": "Execute anyway",
      "description": "Proceed to execution despite remaining issues"
    },
    {
      "label": "Done for now",
      "description": "Stop here — I'll review the issues manually"
    }
  ],
  "allowFreeformInput": false
}
```

---

## Post-Plan Handoffs

### Execute in current branch

Inform the user: *"Use `/rad-execute` in this window to start execution for `{projectName}`."*

### Execute in a new worktree

Hand off to the `rad-execute-parallel` skill. Pass `{projectName}` as the project argument. The worktree setup and launch will be handled entirely by that skill.

### Continue iterating on the audit

Run additional audit passes (same loop as above). After each pass, re-ask the post-plan question until either all issues are resolved or the user chooses to stop.

### Done for now

Inform the user: *"Plan is saved at `{projectDir}`. Kick off execution any time with `/rad-execute` or `/rad-execute-parallel`."*
