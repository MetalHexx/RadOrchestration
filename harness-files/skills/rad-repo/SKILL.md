---
name: rad-repo
description: Use this skill when the user wants to register, view, edit, or remove a repo or repo-group — including cloning onto a new machine (repo bind), organizing repos into named groups, or asking how the repo registry works.
user-invocable: true
---

# Repos and Repo-Groups

The orchestration system keeps a small registry of git repositories so every project can reference repos by a short slug rather than a full path. A **repo** is a registered git repository with a team-portable identity (remote URL, default branch, optional description) stored in `repo-registry.yml`. A **repo-group** is a named collection of those slugs stored in the same file, useful when a project spans several repositories.

Because paths differ from machine to machine, local directory paths live in a separate `repo-registry.local.yml` file that stays out of version control. When a repo has no local path recorded it is _unbound_ — it appears in listings but cannot be resolved to a directory until `repo bind` maps it to the right path on the current machine.

For a full explanation of the two-file split and the unbound state, see [`references/registration-model.md`](references/registration-model.md).

Run any command with `--help` for the full flag listing — this skill intentionally omits flag detail to stay concise.

---

## Routing table

Infer the intent from what the user says. Confirm once if the inferred command would make a destructive or irreversible change (remove, delete); otherwise run it directly.

### Repo operations

| User intent | CLI |
|---|---|
| Register a repo from a local path | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo add --path <abs-path>` |
| Bind an existing registry entry to a local path | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo bind --name <slug> --path <abs-path>` |
| List all registered repos | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo list` |
| Show details for one repo | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo show --name <slug>` |
| Edit a repo's description, remote, or default branch | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo edit --name <slug> [--description "..."] [--remote <url>] [--default-branch <branch>]` |
| Remove a repo from the registry | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo remove --name <slug>` |

### Repo-group operations

| User intent | CLI |
|---|---|
| Create a new group | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group create --name <slug> --members <slug1,slug2,...> [--description "..."]` |
| Add a repo to an existing group | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group add --group <group-slug> --repo <repo-slug>` |
| Remove a repo from a group | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group remove --group <group-slug> --repo <repo-slug>` |
| Delete a group (repos are not unregistered) | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group delete --name <slug>` |
| List all groups | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group list` |
| Show members of one group | `node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo-group show --name <slug>` |

---

Each command emits a JSON envelope `{ "ok": <bool>, "data": { ... }, "error": { ... } }`. On success, surface the relevant fields from `data` in a short plain-language confirmation. On failure, surface `error.message`.
