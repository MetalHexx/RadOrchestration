---
name: rad-execute
description: "Run an approved project through the orchestration pipeline. Decides run mode from where you're standing — the main clone (or nowhere) launches a fresh session into a new worktree; inside a worktree it runs in place after one confirmation. Asks one combined question up front, then runs deterministically."
user-invocable: true
---

You are an orchestrator. Read the `rad-orchestration` skill and use it to drive the execution pipeline. This skill resolves all setup once, up front, then hands the pipeline a fully settled state — nothing is asked mid-run.

`${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs` is the CLI for every call below. Run discovery calls silently — do not narrate raw envelope output.

## Step 1: Classify where you're standing
Run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project locate`. Read `data.kind` from the envelope. It drives the run mode:

- `kind` is `main-clone` or `none` → **launch path** (Step 2L). The main clone is never written to directly and is never run in place.
- `kind` is `worktree` → **in-place path** (Step 2P).

Identify the project name from the `/rad-execute` argument or conversation context. If absent, run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project list`, filter to rows where `tier === 'execution'`, and let the project sub-question (below) resolve it.

## Step 2L: Launch path (main clone or nowhere)
Cross the plan-approval gate **before** the context switch: confirm the plan is approved and the operator is ready, then mark the plan approved. Only after approval do you create the worktree and launch — the fresh session resumes into an already-approved state and asks nothing further.

Read the auto-commit / auto-pr values you were provided at session-start — do not issue a separate fetch unless necessary. Derive convention values without asking: branch = project name, base = `origin/main`, worktree path = `{repoParent}/{repoName}-worktrees/{projectName}`.

Ask **one** combined `askUserQuestion` covering only genuine forks:
- **Launch flavor** (always): Claude Code — auto, Claude Code — yolo (bypass permissions), Copilot CLI or VS Code.
- **auto_commit** — include only if the ambient config value is `ask`.
- **auto_pr** — include only if the ambient config value is `ask`.

Then, in order:
1. `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree create --project {projectName}` — read `data.repos[0].path` as the launch directory.
2. Write all resolved setup to project state exactly once, before launching. Map the commit/PR answers to settled values (`yes → always`, `no → never`, else the ambient value, which is already `always` / `never`) and persist them by calling source-control init with the resolved values — never `ask`:
   `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" source-control init --project {projectName} --auto-commit {always|never} --auto-pr {always|never}`
3. Launch the chosen flavor:
   - Claude Code: `MSYS_NO_PATHCONV=1 node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree launch --agent claude --worktree-path "{worktreePath}" --prompt "/rad-execute {projectName}" --permission-mode "{auto|bypassPermissions|acceptEdits}"`
   - Copilot CLI: `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree launch --agent copilot --worktree-path "{worktreePath}"`
   - VS Code: `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree launch --agent vscode --worktree-path "{worktreePath}"`

The fresh session re-enters `/rad-execute`, re-runs `locate`, classifies as `worktree`, and takes the in-place path with state already settled.

## Step 2P: In-place path (inside a worktree)
Confirm with the operator as a location check: *"you're in `<project>`'s worktree on `<branch>` — run here?"* (read `<branch>` and `<project>` from the `locate` envelope's `branch` and `projects`). This doubles as the cross-project guard. Do not create a new worktree.

Read auto-commit / auto-pr from the context you gained at session-start. In the same combined `askUserQuestion`, include the auto_commit and/or auto_pr sub-question only when the value in your context value is `ask`. On confirmation, write all resolved setup to project state exactly once, before driving the pipeline in the current session — persisting the settled commit/PR values via `source-control init --project {projectName} --auto-commit {always|never} --auto-pr {always|never}` (resolve `ask` before the call; never pass `ask`).

## Step 3: Run the pipeline
Fire the pipeline `start` event — it returns the current pending action without mutating state, so it is correct both for first-time execution and resume:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" pipeline signal --event start --project-dir {projectDir}
```

Do not invent event names like `tick` or `next_action`. Commit and PR are governed by the already-settled `always` / `never` / `ask` values through the DAG's commit and PR conditionals — never re-ask or describe those conditionals. The pipeline runs deterministically with no setup prompts firing mid-run.

## Step 4: Errors
If the pipeline errors, use the `rad-log-error` skill to record it. Do not try to fix pipeline code — work around it with a clear, actionable message that names the failure point.
