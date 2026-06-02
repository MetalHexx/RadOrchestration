# CLI Command Reference

The `/rad-repo` skill drives the `radorch` CLI. The CLI is **mechanical and non-interactive**: it takes explicit arguments, resolves deterministic git facts, and **fails loud** on ambiguity — it never prompts. The conversation lives in the skill (see [interacting-with-users.md](interacting-with-users.md)).

Every command emits one JSON envelope on stdout: `{ "ok": <bool>, "data": { ... }, "error": { ... } }`. Read result fields from inside `data`. Every command also supports `--help` at the noun, subcommand, and flag level — prefer it over guessing flags.

## Repo operations

Register a repo (resolves a worktree/subdirectory to the main clone; slug from the remote name unless `--name` is given; `--description` is required):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo add --path <abs-path> --description "<what it is and why you'd look here>" [--name <slug>]
```

Preview what `repo add` would register — resolved path, derived slug, remote, and detection (`isWorktree`, `mainWorktreePath`, `remoteAlreadyRegisteredAs`, `nameAvailable`, …) — **without writing** and **without needing a description**:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo add --path <abs-path> --dry-run --json
```

Bind a registered repo to a local clone on this machine (resolves a worktree to its main clone; warns on a remote mismatch):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo bind --name <slug> --path <abs-path>
```

List all repos with their bound/unbound state:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo list
```

Show one repo's full detail (identity, group memberships, local path or unbound state):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo show --name <slug>
```

Edit mutable identity fields (the slug cannot be changed; the description cannot be blanked):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo edit --name <slug> [--description "..."] [--remote <url>] [--default-branch <branch>]
```

Remove a repo from the registry (confirm with the user first — destructive):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo remove --name <slug>
```

## Repo-group operations

Create a group from member repos (`--description` is required — it is the scoping rationale):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group create --name <slug> --members <slug1,slug2,...> --description "<what this group scopes>"
```

Edit a group's description (the slug cannot be changed; the description cannot be blanked):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group edit --name <slug> --description "<new scoping rationale>"
```

Add or remove a member repo:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group add --group <group-slug> --repo <repo-slug>
```

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group remove --group <group-slug> --repo <repo-slug>
```

Delete a group (member repos stay registered — confirm with the user first):

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group delete --name <slug>
```

List all groups, or show one group's members:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group list
```

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group show --name <slug>
```

## Failure modes worth knowing

`repo add` fails loud (these are the moments to interview the user — see [interacting-with-users.md](interacting-with-users.md)):

- the path is not a git repository;
- there is no remote, or multiple remotes and none named `origin`;
- the same remote is already registered under a different slug;
- the resolved/`--name` slug is invalid or already taken;
- no `--description` was supplied.
