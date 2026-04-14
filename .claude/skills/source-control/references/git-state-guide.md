# Git State Guide

This document is the prerequisite reference for the Source Control Agent before performing any commit operation. It covers how to read pipeline state, handle absent state gracefully, validate the worktree before operating, and follow the correct state-reading sequence.

---

## 1. Reading `pipeline.source_control` from `state.json`

The agent reads `state.json` from the project directory and locates the `pipeline.source_control` sub-object. This sub-object contains all the context the agent needs to execute a commit.

### Field Reference

| Field | Type | Allowed Values | Purpose |
|-------|------|----------------|---------|
| `branch` | string | Any valid git branch name | The feature branch the worktree is checked out on |
| `base_branch` | string | Any valid git branch name | The base branch to merge into (e.g., `main`) |
| `worktree_path` | string | Absolute filesystem path | The absolute path to the git worktree directory |
| `auto_commit` | string | `"always"` \| `"never"` | Whether to auto-commit after code review approval |
| `auto_pr` | string | `"always"` \| `"never"` | Whether to auto-create a PR after all phases complete |
| `remote_url` | `string \| null` | GitHub HTTPS URL or `null` | GitHub HTTPS remote URL; auto-detected at `source_control_init` time from `git remote get-url origin`; `null` when detection fails or `--remote-url` was omitted |
| `compare_url` | `string \| null` | GitHub compare URL or `null` | Branch compare URL derived from `remote_url`; format: `{remote_url}/compare/{base_branch}...{branch}`; `null` when `remote_url` is `null` |

The 5 required fields (`branch`, `base_branch`, `worktree_path`, `auto_commit`, `auto_pr`) are always present when the `source_control` sub-object exists (schema-enforced). `remote_url` and `compare_url` are optional nullable fields — either may be `null` when remote URL detection fails or the `--remote-url` flag was omitted at `source_control_init` time. The schema enforces `additionalProperties: false` on the `source_control` object — no extra fields are permitted.

### Key Rules

- The `source_control` sub-object is written by the `source_control_init` pipeline event during project setup
- When the `source_control` sub-object exists, all 5 inner fields are required and present
- The values `"always"` and `"never"` are the only values that appear in state for `auto_commit` and `auto_pr` — the value `"ask"` is resolved by `rad-execute-parallel` before `source_control_init` runs and is **never** written to state

### Schema Reference

```json
"source_control": {
  "type": "object",
  "additionalProperties": false,
  "required": ["branch", "base_branch", "worktree_path", "auto_commit", "auto_pr"],
  "properties": {
    "branch": { "type": "string" },
    "base_branch": { "type": "string" },
    "worktree_path": { "type": "string" },
    "auto_commit": { "type": "string", "enum": ["always", "never"] },
    "auto_pr": { "type": "string", "enum": ["always", "never"] },
    "remote_url": { "oneOf": [{ "type": "string" }, { "type": "null" }] },
    "compare_url": { "oneOf": [{ "type": "string" }, { "type": "null" }] }
  }
}
```

### Task Commit Hash

Each Task record in `execution.phases[n].tasks` gains an optional `commit_hash` field written by the `commit_completed` pipeline event after a successful commit.

| Field | Type | Null Condition | Purpose |
|-------|------|----------------|---------|
| `commit_hash` | `string \| null` | `null` when `auto_commit` is `"never"`, commit was skipped, or no hash was returned | Short git commit hash (7 chars) of the commit created for this task |

The Source Control Agent does **not** write this field directly — it is written by the `COMMIT_COMPLETED` mutation handler in `mutations.ts` using the `commitHash` value returned by `git-commit.js` and passed through the Orchestrator via `--commit-hash`. The agent's responsibility is to include `commitHash` in its output result block so the Orchestrator can pass it to `pipeline.js`.

#### Schema Reference (Task item)

```json
// Task item in execution.phases[n].tasks
"commit_hash": {
  "oneOf": [
    { "type": "string" },
    { "type": "null" }
  ]
}
// NOT in Task "required" array — backward compatible with pre-feature state files
```

---

## 2. Fallback When `pipeline.source_control` Is Absent

The `source_control` property is **optional** on the `pipeline` object — it is NOT in the `"required"` array. Old state files without it remain valid and must be handled gracefully.

### Behavior When `pipeline.source_control` Is Absent

- **Log an informational notice** using the `ℹ` prefix symbol:
  ```
  ℹ pipeline.source_control not found in state — skipping commit
  ```
- **Skip** the commit operation entirely — do NOT continue to git operations
- **Never** throw an error and **never** return `success: false`
- **Signal `commit_completed`** with a skip-reason context so the pipeline continues

### Example Skip Context

```json
{
  "task_id": "P01-T02",
  "committed": false,
  "pushed": false,
  "skip_reason": "source_control_not_initialized"
}
```

This is graceful degradation, not an error. The pipeline must never stall — every code path ends with `commit_completed`.

---

## 3. Validating Working Tree Has Changes

Before committing, the agent must verify that the working tree has uncommitted changes. A commit against a clean working tree is a no-op scenario that must be handled gracefully.

### Check Procedure

Run `git status --porcelain` from the worktree path:

```
git status --porcelain
```

- If the output is **non-empty**: the working tree has changes — proceed to commit
- If the output is **empty**: the working tree is clean — this is the `nothing_to_commit` scenario

### Clean Working Tree Behavior

- **Log an informational notice** using the `ℹ` prefix symbol:
  ```
  ℹ Working tree is clean — nothing to commit
  ```
- **Do NOT treat a clean working tree as an error** — skip the commit, do not halt
- **Signal `commit_completed`** with appropriate context so the pipeline continues

### Example Skip Context

```json
{
  "task_id": "P01-T02",
  "committed": false,
  "pushed": false,
  "skip_reason": "nothing_to_commit"
}
```

---

## 4. Validating Worktree Path Is Accessible

Before running **any** git command, the agent must verify that the `worktree_path` directory exists and is accessible. This validation is the first git-related check performed.

### Check Procedure

Verify the directory at the path exists before proceeding:

```js
fs.existsSync(worktreePath)  // or equivalent validation
```

- If the path **exists and is accessible**: proceed to the next check
- If the path **does NOT exist or is NOT accessible**: this IS an error condition

### Inaccessible Path Behavior

- **Invoke the `log-error` skill** with descriptive error context
- **Signal `commit_completed`** with error context — do NOT stall the pipeline

### Example Error Context

```json
{
  "task_id": "P01-T02",
  "committed": false,
  "pushed": false,
  "error": "worktree_path not accessible",
  "worktree_path": "/abs/path"
}
```

Unlike the absence of `pipeline.source_control` (Section 2) and a clean working tree (Section 3), an inaccessible `worktree_path` is a true error — use the `✗` symbol when reporting it and invoke `log-error` before signaling `commit_completed`.

---

## 5. State Reading Sequence

The agent follows a strict guard-clause sequence before performing any commit operation. Each step is a guard — failure at any step causes a graceful skip or error, then stops. The pipeline never stalls.

### Sequence (Steps 1–7)

1. **Read `state.json`** from the project directory and parse its contents
2. **Check if `pipeline.source_control` exists** in the parsed state
3. **If absent →** log `ℹ` notice and skip (Section 2 fallback behavior) — signal `commit_completed` and **STOP**
4. **Extract `worktree_path` and `branch`** from `pipeline.source_control`
5. **Validate `worktree_path` is accessible** (Section 4 validation) — if invalid, invoke `log-error`, signal `commit_completed` with error context, and **STOP**
6. **Check working tree has changes** via `git status --porcelain` (Section 3 validation) — if clean, log `ℹ` notice, signal `commit_completed`, and **STOP**
7. **All checks passed** — proceed to commit operation (hand off to `operations-guide.md`)

### Guard-Clause Summary

```
Read state.json
     │
     ▼
pipeline.source_control exists?
     │ No  → ℹ log + skip → commit_completed (STOP)
     │ Yes ↓
worktree_path accessible?
     │ No  → ✗ log-error + commit_completed (STOP)
     │ Yes ↓
Working tree has changes?
     │ No  → ℹ log + skip → commit_completed (STOP)
     │ Yes ↓
Proceed to commit (operations-guide.md)
```

**Critical rule:** Every code path — success, skip, or error — ends with `commit_completed`. This event is the mechanism that advances the pipeline. Omitting it causes the pipeline to stall indefinitely.

---

## 6. Agent Feedback Symbols

The Source Control Agent uses these symbols when reporting outcomes:

| Symbol | Meaning |
|--------|---------|
| `✓` | Success — operation completed fully |
| `✗` | Failure — operation failed (partial or full) |
| `ℹ` | Informational — notice, skip, or non-critical status |

Usage in this guide:
- `ℹ` — when `pipeline.source_control` is absent (graceful skip) or working tree is clean (graceful skip)
- `✗` — when `worktree_path` is not accessible (true error)
