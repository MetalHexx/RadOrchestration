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

Format: `{prefix}({taskId}): {title}`
Optional body: blank line then 2–4 prose lines from the task description.

**2. Run:**
```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" git commit --worktree-path "<worktree>" --message "<message>"
```

**3. Parse the envelope on stdout. Read fields from `data` and emit:**
````
## Commit Result
```json
{ "committed": <data.committed>, "pushed": <data.pushed>, "commitHash": "<data.commitHash-or-null>", "error": "<data.error-or-null>", "errorType": "<data.errorType-or-null>" }
```
````

A partial-success commit (commit landed but push failed) is still envelope-success (`ok: true`); the failure surfaces via `data.pushed=false` and `data.errorType="push_failed"`. Treat it as a commit success in your block.

A remote-less repo (such as a side-project) also returns `ok: true` with `data.pushed=false`, but carries **no** `errorType`. This is expected — the commit succeeded and there is simply no remote to push to. Do not treat it as a failure. The distinction: `push_failed` always sets `errorType`; a clean remote-less result does not.

PR Mode is never invoked for a side-project (`auto_pr: never`). A side-project has no remote and therefore no pull-request surface; skip the PR step entirely when the project kind is `side-project`.
