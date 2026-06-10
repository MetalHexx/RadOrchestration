---
name: rad-source-control
description: 'Source control operations — commit code, open a PR, create a worktree, or clean up a worktree. All inputs for commit and PR come from the spawn prompt; worktree operations are interactive and driven from the main session.'
user-invocable: false
---

# Source Control

This skill is a router. Each operation dispatches to a reference document. Read the section for your operation and follow it.

---

## Shared JSON-Envelope Convention

All `radorch` CLI calls emit a single JSON envelope on stdout:

```
{ "ok": <bool>, "data": { ... }, "error": { ... } }
```

Read result fields from inside `data` and emit the corresponding markdown block. This convention applies to every operation below.

---

## Routing Table

| Operation | Invoker | All inputs from spawn prompt? | Reference |
|-----------|---------|-------------------------------|-----------|
| Commit | source-control subagent | true | [`references/creating-commits.md`](references/creating-commits.md) |
| Open PR | source-control subagent | true | [`references/working-with-prs.md`](references/working-with-prs.md) |
| Create worktree | main session | false (interactive + project state) | [`references/working-with-worktrees.md`](references/working-with-worktrees.md) |
| Clean up worktree | main session | false (interactive + project state) | [`references/working-with-worktrees.md`](references/working-with-worktrees.md) |

> **Triad note:** Worktree lifecycle (create and clean up) lives in the **act lane** of the orchestration triad. This supersedes the earlier "worktree creation is outside all three lanes" stance from PROJECT-GRAPH-2. Commit and PR remain subagent operations and are never reached by the interactive worktree flow.
