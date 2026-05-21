---
name: rad-source-control
description: 'Source control operations — commit code or open a PR. All inputs come from the spawn prompt.'
user-invocable: false
---

# Source Control

Both operations are subcommands of the bundled `radorch` CLI. Each call emits a single JSON envelope on stdout of the shape `{ "ok": <bool>, "data": { ... }, "error": { ... } }`. Read result fields from inside `data` and emit the corresponding markdown block.

---

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

---

## PR Mode

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
