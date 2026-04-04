# Workflow Guide — Execute Parallel

Detailed reference for the agent executing the `execute-parallel` skill. Covers question schemas, value resolution, the `source_control_init` pipeline call, launch commands, and error handling.

---

## Conventions (Applied Automatically)

| Value | Rule | Example |
|---|---|---|
| Branch name | Same as project folder name | `MY-FEATURE` |
| Worktree path | `{repoParent}/{repoName}-worktrees/{projectName}` | `C:\dev\v3-worktrees\MY-FEATURE` |

---

## Question Schemas

Build **one** `askQuestions` call. Include only the questions whose condition is met, in the order listed below.

### Q: `project_name` — only if the project was NOT identified from context

```json
{
  "header": "project_name",
  "question": "Which project should run in this worktree?",
  "options": [
    {
      "label": "{projects[0].name}",
      "recommended": true,
      "description": "{projects[0].masterPlanPath}"
    },
    {
      "label": "{projects[1].name}",
      "description": "{projects[1].masterPlanPath}"
    }
  ],
  "allowFreeformInput": true
}
```

Build one option per project from `find-projects.js` output. Mark the first as `recommended`. Always include a Custom option at the end. If no projects were found, show only Custom.

**Resolve:** Named option → `projectName` = that label. Path ending `.md` → treat as `masterPlanPath`, derive `projectName` from parent folder. Otherwise → treat as `projectName`.

After resolving, if the worktree check was not already done, run `find-projects.js --project-name {projectName}` to get existing worktree info.

---

### Q: `use_existing_worktree` — only if `worktreeExists === true`

```json
{
  "header": "use_existing_worktree",
  "question": "A worktree for {projectName} already exists at {existingWorktreePath} (branch: {existingBranch}). What would you like to do?",
  "options": [
    {
      "label": "Use the existing worktree",
      "recommended": true,
      "description": "Skip creation — reuse what's already there"
    },
    {
      "label": "Create a new worktree",
      "description": "Set up a fresh worktree (useful if the existing one is in a bad state)"
    }
  ],
  "allowFreeformInput": false
}
```

---

### Q: `branch_from` — always include

```json
{
  "header": "branch_from",
  "question": "Which branch should the worktree branch off from?",
  "options": [
    {
      "label": "origin/{defaultBranch}",
      "recommended": true,
      "description": "Default branch — clean, stable starting point"
    },
    {
      "label": "{currentBranch}",
      "description": "Your current branch — carry forward in-progress work"
    },
    { "label": "Custom", "description": "Type any branch name, tag, or commit ref" }
  ],
  "allowFreeformInput": true
}
```

---

### Q: `auto_commit` — only if `configAutoCommit === "ask"`

```json
{
  "header": "auto_commit",
  "question": "Auto-commit after every approved task?",
  "options": [
    { "label": "yes", "recommended": true, "description": "Commit and push automatically after every approved task" },
    { "label": "no", "description": "Skip commits — you'll handle git manually" }
  ],
  "allowFreeformInput": false
}
```

---

### Q: `auto_pr` — only if `configAutoPr === "ask"`

```json
{
  "header": "auto_pr",
  "question": "Auto-create a PR when the project completes final review?",
  "options": [
    { "label": "yes", "recommended": true, "description": "Create a pull request automatically at the end" },
    { "label": "no", "description": "Skip PR creation — you'll open one manually" }
  ],
  "allowFreeformInput": false
}
```

---

### Q: `post_action` — always include

```json
{
  "header": "post_action",
  "question": "How should the worktree be opened after setup?",
  "options": [
    { "label": "Open in new VS Code window", "recommended": true, "description": "Runs: code \"{worktreePath}\"" },
    { "label": "Open Copilot CLI", "description": "Launches orchestration via Copilot CLI in an external terminal" },
    { "label": "Open Claude Code", "description": "Launches orchestration via Claude Code in an external terminal" },
    { "label": "Open terminal at worktree", "description": "Opens an external terminal at the worktree path" },
    { "label": "Do nothing", "description": "Just create it — I'll navigate there myself" }
  ],
  "allowFreeformInput": false
}
```

---

## Value Resolution

After all answers are returned, derive these values:

| Value | Source |
|---|---|
| `projectName` | From conversation context or `project_name` answer |
| `masterPlanPath` | From context or `find-projects.js` output |
| `projectDir` | `{projectsBasePath}/{projectName}` |
| `branchName` | `{projectName}` |
| `worktreePath` | `{repoParent}/{repoName}-worktrees/{projectName}` |
| `baseBranch` | `branch_from` answer |
| `resolvedAutoCommit` | `auto_commit` answer, or `configAutoCommit` if it wasn't `"ask"` |
| `resolvedAutoPr` | `auto_pr` answer, or `configAutoPr` if it wasn't `"ask"` |

**If the user chose "Use the existing worktree":**
- Set `worktreePath` = `existingWorktreePath`, `branchName` = `existingBranch`
- **Skip** the `create-worktree.js` step — jump directly to `source_control_init`

---

## Source Control Init

After worktree creation (or reuse), call the pipeline to record source control settings:

```
node {repoRoot}/{orchRoot}/skills/orchestration/scripts/pipeline.js --event source_control_init --project-dir "{projectDir}" --branch "{branchName}" --base-branch "{baseBranch}" --worktree-path "{worktreePath}" --auto-commit "{resolvedAutoCommit}" --auto-pr "{resolvedAutoPr}" --remote-url "{remoteUrl}" --compare-url "{compareUrl}"
```

Use `remoteUrl` and `compareUrl` from `create-worktree.js` output. For reused worktrees where the script was not run, detect them manually:
- Run `git remote get-url origin` from the worktree path
- Convert SSH → HTTPS: `git@github.com:ORG/REPO.git` → `https://github.com/ORG/REPO`
- Strip trailing `.git` from HTTPS URLs
- `compareUrl` = `{remoteUrl}/compare/{baseBranch}...{branchName}` (strip `origin/` prefix from baseBranch)

Verify the response contains `"success": true`. If it fails, show the error and stop.

---

## Launch Commands

Execute the `post_action` chosen by the user. Prefer `masterPlanPath` as the argument if available, otherwise use `projectName`.

### Open in new VS Code window

```
code "{worktreePath}"
```

Display:
```
──────────────────────────────────────────────
  Next step
  1. Wait for the new VS Code window to open
  2. In that window, use /rad-execute to start
     project execution for {projectName}
──────────────────────────────────────────────
```

### Open Copilot CLI

**Windows:**
```powershell
$innerCmd = "copilot --agent orchestrator --add-dir '{projectDir}' --allow-tool=shell -i 'Start project execution for project {masterPlanPath or projectName}'"
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($innerCmd))
Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList "-Command", "wt --startingDirectory '{worktreePath}' powershell -NoExit -EncodedCommand $encoded"
```

**macOS:**
```
osascript -e 'tell application "Terminal" to do script "cd \"{worktreePath}\" && copilot --agent orchestrator --prompt \"Start project execution for project {masterPlanPath or projectName}\""'
```

**Linux:**
```
gnome-terminal -- bash -c "cd '{worktreePath}' && copilot --agent orchestrator --prompt 'Start project execution for project {masterPlanPath or projectName}'; exec bash"
```

### Open Claude Code

**Windows:**
```powershell
$innerCmd = "claude --agent orchestrator -i 'Start project execution for project {masterPlanPath or projectName}'"
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($innerCmd))
Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList "-Command", "wt --startingDirectory '{worktreePath}' powershell -NoExit -EncodedCommand $encoded"
```

**macOS:**
```
osascript -e 'tell application "Terminal" to do script "cd \"{worktreePath}\" && claude --agent orchestrator \"Start project execution for project {masterPlanPath or projectName}\""'
```

**Linux:**
```
gnome-terminal -- bash -c "cd '{worktreePath}' && claude --agent orchestrator 'Start project execution for project {masterPlanPath or projectName}'; exec bash"
```

### Open terminal at worktree

**Windows:** `Start-Process powershell -ArgumentList @("-NoExit", "-Command", "cd '{worktreePath}'")`

**macOS:** `osascript -e 'tell application "Terminal" to do script "cd \"{worktreePath}\""'`

**Linux:** `gnome-terminal -- bash -c "cd '{worktreePath}'; exec bash"`

### Do nothing

Inform the user: *"Worktree is ready at `{worktreePath}` on branch `{branchName}`."*

---

## Error Handling

### `create-worktree.js` errors

| `errorType` | Likely cause | Suggested fix |
|---|---|---|
| `already_exists_path` | Folder at worktree path already exists | Delete/rename the folder, or choose "Use the existing worktree" |
| `already_exists_branch` | Git branch name already taken | Run `git worktree add "{worktreePath}" "{branchName}"` to check out the existing branch instead of creating a new one |
| `invalid_reference` | `baseBranch` ref not found | Run `git fetch` and retry; verify with `git branch -r` |
| `unknown` | Unclassified git error | Show the raw error; suggest `git worktree list` to inspect state |

**Do NOT proceed** to `source_control_init` if worktree creation fails.

### Partial success (exit code 1)

The worktree was created but `git push -u origin` failed. This is non-blocking — proceed with `source_control_init` and launch. The branch can be pushed later.
