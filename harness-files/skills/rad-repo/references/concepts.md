# Concepts & Philosophy

## Why the registry exists

A CLI agent's entire universe is its current working directory — it has no peripheral vision. Real software work, though, is cross-cutting: a feature lands in a backend, a frontend, a shared client, an infra repo. The repo a change lives in is an accident of how a team stores code; the *task* is the unit of intent, and intent spans repos.

The registry is a **logical map** that decouples an agent's worldview from how the filesystem happens to be laid out. With it, an agent knows there is code beyond the cwd, where it lives, what each repo is for, and which repos belong together. Without it, cross-repo work is impossible — the agent simply can't see far enough.

- **Descriptions give reach.** They are the *reason to explore*: the semantic hook that turns "a repo exists" into "I should look there for this."
- **Repo-groups give focus.** They scope attention to the repos relevant to a domain, so the agent isn't dragged through unrelated code.

The map only works if it is **true** and **complete**: it must point at real, durable repositories (not transient worktrees), and every entry must carry a real description.

## What a repo is

A **repo** is a git repository recorded under a short lowercase-kebab slug (e.g. `billing-api`, `web-app`). The registry stores its team-portable identity: remote URL, default branch, and a **required** human description. The per-machine local clone path is stored separately (see the two-file model).

- **Slug.** Derived by default from the **remote repository name** (`…/RadOrchestration` → `rad-orchestration`, splitting camelCase), or set explicitly with `--name`. It is **not** taken from the local folder name — a folder is incidental, the remote identity is durable. Slugs are lowercase-kebab (`a-z`, `0-9`, hyphens), unique across both repos and repo-groups, and **immutable** once registered (to change one, remove and re-add). Because it can't be changed later, confirm the slug with the user at registration time.
- **Description (required).** A non-empty "what is this and why would an agent look here." `repo add` refuses to register without one, and `repo edit` refuses to blank it.
- **Canonical home.** `repo add` registers the repository's **main clone**, resolving automatically when you point it at a linked worktree or a subdirectory. Worktrees are transient; the main clone is the durable home.

## What a repo-group is

A **repo-group** is a named list of repo slugs with its own slug and a **required** description. Groups let a project reference several repositories as one scoping unit instead of enumerating slugs. The description is the *scoping rationale* — what domain this group covers and why; it is **editable via `repo-group edit`** (parity with a repo's description), though, like a slug, it can never be blanked. The slug itself stays immutable once set. Deleting a group removes only the group record; the member repos stay registered.

## The two-file model

The registry lives in two files under the radorc root (`~/.radorc/`):

- **`repo-registry.yml`** — team-portable identity: each repo's remote, default branch, and description, plus all repo-group definitions. Safe to commit and share; contains no machine-specific paths.
- **`repo-registry.local.yml`** — per-machine paths mapping each slug to its local clone directory. Auto-added to `.gitignore` on first write, because paths are meaningful only on the machine where the repo is cloned.

When a teammate pulls `repo-registry.yml`, every repo's identity is present immediately — but with no path bindings yet, because their checkout lives elsewhere.

## The unbound state

A repo is **unbound** when its slug is in `repo-registry.yml` but has no entry in `repo-registry.local.yml` on this machine — the normal teammate-clone case, never an error. Unbound repos show in `repo list` with `bound: false` and a remediation hint; they can't be resolved to a directory until bound. The remediation is `repo bind`:

```
node "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" repo bind --name <slug> --path <abs-path>
```

This writes the local path for that slug without touching the shared identity file. After binding, `repo show` reports `bound: true` and the resolved path.

## Slug & uniqueness rules

Every slug — repo or repo-group — must be unique across **both** namespaces (a repo and a group can never share a name). Slugs are lowercase-kebab; `repo add` / `repo-group create` validate this and fail loud on a collision or an invalid slug.
