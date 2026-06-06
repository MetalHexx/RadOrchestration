---
name: 'rad-execute-parallel'
description: 'Set up a parallel git worktree for a project and launch orchestration execution in it. Use when asked to "run in parallel", "create a worktree", "execute in a worktree", or when launching a project in an isolated branch for parallel development. Handles git worktree creation, branch setup, source control initialization, and opening the worktree in VS Code, Copilot CLI, Claude Code, or a terminal.'
user-invocable: true
---

# Execute Parallel
Set up a dedicated git worktree for a project and launch orchestration execution inside it. Frontloads all research, asks all questions in a single call, then creates the worktree and configures source control automatically.

## Initialize
You are an orchestrator. You'll be using the `rad-orchestration` skill for this project.  Read the skill  and prepare to use it to run the execution pipeline.

## Subcommands

| Subcommand | Input | Output (envelope `data`) | Purpose |
|--------|-------|--------|---------|
| `radorch project context` | *(none — auto-detects)* | `{ repoRoot, repoName, repoParent, currentBranch, defaultBranch, platform, projectsBasePath, configAutoCommit, configAutoPr, remoteUrl, projectDir, projectType, sourceControlInitialized }` | Detect git environment and read orchestration config |
| `radorch project find` | `--projects-base-path <path> --repo-root <path>` | `{ basePathExists: boolean, projects: [{ name, masterPlanPath, currentTier, existingWorktreePath, existingBranch, worktreeExists }] }` (`basePathExists: false` indicates a missing/misconfigured `projectsBasePath`) | Scan for execution-ready projects and check existing worktrees |
| `radorch project find` | `--projects-base-path <path> --repo-root <path> --project-name <name>` | Same shape, single-project lookup | Look up one project by name (worktree + master plan info) |
| `radorch worktree create` | `--repo-root <path> --branch <name> --worktree-path <path> --base-branch <ref>` | `{ created, worktreePath, branch, baseBranch, pushed, remoteUrl, compareUrl, error, errorType }` | Create worktree, push branch, detect remote URL |
| `radorch worktree launch` | `--agent {claude\|copilot\|vscode\|terminal} --worktree-path <path>` plus per-agent flags | `{ ok, platform, agent, permissionMode? }` | Open a terminal at the worktree and launch the chosen agent |

Every subcommand emits `{ ok, data, error }` on stdout. Exit codes (`worktree create`): `0` = created + pushed, `1` = created but push failed, `2` = create failed.

## Workflow

Follow these steps in order. Run steps 1–2 silently — do not narrate or display output.

1. **Gather context** — Run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project context`. Parse fields from the envelope's `data` block.

2. **Identify project** — Check the conversation, open files, and the argument passed to this prompt for a project name (`SCREAMING-CASE`) or master plan path. If found, run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project find --projects-base-path "{data.projectsBasePath}" --repo-root "{data.repoRoot}" --project-name {name}` to get worktree info. If not found, run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project find --projects-base-path "{data.projectsBasePath}" --repo-root "{data.repoRoot}"` (scan mode) to get all execution-ready candidates.

   **Kind guard (run immediately after the project is identified):**
   Run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project context --project-name {projectName}` and read `data.projectType`. When `(projectType ?? 'standard') === 'side-project'`, redirect to `/rad-execute` and stop — do not continue to steps 3–7. The entire parallel/worktree path (`project_name`, `branch_from`, `post_action`, `worktree create`, `worktree launch`) applies only to `standard` projects. Tell the user briefly that this is a side-project and has been routed to `/rad-execute` instead.

3. **Ask questions** — Before building the `askQuestions` call, greet the user with a short opening message. Keep it warm and one or two sentences — e.g. *"I'll set up an isolated worktree for this project and get orchestration running inside it. Only projects that have been fully planned and approved will appear in the list below."* Then build one `askQuestions` call with only the applicable questions. Read [references/workflow-guide.md](./references/workflow-guide.md) for the exact question schemas and conditions.

4. **Resolve values** — Derive `projectName`, `projectDir`, `branchName`, `worktreePath`, `baseBranch`, `resolvedAutoCommit`, `resolvedAutoPr` from the answers. See the Value Resolution table in the workflow guide.

5. **Create worktree** — If not reusing an existing worktree, run `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree create ...`. On failure, show the error and a targeted fix from the error table in the workflow guide. Do not proceed if creation fails.

6. **Source control init** — Call `radorch pipeline signal --event source_control_init` via the canonical script-block convention with the resolved values and URLs from `worktree create` output. See the workflow guide for the exact command template.

7. **Launch** — Execute the post-action chosen in step 3 via `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree launch --agent {agent} ...`. See the workflow guide for the per-agent flag matrix.

## Contents

- **`references/workflow-guide.md`** — Question schemas, value resolution, source_control_init template, launch commands, error handling
