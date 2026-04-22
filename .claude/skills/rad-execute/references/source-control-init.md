# Source Control Initialization

Detailed reference for the `rad-execute` orchestrator when `sourceControlInitialized` is `false` and `pipeline.source_control` must be populated before the first pipeline tick.

**Prerequisite:** the caller has already run `node {skillRoot}/scripts/gather-context.js --project-name {PROJECT_NAME}` and parsed its JSON output (the `--project-name` flag tells the script to peek at `{projectDir}/state.json` and emit `sourceControlInitialized`). `{skillRoot}` is the directory containing `rad-execute/SKILL.md`.

## Field resolution

| Init field | Source |
|---|---|
| `projectDir` | `projectDir` from script output (used as `--project-dir` for the pipeline CLI) |
| `worktree_path` | `repoRoot` from script output |
| `branch` | `currentBranch` from script output |
| `base_branch` | Prompt user (see `branch_from` schema below). Default = `defaultBranch` from script output. |
| `auto_commit` | If `configAutoCommit === "ask"`, prompt with the `auto_commit` schema. Otherwise pass `configAutoCommit` through unchanged. |
| `auto_pr` | If `configAutoPr === "ask"`, prompt with the `auto_pr` schema. Otherwise pass `configAutoPr` through unchanged. |
| `remote_url` | `remoteUrl` from script output. May be `""` — if empty, omit the `--remote-url` flag. |
| `compare_url` | `{remote_url}/compare/{base_branch}...{branch}` when `remote_url` is non-empty. Otherwise omit `--compare-url`. |

The `source_control_init` pipeline mutation normalizes `yes` → `always` and `no` → `never`, so the user's answers pass through unchanged.

## Question schemas

Build one `askQuestions` call containing only the questions whose condition is met (i.e., the `base_branch` question always, plus the `auto_commit`/`auto_pr` questions only when config is `"ask"`).

### `branch_from`

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

### `auto_commit` — only if `configAutoCommit === "ask"`

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

### `auto_pr` — only if `configAutoPr === "ask"`

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

## Pipeline invocation

After resolving all fields, fire the `source_control_init` pipeline event:

```
node {repoRoot}/{orchRoot}/skills/orchestration/scripts/pipeline.js --event source_control_init --project-dir "{projectDir}" --branch "{branch}" --base-branch "{baseBranch}" --worktree-path "{worktreePath}" --auto-commit "{resolvedAutoCommit}" --auto-pr "{resolvedAutoPr}" --remote-url "{remoteUrl}" --compare-url "{compareUrl}"
```

`{repoRoot}` and `{orchRoot}` come from the `gather-context.js` output. Omit the `--remote-url` and `--compare-url` flags when their resolved values are empty.

Verify the response contains `"success": true`. If it fails, show the error to the user and stop — do not proceed to execute the pipeline.
