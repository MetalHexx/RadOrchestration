---
description: "Start a project executing in a new parallel worktree. Creates the worktree interactively, then launches orchestration execution in it — via a new VS Code window, Copilot CLI, or a terminal."
argument-hint: "[project name or master plan path]"
---

# Execute Project in Parallel Worktree

Set up a dedicated worktree for a project and launch its orchestration execution
inside it. Follow each step in order. Do NOT skip or reorder steps.

---

## Step 1 — Identify the Project (Silent)

Before doing anything else, determine the project to execute:

1. Check the current conversation, open files, and recently run commands for:
   - A project name in `SCREAMING-CASE` (e.g. `MY-FEATURE`, `FIX-LOGIN`)
   - A path to a Master Plan document (e.g. `…/MY-FEATURE/MY-FEATURE-MASTER-PLAN.md`)
   - A `state.json` path referencing a project
   - An argument passed to this prompt (see `argument-hint`)

2. If a project is clearly identified, store:
   - **`projectName`** — the short project identifier (e.g. `MY-FEATURE`)
   - **`masterPlanPath`** — absolute path to the master plan file, if found; otherwise `null`

3. If the project cannot be determined from context, discover available projects:

   **a. Read `orchestration.yml`** to find the projects folder:
   - Look for `.github/skills/orchestration/config/orchestration.yml` in the workspace root
   - Read `projects.base_path` — this is the folder where project folders live
     (e.g. `C:\dev\orchestration-projects`)

   **b. Scan the projects folder** for qualifying projects:
   - List all immediate subdirectories that do **not** start with `_` (those are archived)
   - For each, check whether a `state.json` file exists
   - Read each `state.json` and keep only projects where:
     - `planning.status === "complete"` AND
     - `planning.human_approved === true`
   - For each qualifying project, extract:
     - `name` — the folder name (e.g. `MY-FEATURE`)
     - `tier` — `pipeline.current_tier` (e.g. `execution`, `review`, `complete`)
     - `masterPlanPath` — the `doc_path` of the step where `name === "master_plan"` inside
       `planning.steps`; use `null` if not found

   **c. Sort** qualifying projects so the most actionable appear first:
   `execution` → `review` → `planning` → `complete` → everything else.
   Within each tier, sort alphabetically.

   **d. Build the `askQuestions` call** using up to 4 of the top qualifying projects as options.
   For each option use:
   - `label`: the project name (e.g. `MY-FEATURE`)
   - `description`: `[{tier}]  {masterPlanPath}` if a master plan path is known,
     or `[{tier}]` alone if not.
   - Mark the first option as `"recommended": true`

   Always add a final option:
   ```json
   { "label": "Custom", "description": "Type a project name or paste a master plan path" }
   ```

   Example call shape (substitute real project data):
   ```json
   {
     "questions": [
       {
         "header": "project_name",
         "question": "Which project do you want to run in this parallel worktree?",
         "options": [
           {
             "label": "MY-FEATURE",
             "recommended": true,
             "description": "[execution]  C:\\dev\\orchestration-projects\\MY-FEATURE\\MY-FEATURE-MASTER-PLAN.md"
           },
           {
             "label": "FIX-LOGIN",
             "description": "[review]  C:\\dev\\orchestration-projects\\FIX-LOGIN\\FIX-LOGIN-MASTER-PLAN.md"
           },
           {
             "label": "Custom",
             "description": "Type a project name or paste a master plan path"
           }
         ],
         "allowFreeformInput": true
       }
     ]
   }
   ```

   **e. Fallback** — if no qualifying projects are found (empty projects folder, no approved
   plans, or `orchestration.yml` is missing), show a single free-text option:
   ```json
   {
     "questions": [
       {
         "header": "project_name",
         "question": "Which project do you want to run in this parallel worktree?",
         "options": [
           {
             "label": "Custom",
             "description": "Type a project name or paste a master plan path"
           }
         ],
         "allowFreeformInput": true
       }
     ]
   }
   ```

   **f. Resolve the answer:**
   - If the user selected a named project option → `projectName` = that label,
     `masterPlanPath` = the path embedded in the description (or look it up from the
     scanned project list).
   - If the user typed a value ending in `.md` → treat as `masterPlanPath`;
     derive `projectName` from the parent folder name.
   - Otherwise → treat the typed value as `projectName` directly.

Store both values before proceeding.

---

## Step 2 — Check for an Existing Worktree

Before creating anything, check whether a worktree for this project already exists.

**a. Check `state.json`** for the project (found via `projects.base_path/{projectName}/state.json`):
- Read `pipeline.source_control.worktree_path` — store as **`existingWorktreePath`** (may be `null`)
- Read `pipeline.source_control.branch` — store as **`existingBranch`** (may be `null`)

**b. Verify on disk** — if `existingWorktreePath` is non-null:
- Run `git worktree list --porcelain` from the repo root
- Check whether `existingWorktreePath` appears in the output
- If it does → the worktree is **active** (`worktreeExists = true`)
- If it does not → the path is stale (removed outside git); treat as `worktreeExists = false`

**c. If `worktreeExists === true`**, call `askQuestions` with **1 question**:

```json
{
  "questions": [
    {
      "header": "use_existing_worktree",
      "question": "A worktree for {projectName} already exists. What would you like to do?",
      "options": [
        {
          "label": "Use the existing worktree",
          "recommended": true,
          "description": "{existingWorktreePath}  (branch: {existingBranch})"
        },
        {
          "label": "Create a new worktree",
          "description": "Set up a fresh worktree — useful if the existing one is in a bad state"
        }
      ],
      "allowFreeformInput": false
    }
  ]
}
```

- If the user chose **"Use the existing worktree"**:
  - Set **`worktreePath`** = `existingWorktreePath` and **`branchName`** = `existingBranch`
  - **Skip Step 3 entirely** — jump straight to Step 4 (Source Control Setup).
    When you reach Step 5 (Launch Execution), treat the post-creation action
    as if the user had chosen "Open terminal at worktree"
    (i.e. `cd "{worktreePath}"`) unless they indicate otherwise.
- If the user chose **"Create a new worktree"**:
  - Continue to Step 3 as normal.

**d. If `worktreeExists === false`** (no worktree found), continue to Step 3.

---

## Step 3 — Create the Worktree

> **You are now re-using the `/rad-create-worktree` prompt.**
> Follow every step of that prompt exactly — from **Step 1 (Gather Context)** through
> **Step 7 (Create the Worktree)**.
>
> When generating **branch name suggestions** (Step 2, Q1), incorporate `projectName`
> to produce contextually accurate suggestions.
> For example, if `projectName` is `FIX-LOGIN`, suggest `fix/login` and `fix/login-flow`.

---

## Step 4 — Source Control Setup

After the worktree is created (or confirmed from Step 2), configure source control for
this project run before launching execution.

**a. Read source control config** from `orchestration.yml`
(at `{orchRoot}/skills/orchestration/config/orchestration.yml`, where `{orchRoot}` is the
workspace root + `system.orch_root` — typically `.github`):

- `source_control.auto_commit` → store as **`configAutoCommit`** (`always`, `ask`, or `never`)
- `source_control.auto_pr` → store as **`configAutoPr`** (`always`, `ask`, or `never`)

If `orchestration.yml` is missing or the `source_control` block is absent, default both to `"ask"`.

**b. Resolve `baseBranch`** for the pipeline call:

- If Step 3 was executed: **`baseBranch`** = `branchFrom` (the branch origin selected in
  `/rad-create-worktree` Step 5, Q3)
- If the worktree was reused from Step 2 (Step 3 was skipped): detect the default remote
  branch by running `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null` from `worktreePath`
  and extracting the trailing segment (e.g. `main` from `refs/remotes/origin/main`).
  If detection fails, default to `"main"`.

**c. Resolve `ask` values** — if either config value is `"ask"`, ask the user:

- If **both** `configAutoCommit` and `configAutoPr` are already `always` or `never`:
  set **`resolvedAutoCommit`** = `configAutoCommit` and **`resolvedAutoPr`** = `configAutoPr`.
  Skip to step **e** — no questions needed.

- If **at least one** is `"ask"`, call `askQuestions` with a single call containing only the
  applicable questions. Include the `auto_commit` question only if `configAutoCommit === "ask"`;
  include the `auto_pr` question only if `configAutoPr === "ask"`:

```json
{
  "questions": [
    {
      "header": "auto_commit",
      "question": "How should auto-commit behave for this project run?",
      "options": [
        {
          "label": "always",
          "recommended": true,
          "description": "Commit and push automatically after every approved task"
        },
        {
          "label": "never",
          "description": "Skip commits — you'll handle git manually"
        }
      ],
      "allowFreeformInput": false
    },
    {
      "header": "auto_pr",
      "question": "How should auto-PR behave for this project run?",
      "options": [
        {
          "label": "always",
          "recommended": true,
          "description": "Create a pull request automatically when the project completes final review"
        },
        {
          "label": "never",
          "description": "Skip PR creation — you'll open a pull request manually"
        }
      ],
      "allowFreeformInput": false
    }
  ]
}
```

If only `auto_commit` is `"ask"` (and `auto_pr` is not), include only the first question.
If only `auto_pr` is `"ask"` (and `auto_commit` is not), include only the second question.
If both are `"ask"`, include both questions in the single call.

**d. Store resolved values:**

- For each question answered: **`resolvedAutoCommit`** / **`resolvedAutoPr`** = the user's
  choice (`always` or `never`)
- For each question NOT asked (config was already `always` or `never`): use the config value

At this point both **`resolvedAutoCommit`** and **`resolvedAutoPr`** are `always` or `never`.
The value `ask` is never passed to the pipeline.

**e. Call `source_control_init`** to write source control metadata to state:

```
node {orchRoot}/skills/orchestration/scripts/pipeline.js --event source_control_init --project-dir {projectDir} --context '{"branch":"{branchName}","base_branch":"{baseBranch}","worktree_path":"{worktreePath}","auto_commit":"{resolvedAutoCommit}","auto_pr":"{resolvedAutoPr}"}'
```

Where:
- **`{orchRoot}`** = workspace root + `system.orch_root` from `orchestration.yml` (e.g. `.github`)
- **`{projectDir}`** = `projects.base_path` + `/{projectName}` from `orchestration.yml`
- **`{branchName}`** = from Step 2 or Step 3
- **`{baseBranch}`** = resolved in step **b**
- **`{worktreePath}`** = from Step 2 or Step 3
- **`{resolvedAutoCommit}`** = `always` or `never`
- **`{resolvedAutoPr}`** = `always` or `never`

The pipeline call returns JSON. Verify the response contains `"success": true`.
If it fails, show the error to the user and do NOT proceed to Step 5.

---

## Step 5 — Launch Execution

After source control is configured (Step 4), execute the post-creation action the user
chose in Step 6 (Q4) of the `/rad-create-worktree` prompt.
(If the user reused an existing worktree and no Q4 was asked, default to "Open terminal at worktree".)

Apply these rules, in priority order:

### If the user chose "Open Copilot CLI" AND `projectName` is known

Instead of the generic `copilot code` command from `/rad-create-worktree`, open an external
terminal window and run the specialised orchestration command in the worktree directory.

Prefer `masterPlanPath` as the argument if available, otherwise use `projectName`.

Use the command matching `platform` (detected in Step 1 of `/rad-create-worktree`):

- **Windows** (run in sequence — `{projectDir}` is the directory containing `{masterPlanPath}`):
  ```powershell
  $innerCmd = "copilot --agent orchestrator --add-dir '{projectDir}' --allow-tool=shell -i 'Start project execution for project {masterPlanPath or projectName}'"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($innerCmd))
  Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList "-Command", "wt --startingDirectory '{worktreePath}' powershell -NoExit -EncodedCommand $encoded"
  ```
- **macOS**:
  `osascript -e 'tell application "Terminal" to do script "cd \"{worktreePath}\" && copilot --agent orchestrator --prompt \"Start project execution for project {masterPlanPath or projectName}\""'`
- **Linux**:
  `gnome-terminal -- bash -c "cd '{worktreePath}' && copilot --agent orchestrator --prompt 'Start project execution for project {masterPlanPath or projectName}'; exec bash"`

Inform the user:
*"Copilot CLI is launching orchestration for `{projectName}` in `{worktreePath}` on branch `{branchName}`."*

### If the user chose "Open Claude Code" AND `projectName` is known

Instead of the generic `claude` command from `/rad-create-worktree`, open an external
terminal window and run the specialised orchestration command in the worktree directory.

Prefer `masterPlanPath` as the argument if available, otherwise use `projectName`.

Use the command matching `platform`:

- **Windows** (run in sequence):
  ```powershell
  $innerCmd = "claude --agent orchestrator -i 'Start project execution for project {masterPlanPath or projectName}'"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($innerCmd))
  Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList "-Command", "wt --startingDirectory '{worktreePath}' powershell -NoExit -EncodedCommand $encoded"
  ```
- **macOS**:
  `osascript -e 'tell application "Terminal" to do script "cd \"{worktreePath}\" && claude --agent orchestrator \"Start project execution for project {masterPlanPath or projectName}\""'`
- **Linux**:
  `gnome-terminal -- bash -c "cd '{worktreePath}' && claude --agent orchestrator 'Start project execution for project {masterPlanPath or projectName}'; exec bash"`

Inform the user:
*"Claude Code is launching orchestration for `{projectName}` in `{worktreePath}` on branch `{branchName}`."*

### If the user chose "Open in new VS Code window"

Run: `code "{worktreePath}"`

Then inform the user:

```
──────────────────────────────────────────────
  Next step
  1. Wait for the new VS Code window to open
  2. In that window, use /rad-execute to start
     project execution for {projectName}
──────────────────────────────────────────────
```

### If the user chose "Open terminal at worktree"

Run: `cd "{worktreePath}"`

Then inform the user:
*"Terminal is now at `{worktreePath}`. Run `/rad-execute` here when you're ready to start `{projectName}`."*

### If the user chose "Do nothing"

No additional action. The success confirmation from Step 7 of `/rad-create-worktree` is sufficient.
