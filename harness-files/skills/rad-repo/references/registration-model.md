# Registration Model

## What a repo is

A **repo** is a git repository recorded in the orchestration system under a short lowercase-kebab slug (e.g. `my-app`, `shared-lib`). The registry stores the team-portable parts of its identity: remote URL, default branch, and an optional human-readable description. The slug is derived automatically from the last path segment of the directory when you register with `repo add`, or you can supply one explicitly.

Slugs are unique across both repos and repo-groups — you cannot have a repo and a repo-group sharing the same name.

## What a repo-group is

A **repo-group** is a named list of repo slugs. Groups let a project reference several repositories as a unit rather than enumerating each slug individually. A group has its own slug and an optional description. Deleting a group removes only the group record; the member repos remain registered and unaffected.

## The two-file split

The registry is deliberately split across two files that live in the radorc root (`~/.radorc/`):

**`repo-registry.yml`** — team-portable identity. Contains each repo's remote URL, default branch, and description, plus all repo-group definitions and their member lists. This file is safe to commit and share with teammates because it contains no machine-specific paths.

**`repo-registry.local.yml`** — per-machine paths. Maps repo slugs to absolute directory paths on the current machine. This file is automatically added to `.gitignore` when it is first written, because paths are meaningful only on the machine where the repo is cloned.

When a teammate clones the project repository and pulls `repo-registry.yml`, their local copy starts with every repo's identity already present — but with no path bindings yet, because their checkout lives at a different location.

## The unbound state

A repo is **unbound** when its slug appears in `repo-registry.yml` but has no entry in `repo-registry.local.yml`. An unbound repo shows up in `repo list` with `bound: false` and a hint suggesting the remediation command. Unbound repos cannot be resolved to a directory, so any workflow step that needs to open or run code in that repo will fail until it is bound.

The remediation is `repo bind`:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo bind --name <slug> --path <abs-path>
```

This writes the local path for that slug into `repo-registry.local.yml` without touching the shared identity file. After binding, `repo show` reports `bound: true` and the resolved path.

## Slug uniqueness

Every slug — whether it names a repo or a repo-group — must be unique within the registry. The constraint spans both namespaces: a slug already used for a repo cannot be reused for a group, and vice versa. The `repo add` and `repo-group create` commands enforce this and return an error if the chosen name is already taken.

Slugs follow lowercase-kebab convention (`a-z`, `0-9`, hyphens; no uppercase, no underscores, no slashes). The `repo add` command derives the slug automatically from the directory name using that rule; you can override it before or after registration with `repo edit`.
