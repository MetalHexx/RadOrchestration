# Source Control Initialization

Detailed reference for the `rad-execute` orchestrator when `sourceControlInitialized` is `false` and `pipeline.source_control` must be populated before the first pipeline tick.

**Prerequisite:** the caller has already run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project context --project-name {PROJECT_NAME}` and read `data.sourceControlInitialized` from the envelope (the `--project-name` flag tells the subcommand to peek at `{projectDir}/state.json` and emit `sourceControlInitialized` inside the `data` block).

## Field resolution

| Init field | Source |
|---|---|
| `projectDir` | `data.projectDir` (used as `--project-dir` for the `radorch pipeline signal` subcommand) |
| `worktree_path` | `data.repoRoot` |
| `branch` | `data.currentBranch` |
| `base_branch` | Prompt user with a free-form `base_branch` question; default = `data.defaultBranch`. |
| `auto_commit` | If `data.configAutoCommit === "ask"`, prompt with the `auto_commit` schema. Otherwise pass `data.configAutoCommit` through unchanged. |
| `auto_pr` | If `data.configAutoPr === "ask"`, prompt with the `auto_pr` schema. Otherwise pass `data.configAutoPr` through unchanged. |
| `remote_url` | `data.remoteUrl`. May be `""` — if empty, omit the `--remote-url` flag. |
| `compare_url` | `{remote_url}/compare/{base_branch}...{branch}` when `remote_url` is non-empty. Otherwise omit `--compare-url`. |

The `source_control_init` pipeline mutation normalizes `yes` → `always` and `no` → `never`, so the user's answers pass through unchanged.

## Question schemas

Use `askQuestions` tool when auto_commit or auto_pr are set to `"ask"` to prompt the user with the following schemas. Only prompt for the relevant question(s) based on which fields need resolution.

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
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" pipeline signal --event source_control_init --project-dir "{projectDir}" --branch "{branch}" --base-branch "{baseBranch}" --worktree-path "{worktreePath}" --auto-commit "{resolvedAutoCommit}" --auto-pr "{resolvedAutoPr}" --remote-url "{remoteUrl}" --compare-url "{compareUrl}"
```

Omit the `--remote-url` and `--compare-url` flags when their resolved values are empty.

Verify the envelope returns `ok: true`. On `ok: false`, show `error.message` to the user and stop — do not proceed to execute the pipeline.
