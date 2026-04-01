# PR Operations Guide

This document is the primary reference for the Source Control Agent when creating a pull request.

---

## 1. Prerequisites

Before invoking the `gh-pr.js` script, read `state.json` to gather all required inputs. Each input maps to a CLI flag.

| State Field | CLI Flag | Required | Description |
|-------------|----------|----------|-------------|
| `pipeline.source_control.worktree_path` | `--worktree-path` | Yes | Path to the git worktree |
| `pipeline.source_control.branch` | `--branch` | Yes | Head branch for the PR |
| `pipeline.source_control.base_branch` | `--base-branch` | Yes | Base branch for the PR |
| `project.name` | `--title` | Yes | PR title — use the project name as-is (no enrichment) |
| `final_review.doc_path` | `--body-file` | No | Path to the final review markdown file; omit flag entirely if `null` |

**Graceful absence**: If `pipeline.source_control` is absent from state, skip PR creation entirely — do NOT invoke `gh-pr.js`. Instead, output a PR Result block with `error: "source_control_context_absent"` and continue.

---

## 2. CLI Usage

Invoke the `gh-pr.js` script from the source-control skill's scripts directory:

```
node .github/skills/source-control/scripts/gh-pr.js \
  --worktree-path <worktree_path> \
  --branch <branch> \
  --base-branch <base_branch> \
  --title <project_name> \
  [--body-file <final_review_doc_path>]
```

**CLI arguments:**

| Flag | Required | Description |
|------|----------|-------------|
| `--worktree-path` | Yes | Path to the git worktree |
| `--branch` | Yes | Head branch for the PR |
| `--base-branch` | Yes | Base branch for the PR |
| `--title` | Yes | PR title — use `state.project.name` (e.g., `"AUTO-PR"`) |
| `--body-file` | No | Path to a markdown file for the PR body — read from `state.final_review.doc_path`; omit if null |

**Important**: `--body-file` is optional — only pass it when `final_review.doc_path` is non-null. If `final_review.doc_path` is `null`, omit the flag entirely (the PR will be created with no body).

---

## 3. Result Shape

The `gh-pr.js` script outputs a single `PrResult` JSON object on stdout.

### PrResult Interface

| Field | Type | Description |
|-------|------|-------------|
| `pr_created` | `boolean` | `true` if a new PR was created |
| `pr_url` | `string \| null` | Full URL to the PR, or `null` on failure |
| `pr_number` | `number \| null` | PR number, or `null` on failure |
| `pr_existed` | `boolean` | `true` if PR already existed (idempotent detection) |
| `error` | `string \| null` | Error key (`"gh_not_found"`, `"auth_failed"`, `"no_remote"`, `"creation_failed"`, `"precondition_failure"`), or `null` |
| `message` | `string` | Human-readable summary |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | PR created or existing PR detected — `pr_url` populated |
| `1` | PR creation attempted but failed — `error` populated |
| `2` | Pre-condition failure (gh CLI missing, not authenticated, no remote) |

---

## 4. Structured Result Patterns

The `gh-pr.js` script returns one of three exit codes. The agent MUST handle all outcomes, plus the agent-level context-absent case.

**PR created** (exit code 0, `pr_created: true`):
```json
{
  "pr_created": true,
  "pr_url": "https://github.com/org/repo/pull/42",
  "pr_number": 42,
  "pr_existed": false,
  "error": null,
  "message": "PR created successfully"
}
```

**Existing PR found** (exit code 0, `pr_existed: true`):
```json
{
  "pr_created": false,
  "pr_url": "https://github.com/org/repo/pull/41",
  "pr_number": 41,
  "pr_existed": true,
  "error": null,
  "message": "Existing PR found"
}
```

**Creation failed** (exit code 1):
```json
{
  "pr_created": false,
  "pr_url": null,
  "pr_number": null,
  "pr_existed": false,
  "error": "creation_failed",
  "message": "pull request create failed: Draft pull requests are not supported"
}
```

**Pre-condition failure** (exit code 2 — `gh_not_found`, `auth_failed`, `no_remote`, or `precondition_failure`):
```json
{
  "pr_created": false,
  "pr_url": null,
  "pr_number": null,
  "pr_existed": false,
  "error": "gh_not_found",
  "message": "gh: command not found"
}
```

**Source control context absent** (agent-level skip — no script invocation):
```json
{
  "pr_created": false,
  "pr_url": null,
  "pr_number": null,
  "pr_existed": false,
  "error": "source_control_context_absent",
  "message": "pipeline.source_control absent in state — PR creation skipped"
}
```

---

## 5. Error Handling

The `log-error` skill is invoked when the `error` field is non-null. The simple rule: **invoke `log-error` whenever `error` is non-null**.

| Error Key | Detection | Agent Action | Severity |
|-----------|-----------|-------------|----------|
| `gh_not_found` | `error` field is `"gh_not_found"` | Invoke `log-error` skill; output PR Result block | major |
| `auth_failed` | `error` field is `"auth_failed"` | Invoke `log-error` skill; output PR Result block | major |
| `no_remote` | `error` field is `"no_remote"` | Invoke `log-error` skill; output PR Result block | major |
| `creation_failed` | `error` field is `"creation_failed"` | Invoke `log-error` skill; output PR Result block | major |
| `precondition_failure` | `error` field is `"precondition_failure"` | Invoke `log-error` skill; output PR Result block | major |
| `source_control_context_absent` | `pipeline.source_control` absent in state | Invoke `log-error` skill (severity: minor); output PR Result block | minor |

**Completion rule**: After logging the error, **always output the PR Result block** — the Orchestrator reads it and extracts `pr_url` and `pr_number`.

**Never call `pipeline.js`** from within the Source Control Agent — the Orchestrator is the sole caller of the pipeline script.

---

## 6. Agent Feedback Symbols

The Source Control Agent uses these symbols when reporting outcomes:

| Symbol | Meaning |
|--------|---------|
| `✓` | Success — PR created or existing found |
| `✗` | Failure — PR creation failed or pre-condition failure |
| `ℹ` | Informational — source control context absent (graceful skip) |

---

## 7. Feedback Output Patterns

After parsing the JSON result from stdout, output one of these patterns:

**PR created** (exit code 0, `pr_created: true`):
```
✓  PR created:  <pr_url>
```

**Existing PR found** (exit code 0, `pr_existed: true`):
```
✓  Existing PR: <pr_url>
```

**Creation failed** (exit code 1):
```
✗  PR creation failed: <error_message>
   Error logged to project error log.
```

**Pre-condition failure** (exit code 2):
```
✗  Pre-condition failed: <error_message>
   Error logged to project error log.
```

**Context absent** (no script invocation):
```
ℹ  pipeline.source_control absent — PR creation skipped
```

---

## 8. PR Result Block

After outputting the human-readable feedback above, **always append a `## PR Result` block** as the final output. The Orchestrator scans for this block to extract `pr_url` and `pr_number`.

**Format** (required for every code path):

````
## PR Result
```json
{ "pr_created": <bool>, "pr_url": "<url-or-null>", "pr_number": <number-or-null>, "pr_existed": <bool>, "error": "<key-or-null>", "message": "<summary>" }
```
````

**Values for each outcome:**

| Outcome | `pr_created` | `pr_url` | `pr_number` | `pr_existed` | `error` | `message` |
|---------|-------------|----------|-------------|-------------|---------|-----------|
| PR created | `true` | PR URL | PR number | `false` | `null` | `"PR created successfully"` |
| Existing PR found | `false` | PR URL | PR number | `true` | `null` | `"Existing PR found"` |
| Creation failed | `false` | `null` | `null` | `false` | `"creation_failed"` | error message |
| Pre-condition failure | `false` | `null` | `null` | `false` | error key | error message |
| Context absent | `false` | `null` | `null` | `false` | `"source_control_context_absent"` | `"pipeline.source_control absent in state — PR creation skipped"` |

**Example — PR created:**

````
## PR Result
```json
{ "pr_created": true, "pr_url": "https://github.com/org/repo/pull/42", "pr_number": 42, "pr_existed": false, "error": null, "message": "PR created successfully" }
```
````

**Example — existing PR found:**

````
## PR Result
```json
{ "pr_created": false, "pr_url": "https://github.com/org/repo/pull/41", "pr_number": 41, "pr_existed": true, "error": null, "message": "Existing PR found" }
```
````

**Example — creation failed:**

````
## PR Result
```json
{ "pr_created": false, "pr_url": null, "pr_number": null, "pr_existed": false, "error": "creation_failed", "message": "pull request create failed: Draft pull requests are not supported" }
```
````

**Example — pre-condition failure:**

````
## PR Result
```json
{ "pr_created": false, "pr_url": null, "pr_number": null, "pr_existed": false, "error": "gh_not_found", "message": "gh: command not found" }
```
````

**Example — context absent:**

````
## PR Result
```json
{ "pr_created": false, "pr_url": null, "pr_number": null, "pr_existed": false, "error": "source_control_context_absent", "message": "pipeline.source_control absent in state — PR creation skipped" }
```
````

### Pipeline Signal

After outputting the PR Result block, the Orchestrator reads the `## PR Result` block, extracts `pr_url`, and signals `pr_created` to the pipeline.

- **On success** (`pr_url` is non-null): signal `pr_created --pr-url <pr_url>` (PR created or existing PR found)
- **On failure** (`pr_url` is `null`): signal `pr_created` **without** the `--pr-url` flag — do **not** pass the literal string `"null"`. The pipeline CLI omits `pr_url` from context when the flag is absent, and the mutation handler coalesces the missing value to `null`, correctly recording the failed attempt
- On any failure, the Orchestrator still reads the PR Result block — **always output it regardless of outcome**
- **Do NOT signal `task_committed`** — PR mode uses `pr_created`
