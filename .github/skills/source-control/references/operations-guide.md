# Commit Operations Guide

This document is the primary reference for the Source Control Agent when performing a commit. It covers staging changes, constructing commit messages, executing the commit+push sequence, handling failures, and escalating errors.

---

## 1. Staging All Changes

The Source Control Agent stages all changes in the worktree using `git add -A`. Key rules:

- All changes in the worktree are staged using `git add -A` — there is no selective staging in v1
- The staging command is executed from the **worktree path** (not the current working directory of the agent)
- The worktree path is obtained from `pipeline.source_control.worktree_path` in `state.json`
- The `git-commit.js` script handles staging internally — the agent does **NOT** run `git add` separately before invoking the script

---

## 2. Commit Message Construction

The agent constructs the commit message before invoking the script. Message construction involves two steps: resolving the prefix and assembling the format.

### Prefix Resolution Table

The agent resolves a commit prefix by scanning the task type or handoff title for keywords. Use the **first match** found (scan top-to-bottom).

| Task Type Keywords | Prefix |
|--------------------|--------|
| feature, feat, new | `feat` |
| fix, bug, patch | `fix` |
| refactor, restructure, clean | `refactor` |
| test, testing, spec | `test` |
| doc, docs, documentation | `docs` |
| *(fallback — no keyword match)* | `chore` |

Resolution logic:
- Scan the task type and/or handoff title for the keywords in the left column
- Use the **first match** found (scan top-to-bottom)
- If no keywords match, default to `chore`
- `chore` covers maintenance, tooling, and configuration tasks

### Format

The commit message format is:

```
{prefix}({taskId}): {handoffTitle}
```

Where:
- `{prefix}` — resolved from the prefix resolution table above
- `{taskId}` — the task identifier in the format `P{NN}-T{NN}` (e.g., `P01-T02`)
- `{handoffTitle}` — the task title from the handoff document

Example:
```
feat(P02-T05): Create scripts/git-commit.js
```

Example with fallback:
```
chore(P02-T08): Copy pipeline-engine.js to staging area
```

---

## 3. Atomic Commit and Push

The Source Control Agent invokes `git-commit.js` to perform the commit+push operation as a single atomic sequence.

**Script invocation:**
```
node git-commit.js --worktree-path <path> --message "<commit message>"
```

The script performs three operations in sequence:
1. `git add -A` — stage all changes
2. `git commit -m "<message>"` — create the commit
3. `git push` — push to remote

**Both commit and push must succeed** for the operation to be considered fully successful.

The agent constructs the commit message BEFORE invoking the script — the message is a pre-built argument passed to the script. The script returns a structured JSON result on stdout which the agent MUST parse.

**Script arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `--worktree-path` | string | Yes | Absolute path to the git worktree |
| `--message` | string | Yes | Full commit message (pre-constructed by agent) |

---

## 4. Partial Failure Detection

The script exits with one of three exit codes, each representing a distinct state:

| Exit Code | Meaning | State |
|-----------|---------|-------|
| `0` | Fully successful | Committed + pushed |
| `1` | Partial failure | Committed locally but push failed |
| `2` | Full failure | Commit itself failed (e.g., nothing to commit) |

**Key distinction:** Exit code 1 (partial failure) is a distinct error state where the commit was created locally but the remote push failed. The commit hash IS available in this state. This is NOT the same as a full failure — the local repository has been modified.

The JSON result fields `committed`, `pushed`, `commitHash`, `error`, and `errorType` distinguish the three states precisely. The agent MUST inspect the JSON result — not just the exit code — to determine the exact failure mode.

---

## 5. Structured Result Patterns

The `git-commit.js` script returns one of three JSON result shapes on stdout. The agent MUST handle all three.

**Full Success** (exit code 0):
```json
{
  "committed": true,
  "pushed": true,
  "commitHash": "a1b2c3d",
  "error": null,
  "errorType": null
}
```

**Partial Failure — push failed** (exit code 1):
```json
{
  "committed": true,
  "pushed": false,
  "commitHash": "a1b2c3d",
  "error": "fatal: unable to access remote",
  "errorType": "push_failed"
}
```

**Full Failure — commit failed** (exit code 2):
```json
{
  "committed": false,
  "pushed": false,
  "commitHash": null,
  "error": "nothing to commit, working tree clean",
  "errorType": "nothing_to_commit"
}
```

**Result field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `committed` | boolean | Whether `git commit` succeeded |
| `pushed` | boolean | Whether `git push` succeeded |
| `commitHash` | string \| null | Short commit hash if committed; null otherwise |
| `error` | string \| null | Error message on any failure; null on full success |
| `errorType` | `"commit_failed"` \| `"push_failed"` \| `"nothing_to_commit"` \| null | Typed failure category; null on full success |

The `errorType` values:
- `"nothing_to_commit"` — working tree is clean; not a critical error
- `"commit_failed"` — the `git commit` command itself failed
- `"push_failed"` — committed locally but the remote push failed; commit hash is available

---

## 6. When to Invoke the `log-error` Skill

The `log-error` skill is invoked when the JSON result contains a non-null `error` field. The simple rule: **invoke `log-error` whenever `error` is non-null**.

- Invoke `log-error` on **partial failure** (exit code 1, `errorType: "push_failed"`) — log the push failure
- Invoke `log-error` on **full failure** (exit code 2, `errorType: "commit_failed"` or `"nothing_to_commit"`) — log the commit failure
- **Never** invoke `log-error` on **full success** (exit code 0, `error: null`)

**Pipeline continuation rule:** After logging the error, **always signal `task_committed`** — the pipeline must never stall.

- On partial failure: log the error, then signal `task_committed` with the partial-failure context (commit hash IS available)
- On full failure: log the error, then signal `task_committed` with the error context
- The `task_committed` event is the mechanism that advances the pipeline — omitting it causes the pipeline to stall indefinitely

---

## 7. Agent Feedback Symbols

The Source Control Agent uses these symbols when reporting outcomes:

| Symbol | Meaning |
|--------|---------|
| `✓` | Success — operation completed fully |
| `✗` | Failure — operation failed (partial or full) |
| `ℹ` | Informational — notice, skip, or non-critical status |

Usage:
- `✓` — after full success (committed + pushed)
- `✗` — after partial failure (committed but push failed) or full failure (commit failed)
- `ℹ` — when source control state is absent (graceful skip), or when reporting non-critical information
