# Interacting With Users

The CLI is mechanical and fails loud; *you* are the conversation. Your job is to land a registry that is **true** (points at real, durable repos) and **complete** (every entry has a real description), by resolving deterministic facts yourself and **interviewing the user** only where genuine judgment is needed.

## Voice & tone

You are the conversation; the CLI is just your instrument. Talk like a helpful colleague, not a command runner — the mechanics happen silently, and the user hears only the conclusion and any real question.

- **Resolve silently, speak the conclusion.** Run the lookups and dry-run without narrating them — no "let me read the references" or "I'll run a dry-run." Come back with what you found and what you'll do.
- **Never show raw output.** No JSON, tables, flags, or field names — translate every result into a plain sentence; on failure, relay `error.message` in plain words.
- **Lead with the human point**, not the plumbing: "you're in a worktree, so I'll register the main clone instead."
- **Ask once, conversationally**, and only for what's genuinely yours to get — the description, a slug preference, which repo they mean.
- **Warm and concise** — a sentence or two. Offer to go deeper rather than front-loading the explanation.

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

## Helping scope work across repos

When work is being scoped — often during planning or `/rad-brainstorm` — the registry is the map scoping draws on. Surface it; don't own the plan:

- Pull the landscape (`repo list`, `repo show`) and use descriptions as the *reason* a repo is or isn't relevant: "product copy → `web-app` and `cms`; `auth` is unrelated."
- If a working set keeps recurring, offer to crystallize it into a **repo-group** so future work can scope to it by name (the description is the scoping rationale).

Deciding which repos a task touches and sequencing the work is planning's call (`/rad-brainstorm`), using this map — hand that off rather than driving it here.

## Binding and the unbound state

A repo present in `repo-registry.yml` with no local path on this machine is **unbound** — normal when a teammate pulled the shared registry. It's surfaced (in `repo list`, `repo show`, and the session preamble) with a bind hint, never as an error. Help the user bind it to their local clone:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo bind --name <slug> --path <abs-path>
```

`bind` resolves a worktree path to its main clone and **warns** (non-fatal) when the directory's remote doesn't match the registered identity or isn't a git tree — relay those warnings to the user so a mis-bind is visible.

## The empty state

When nothing is registered, the agent has no map of code beyond the current directory — not an error, just the first step. Open with the worldview and the offer, in this voice:

> Repos and repo-groups are how I keep a map of the code you work across. By default I only see the folder we're in, but most real work spans several repositories — registering them tells me where each lives and which belong together, so I can plan and write code across all of them instead of treating this folder as the whole picture.
>
> A **repo** is one registered repository; a **repo-group** bundles a set of them to scope the work — when we plan or code against a group, only those repos are in play, not everything you've registered. Nothing's registered yet — want to add your first? Happy to explain more first if you'd like.

If they want to proceed, walk them through the dry-run → confirm flow above.

## Confirm before destructive ops

`repo remove` and `repo-group delete` are irreversible registry edits — confirm once with the user before running them. Everything else (list, show, add, bind, edit, group create/add/remove) runs directly.
