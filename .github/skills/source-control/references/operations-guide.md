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

{body}
```

Where:
- `{prefix}` — resolved from the prefix resolution table above
- `{taskId}` — the task identifier in the format `P{NN}-T{NN}` (e.g., `P01-T02`)
- `{handoffTitle}` — the task title from the handoff document
- `{body}` — 3–6 prose lines drawn from the task handoff's **description** and/or **goals** fields; omitted when no description or goals content is present

Body construction rules:
- Separate subject from body with exactly one blank line (standard conventional-commit spec)
- Body is 3–6 lines drawn from the task handoff’s **description** and/or **goals** fields
- Each line is a plain prose sentence with bullet; no trailing whitespace
- Multi-line string is passed as a single `--message` argument (newlines embedded as `\n`)
- Body is **omitted** if the handoff has no description or goals content

Example (with body):
```
feat(P02-T03): Add remote_url detection to source_control_init

- Detects the GitHub HTTPS remote URL from git remote get-url origin.
- Converts SSH remotes (git@github.com:org/repo.git) to HTTPS.
- Stores remote_url and compare_url in pipeline.source_control.
- Enables branch compare links in the monitoring dashboard.
```

Example (title-only, no body):
```
feat(P02-T05): Create scripts/git-commit.js
```

Example with fallback prefix:
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

**Completion rule:** After logging the error, **output your commit result block** — the Orchestrator reads it and signals `task_committed` with the extracted values.

- On partial failure: log the error, then output the partial-failure result block (commit hash IS available)
- On full failure: log the error, then output the full-failure result block
- Never call `pipeline.js` from within the Source Control Agent — the Orchestrator is the sole caller of the pipeline script

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

---

## 8. Feedback Output Patterns

After parsing the JSON result from stdout, output one of these three patterns:

**Full success** (exit code 0):
```
✓  Committed:  {commitMessage}
✓  Pushed to:  origin/{branch}
```

**Partial failure** — committed but push failed (exit code 1):
```
✓  Committed:  {commitMessage}
✗  Push failed: {error}
   Error logged to project error log.
   To retry: run `git push` from the worktree at {worktreePath}
```

**Full failure** — commit failed (exit code 2):
```
✗  Commit failed: {error}
   Error logged to project error log.
   Pipeline will continue without committing {taskId}.
   To diagnose: run `git status` from the worktree at {worktreePath}
```

---

## 9. Commit Result Block

After outputting the human-readable feedback above, **always append a `## Commit Result` block** as the final output. The Orchestrator scans for this block to extract the values it passes to `task_committed`.

**Format** (required for every code path):

```
## Commit Result
```json
{ "commitHash": "<hash-or-null>", "pushed": <true|false>, "error": "<message-or-null>" }
```
```

**Values for each outcome:**

| Outcome | `commitHash` | `pushed` | `error` |
|---------|-------------|----------|---------|
| Full success | short SHA | `true` | `null` |
| Partial failure (push failed) | short SHA | `false` | push error message |
| Full failure (commit failed) | `null` | `false` | commit error message |
| `pipeline.source_control` absent | `null` | `false` | `"source_control context absent — commit skipped"` |
| Worktree path inaccessible | `null` | `false` | error message |
| Script execution error | `null` | `false` | error message |

**Example — full success:**

```
## Commit Result
```json
{ "commitHash": "a1b2c3d", "pushed": true, "error": null }
```
```

**Example — partial failure:**

```
## Commit Result
```json
{ "commitHash": "a1b2c3d", "pushed": false, "error": "fatal: unable to access remote" }
```
```

**Example — full failure:**

```
## Commit Result
```json
{ "commitHash": null, "pushed": false, "error": "nothing to commit, working tree clean" }
```
```
