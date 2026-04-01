---
name: source-control
description: 'Source control operations for the orchestration pipeline. Use when the Orchestrator spawns the Source Control Agent to commit code or create a PR.  Also useful for adhoc source control operations by any agent or human such as correcting a PR based on review feedback.'
---

# Source Control

Orchestration pipeline skill for source control operations. Provides routing for commit and PR modes, with reference documents containing all git knowledge and scripts that execute the actual operations.

## Routing Table

| Mode   | Reference Document                                                          | Script                                                  | Status       |
|--------|-----------------------------------------------------------------------------|---------------------------------------------------------|--------------|
| commit         | [references/operations-guide.md](./references/operations-guide.md)         | [scripts/git-commit.js](./scripts/git-commit.js)       | Functional   |
| commit         | [references/git-state-guide.md](./references/git-state-guide.md)           | *(context only — no script)*                            | Functional   |
| PR             | [references/pr-guide.md](./references/pr-guide.md)                         | [scripts/gh-pr.js](./scripts/gh-pr.js)                 | Functional   |
| pr-corrections | [references/pr-corrections-guide.md](./references/pr-corrections-guide.md) | *(GitHub MCP — no script)*                              | Functional   |

## Loading Instructions

1. **Determine your mode** from the Orchestrator context:
   - Received `invoke_source_control_commit` → **commit mode**
   - Received `invoke_source_control_pr` → **PR mode**
   - Received `invoke_source_control_pr_corrections` → **pr-corrections mode** (see `pr-corrections-guide.md`)
2. **Read all reference documents** for your mode before taking any action.
3. **Execute the script** for your mode; parse the JSON result from stdout.
4. **On any failure**, invoke the `log-error` skill before completing.
5. **Output a structured result block** — every code path ends with this output:
   - **Commit mode**: output a `## Commit Result` block — the Orchestrator reads it and signals `task_committed`
   - **PR mode**: output a `## PR Result` block — the Orchestrator reads it and signals `pr_created --pr-url <url>` on success, or `pr_created` **without** `--pr-url` on failure (when `pr_url` is `null`)
   - **PR-corrections mode**: no structured result block required (corrections are committed via commit mode)

## Error Handling

Every scenario ends with outputting a structured result block. The Orchestrator reads this block to extract the relevant values.

### Commit Mode

Output a `## Commit Result` block. The Orchestrator reads it and signals `task_committed`.

| Scenario | Action | Report to Orchestrator |
|----------|--------|------------------------|
| Full success (committed + pushed) | Display success feedback | ✅ Output commit result block |
| Partial failure (committed, push failed) | Invoke `log-error` skill; display partial failure feedback | ✅ Output commit result block |
| Full failure (commit failed) | Invoke `log-error` skill; display full failure feedback | ✅ Output commit result block |
| `pipeline.source_control` absent | Display `ℹ` notice; skip commit | ✅ Output commit result block |
| Worktree path inaccessible | Invoke `log-error` skill; display error | ✅ Output commit result block |
| Script execution error | Invoke `log-error` skill; display error | ✅ Output commit result block |

### PR Mode

Output a `## PR Result` block. The Orchestrator reads it and signals `pr_created --pr-url <url>`.

| Scenario | Action | Report to Orchestrator |
|----------|--------|------------------------|
| Full success (PR created or existing found) | Display success feedback | ✅ Output PR result block |
| Creation failure (`gh pr create` failed) | Invoke `log-error` skill; display failure feedback | ✅ Output PR result block |
| Pre-condition failure (gh CLI missing, auth failed) | Invoke `log-error` skill; display failure feedback | ✅ Output PR result block |
| `pipeline.source_control` absent | Display `ℹ` notice; skip PR | ✅ Output PR result block |

## Contents

This skill bundles:

- **`references/operations-guide.md`** — Commit operations: staging, message construction, commit+push, error patterns
- **`references/git-state-guide.md`** — Reading pipeline.source_control from state; fallback behavior; pre-op validation
- **`references/pr-guide.md`** — Agent reference for PR mode: workflow, CLI usage, result shapes, error patterns
- **`references/pr-corrections-guide.md`** — Review PR comments critically, implement fixes, respond per comment, commit+push
- **`scripts/git-commit.js`** — CLI script: stage + commit + push; returns structured JSON result
- **`scripts/gh-pr.js`** — CLI script: detect existing PR, create if absent; returns structured JSON result
