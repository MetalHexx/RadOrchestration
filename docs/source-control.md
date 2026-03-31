# Source Control Automation

The orchestration pipeline's source control automation feature enables automatic git commit and push after every approved task. It is configured via `orchestration.yml` using an `always | ask | never` convention that applies to both commit and pull request automation. Pull request automation is scaffolded but delivered by the follow-on AUTO-PR project.

## Quick Start

1. **Configure once**: Run `configure-system` or the installer to set `auto_commit` in `orchestration.yml`.
2. **Set up per project**: `rad-execute-parallel` asks (or applies) your source control preference before launching execution.
3. **Work normally**: Every approved task is committed and pushed automatically when `auto_commit: always`.

## Configuration

```yaml
# ─── Source Control ────────────────────────────────────────────────────────────
source_control:
  auto_commit: "ask"          # always | ask | never
  auto_pr: "ask"              # always | ask | never
  provider: "github"          # reserved: github only in v1
```

| Field | Allowed values | Default | Description |
|-------|----------------|---------|-------------|
| `auto_commit` | `always` \| `ask` \| `never` | `ask` | Controls automatic git commit after task approval |
| `auto_pr` | `always` \| `ask` \| `never` | `ask` | Controls automatic PR creation on final approval |
| `provider` | `github` | `github` | Reserved; only GitHub supported in v1 |

Per-project values persisted via `source_control_init` take precedence over these defaults at runtime.

## Setup

The `rad-execute-parallel` script handles source control setup immediately after worktree creation:

- After worktree creation, the setup step reads `auto_commit` and `auto_pr` from `orchestration.yml`.
- If either is `ask`, the operator is prompted to choose `always` or `never` for this project run.
- If both are `always` or `never`, no prompt is shown — config values are used directly.
- The resolved values are persisted to state via `pipeline.js --event source_control_init` with context `{ branch, base_branch, worktree_path, auto_commit, auto_pr }`.
- The `source_control_init` event is idempotent — safe to re-run without corrupting state.

### Branch Publication

`rad-execute-parallel` publishes the branch to the remote immediately after worktree creation, before calling `pipeline.js --event source_control_init`:

- `git push -u origin {branch}` is run from the worktree path; push failure is non-blocking — the error is logged and the init continues.
- The `source_control_init` event itself remains idempotent — safe to re-run without corrupting state.
- If the branch was already pushed in a prior run, the upstream tracking is already set and the push is a no-op.

## Pipeline Events

| Event | Triggered by | Action returned | Notes |
|-------|-------------|----------------|-------|
| `source_control_init` | `rad-execute-parallel` after worktree creation | *(state write only)* | Idempotent; safe to re-run |
| `task_commit_requested` | Resolver after task approved (when `auto_commit: always`) | `invoke_source_control_commit` | Skipped when `auto_commit: never` or absent |
| `task_committed` | Orchestrator after agent completes commit | *(next-task action)* | Resumes normal pipeline flow |
| `pr_requested` *(AUTO-PR)* | Resolver after final approval (when `auto_pr: always`) | `invoke_source_control_pr` | Placeholder — delivered by AUTO-PR |
| `pr_created` *(AUTO-PR)* | Orchestrator after agent creates PR | `display_complete` | Placeholder — delivered by AUTO-PR |

## Source Control Agent

The Source Control Agent is a thin router — it loads the `source-control` skill and delegates all operations to the routing table's reference documents and bundled scripts. No git logic is embedded in the agent definition.

| Mode | Trigger | Skill reference | Script |
|------|---------|----------------|--------|
| commit | `invoke_source_control_commit` action | `references/operations-guide.md` | `scripts/git-commit.js` |
| PR *(AUTO-PR)* | `invoke_source_control_pr` action | `references/pr-guide.md` *(stub)* | `scripts/gh-pr.js` *(stub)* |

The agent has access to `read`, `execute`, and `todo` tools only. It never uses `edit` — source files are the Coder's domain only.

## Skill Structure

```
.github/skills/source-control/
├── SKILL.md                           ← routing table: mode → reference + script
├── references/
│   ├── operations-guide.md            ← commit operations: staging, message construction, commit+push, errors
│   ├── git-state-guide.md             ← branch/worktree context: read from state, fallback, pre-op checks
│   └── pr-guide.md                    ← PR placeholder (AUTO-PR stub)
└── scripts/
    ├── git-commit.js                  ← stage + commit + push CLI wrapper → structured JSON result
    └── gh-pr.js                       ← PR script stub → structured not-implemented JSON result
```

| Mode | Reference Document | Script | Status |
|------|-------------------|--------|--------|
| commit | `references/operations-guide.md` | `scripts/git-commit.js` | Functional |
| PR | `references/pr-guide.md` | `scripts/gh-pr.js` | AUTO-PR stub |

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

**Example:**

```
feat(P02-T03): Add remote_url detection to source_control_init

Detects the GitHub HTTPS remote URL from git remote get-url origin.
Converts SSH remotes (git@github.com:org/repo.git) to HTTPS.
Stores remote_url and compare_url in pipeline.source_control.
Enables branch compare links in the monitoring dashboard.
```

## Error Handling

The Source Control Agent produces structured feedback for every operation outcome:

**Success:**
```
✓  Committed:  feat(TASK-3): Add user authentication endpoint
✓  Pushed to:  origin/feature/my-project-branch
```

**Partial Failure — Commit Succeeded, Push Failed:**
```
✓  Committed:  feat(TASK-3): Add user authentication endpoint
✗  Push failed: fatal: unable to access 'https://github.com/...': SSL certificate problem
   Error logged to project error log.
   To retry: run `git push` from the worktree at {worktreePath}
```

**Full Failure — Commit Failed:**
```
✗  Commit failed: nothing to commit, working tree clean
   Error logged to project error log.
   Pipeline will continue without committing TASK-3.
   To diagnose: run `git status` from the worktree at {worktreePath}
```

**Graceful Absence Notice:**
```
ℹ  Source control not initialized. Skipping commit for TASK-3.
   To enable auto-commit: re-run rad-execute-parallel before launching execution.
```

On any failure, the error details are written to the project error log via the `log-error` skill. The pipeline always continues — it does not stall on source control failures.

## State Schema

Source control state is stored under `pipeline.source_control` in `state.json`:

```json
{
  "pipeline": {
    "source_control": {
      "branch": "feature/my-project-branch",
      "base_branch": "main",
      "worktree_path": "/path/to/worktree",
      "auto_commit": "always",
      "auto_pr": "never",
      "remote_url": "https://github.com/org/repo",
      "compare_url": "https://github.com/org/repo/compare/main...feature/my-project-branch"
    }
  }
}
```

All 5 fields (`branch`, `base_branch`, `worktree_path`, `auto_commit`, `auto_pr`) are required when the sub-object is present. The sub-object itself is optional — its absence triggers graceful degradation: the pipeline skips commit steps and logs an informational notice. The `provider` field is hardcoded to `'github'` in the configuration layer (v1 constraint) and is not persisted to the state sub-object.

`remote_url` and `compare_url` are written by `source_control_init` and may be `null` when GitHub remote detection fails. After each task commit, `commit_hash` is written onto the task entry:

```json
{
  "execution": {
    "phases": [{
      "tasks": [{
        "name": "P01-T01-EXAMPLE",
        "status": "complete",
        "commit_hash": "bb3c89e"
      }]
    }]
  }
}
```

### Field Reference

| Field | Location | Type | Null condition |
|-------|----------|------|----------------|
| `remote_url` | `pipeline.source_control` | `string \| null` | `null` when the remote URL cannot be detected (non-GitHub remote, or `git remote get-url` fails) |
| `compare_url` | `pipeline.source_control` | `string \| null` | `null` whenever `remote_url` is `null` |
| `commit_hash` | `execution.phases[n].tasks[n]` | `string \| null` | `null` for tasks completed before this feature shipped, or when the commit step failed |

## What's Coming (AUTO-PR)

The AUTO-PR project will deliver full pull request automation on top of the scaffolding included here. AUTO-PR will add: PR pipeline events (`pr_requested`, `pr_created`), `gh` CLI integration for PR creation, and full content for `pr-guide.md`.

> Sections marked with *(AUTO-PR)* in the tables above will be filled in when AUTO-PR is delivered. No changes to this page's structure, the `orchestration.yml` schema, or the `rad-execute-parallel` prompt will be required.
