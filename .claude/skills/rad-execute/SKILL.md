---
name: rad-execute
description: "Continue a project through the orchestration pipeline. Ensures the Orchestrator runs as the primary agent — not as a subagent — so it retains full control of agent sequencing. Use for local, background, or cloud-based execution."
disable-model-invocation: true
user-invocable: true
---

## Initialize
You are an orchestrator. You'll be using the `orchestration` skill for this project.  Read the skill  and prepare to use it to run the execution pipeline.

# Approve plan
The Master Plan is complete. As a human reviewer, I have approved the plan and am ready to execute. Mark the plan as approved and begin execution of the project.

# Execute Plan
Execute the project according to the approved Master Plan using the proper execution pipeline.

## Source Control Initialization

Before the first pipeline tick of a new execution, make sure `pipeline.source_control` is populated in `state.json`. The commit and PR gates now read from this state — without it, the walker will halt when it reaches either conditional.

1. Read `state.json` at the project directory.
2. **If `pipeline.source_control` is not `null`, skip this whole section** — source control is already initialized and the execution can resume ceremony-free.
3. Otherwise, gather the init values:
   - `branch` — from `git branch --show-current`.
   - `worktree_path` — the current working directory.
   - `remote_url` — from `git remote get-url origin` if present; tolerate missing remote (treat as unset). Convert SSH → HTTPS (`git@github.com:ORG/REPO.git` → `https://github.com/ORG/REPO`) and strip any trailing `.git`.
   - `compare_url` — `{remote_url}/compare/{base_branch}...{branch}` when `remote_url` is known; otherwise unset.
   - `base_branch` — use `config.source_control.base_branch` if present. Otherwise ask the user with a `base_branch` question (default `"main"`, allow free-form input).
   - `auto_commit` — if `config.source_control.auto_commit === "ask"`, prompt the user with the `auto_commit` question schema at `.claude/skills/rad-execute-parallel/references/workflow-guide.md:96-108`. Otherwise use the config value directly.
   - `auto_pr` — if `config.source_control.auto_pr === "ask"`, prompt with the `auto_pr` schema at `.claude/skills/rad-execute-parallel/references/workflow-guide.md:112-124`. Otherwise use the config value directly.

   The user's `yes`/`no` answers can be passed through unchanged — the `source_control_init` pipeline event normalizes `yes` → `always` and `no` → `never` automatically.

4. Call the pipeline, mirroring the shape at `.claude/skills/rad-execute-parallel/references/workflow-guide.md:173`:

   ```
   node {orchRoot}/skills/orchestration/scripts/pipeline.js --event source_control_init --project-dir "{projectDir}" --branch "{branch}" --base-branch "{baseBranch}" --worktree-path "{worktreePath}" --auto-commit "{resolvedAutoCommit}" --auto-pr "{resolvedAutoPr}" --remote-url "{remoteUrl}" --compare-url "{compareUrl}"
   ```

   Omit `--remote-url` / `--compare-url` when their values are unset. Verify the response contains `"success": true`; on failure, show the error and stop.

5. Proceed with execution.

# Pipeline Error Handling
- If any errors occur with the pipeline during execution, use the `log-error` skill to log them
- Do not try to fix the pipeline code,  simply work around it. 
- Ensure that error messages are clear, actionable, and include relevant information about the failure point.
