# Workflow Guide — Execute Parallel

Detailed reference for the agent executing the `rad-execute-parallel` skill. Covers question schemas, value resolution, the two-call source-control init flow, launch commands, and error handling.

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
      "description": "{projects[0].dir}/{projects[0].docs.masterPlan}"
    },
    {
      "label": "{projects[1].name}",
      "description": "{projects[1].dir}/{projects[1].docs.masterPlan}"
    }
  ],
  "allowFreeformInput": true
}
```

Build one option per project from `radorch project list` output (tier-filtered to `tier === 'execution'`). Each row carries `{ name, status, tier, sourceControlInitialized }` — run `radorch project show --id {name}` to obtain `dir` and `docs.masterPlan` for the description. Mark the first as `recommended`. Always include a Custom option at the end. If no projects were found, show only Custom.

**Resolve:** Named option → `projectName` = that label. Path ending `.md` → treat as `masterPlanPath`, derive `projectName` from parent folder. Otherwise → treat as `projectName`.

After resolving, if the worktree check was not already done, run `radorch project show --id {projectName}` and `radorch project worktrees --id {projectName}` to get project and existing worktree info.

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

### Q: `branch_from` — only when `worktreeExists === false`

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
    { "label": "Open Claude Code — auto (recommended)", "description": "Launches Claude Code with classifier-judged permissions — safer guard-rails, may pause on risky calls" },
    { "label": "Open Claude Code — bypass permissions (yolo)", "description": "Launches Claude Code skipping all permission prompts — fully autonomous, no guard-rails" },
    { "label": "Open Claude Code — accept edits", "description": "Launches Claude Code auto-accepting file edits; prompts for shell and other side-effecting calls" },
    { "label": "Open Claude Code — default (interactive)", "description": "Launches Claude Code prompting for every tool call — only use if you intend to babysit the session" },
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
| `masterPlanPath` | Compose from `project show --id {projectName}`: `{data.dir}/{data.docs.masterPlan}` |
| `projectDir` | `data.dir` from `project show --id {projectName}` |
| `branchName` | `{projectName}` |
| `worktreePath` | From `data.repos[0].path` returned by `radorch worktree create --project {projectName}` (the command returns a per-repo array — `repos[0]` is the launch directory) |
| `baseBranch` | `branch_from` answer |
| `resolvedAutoCommit` | `auto_commit` answer (`yes` → `always`, `no` → `never`), or `configAutoCommit` if it wasn't `"ask"` |
| `resolvedAutoPr` | `auto_pr` answer (`yes` → `always`, `no` → `never`), or `configAutoPr` if it wasn't `"ask"` |
| `permissionMode` | Parsed from `post_action` label: `"auto"` (auto), `"bypassPermissions"` (bypass/yolo), `"acceptEdits"` (accept edits), `"default"` (interactive). Only set when a Claude Code option was selected. |

**If the user chose "Use the existing worktree":**
- Set `worktreePath` = `existingWorktreePath`, `branchName` = `existingBranch`
- Same-branch reuse: the follow-up project continues on the same branch as the reused project, landing on top of prior work. No branch prompt fires (C cases are silent — see five-case routing below).
- **Skip** the `radorch worktree create` step — jump directly to `radorch source-control init`.

---

## Source Control Init (Two-Call Flow)

After worktree creation (or reuse), delegate to `rad-source-control`'s worktree flow for the provision → record sequence. The launcher stays thin — it does not carry init logic.

Run the two calls in order:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree create --project {projectName}
```

Then:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" source-control init --project {projectName}
```

The locate → decide → prompt → provision → record logic lives in `rad-source-control`'s [`working-with-worktrees.md`](../../rad-source-control/references/working-with-worktrees.md). Refer to it for the authoritative decision flow — the launcher delegates rather than duplicating it.

### Five-case routing summary

Cases A, B, and C are silent (no prompts). Prompts fire only at genuine forks:

| Case | Situation | Prompt? |
|---|---|---|
| **A — Fresh standard** | `kind === 'none'` or `kind === 'main-clone'`, standard project | No |
| **B — Side-project** | Project type is `side-project` | No |
| **C — Standing in target's worktree** | `kind === 'worktree'`, project already there | No |
| **C′ — Different project's worktree** | `kind === 'worktree'`, different project | Yes — confirm reuse; branch inherited from current worktree |
| **D — Main clone, no worktree wanted** | `kind === 'main-clone'`, user declines worktree | Yes — confirm in-place mode |
| **E — Reused set missing a repo** | Reusing existing set but a repo has no worktree yet | Yes — confirm pull-in |

Verify the `source-control init` envelope returns `ok: true`. On `ok: false`, show `error.message` and stop.

---

## Launch Commands

Execute the `post_action` chosen by the user. Prefer `masterPlanPath` as the argument if available, otherwise use `projectName`.

### Open in new VS Code window

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree launch --agent vscode --worktree-path "{worktreePath}"
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

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree launch --agent copilot --worktree-path "{worktreePath}" --prompt "Start project execution for project {masterPlanPath or projectName}"
```

### Open Claude Code

```
MSYS_NO_PATHCONV=1 node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree launch --agent claude --worktree-path "{worktreePath}" --prompt "/rad-execute {projectName}" --permission-mode "{permissionMode}"
```

The subcommand handles Windows, macOS, and Linux internally — no platform-specific branching needed here. The `MSYS_NO_PATHCONV=1` prefix disables Git Bash's POSIX-to-Windows path conversion so the leading `/` in the slash-command prompt survives the shell → `node.exe` argument boundary; the subcommand also defensively repairs MSYS-mangled prompts as a safety net.

### Open terminal at worktree

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree launch --agent terminal --worktree-path "{worktreePath}"
```

### Do nothing

Inform the user: *"Worktree is ready at `{worktreePath}` on branch `{branchName}`."*

---

## Error Handling

### `radorch worktree create` errors

| `errorType` | Likely cause | Suggested fix |
|---|---|---|
| `already_exists_path` | Folder at worktree path already exists | Delete/rename the folder, or choose "Use the existing worktree" |
| `already_exists_branch` | Git branch name already taken | Run `git worktree add "{worktreePath}" "{branchName}"` to check out the existing branch instead of creating a new one |
| `invalid_reference` | `baseBranch` ref not found | Run `git fetch` and retry; verify with `git branch -r` |
| `unknown` | Unclassified git error | Show the raw error; suggest `git worktree list` to inspect state |

**Do NOT proceed** to `source-control init` if worktree creation fails.

### Partial success (exit code 1)

The worktree was created but `git push -u origin` failed. This is non-blocking — proceed with `source-control init` and launch. The branch can be pushed later.
