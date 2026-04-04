---
name: 'rad-execute-parallel'
description: 'Set up a parallel git worktree for a project and launch orchestration execution in it. Use when asked to "run in parallel", "create a worktree", "execute in a worktree", or when launching a project in an isolated branch for parallel development. Handles git worktree creation, branch setup, source control initialization, and opening the worktree in VS Code, Copilot CLI, Claude Code, or a terminal.'
user-invocable: true
disable-model-invocation: true
---

# Execute Parallel

Set up a dedicated git worktree for a project and launch orchestration execution inside it. Frontloads all research, asks all questions in a single call, then creates the worktree and configures source control automatically.

## Scripts

| Script | Input | Output | Purpose |
|--------|-------|--------|---------|
| `scripts/gather-context.js` | *(none — auto-detects)* | `{ repoRoot, repoName, repoParent, currentBranch, defaultBranch, platform, orchRoot, projectsBasePath, configAutoCommit, configAutoPr }` | Detect git environment and read orchestration config |
| `scripts/find-projects.js` | `--projects-base-path <path> --repo-root <path>` | `{ projects: [{ name, masterPlanPath, currentTier, existingWorktreePath, existingBranch, worktreeExists }] }` | Scan for execution-ready projects and check existing worktrees |
| `scripts/find-projects.js` | `--projects-base-path <path> --repo-root <path> --project-name <name>` | Same shape, single-project lookup | Look up one project by name (worktree + master plan info) |
| `scripts/create-worktree.js` | `--repo-root <path> --branch <name> --worktree-path <path> --base-branch <ref>` | `{ created, worktreePath, branch, baseBranch, pushed, remoteUrl, compareUrl, error, errorType }` | Create worktree, push branch, detect remote URL |

All scripts output JSON to stdout. Exit codes: `0` = success, `1` = partial (created but push failed), `2` = failure.

## Workflow

Follow these steps in order. Run steps 1–2 silently — do not narrate or display output.

1. **Gather context** — Run `gather-context.js`. Parse the JSON result.

2. **Identify project** — Check the conversation, open files, and the argument passed to this prompt for a project name (`SCREAMING-CASE`) or master plan path. If found, run `find-projects.js --project-name {name}` to get worktree info. If not found, run `find-projects.js` (scan mode) to get all execution-ready candidates.

3. **Ask questions** — Before building the `askQuestions` call, greet the user with a short opening message. Keep it warm and one or two sentences — e.g. *"I'll set up an isolated worktree for this project and get orchestration running inside it. Only projects that have been fully planned and approved will appear in the list below."* Then build one `askQuestions` call with only the applicable questions. Read [references/workflow-guide.md](./references/workflow-guide.md) for the exact question schemas and conditions.

4. **Resolve values** — Derive `projectName`, `projectDir`, `branchName`, `worktreePath`, `baseBranch`, `resolvedAutoCommit`, `resolvedAutoPr` from the answers. See the Value Resolution table in the workflow guide.

5. **Create worktree** — If not reusing an existing worktree, run `create-worktree.js`. On failure, show the error and a targeted fix from the error table in the workflow guide. Do not proceed if creation fails.

6. **Source control init** — Call `pipeline.js --event source_control_init` with the resolved values and URLs from `create-worktree.js` output. See the workflow guide for the exact command template.

7. **Launch** — Execute the post-action chosen in step 3. See the workflow guide for platform-specific launch commands.

## Contents

- **`references/workflow-guide.md`** — Question schemas, value resolution, source_control_init template, launch commands, error handling
- **`scripts/gather-context.js`** — Git environment detection + orchestration config reader (standalone, no external dependencies)
- **`scripts/find-projects.js`** — Project scanner: finds execution-ready projects, checks worktree status (standalone)
- **`scripts/create-worktree.js`** — Worktree creation: git worktree add, branch push, remote URL detection (standalone)
