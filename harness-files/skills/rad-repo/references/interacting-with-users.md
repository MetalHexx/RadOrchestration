# Interacting With Users

The CLI is mechanical and fails loud; *you* are the conversation. Your job is to land a registry that is **true** (points at real, durable repos) and **complete** (every entry has a real description), by resolving deterministic facts yourself and **interviewing the user** only where genuine judgment is needed.

## The infer-vs-interview rule

| Kind of information | Who resolves it |
|---|---|
| The main clone path, the remote, the default branch | **The CLI** — deterministic git facts. Don't ask. |
| The slug, which remote (when several), whether this is even the repo the user means, the description | **You, with the user** — judgment calls. Interview. |

Never guess a judgment call just because the CLI *could* produce a plausible value. A confident wrong registration (a worktree as the repo, a meaningless slug, an empty description) is worse than a question.

## Registering a repo — the dry-run → confirm flow

Always inspect before you write. Run a dry-run first (it needs no description and writes nothing):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo add --path <abs-path> --dry-run --json
```

Read `data.detection` and decide what to confirm:

- **`isWorktree` / `isSubdir` true** → the path you were given isn't the repo's home. The CLI will register `mainWorktreePath` (the durable main clone). Tell the user: *"You're inside a worktree of `…`; I'll register the main clone at `<mainWorktreePath>` instead — good?"* Don't register the worktree.
- **`remoteAlreadyRegisteredAs` set** → this repo is already in the registry under that slug. Don't create a duplicate; point the user at the existing entry (or, if they intend to replace it, remove first).
- **`otherRemotes` non-empty** → there was more than one remote; confirm `remoteName` is the right one.
- **proposed `name`** → confirm the slug. It's remote-derived by default and **immutable once set**, so this is the moment to get it right. If the user wants a different slug, pass `--name`.
- **`nameAvailable` false** → the slug is taken; pick another with `--name`.

Then gather a **real description** — a "what is this and why would an agent look here," not a placeholder. This is the single most valuable field: it's what later lets you (or another agent) decide to explore this repo. Prompt for it like you mean it; reject `x`-style non-answers.

Finally write, with the confirmed slug and description:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo add --path <abs-path> --description "<the description you gathered>" [--name <confirmed-slug>]
```

Surface `data.resolvedFrom` back to the user when the registered path differs from what they gave you, so the resolution is never silent.

## Scoping a project with the user

This is the highest-value thing the skill enables. When a task or project is being scoped, use the registry to define the working set of repos:

- Pull the landscape (`repo list`, and group/description detail via `repo show`).
- Propose the repos the work plausibly touches, using descriptions as the *reason* ("product copy → `web-app` and `cms`; `auth` is unrelated, leaving it out").
- If a stable bundle keeps recurring, offer to capture it as a **repo-group** so future work can scope to it by name. Group creation requires a description — make it the scoping rationale.
- Confirm the set before work proceeds. Reach for what's relevant; leave out what isn't.

## Binding and the unbound state

A repo present in `repo-registry.yml` with no local path on this machine is **unbound** — normal when a teammate pulled the shared registry. It's surfaced (in `repo list`, `repo show`, and the session preamble) with a bind hint, never as an error. Help the user bind it to their local clone:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo bind --name <slug> --path <abs-path>
```

`bind` resolves a worktree path to its main clone and **warns** (non-fatal) when the directory's remote doesn't match the registered identity or isn't a git tree — relay those warnings to the user so a mis-bind is visible.

## The empty state

When nothing is registered, the agent has no map of code beyond the current directory. Don't treat this as an error — treat it as the first step. Explain briefly why a registry matters (cross-repo reach), then offer to register the user's first repo and walk them through the dry-run → confirm flow above.

## Confirm before destructive ops

`repo remove` and `repo-group delete` are irreversible registry edits — confirm once with the user before running them. Everything else (list, show, add, bind, edit, group create/add/remove) runs directly.
