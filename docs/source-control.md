# Source Control Automation

The orchestration pipeline's source control automation feature enables automatic git commit and push after every approved task. It is configured via `orchestration.yml` using an `always | ask | never` convention that applies to both commit and pull request automation. Pull request automation creates a GitHub PR via the `gh` CLI after the comprehensive final review completes, before the final human approval gate, when `auto_pr: always`.

## Quick Start

1. **Configure once**: Run `configure-system` or the installer to set `auto_commit` in `orchestration.yml`.
2. **Set up per project**: The `rad-execute-parallel` skill asks (or applies) your source control preference before launching execution.
3. **Work normally**: Every approved task is committed and pushed automatically when `auto_commit: always`.

## Configuration

| Field | Allowed values | Default | Description |
|-------|----------------|---------|-------------|
| `auto_commit` | `always` \| `ask` \| `never` | `ask` | Controls automatic git commit after task approval |
| `auto_pr` | `always` \| `ask` \| `never` | `ask` | Controls automatic PR creation on final approval |
| `provider` | `github` | `github` | Only GitHub is supported |

Per-project values take precedence over these defaults at runtime.

## Setup

The `rad-execute-parallel` skill handles source control setup immediately after worktree creation:

- After worktree creation, the setup step reads `auto_commit` and `auto_pr` from `orchestration.yml`.
- If either is `ask`, the operator is prompted to choose `always` or `never` for this project run.
- If both are `always` or `never`, no prompt is shown — config values are used directly.
- The resolved values are persisted to state via `pipeline.js --event source_control_init` with context `{ branch, base_branch, worktree_path, auto_commit, auto_pr }`.
- The `source_control_init` event is idempotent — safe to re-run without corrupting state.

### Branch Publication

The `rad-execute-parallel` skill publishes the branch to the remote immediately after worktree creation, before calling `pipeline.js --event source_control_init`:

- `git push -u origin {branch}` is run from the worktree path; push failure is non-blocking — the error is logged and the init continues.
- The `source_control_init` event itself remains idempotent — safe to re-run without corrupting state.
- If the branch was already pushed in a prior run, the upstream tracking is already set and the push is a no-op.

For pipeline event details and source control event flow, see [Scripts Reference](internals/scripts.md).

## Source Control Agent

The Source Control Agent handles automatic git operations. It performs commits after approved tasks and creates pull requests after the final review. The agent delegates to the `source-control` skill for all git and GitHub CLI operations.

## Commit Message Format

Commit messages follow the pattern: `{prefix}({taskId}): {handoffTitle}`

The prefix is resolved from the task type or keywords in the task title:

| Task type / keywords | Conventional prefix |
|----------------------|-------------------|
| Feature, addition, new capability | `feat` |
| Bug fix, error, resolve, patch | `fix` |
| Refactoring, restructure, clean up | `refactor` |
| Tests, coverage, spec | `test` |
| Documentation, README, docs | `docs` |
| Configuration, tooling, scripts, chore | `chore` |
| Default (unmatched) | `chore` |

**Examples:**

- `feat(TASK-1): Add source-control skill and routing table`
- `fix(TASK-2): Resolve null pointer in session handler`
- `test(TASK-5): Add integration tests for source_control_init event`
- `chore(TASK-7): Extend orchestration.yml with source_control block`

### Commit Message Body

Commit messages optionally include a body — 3–6 plain-prose sentences or bullets drawn from the task handoff's description and goals:

- Subject and body are separated by exactly one blank line, following the [Conventional Commits](https://www.conventionalcommits.org/) spec.
- The multi-line message is passed as a single `-m` argument with embedded newlines (for example: `git commit -m $'{subject}\n\n{body}'` or equivalent).
- Body is omitted entirely when the handoff has no description or goals content.

For example, a subject line like `feat(P02-T03): Add remote_url detection` may be followed by 3–6 bullet sentences describing the change.

## Error Handling

The Source Control Agent produces structured feedback for every operation — success confirmations, partial failure details, and full failure diagnostics. On failure, errors are logged to the project error log and the pipeline continues. Source control failures never block pipeline execution.

For the state schema and field reference, see [state-v4.schema.json](../.github/skills/orchestration/schemas/state-v4.schema.json).

