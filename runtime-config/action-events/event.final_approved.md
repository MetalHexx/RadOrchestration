---
kind: event
name: final_approved
title: Final approval gate approved
description: The operator has approved the final review and the pipeline may conclude.
signal_payload: {}
---

Confirm the operator explicitly approved before signaling. Do not signal on ambiguous or non-committal responses. Signaling moves the pipeline into its concluding stage.

## End-of-run worktree cleanup
After the operator has approved, offer worktree cleanup with a single concise `askUserQuestion`: ask whether to remove this project's worktree now. Remind them in the question to approve **and merge** the PR first — accepting before merging discards unmerged work.

Because the run approved from **inside** the worktree, do not self-delete it. If the operator accepts, route the removal to the main session (a context that is not standing inside the worktree being removed) by directing them to run, from the main clone:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" worktree remove --project {projectName}
```

If the operator declines, take no action — the worktree is left in place.
