## PR Mode

### Single-repo mode

**1. Run:**
```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" git pr \
  --worktree-path "<worktree>" \
  --branch "<branch>" \
  --base-branch "<base-branch>" \
  --title "<project-name>" \
  [--body-file "<path>"]
```
`--body-file` is the path to a markdown file that becomes the PR description on GitHub. Pass it when a body file path is provided in the prompt; omit it otherwise (PR will have no description).

**2. Parse the envelope on stdout. Read fields from `data` and emit:**
````
## PR Result
```json
{ "pr_created": <data.pr_created>, "pr_url": "<data.pr_url-or-null>", "pr_number": <data.pr_number-or-null>, "pr_existed": <data.pr_existed>, "error": "<data.error-or-null>", "message": "<data.message>" }
```
````

### Multi-repo fan-out mode

Use fan-out mode when the project has more than one repository. Compose all PR descriptions first, then pass the full array to the CLI in a single call.

**1. Compose one PR description per repo** (single pass, no CLI calls yet):

For each repo in `pipeline.source_control.repos`, author a PR title and description body. The body should summarise work done in that repo during this project.

**2. Run the fan-out CLI:**
```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" git pr \
  --repos '<json>'
```

`--repos` accepts a JSON array. Each element must match the `FanOutRepo` shape exactly:

```json
[
  {
    "name": "<repo-name>",
    "path": "<absolute-path-to-worktree>",
    "branch": "<head-branch>",
    "baseBranch": "<base-branch>",
    "title": "<pr-title>",
    "description": "<pr-body-markdown>"
  }
]
```

Field reference for each repo object:
- `name` — repo identifier (matches `pipeline.source_control.repos[].name`)
- `path` — absolute path to the worktree for this repo
- `branch` — head branch to open the PR from
- `baseBranch` — base branch to target (typically `main`)
- `title` — PR title string
- `description` — full PR description body (markdown)

**3. Parse the envelope on stdout.** On success, `data` is an array of result objects:

```json
[
  { "name": "<repo-name>", "pr_url": "<url>" }
]
```

Each result element matches the `FanOutResult` shape: `name` (repo identifier) and `pr_url` (the created or existing PR URL).

**4. Relay the result as a single array-shaped `pr_created` signal:**

```json
{
  "repos": [
    { "name": "<repo-name>", "pr_url": "<url>" }
  ]
}
```

Pass the entire `data` array from step 3 directly as `repos` in the signal payload. The pipeline engine writes each `pr_url` to the matching `source_control.repos[]` entry by name.

**Failure discipline (fan-out):**

- If the CLI returns an error envelope (`ok: false`) or throws, halt and report the error.
- On retry, the CLI's already-open-PR check (`pr_existed: true`) is idempotent — re-running fan-out for a repo that already has a PR returns its existing URL without creating a duplicate.
- Apply the same halt-then-retry guard as for commit: surface the error, let the operator decide whether to retry or skip.
