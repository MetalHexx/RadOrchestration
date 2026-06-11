## Commit Mode

**1. Build the commit message** from the spawn prompt. Derive the prefix from the task title or type (first match):

| Keywords | Prefix |
|----------|--------|
| feature, feat, new | `feat` |
| fix, bug, patch | `fix` |
| refactor, restructure, clean | `refactor` |
| test, testing, spec | `test` |
| doc, docs, documentation | `docs` |
| *(no match)* | `chore` |

For a multi-repo task, compose **one** commit message header in a single pass:

Format: `{prefix}({taskId}): {title}`
Optional body: blank line then 2–4 prose lines from the task description.

**2. Run (fan-out across all repos in one command):**
```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" git commit \
  --repos '[{"name":"<repo>","path":"<worktree-abs-path>","message":"<commit-message>"}, ...]'
```

Where `--repos` is the JSON array of per-repo objects (each carrying `name`, `path`, and `message`). The CLI commits every repo in a single pass and returns a structured per-repo result array.

**3. Parse the envelope on stdout. The `data.repos` field is a per-repo array. Relay the entire array into one array-shaped `commit_completed` signal:**
````
## Commit Result
```json
{
  "repos": <data.repos>
}
```
````

Each entry in `data.repos` carries: `{ "name": "<repo>", "committed": <bool>, "commitHash": "<hash-or-null>", "pushed": <bool> }`.

A partial-success commit (commit landed but push failed) is still envelope-success (`ok: true`); the failure surfaces via `pushed=false` on the affected repo entry. Treat committed repos as commit successes regardless of push outcome.

A remote-less repo (such as a side-project) also returns `ok: true` with `pushed=false`. This is expected — the commit succeeded and there is simply no remote to push to. Do not treat it as a failure.

A `committed: false` entry means the repo was skipped (e.g., no changes). This is a clean skip — relay it as-is in the array; the mutation ignores it without error.

PR Mode is never invoked for a side-project (`auto_pr: never`). A side-project has no remote and therefore no pull-request surface; skip the PR step entirely when the project kind is `side-project`.
