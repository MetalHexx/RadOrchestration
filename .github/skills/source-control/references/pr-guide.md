# PR Operations Guide

This document is the primary reference for the Source Control Agent when creating a pull request. It covers reading source control state, constructing PR parameters, invoking the `gh-pr.js` script, parsing results, handling failures, and reporting outcomes.

---

## 1. State Reading

The Source Control Agent reads the `pipeline.source_control` object from `state.json` to obtain the values needed for PR creation.

| Field | Type | Usage |
|-------|------|-------|
| `worktree_path` | string | Passed as `--worktree-path` flag |
| `branch` | string | Passed as `--head` flag |
| `base_branch` | string | Passed as `--base` flag |

Key rules:

- All three fields must be present in `pipeline.source_control`
- If `pipeline.source_control` is absent from `state.json`, the agent performs a **graceful skip** — no PR is created, and the agent outputs the skip feedback (see Section 7)
- The agent also reads `project.name` from `state.json` to construct the PR title

---

## 2. PR Parameter Construction

The agent constructs two parameters before invoking the script: the PR title and the body file path.

### PR Title

The PR title format is:

```
{PROJECT-NAME}: Pipeline delivery
```

Where `{PROJECT-NAME}` is the project name from `state.json → project.name`.

### PR Body File

The agent attempts to locate a body file for the PR:

1. Check if a phase report or final review document exists for the project
2. If a body file exists → pass its path as `--body-file`
3. If no body file exists → omit `--body-file` (the script defaults the body to `"Pipeline delivery"`)

---

## 3. Script Invocation

The Source Control Agent invokes `gh-pr.js` to create the pull request.

**Script invocation:**
```
node gh-pr.js --worktree-path <path> --title <title> --body-file <path> --base <branch> --head <branch>
```

The script performs a single operation: create a PR via the `gh` CLI (or return an existing PR if one already exists on the same head branch).

The agent constructs the title and resolves the body file BEFORE invoking the script — these are pre-built arguments. The script returns a structured JSON result on stdout which the agent MUST parse.

**Script arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `--worktree-path` | string | Yes | Absolute path to the git worktree (used as `cwd` for `gh` commands) |
| `--title` | string | Yes | PR title |
| `--body-file` | string | No | Path to a file containing the PR body; if omitted, body defaults to `"Pipeline delivery"` |
| `--base` | string | Yes | Base branch (merge target) |
| `--head` | string | Yes | Head branch (source branch with changes) |

**Exit codes:**

| Exit Code | Meaning |
|-----------|---------|
| `0` | PR created successfully OR existing PR found and returned (idempotent) |
| `2` | Failure (missing args, auth error, `gh` CLI error) |

---

## 4. Structured Result Patterns

The `gh-pr.js` script returns one of three JSON result shapes on stdout. The agent MUST handle all three.

**Success — new PR created** (exit code 0):
```json
{
  "pr_created": true,
  "pr_url": "https://github.com/org/repo/pull/42",
  "error": null,
  "errorType": null
}
```

**Success — existing PR found (idempotent)** (exit code 0):
```json
{
  "pr_created": false,
  "pr_url": "https://github.com/org/repo/pull/42",
  "error": null,
  "errorType": null
}
```

**Failure** (exit code 2):
```json
{
  "pr_created": false,
  "pr_url": null,
  "error": "<error message>",
  "errorType": "<error-type>"
}
```

**Result field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `pr_created` | boolean | Whether a **new** PR was created (false on idempotent hit or failure) |
| `pr_url` | string \| null | PR URL on success or idempotent hit; null on failure |
| `error` | string \| null | Sanitized error message on failure; null on success |
| `errorType` | `"missing_args"` \| `"auth_failed"` \| `"create_failed"` \| null | Typed failure category; null on success |

The `errorType` values:
- `"missing_args"` — one or more required flags were not provided
- `"auth_failed"` — `gh` CLI is not authenticated or credentials are invalid
- `"create_failed"` — PR creation failed for any other reason (network, permissions, etc.)

---

## 5. When to Invoke the `log-error` Skill

The `log-error` skill is invoked when the JSON result contains a non-null `error` field. The simple rule: **invoke `log-error` whenever `error` is non-null**.

- Invoke `log-error` on **failure** (exit code 2, any `errorType`) — log the PR creation failure
- **Never** invoke `log-error` on **success** (exit code 0, `error: null`) — whether a new PR was created or an existing one was found
- **Never** invoke `log-error` on **graceful skip** (`pipeline.source_control` absent) — this is expected, not an error

**Error logging parameters:**

- **Severity**: `"minor"` — PR failure is non-blocking; the pipeline always completes
- **Source**: `"source-control-agent"`
- **Message**: The `error` field value from the script result

**Completion rule:** After logging the error, **output your PR result block** — the Orchestrator reads it and signals `pr_created` with the extracted values. Never call `pipeline.js` from within the Source Control Agent — the Orchestrator is the sole caller of the pipeline script.

---

## 6. Agent Feedback Symbols

The Source Control Agent uses these symbols when reporting outcomes:

| Symbol | Meaning |
|--------|---------|
| `✓` | Success — PR created or existing PR found |
| `✗` | Failure — PR creation failed |
| `ℹ` | Informational — source control state absent (graceful skip) or existing PR found |

Usage:
- `✓` — after a new PR is created successfully
- `ℹ` — when an existing PR is found (idempotent), or when source control state is absent (graceful skip)
- `✗` — after any failure (missing args, auth error, creation error)

---

## 7. Feedback Output Patterns

After parsing the JSON result from stdout, output one of these patterns:

**New PR created** (exit code 0, `pr_created: true`):
```
✓  PR created: {pr_url}
```

**Existing PR found — idempotent** (exit code 0, `pr_created: false`, `pr_url` non-null):
```
ℹ  Existing PR found: {pr_url}
```

**Failure** (exit code 2):
```
✗  PR creation failed: {error}
   Error logged to project error log.
   Pipeline will continue without a pull request.
```

**Source control state absent** (graceful skip — no `pipeline.source_control`):
```
ℹ  Source control context absent — PR creation skipped.
```

---

## 8. PR Result Block

After outputting the human-readable feedback above, **always append a `## PR Result` block** as the final output. The Orchestrator scans for this block to extract the `pr_url` value it passes to `pr_created`.

**Format** (required on every code path):

````
## PR Result
```json
{ "pr_url": "<url-or-null>" }
```
````

**Values for each outcome:**

| Outcome | `pr_url` |
|---------|----------|
| New PR created | PR URL string |
| Existing PR found (idempotent) | Existing PR URL string |
| Failure (any) | `null` |
| Source control state absent | `null` |

**Example — new PR created:**

````
## PR Result
```json
{ "pr_url": "https://github.com/org/repo/pull/42" }
```
````

**Example — existing PR found:**

````
## PR Result
```json
{ "pr_url": "https://github.com/org/repo/pull/42" }
```
````

**Example — failure:**

````
## PR Result
```json
{ "pr_url": null }
```
````

**Example — source control state absent:**

````
## PR Result
```json
{ "pr_url": null }
```
````

**Never leave the pipeline stalled** — always output the `## PR Result` block regardless of outcome. The Orchestrator reads it and signals `pr_created` with the `pr_url` value. The agent does NOT call `pipeline.js` directly — the Orchestrator is the sole caller of the pipeline script.
