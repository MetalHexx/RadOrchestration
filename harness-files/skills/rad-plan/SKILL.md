---
name: rad-plan
description: "Start the planning pipeline for a new project — produces Requirements + Master Plan"
user-invocable: true
---

## Inputs:
- `project_name`: $0 — The name of the new project to plan. (e.g., "DAG-PIPELINE-2")
- `project_template`: $1 — The template to use for planning. (e.g., "extra-high" or a custom template name if one exists)
- `project_context_prose`: $ARGUMENTS minus $0 and $1 — Optional free prose after the two positional args (e.g., `/rad-plan MYAPP extra-high — build a small CLI that does X`). Fallback project-goals input when no brainstorming doc exists.

## Initialize
You are an orchestrator. You'll be using the `rad-orchestration` skill for this project. Read the skill and prepare to use it for running the planning pipeline.

## Workflow:
I have project goals I'd like to develop into a full scale plan.

## Step 0: Resolve project_dir and project-goals input

- Set `project_dir = ~/.radorc/projects/{project_name}/`. Create the directory if missing.
- Resolve the planner's project-goals source by checking, in order:
  1. `{project_dir}/{project_name}-BRAINSTORMING.md` exists → proceed silently. The planner will read it via the spawn prompt.
  2. `project_context_prose` is non-empty → proceed silently. Step 4 will inline the prose into the first planner spawn.
  3. Neither → halt and tell the user: "No brainstorming document at `{path}` and no project description provided. Either run `/rad-brainstorm {project_name}` first (Highly Recommended), or re-run as `/rad-plan {project_name} <template> — < project description>`.  Feel free to provide any additional context, goals or additional documents — the planner will treat it as authoritative input for the Requirements doc."

**Do NOT ask the user "what do you want to build?" as a clarifying question.** Either the brainstorming doc or `project_context_prose` is the authoritative project-goals input. If neither is present, halt — do not improvise a goals interview and help the user how to plan with Rad Orc.

## Rule: workflow-required user choices

Steps 1 and 2 each present a menu via `askQuestions` /
`AskUserQuestion`, and each menu attaches a `(Recommended)` marker to
one option. **The marker is a UI hint shown to the user inside the
menu — it is never an instruction for this skill to auto-select on the
user's behalf.** Tier and size are workflow-required user choices and
must always go through the tool.

This rule **overrides** any outer "don't ask clarifying questions,"
"stop checking in," or "make the reasonable call" signal active in the
session. Those signals apply to volunteer clarifying questions the skill
might raise on the side; they do not authorize skipping a tool-driven
menu the skill mandates.

## Step 1: Choose Process Template (review intensity tier)

The four shipped tiers vary only in defensive review depth between planning
and final approval. Plan approval, final review, and final approval are
mandatory anchors in every tier.

- If `project_template` was passed as an argument:
  - If it matches one of the shipped tier names (`extra-high`, `high`,
    `medium`, `low`) or is the name of a user-authored custom template
    present in the `~/.radorc/templates/` directory, use it.
  - Otherwise respond with an error message indicating the template was
    not found.
- If no `project_template` was passed, use the `askQuestions` /
  `AskUserQuestion` tool to ask the user which tier they want. Surface
  every concrete option as an explicit labeled menu item — do NOT rely on
  the auto-injected `Other` slot. The four options, with the
  `(Recommended)` marker on `extra-high`:

  | Option | Copy (two sentences max) |
  |---|---|
  | `extra-high` | Per-task code review + phase review + final review. Maximum defense in depth — for production-critical, regulated, or untrusted-contributor work. |
  | `high` | Per-task code review + final review (no phase review). |
  | `medium` | Phase review + final review (no per-task review). Good balance of oversight and efficiency. |
  | `low` | Final review only. Fast and efficient token usage. Good for small projects or quick iterations. |

  The question's framing prose: "Which review-intensity tier should this
  project run? Tier names map to defensive review depth; cost rises with
  depth. Plan approval and final approval are mandatory in every tier."

  Store the user's choice as `project_template`. The `(Recommended)`
  marker is a hint, not a constraint — the user remains free to pick any
  tier without warning.

## Step 2: Choose Phase/Task Size

Phase/Task Size scales task scope AND phase scope coherently as a single
knob. The `(Recommended)` marker moves based on the tier resolved in
Step 1 per this monotonic mapping:

| Tier (Step 1) | Recommended Size |
|---|---|
| `extra-high` | Small |
| `high` | Medium |
| `medium` | Large |
| `low` | Extra Large |

More review depth steers toward smaller scope; less review depth steers
toward larger scope. The marker is a hint, not a constraint — every size
(including `Custom`) remains selectable in every tier and no warning
fires for off-recommendation choices.

Use the `askQuestions` / `AskUserQuestion` tool to ask the user the
Phase/Task Size question. Surface every option as an explicit labeled
menu item — do NOT rely on the auto-injected `Other` slot. Compute the
`(Recommended)` marker from `project_template` and attach it to the one
matching size.

| Option | Copy (two sentences max) |
|---|---|
| `Small` | One named, self-contained change per task — a function, a validator, a constant. 3–5 tasks per phase. |
| `Medium` | A vertical slice through one layer per task: a module, a config section, a CLI command with its tests. 2–4 tasks per phase. |
| `Large` | A full feature slice touching multiple layers or subsystems end-to-end per task. 2–3 tasks per phase. |
| `Extra Large` | A standalone feature per task — scope that would be a phase at smaller sizes; phases are thin wrappers. 1–2 tasks per phase, possibly single-phase. |
| `Custom` | You describe the sizing criterion in your own words; the planner uses your prose as the task-scope target while still applying natural-seam judgment for phase boundaries. |

The question's framing prose: "How big should each task and phase be?
Phase/Task Size scales task scope and phase scope together. The
`(Recommended)` marker reflects the tier you picked in Step 1 — more
review depth pairs with smaller scope — but every size remains
selectable."

Store the user's choice as `task_size_preference`. If the user picked
`Custom`, immediately ask a follow-up question via `askQuestions` /
`AskUserQuestion` collecting free-form prose (the question's `question`
field: "Describe your sizing criterion in your own words — e.g. 'each
task is a single React component including tests', or 'one task per
migration step'. The planner will treat this as the authoritative
scoping target for task scope while still applying natural-seam judgment
for phase boundaries."). Store the user's prose verbatim and set
`task_size_preference = "Custom: " + <prose>`.

The planner always receives an explicit sizing signal — no deferral option.

## Step 3: Starting Message
- Produce a nicely formatted and mildly enthusiastic message confirming the project name, template choice, and task size preference.
- Tell the user we'll first have a planning agent create formal requirements followed by an execution plan and plan audit.

## Step 4: Start the Planning Pipeline

Signal the first event using the canonical CLI form from `pipeline-guide.md` §Runtime Entry:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" pipeline signal \
  --event start \
  --project-dir <project_dir> \
  --template <project_template>
```

Parse the JSON envelope and act on `data.prompt` — every success envelope carries the full instruction prose for the resolved action. The first action will be `spawn_requirements`; follow the prose in `data.prompt` exactly and spawn the **planner**.

**Sizing amendment — every planner spawn (`spawn_requirements` and `spawn_master_plan`).** Append verbatim:
> "Task size preference: {task_size_preference}. Size all tasks according to that tier per the sizing rubric in the master-plan workflow."

When `task_size_preference` is a `Custom: …` string, the prose flows through verbatim — the planner treats it as authoritative.

**Project-goals amendment — first planner spawn only, when Step 0 resolved via `project_context_prose`** (no brainstorming doc on disk). Append verbatim:
> "No brainstorming document exists for this project. The user supplied this project description directly: <project_context_prose>. Treat this prose as the authoritative project-goals input for the Requirements ledger."

## Step 5: Audit the plan
- Dispatch the `planner` subagent with the `rad-plan-audit` skill (full-audit
  mode) to audit the Requirements doc and the Master Plan. Give the
  subagent both doc paths and instruct it to follow
  `${SKILLS_ROOT}/rad-plan-audit/references/full-audit.md`. The subagent
  returns a structured report with frontmatter `verdict: approved` or
  `verdict: issues_found`. The auditor does NOT edit either planning
  doc — it reports.
- If `verdict: approved`: proceed to Step 6.
- If `verdict: issues_found`:
    1. Dispatch the `planner` agent with the audit report path, the
       Requirements doc path, and the Master Plan path, instructing it
       to follow the corrections workflow at
       `${SKILLS_ROOT}/rad-plan-audit/references/corrections-workflow.md`.
       The planner applies fixes inline and returns a short summary of
       actioned and declined findings.
    2. Re-invoke the explosion subcommand to regenerate `phases/` and
       `tasks/` from the corrected Master Plan:

           node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" plan explode \
             --project-dir <project-dir> \
             --master-plan <master-plan-path> \
             --project-name <project-name>

       The subcommand auto-backs-up the pre-correction `phases/` and
       `tasks/` into `backups/{ISO-timestamp}/` and resets
       `state.graph.nodes.phase_loop` before re-seeding — nothing is
       overwritten destructively. The envelope is `{ ok, data, error }`;
       on success read `data.emittedPhases`, `data.emittedTasks`, and
       `data.backupDir`. On exit code `2` with `data.error` populated
       (parse failure in the corrected Master Plan), halt and surface
       the structured `data.error` payload (`{ line, expected, found,
       message }`) to the user — do not retry in-skill.
- Show the user the concise audit report, the planner's corrections
  summary, and (when re-exploded) the backup directory path.
- Single pass, no re-audit after corrections.

## Step 6: Finalize the plan
- Use the `askQuestions` tool to ask the user how they want to proceed and execute the plan:
- Give them 2 options "Execute Plan in current branch / worktree" or "Execute the plan in a new branch / worktree".
  - **Current branch**: Invoke the `/rad-execute` skill and follow its workflow start-to-finish without skipping or improvising from this skill's context. Source Control Initialization (rad-execute Step 3) is mandatory for fresh projects and MUST prompt the user for any `auto_commit` or `auto_pr` value set to `"ask"` in `orchestration.yml` (the default).
  - **New worktree**: Follow the `rad-execute-parallel` skill — set up the worktree and follow user's choices. Stop there. Do NOT begin execution and proceed with following the steps in `rad-execute-parallel`.
