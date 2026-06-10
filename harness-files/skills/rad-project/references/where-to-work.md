# Where to Work

## Worktrees and projects

Work happens in **worktrees**, one per repo that a project spans. A project may have multiple worktrees (one per participating repository). The project registry stores each worktree's `repo`, `path`, and `branch`.

## Canonical location

Worktrees live under `~/.radorc/worktrees/<worktree_name>/<repo-slug>/`. Treat this as world-knowledge and a guardrail: if you find yourself in a path that does not match this pattern, you are likely in a main clone — not the right place to work.

## worktree_name reuse

Each worktree record carries a `worktree_name` key. It defaults to the project name. An offshoot project can share its parent's `worktree_name` — this is how a correction project points at the parent's existing worktrees rather than creating new ones.

When you see the same `worktree_name` across two projects, those projects share a physical worktree. Edits in one affect the other.

## Find before acting

Before taking any action for a project:

1. Run `project worktrees --id <project-id>` to resolve the actual paths.
2. Confirm the `exists` field is `true` for the target repo.
3. Use the returned `path` — do not construct the path from components.

If you are already in a directory, check whether it matches the returned path. If you are in a main clone and the work belongs in a worktree, switch to the worktree path before acting.

## Ask the tool, not yourself

Never build a worktree path by hand. Always query:
- `project worktrees --id <project-id>` for resolved paths with existence checks
- `project show --id <project-id>` for full project context including worktrees

## Reverse lookup — where you're standing

If you already have a cwd and need to know which project it belongs to, use `project locate` (no args):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" project locate
```

The `kind` field in the returned envelope tells you the location class of your cwd (`worktree`, `main-clone`, `side-project`, or `none`). The `projects` field lists the matching project IDs. Use this as the complement to the forward lookup: `project worktrees --id <project-id>` goes from project → paths; `project locate` goes from cwd → project.

## Side-projects

A side-project (`type: side-project`) lives in its own local repo — it does not use the shared worktree layout. Its working directory is wherever the user's local repo lives. `project show` will surface its path if it was registered with one.

## This skill is awareness-only

The `/rad-project` skill is awareness-only for location. Its job is to find and surface existing worktrees (via `project worktrees`, `project show`, and `project locate`) so you work in the right place.

Worktree lifecycle — creating new worktrees and cleaning them up — now lives in the act lane under `rad-source-control`. See that skill's `working-with-worktrees.md` for the authoritative create and cleanup procedures. Do not attempt to create or delete worktrees from within `/rad-project`.
