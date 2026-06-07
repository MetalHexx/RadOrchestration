# Multi-Repo Design

**Status:** In flight. This document captures the multi-repo direction as reframed in a fresh brainstorming pass on 2026-05-27/29. The work itself remains deferred until picked up as discrete projects. Sections below describe direction agreed during this brainstorming pass; specific topics not yet revisited are flagged in **Future Iterations**.

---

## Why multi-repo (the orienting philosophy)

A CLI agent's entire universe is its current working directory — it has no peripheral vision into code that lives elsewhere. Real software work is the opposite: a feature or task is cross-cutting, landing across a backend, a frontend, a shared library, infra. The repository a change lives in is an accident of how a team stores code; the *task* is the unit of intent, and intent spans repos. Single-repo tooling forces intent to conform to storage — so the cross-cutting, high-value work is exactly what it cannot reach.

The registry is a **logical map** that decouples an agent's worldview from how the filesystem happens to be laid out (a parent folder, a monorepo, scattered clones — it no longer matters). It is the foundation every later iteration stands on, so it must be **true** (pointing at real, durable repositories — main clones, never transient worktrees) and **complete** (every entry carrying a real description).

Two forces pull in opposite directions, on purpose:

- **Reach** — descriptions are the *reason to explore*. They turn "a repo exists" into "I should look there for this," and stop an agent from tunnelling on the cwd and missing where the work lands.
- **Focus** — repo-groups scope attention to the repos relevant to a domain, so an agent isn't dragged through unrelated code.

Blindness (missing relevant repos) and distraction (drowning in irrelevant ones) are the two failure modes; the registry is the dial between them. Everything in this design — ambient awareness, descriptions, repo-groups, the `/rad-repo` skill — exists to give a context-bounded agent a **true, scoped model of a system larger than it can see**. Hold this framing when picking up any iteration.

---

## Vocabulary

| Term | Definition |
|---|---|
| **Install** | One per machine, rooted at `~/.radorc/`. Holds the runtime, configuration, registry, projects, and worktrees. |
| **Repo** | A first-class registry entry. Has a name, remote URL, default branch, and description. Local path (per-machine) lives separately in `repo-registry.local.yml`. |
| **Repo-Group** | A named, optional grouping of repos used at brainstorming time as input shorthand and preserved as provenance metadata on requirements / master plan. **Not a runtime entity** — once a project is created, it carries a frozen list of repos, not a repo-group reference. No mid-flight repo-group expansion exists. |
| **Project** | A unit of orchestration work. Lives at `~/.radorc/projects/<NAME>/` regardless of which repo(s) it touches. Targets a list of repos directly (the list may have been seeded from a repo-group, recorded as `repo-group:` provenance on requirements + master plan). |
| **Worktree** | A managed git worktree of a registered repo, created at `source_control_init` time at `~/.radorc/worktrees/<worktree_name>/<REPO>/`. `worktree_name` is a required value on each project (defaults to the project's own name). Projects can share a `worktree_name` to operate on the same on-disk structure — e.g., a follow-up project running against an earlier project's branches. Always derived by convention; never stored as a path in state. |
| **Phase** | A grouping of tasks within a Master Plan, identified `P01`, `P02`, etc. Groups work by natural seam (layer boundary, independently deliverable slice). Tasks within a phase share execution ordering and review scope but are individually executed. Mixed-repo phases are supported — phase frontmatter `repos:` is the union of its tasks' target repos. |
| **Task** | A unit of code change inside a project, executed by the coder agent from a self-contained handoff. Names the target repo(s) explicitly via `**Target repos:**` plus per-repo `**Files for <repo>:**` subsections. |
| **Registry** | The two-file model that identifies a team's repos. `repo-registry.yml` (team-portable, versioned) carries identity; `repo-registry.local.yml` (per-machine, gitignored) carries local-clone paths. |

A project at `~/.radorc/projects/BUILD-FOO/` carries `repos: [backend, frontend]` in its master plan frontmatter (the sealed authoritative source). Its tasks specify `**Target repos:** backend` (always plural-form, even when one name). Worktrees materialize at `~/.radorc/worktrees/BUILD-FOO/backend/` etc. when the project initializes source control. Agents always operate inside worktrees, never in the source clones.

---

## The Repo Registry

This section covers everything in the registry domain: the data files, the lib module that owns them, the CLI commands that read/write them, the user-facing skill that fronts them, and the ambient-awareness mechanism that makes agents aware of registered repos by default.

### The two-file model

The registry splits identity from per-machine paths:

| File | Versioned? | Purpose |
|---|---|---|
| `repo-registry.yml` | Yes | Team identity — repos and repo-groups with names, remote URLs, default branches, descriptions, repo-group memberships |
| `repo-registry.local.yml` | No (gitignored) | Per-machine path bindings — maps registered repo names to local source-clone paths |

The `.local.yml` suffix carries the "don't commit; per-machine override" semantic via the well-established `.env.local` convention.

#### `repo-registry.yml` shape

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# Team repo registry.
# Source of truth for repo IDENTITIES (name, remote, default branch, description)
# and REPO-GROUPS (named bundles of repos used for project scoping).
#
# Versioned — commit changes here so everyone on the team sees them.
# Per-machine source-clone paths live in repo-registry.local.yml (gitignored).
# ─────────────────────────────────────────────────────────────────────────────

repos:
  backend:
    remote: git@github.com:acme/backend.git
    default_branch: main
    description: >
      REST API, async worker queue, and Postgres + Redis layer for the
      customer-facing product. Owns auth, billing, and event ingestion.

  frontend:
    remote: git@github.com:acme/frontend.git
    default_branch: main
    description: >
      User-facing React app: customer dashboard, marketing site, and the
      embedded customer-portal iframe. Consumes backend's REST API.

  infra:
    remote: git@github.com:acme/infra.git
    default_branch: main
    description: >
      Terraform modules, GitHub Actions workflows, and deploy scripts.
      Crosses backend + frontend; changes here trigger staged rollouts.

repo-groups:
  acme-stack:
    description: >
      The full customer-facing product stack — backend API + frontend app.
      Use this when scoping a project that touches both layers (e.g. a new
      end-to-end feature).
    members: [backend, frontend]

  acme-with-infra:
    description: >
      All three repos. Use for projects that need coordinated deploy or
      infra changes alongside app code.
    members: [backend, frontend, infra]
```

**Shape notes:**

- Map-keyed (not array-of-objects). The registry files are static identity catalogs read by lookup-by-name; the array-of-objects convention used elsewhere in the system is for pipeline data flow specifically.
- Multi-line `description:` fields use YAML's `>` folded scalar — line-breaks become spaces, so agents and humans both see clean prose without `\n`-noise in output.
- `default_branch` is snake_case (matches existing state.json field conventions); `repo-groups:` top-level key uses the kebab-case form per the vocabulary.

#### `repo-registry.local.yml` shape

```yaml
# ─────────────────────────────────────────────────────────────────────────────
# Per-machine source-clone paths.
# Anchors each registered repo (from repo-registry.yml) to its local clone
# on THIS machine. Gitignored — never commit.
#
# Populate with `radorch repo add <path>` (registers + binds in one step)
# or `radorch repo bind <name> <path>` (anchors an already-registered repo).
# ─────────────────────────────────────────────────────────────────────────────

repos:
  backend:  C:\dev\acme\backend
  frontend: C:\dev\acme\frontend
  infra:    C:\dev\acme\infra
```

**Shape notes:**

- Just `name: path` pairs. Nothing else has per-machine variance, so nothing else belongs here.
- No `repo-groups:` section — groupings have no per-machine state.
- The top-of-file comment names the two CLI commands that maintain it, so a developer opening the file sees how to populate or update entries immediately.

### `cli/src/lib/repo-registry/` module

A new lib module (sibling to `cli/src/lib/pipeline-engine/`) owns registry operations: reading `repo-registry.yml` + `repo-registry.local.yml`, name → source-path resolution, repo-group operations.

**Consumed by:**

- All `radorch repo` / `repo-group` / `worktree` subcommands (obvious)
- `radorch source-control init` — worktree creation needs the source clone path
- `radorch git commit` / `git pr` — per-repo remote URL lookup
- `radorch pipeline signal` — **validation only** (checking that event payloads referencing repo names match the registry; not for path resolution)

The pipeline engine itself does **not** consume this module at enrichment time — paths are convention-derived (see **Pipeline Data Flow** below).

### CLI command surface

Multi-repo introduces a new CLI subcommand surface on `radorch`. The `/rad-repo` skill is the primary user-facing entry point, but the commands are usable in their own right and are leveraged by pipeline operations that need registry data. High-level shape only — exact flags and argument grammars are out of scope here.

**Repo registry CRUD:**

| Command | Purpose |
|---|---|
| `radorch repo add <path>` | Register a new repo. Infers name, remote, default branch from the git directory at path; writes both `repo-registry.yml` (identity) and `repo-registry.local.yml` (path). Prompts for ambiguous fields. |
| `radorch repo bind <name> <path>` | Anchor an already-registered repo to a local source-clone path on this machine. Touches `repo-registry.local.yml` only. Used when the repo identity exists (e.g., from a cloned `repo-registry.yml`) but the local path hasn't been set on this machine. |
| `radorch repo list` | List registered repos. |
| `radorch repo show <name>` | Show details for one repo (including local source-clone path on this machine). |
| `radorch repo remove <name>` | Unregister. Blocks when an active project targets the repo unless `--force` is passed. |
| `radorch repo edit <name>` | Modify description / remote / default branch. |

**Repo-Group management:**

| Command | Purpose |
|---|---|
| `radorch repo-group create <name> <repo1> <repo2> ...` | Group repos into a repo-group. |
| `radorch repo-group list` | List repo-groups with members. |
| `radorch repo-group show <name>` | Details. |
| `radorch repo-group add <group> <repo>` / `repo-group remove <group> <repo>` | Add / remove member repos. |
| `radorch repo-group delete <name>` | Delete the repo-group. Does not unregister member repos. |

**Worktree management:**

| Command | Purpose |
|---|---|
| `radorch worktree list <project>` | List a project's worktrees. |
| `radorch worktree remove <project>` | Destroy all of a project's worktrees. |
| `radorch worktree remove <project> --repo <name>` | Destroy a single repo's worktree (e.g., to recover from corruption). |

Worktree **creation** is implicit — it happens during `radorch source-control init`. No direct `radorch worktree create` command.

**Source-control flow** (covered in detail in the sections noted; listed here for surface completeness):

| Command | Purpose | Section |
|---|---|---|
| `radorch source-control init --project <name>` | Create worktrees + populate state per repo | Worktree Lifecycle + Source-Control Init |
| `radorch git commit --task-id <id>` | Fan-out per-repo commits using agent-supplied messages | Source-Control Fan-Out |
| `radorch git pr --project <name>` | Fan-out per-repo PRs with two-pass linked-PR creation | Source-Control Fan-Out |

**Two implementation-time questions, deferred:**

- Exact semantics of `radorch repo remove --force` (warn-and-proceed vs. additional confirmation prompt)
- Whether `radorch worktree remove --repo <name>` updates `state.pipeline.source_control.repos` to mark the entry as orphaned, or just deletes the worktree directory without state changes

### `/rad-repo` skill (NEW)

Registration and management are exposed through a single user-facing skill, **`/rad-repo`**, which covers both repos and repo-groups. The skill dispatches to underlying CLI commands; the CLI itself is not surfaced for direct user use today.

**Behavior** (revised 2026-06-01 — supersedes the original "infer-hard" sketch; see the Amendment in the iteration-1 Requirements/Brainstorming):

- **Worldview-first orientation.** The skill is authored as a briefing — *worldview → posture → toolbox* — not a CLI mirror. It grounds the agent in *why* the registry matters (reach + focus, the philosophy above) before *how* to drive it, across a lean `SKILL.md` plus three references (concepts, CLI commands, interacting-with-users).
- **Deterministic detection + confirmation, not hard inference.** `repo add` resolves the canonical **main clone** even when pointed at a linked worktree or a subdirectory, derives the slug from the **remote name** (camelCase-split; not the folder basename), and exposes a read-only `--dry-run` reporting the resolved path, slug, and detection (`isWorktree`, `remoteAlreadyRegisteredAs`, …). The skill runs the dry-run, then **interviews** the user to confirm path, slug, and description before writing. Guessing a judgment call — a worktree as the repo, a meaningless slug, an empty description — is treated as worse than asking; the CLI fails loud on ambiguity so the conversation lives in the skill.
- **Descriptions are required.** `repo add` / `repo-group create` refuse an empty description and `repo edit` refuses to blank one — the description is the load-bearing "reason to explore," so the skill always elicits a real one.
- The skill teaches the concepts and routes natural intent to the right CLI command. `/rad-repo` with no args surfaces a help-style entry point.

This subsection supersedes the earlier "infer-hard, last-path-segment name, one-confirmation" sketch and discharges the **Future Iterations** entry "`/rad-repo` skill scope."

### Ambient awareness

Every supported AI harness fires a **session-start hook** that injects the registered repos and repo-groups directly into the **primary (interactive) session agent's** context. Content is the full inline registry — names, descriptions, remotes, default branches, paths, plus any defined repo-groups:

```
## radorc — Repo Registry

Repos:
- frontend — git@github.com:acme/frontend.git — main — C:\dev\acme\frontend
  "User-facing React app, customer dashboard, marketing site."
- backend  — git@github.com:acme/backend.git  — main — C:\dev\acme\backend
  "REST API, worker queue, Postgres + Redis."

Repo-Groups:
- acme-stack = [frontend, backend]

Use the `/rad-repo` skill to add, edit, remove, or otherwise manage repos and repo-groups.
```

The trailing instruction line is contractual — every emitted hook payload ends with the same `/rad-repo` pointer so any agent reading the block knows where to go for management operations without having to discover the skill some other way.

> **Empirical scope (corrected).** The session-start hook reaches **only the primary interactive-session agent** — it does **not** propagate into spawned subagents (verified: a freshly spawned subagent had zero registry awareness). Subagents therefore have no ambient repo channel; one that genuinely needs registry identity (e.g. the `planner`) must obtain it another way. This is why the `planner` retains the `/rad-repo` skill while the worktree-operating subagents do not — see **Agent + Skill Updates**.

**Per-harness wrapping** is handled by the existing install-adapters layer:

| Harness | Mechanism |
|---|---|
| Claude Code | `SessionStart` hook, `additionalContext` output |
| Codex CLI | `sessionStart` hook, `additionalContext` JSON |
| Copilot VS Code | `.github/hooks/*.json`, `hookSpecificOutput.additionalContext` |
| Copilot CLI | `sessionStart` hook with JSON `additionalContext` (v1.0.11+) |
| Cursor | Falls back to static `AGENTS.md` content (hook API unreliable today) |
| OpenCode | Falls back to static `AGENTS.md` content (no session-start hook) |

The content emitted is harness-agnostic; only the installation differs per adapter.

---

## Project ↔ Repo Binding

Repos enter the system at brainstorming time as a **proposed working set**. The binding is refined through planning and sealed at master plan time. This section covers the full authoring path: brainstorming → planning → frontmatter shapes → exploded handoffs.

### Authority chain

```
BRAINSTORMING.md         proposed (working hypothesis)
    ↓ /rad-plan reads
REQUIREMENTS.md          non-authoritative restate (planner may refine)
    ↓ feeds
MASTER-PLAN.md           SEALED in frontmatter (authoritative)
    ↓ explosion derives
PHASE doc frontmatter    union of tasks' repos (derived)
TASK handoff frontmatter per-task slice (from **Target repos:** parse)
    ↓ explosion writes
state.json TaskIterationEntry.repos (runtime cache, derived)
```

### Brainstorming flow updates

The `/rad-brainstorm` skill is multi-repo aware. Behavior:

1. Problem-space exploration first — no repos forced.
2. Agent surfaces repo context **adaptively** when domain hints land in conversation (e.g., user mentions "the checkout flow" → "sounds like `backend` plus `frontend` — confirm?").
3. At convergence, agent explicitly confirms the working repo set before writing.
4. **No `BRAINSTORMING.md` ships without a `## Repo Targets` section.**

The `BRAINSTORMING.md` template gains a new section:

```markdown
## Repo Targets (proposed)

**Repos involved**: `backend`, `frontend`
**Repo-Group** (if applicable): `acme-stack`
**Rationale**: New `/checkout` endpoint lands in `backend`; `frontend` needs the
typed client and UI integration.

*Note: planner may refine this set during requirements / master-plan work based
on what surfaces in scoping.*
```

The `(proposed)` qualifier in the heading signals the working-hypothesis intent.

### Document mutability

- `BRAINSTORMING.md` is **immutable post-conversation**. Historical proposal preserved.
- Requirements and Master Plan supersede; the master plan frontmatter is the single source of truth at runtime.

### Frontmatter shapes

Uniform `repos:` key across all four docs; semantics differ by doc:

```yaml
# REQUIREMENTS frontmatter (non-authoritative)
repos: [backend, frontend]
repo-group: acme-stack   # optional, provenance only

# MASTER PLAN frontmatter (AUTHORITATIVE — the seal)
repos: [backend, frontend]
repo-group: acme-stack   # optional, provenance only

# Exploded PHASE frontmatter (derived: union of phase's tasks' repos)
repos: [backend, frontend]

# Exploded TASK frontmatter (derived: per-task from **Target repos:** parse)
repos: [backend]
```

### Per-task body shape

Every task block in the master plan carries `**Target repos:**` plus one `**Files for <repo>:**` subsection per repo. Uniform shape — no special casing for single-repo:

```markdown
### P01-T01: Add /checkout endpoint
**Task type:** code
**Requirements:** FR-1, AD-2
**Target repos:** backend, frontend
**Files for backend:**
- Create: `src/routes/checkout.ts`
- Test: `tests/checkout.test.ts`
**Files for frontend:**
- Create: `src/api/checkout-client.ts`

- [ ] **Step 1: Write the failing test (FR-1)** …
```

Single-repo tasks still use `**Files for <repo>:**` (one subsection). No flat `**Files:**` shape; no auto-fill ergonomics.

### Explosion script

The existing `cli/src/lib/explode-master-plan.ts` gains:

- A `targetRepos: string[]` field on `ParsedTask`, populated by `extractTargetRepos(body)` mirroring today's `extractRequirementTags`. Regex: `/\*\*Target repos:\*\*\s*([^\n]+)/`.
- **Strict** parse — throws `ParseError` if `**Target repos:**` is missing on any task. Consistent with the uniform-shape lock; catches malformed plans at explosion time, not during execution.
- Phase frontmatter `repos:` computed as the union of its tasks' `targetRepos`.
- Task handoff frontmatter `repos:` propagated from `targetRepos`.
- `state.json` `TaskIterationEntry` gains a `repos` array (see **Pipeline Data Flow** below).

The `**Files for <repo>:**` subsections need no new parsing — they're opaque body text copied verbatim into the exploded handoff. Downstream agents parse the per-repo grouping when they read the handoff.

---

## Worktree Lifecycle + Source-Control Init

This section covers the operational setup layer: how worktrees come into being for a project and the source-control init flow that creates them.

### Worktree management

Worktrees are **managed by radorc** (not user-maintained convention-only).

| Aspect | Decision |
|---|---|
| Location | `~/.radorc/worktrees/<worktree_name>/<REPO>/` — `worktree_name` defaults to the project name. Default behavior gives each project its own worktree per repo (enables parallel projects touching the same source repo without conflict). Two projects can intentionally share a `worktree_name` to operate on the same worktree structure (e.g., follow-up work). |
| Creation | At `source_control_init` time, per repo in the project's `repos:` set. CLI runs `git worktree add` from the source clone path (looked up via `registry.local.yml`). |
| Branch | Working branch derived from the `worktree_name` (pattern e.g. `radorch/<WORKTREE-SLUG>`), uniform across all of the project's repos. User can override per project (deferred detail). |
| Destruction | Manual via CLI (`radorch worktree remove <project>` or similar). Pipeline never auto-destroys. `/rad-repo` skill is trained to assist users with the operation. |
| `~/.radorc/` portability | `worktrees/` is always gitignored in the outer `~/.radorc/` repo. Each git-worktree has a `.git` *file* (pointer), not a `.git/` directory, so nesting is technically clean; gitignore makes the outer repo skip the whole subtree. |

### Gitignore policy for `~/.radorc/`

For users who source-control their `~/.radorc/` for personal config sync:

```
action-events/*
!action-events/custom/
logs/
runtime/
templates/
ui/
install.json
orchestration.yml
repo-registry.local.yml
worktrees/
```

**Source-controlled:** `action-events/custom/`, `projects/`, `repo-registry.yml`.
**Per-machine / shipped / ephemeral:** everything in the gitignore.

### Source-Control Init reframing

Today, `source_control_init` is essentially a state-setter event masquerading as work: the orchestrator gathers field values manually (via `radorch project context` + user prompts) and signals them through to the pipeline, which writes them into `state.pipeline.source_control`. No real work happens during signaling — the worktree is assumed to already exist.

Multi-repo reframes this around the same pattern as the rest of the design: **a real CLI command does the work, and updates state directly as a side effect** — matching the precedent set by `explode_master_plan` (which mutates state.json directly via `writeState`, with no event-payload round-trip).

### New init flow

| Aspect | Decision |
|---|---|
| Timing | Fires before pipeline execution begins (same as today) |
| Trigger | `/rad-execute` skill calls `radorch source-control init --project X` directly. No source-control agent spawn — init is mechanical (worktree creation + state derivation), no LLM work needed. |
| What the CLI does | Reads project's `repos:` from master plan frontmatter and the resolved `worktree_name` (project name by default, or a name the launch skill set when the user opted to reuse another project's worktrees). For each repo: looks up source clone path from `registry.local.yml`, runs `git worktree add ~/.radorc/worktrees/<worktree_name>/<REPO>/ <branch>` if the worktree doesn't already exist, derives branch / base_branch / remote_url. If the worktree already exists (reuse case), skips creation and adopts the existing branch state. |
| State mutation | CLI updates `state.pipeline.source_control.repos` array **directly** (no separate event signal). Matches the `explode_master_plan` pattern. |
| Per-repo failure | Isolated in the result array — frontend init failure doesn't block backend. Entries indicate per-repo success/failure; user re-runs to retry the failed ones. **Idempotent** — already-initialized repos are no-ops. |
| `auto_commit` / `auto_pr` | Top-level (project-scoped). Gathered by `/rad-execute` skill, possibly via user prompt when config is `"ask"`. Same as today. |
| Branch naming | Derived from the `worktree_name` (which itself defaults to the project name), uniform across all repos. Exact pattern (e.g., `radorch/<WORKTREE-SLUG>`) deferred to a small follow-up. |
| Worktree reuse | The launch skill (`/rad-execute` or `/rad-execute-parallel`) scans for existing worktrees whose repo set overlaps the new project's `repos:` and prompts the user *"reuse `PROJECT-1`'s worktrees, or create a new one?"* If reuse: `worktree_name` is set to the target project's name; init skips `git worktree add` and adopts the existing branch state. If fresh: `worktree_name` = the project's own name. The follow-up case is the developer's responsibility to use intentionally — there is no formal parent-child tracking in state, and `radorch worktree remove` does not know about aliased dependents. |

---

## Pipeline Data Flow

This section covers the runtime data flow: state.json shape, how the engine resolves paths at enrichment time, and the per-action JSON shapes that flow into spawn prompts. `state.json` is **source-controlled** alongside the rest of `~/.radorc/projects/`. It must remain **path-free** so it ports cleanly between developers whose source clones live in different places on disk.

### Data flow overview

```
At explosion time:
  master plan → exploded phase + task docs (with frontmatter)
              → state.json runtime cache (repos array, derived)

At source_control_init (one time per project per repo):
  registry.local.yml → source clone path
  git worktree add ~/.radorc/worktrees/<worktree_name>/<REPO>/   (skipped if already exists for reuse case)
  state.pipeline.source_control populated via direct CLI mutation
  (worktree_name defaults to project name; set by launch skill when user opts to reuse)

At enrichment time (every spawn):
  state.json + convention math → worktree paths
  (no registry lookup needed — paths derived from worktree_name + repo names)
```

### `state.json` shape additions

`TaskIterationEntry` collapses the old `commit_hash` (single) and Wave-2's separate `repos: [name, …]` into one consistent array:

```json
{
  "index": 0,
  "status": "in_progress",
  "doc_path": "tasks/PROJECT-TASK-P01-T01-SLUG.md",
  "repos": [
    { "name": "backend",  "commit_hash": "abc..." },
    { "name": "frontend", "commit_hash": null }
  ]
}
```

`pipeline.source_control` gets the same array treatment. The resolved `auto_commit` / `auto_pr` values live at the top level (project-scoped, not per-repo) and carry the canonical `"always"` | `"never"` vocabulary the runtime accepts (per `mutations.ts` lines 1125–1137; aliases `"yes"` / `"no"` are also accepted at signal time). `worktree_name` is a required top-level value (defaults to the project's own name) and is the sole source of truth for resolving worktree paths at enrichment time:

```json
"pipeline": {
  "source_control": {
    "auto_commit": "always",
    "auto_pr": "always",
    "worktree_name": "BUILD-FOO",
    "repos": [
      { "name": "backend",
        "branch": "radorch/build-foo", "base_branch": "main",
        "remote_url": "git@github.com:acme/backend.git",
        "compare_url": null, "pr_url": null },
      { "name": "frontend",
        "branch": "radorch/build-foo", "base_branch": "main",
        "remote_url": "git@github.com:acme/frontend.git",
        "compare_url": null, "pr_url": null }
    ]
  }
}
```

**Top-level state.json shape today** (for context — multi-repo doesn't change this skeleton, only the contents of `pipeline.source_control` and `TaskIterationEntry`):

```
$schema: "orchestration-state-v5"
project: { ... }
config:  { gate_mode, limits, source_control: { auto_commit, auto_pr, ... } }   ← initial defaults from orchestration.yml
pipeline: { source_control: { ... resolved runtime values ... } }              ← what the runtime actually uses
graph:   { nodes: { ... } }
```

`state.config.source_control` holds the **initial defaults** read from `orchestration.yml` at project creation; `state.pipeline.source_control` holds the **resolved runtime values** that the engine consults during execution. The two are distinct concerns — `state.config` is read-once-at-init, `state.pipeline.source_control` is the operational mirror that grows per-repo arrays under multi-repo. This document's shape changes apply to `state.pipeline.source_control`; `state.config` shape is untouched by multi-repo.

### Path resolution

The pipeline engine **never reads `registry.local.yml` at enrichment time** for path resolution. Worktree paths are derived purely from convention:

```
path = ~/.radorc/worktrees/<worktree_name>/<REPO>/
```

`worktree_name` lives on `state.pipeline.source_control` (required, defaults to project name); the task entry's `repos[].name` provides the repo names. Convention concatenation yields the path. No file I/O, no registry call, no caching layer.

The registry is consulted **once per project per repo at `source_control_init` time** — to know where the source clone lives, as input to `git worktree add`. After that the worktree path is stable and convention-derived.

Implication: if the user moves a source clone (e.g., `C:\dev\acme\backend` → `D:\code\backend`), in-flight projects keep running — only the next `source_control_init` cares about the source location.

> **⚠️ Known gap — registry-vs-worktree path resolution (hit live during MULTI-REPO-3 / iteration 3; fix in a later iteration).**
>
> This section describes the *target* state: the engine hands each spawn a per-action `repos[]` array carrying convention-derived **worktree** `path` values (see `execute_task` shape below), and agents join relative paths against those. That enrichment lands in **iterations 4–5** (managed worktree lifecycle + `context-enrichment.ts` per-action `repos` arrays). It does **not** exist yet in iteration 3.
>
> In the interim, the orchestrator's spawn prompts carry **no worktree path**. When a project runs in a git worktree (e.g. `…/v3-worktrees/MULTI-REPO-3`) but a coder resolves its target repo **by name** — via the `/rad-repo` skill, `radorch repo show`, or reading `repo-registry.local.yml` directly — it gets the registered **canonical main clone** (`rad-orc-source → C:/dev/orchestration/v3`, which `repo add` resolves to *by design* — "main clones, never transient worktrees"). The agent then writes to the main clone on the wrong branch, silently diverging from the branch under execution. It is non-deterministic: an agent that just uses the session CWD lands correctly; one that consults the registry does not.
>
> **Real fix:** exactly what this section already specifies — enrichment carries `repos[].path` (worktrees) and the orchestrator inlines them into every spawn prompt (iters 4–5). **Interim workaround (in force now):** the orchestrator hard-codes the worktree path into every spawn prompt (coder, source-control, reviewer) and explicitly forbids touching the main clone. **Next iteration should also consider a guardrail** beyond prose — e.g. `source_control_init` binds the repo to the worktree for the run, or the CLI fails loud when an agent writes outside the project's worktree.
>
> Observed instance + remediation: `~/.radorc/projects/MULTI-REPO-3/MULTI-REPO-3-ERROR-LOG.md`, Error 1.

### Per-action enrichment shape

Every multi-repo-aware action's `data.context` carries per-repo data as a **single `repos` array of objects**. One canonical shape across all actions; entries gain action-specific fields. This is the same convention used everywhere — state.json, agent outputs, result envelopes.

#### `execute_task`

```json
{
  "phase_id": "P01",
  "task_id": "P01-T01",
  "handoff_doc": "tasks/PROJECT-TASK-P01-T01-SLUG.md",
  "repos": [
    { "name": "backend",  "path": "C:\\Users\\Metal\\.radorc\\worktrees\\BUILD-FOO\\backend" },
    { "name": "frontend", "path": "C:\\Users\\Metal\\.radorc\\worktrees\\BUILD-FOO\\frontend" }
  ]
}
```

The coder agent reads the handoff's `**Files for <repo>:**` subsections, joins relative paths with the matching entry's `path`, runs each repo's commands from that repo's `path`.

#### `spawn_code_reviewer`

```json
{
  "phase_id": "P01",
  "task_id": "P01-T01",
  "repos": [
    { "name": "backend",  "path": "...", "head_sha": "abc123" },
    { "name": "frontend", "path": "...", "head_sha": "def456" }
  ]
}
```

`head_sha` is null per-repo when no commit was made for that repo (e.g., `auto_commit: never` or no changes for that repo). Reviewer iterates the array, runs `git diff` (or `git show <head_sha>`) in each repo's worktree, writes ONE combined review doc. Cross-repo coupling reviewable as one diff.

#### `spawn_phase_reviewer`

```json
{
  "phase_id": "P01",
  "repos": [
    { "name": "backend",  "path": "...", "first_sha": "abc", "head_sha": "xyz" },
    { "name": "frontend", "path": "...", "first_sha": "def", "head_sha": "uvw" }
  ]
}
```

Per-repo cumulative range for the phase. Reviewer runs `git diff <first_sha>~1..<head_sha>` in each repo.

#### `spawn_final_reviewer`

```json
{
  "repos": [
    { "name": "backend",  "path": "...", "base_sha": "abc", "head_sha": "xyz" },
    { "name": "frontend", "path": "...", "base_sha": "def", "head_sha": "uvw" }
  ]
}
```

Project-wide cumulative range per repo. ONE combined review doc; one final-approval gate regardless of repo count.

#### `invoke_source_control_commit`

```json
{
  "phase_id": "P01",
  "task_id": "P01-T01",
  "repos": [
    { "name": "backend",  "path": "...", "branch": "radorch/build-foo", "base_branch": "main" },
    { "name": "frontend", "path": "...", "branch": "radorch/build-foo", "base_branch": "main" }
  ]
}
```

#### `invoke_source_control_pr`

```json
{
  "repos": [
    { "name": "backend",  "path": "...", "branch": "...", "base_branch": "main",
      "remote_url": "git@github.com:acme/backend.git" },
    { "name": "frontend", "path": "...", "branch": "...", "base_branch": "main",
      "remote_url": "git@github.com:acme/frontend.git" }
  ]
}
```

### Catalog bodies

Each `action.X.md` catalog file in `runtime-config/action-events/` tells the orchestrator (in prose) how to inline the `repos` array into the subagent's spawn prompt. The orchestrator stays mechanical — all per-action logic lives in the catalog bodies + `context-enrichment.ts`.

---

## Source-Control Fan-Out

The DAG stays structurally close to v1 — no `for_each_repo` node kind, commit/PR gates stay project-level, fan-out happens **inside the CLI commands** that the existing nodes invoke. One agent spawn per task (for commits) or per project (for PRs), regardless of repo count.

### Commit fan-out

- **One source-control agent spawn per task**, regardless of repo count.
- Agent crafts **per-repo commit messages in a single LLM pass** — output is an array of `{ name, message }`. Each repo gets a unique message tailored to its slice of file changes. Format is **conventional commits** (e.g., `feat(P01-T01): add /checkout endpoint`).
- **Header is mechanical** (`{prefix}({taskId}): {title}`, derived from frontmatter); **body is per-repo, LLM-crafted.**
- **One CLI call per task** — CLI iterates the array internally and commits each repo's worktree with its specific message.
- **Result envelope** carries per-repo outcomes as a `repos` array of objects: `{ name, committed, commitHash, pushed }`.
- **Single-repo tasks use the same contract** — one-entry array, uniform code path. No conditional shape.
- **Source-control agent stays haiku** — conventional commits are formulaic enough that haiku is fine; no model bump.
- **Per-repo failure isolated.** Commit failure for one repo halts the pipeline naming the failed repo; push failure marks `pushed: false` for that repo and continues.

### PR fan-out

- **One source-control agent spawn per project at PR time** — not per repo, not per task.
- Agent crafts **per-repo PR descriptions** via LLM narrative — PRs are for human reviewers, so the body is richer than commit bodies. Each PR description combines project context with per-repo specifics.
- **CLI does the per-repo `gh pr create` work.**
- **Linked PRs via two-pass creation:**
  - Pass 1: per-repo `gh pr create`, capture each PR URL.
  - Pass 2: per-repo `gh pr edit --body`, substitute placeholder text in each PR's body with sibling PR URLs so GitHub auto-renders cross-references.
- **Failure recovery:** idempotent re-run skips already-created PRs and retries the rest. Pass-2 retry-only is supported (detect placeholder text or track per-PR state).
- **Single-repo projects go through the same flow** — one PR, the "Linked PRs" section is omitted.

### `pipeline.source_control` state shape

See **Pipeline Data Flow** above. Per-repo branch, base_branch, remote_url, compare_url, pr_url all live inside the `repos` array. `auto_commit` / `auto_pr` stay top-level.

---

## Agent + Skill Updates

Multi-repo awareness ripples through several skills and agent definitions. The skill / CLI / registry surfaces themselves are covered in **The Repo Registry**; this section names the *behavioral* changes to skills and agents that consume the multi-repo contracts.

### Agent definitions — `/rad-repo` (revised: worktree-write footgun)

Originally every agent definition gained `/rad-repo` in its **Skills** section. That was walked back. A subagent operating inside a project worktree could resolve its target repo *by name* through the registry, get the canonical **main-clone** path (the `.local.yml` mapping points at main clones, never transient worktrees), and write to the wrong working tree — see the MULTI-REPO-3 error log, **Error 1** (a coder wrote its task output to the main clone on `main` instead of the project worktree).

`/rad-repo` is therefore **removed from every agent except the `planner`** — `coder{,-junior,-senior}`, `reviewer`, `source-control`, `orchestrator`, and `brainstormer` — pulled from both their `.md` **Skills** sections and their `.{claude,copilot-cli,copilot-vscode}.yml` `skills:` lists. (The skill stays **user-invocable**; only the agents are de-armed.)

The `planner` **retains** `/rad-repo`: as a spawned subagent it has no ambient registry awareness (see **Ambient awareness**) yet still needs registry *identity* to author the `repos:` set. Its proper replacement — a worktree-aware `## Project Repos Available` spawn block that carries each repo's resolved (convention-derived) path into the planner prompt, mirroring `repository_skills_block` — is **deferred** to a later iteration.

### `/rad-brainstorm`

- Surfaces repo context adaptively during the conversation.
- Confirms working repo set before writing.
- New `## Repo Targets (proposed)` section in the BRAINSTORMING.md template; no doc ships without it.
- Detail: see **Project ↔ Repo Binding** above.

### `/rad-create-plans` (requirements + master-plan workflows)

- Requirements frontmatter gains optional `repos:` (non-authoritative restate).
- Master Plan frontmatter gains `repos:` (sealed, authoritative) and optional `repo-group:` provenance.
- Master Plan body authoring rules: every task carries `**Target repos:**` plus per-repo `**Files for <repo>:**` subsections. Uniform shape — no special casing.

### `/rad-execute`

- Calls `radorch source-control init --project X` directly during pipeline initialization (instead of gathering field values + signaling a state-setter event). CLI does the work, writes state directly, returns result envelope.
- `auto_commit` / `auto_pr` prompting unchanged (still gathered here, still top-level / project-scoped).

### `/rad-execute-coding-task`

- Coder agent reads `repos:` from the task handoff frontmatter to know which repo(s) it's touching.
- Reads handoff body's `**Files for <repo>:**` subsections; joins relative paths with the matching `repos[N].path` from the spawn-prompt context.
- Runs each repo's commands (`npm test`, build, etc.) from that repo's worktree path, not the project root.

### `/rad-code-review` (task / phase / final modes)

- Reviewer iterates the spawn-prompt's `repos` array, runs `git diff` in each repo's worktree per the per-repo SHA fields (`head_sha` for task review; `first_sha` + `head_sha` for phase; `base_sha` + `head_sha` for final).
- Writes ONE combined review doc per scope; findings imply repo via `File:Line` references (the engine handed the reviewer absolute paths via `repos[N].path`).
- Final review: a requirement is `met` only when satisfied wherever owed across all repos — exact mechanic deferred.

### `/rad-source-control`

- Commit mode: agent reads the spawn-prompt's `repos` array, crafts per-repo commit messages in one LLM pass, returns an array of `{ name, message }`. CLI iterates per repo.
- PR mode: agent crafts per-repo PR descriptions in one LLM pass, returns an array of `{ name, description }`. CLI iterates per repo, then runs the two-pass linked-PR creation.

### `/rad-execute-parallel`

- Already creates a single-repo worktree for parallel execution. Will need extension for multi-repo projects — creating N worktrees (one per registered repo in the project) at the parallel branch. Specifics deferred.

### Orchestrator agent (`harness-files/agents/orchestrator.md`)

- Spawn-manifest loading unchanged in structure — `repository_skills_block` continues to flow as today.
- Multi-repo enrichment fields land in `data.context` as the `repos` array; orchestrator inlines them into spawn prompts per the catalog `.md` body instructions. No new routing logic — the orchestrator stays mechanical.

---

## Iteration Sequence

This design is too large to ship as one project. Practical delivery order, super high level — each iteration is a discrete future brainstorming + planning project. Each builds on the prior; ordering is forced by dependency.

1. **Registry foundation** — `repo-registry.yml` + `.local.yml` files, `cli/src/lib/repo-registry/` lib module, `radorch repo` / `radorch repo-group` CLI subcommands (including `bind`), minimal `/rad-repo` skill, session-start hook for ambient awareness. Ships standalone — no project integration yet. Unlocks everything else.

   **Bridge — UI registry management.** Iteration 1 built `lib/repo-registry` as UI-*ready* source but explicitly deferred the build/packaging wiring and any UI consumer ("the library is designed to be UI-consumable; wiring the UI onto it — and any workspace/Next.js build setup — is future work"). Two small, focused follow-on projects discharge that deferred work, in order. They branch off iteration 1 and are **independent of the planning/execution backbone (iterations 2–5)**, which continues unchanged:

   - **MULTI-REPO-1-LIB** — establish **npm workspaces** at the repo root and give `lib/repo-registry` a real build (compiled `dist/` ESM + `.d.ts`), so it is consumed **by name** (`@rad-orchestration/repo-registry`) by both the UI and the CLI — unifying the CLI off its current `tsconfig`-include-of-source coupling — with the library build sequenced ahead of the UI/CLI bundles. A **foundational** monorepo-plumbing project (workspaces + build + the CI / release / install-test / AGENTS.md ripple), done the canonical way rather than via a one-off `file:` dependency.
   - **MULTI-REPO-1-UI** — a new **Repositories** view in the radorch dashboard (header nav, between Projects and Process Editor) giving a human operator a **token-free**, no-agent, no-CLI surface for the full registry operation set (repos + repo-groups), with client-side validation. Consumes MULTI-REPO-1-LIB's package **in-process** via API routes. Depends on MULTI-REPO-1-LIB.

2. **Multi-repo planning artifacts — authoring only** (project `MULTI-REPO-2`). `/rad-brainstorm` gains a mandatory `## Repo Targets` section. `/rad-create-plans` gains **planner-authored** `repos:` frontmatter on Requirements (non-authoritative restate) + Master Plan (sealed) plus optional `repo-group:` provenance, per-task `**Target repos:**` + per-repo `**Files for <repo>:**` (replacing flat `**Files:**`, uniform even for single-repo), and a per-phase `**Target repos:**` union line mirroring the existing `**Requirements:**` convention. `/rad-plan-audit` gets a **minimal** update only — flip its `**Files:**`-mandatory rule to recognize the new shape so it stops mis-flagging multi-repo plans; **no** subset/union/registry validation here (that hard-gates in iteration 3). Scope is bounded by the **author boundary**: everything stamped `author: "planner-agent"` is in; nothing the explosion script stamps is touched. Users can *author* fully multi-repo-shaped plans; the new fields are **inert** (no runtime consumes them yet), so single-repo execution is unaffected. **No `explode-master-plan.ts` change, no state-shape change, no v6 bump.**

3. **Explosion + state v6** (project `MULTI-REPO-3`). `cli/src/lib/explode-master-plan.ts` gains the **strict** `extractTargetRepos` parse (throws `ParseError` on a missing `**Target repos:**`), derives the exploded phase/task frontmatter `repos:` (phase = union of its tasks), and seeds `TaskIterationEntry.repos`; the state schema bumps `v5 → v6`. This is where the authored multi-repo shape first becomes **machine-enforced** and runtime-visible, and the home for the real subset/union/registry validation `/rad-plan-audit` deferred in iteration 2. After this, an authored multi-repo plan explodes into per-repo handoffs + per-repo state. Because the v6 shape lands here, iteration 3 also carries a **minimal engine shim** — the commit-write mutation and review-SHA enrichment move onto the `repos[]` array but handle only the single-repo case (`repos[0]`), and corrective-task entries collapse alongside task entries; rich multi-repo enrichment (and removal of this shim) is iteration 5.

   **Follow-up — `MULTI-REPO-3-SIDE-PROJECTS` (typed `project-type` + local-only side-projects).** Surfaced during iteration 3: a self-contained project that touches *no registered repo* (a trial `MULTI-REPO-3-TEST` run) had no graceful way to declare itself, so the planner fabricated the project name as a repo and `/rad-plan-audit` flagged it (§2.5/§2.6). Decision: introduce a typed **`project-type`** frontmatter field — an enum applied to *every* project, with `standard` the default kind (absent ⇒ `standard`, so existing projects need no migration) and `side-project` the first specialized value (extensible to future kinds, e.g. `follow-up`). A **side-project** is an **auto-provisioned, local-only git repo** at `~/.radorc/side-projects/<project>/` — a **third convention-resolved location-kind** beside registered repos (`.local.yml` lookup) and worktrees, **unregistered by design** (the registry is the team's shared, versioned map; side-projects are personal). `repos:` carries the project's own name — a *real* local repo, so the original "fabrication" becomes correct — with `repo-group: null`, mutually exclusive with registered repos; the project's planning docs + state still live under `~/.radorc/projects/<project>/` like any project (only the code repo lives under `side-projects/`, so the dashboard discovers it for free). Execution rides the **ordinary single-repo path** with kind-gated overrides: a new **`radorch side-project init`** command (mirroring `worktree create`) runs `git init` + a seed commit at the convention path and feeds `worktree_path` into `source-control init`; `auto_commit: always`, `auto_pr: never`; and `radorch git commit` **auto-skips the push when there is no `origin` remote** (a clean `pushed:false`, distinct from `push_failed`). Touch-points: the launch skills (`rad-plan` Step 6, `rad-approve-plan`, `rad-execute` Step 3, `rad-execute-parallel`) gate their git-strategy prompts on `project-type`, read via `radorch project context` (extended to surface the field — never the master-plan body); the planner (`rad-create-plans`) stamps the kind on every plan and seals a side-project's `repos: [<name>]` / `repo-group: null` without a registry lookup; the auditor skips registry-membership for a side-project's own repo; `project_type` is an **additive optional** field on `state.project` in the v6 schema (non-breaking, no migration), seeded during explosion; `side-projects/` is **sacred + gitignored** (nested repos); `/rad-brainstorm` and `/rad-repo` gain side-project awareness and `rad-source-control` notes the clean local-only commit; the dashboard adds a "Local · side-project" badge; and the new command ships with `--help` at all depths plus a help-shape regression-test block. Additive overall — normal multi-repo plans are untouched. Branches off iteration 3.

4. **Worktree + source-control init** — `radorch worktree` CLI, `worktree_name` field, managed-worktree lifecycle, `radorch source-control init` reframed as a real CLI doing the work + state mutation directly. After this, multi-repo projects can be initialized end-to-end on disk.

5. **Pipeline + coder + reviewer** — `context-enrichment.ts` produces per-action `repos` arrays, catalog `.md` bodies updated, coder consumes per-repo `**Files for <repo>:**` + `repos[N].path`, reviewer iterates per-repo SHAs per scope (task / phase / final), **removing the iteration-3 engine shim** (single-repo `repos[0]` handling becomes fully per-repo). End-to-end execution works minus commit/PR fan-out.

6. **Source-control fan-out** — per-repo commit messages (conventional commits, LLM-crafted), `radorch git commit` per-repo iteration, per-repo PR descriptions, `radorch git pr` two-pass linked-PR creation. Closes the **execution** loop to full multi-repo end-to-end.

7. **Multi-repo dashboard** — the radorch dashboard renders per-repo state across the projects timeline: per-repo commit hashes on task cards, the per-repo source-control section (branch / compare / PR URL per repo), and the combined multi-repo review + linked-PR surfaces. Lands **immediately after iteration 6**, once all the per-repo data exists to display (task commits from iteration 3's v6 state, source-control from iteration 4, fan-out PRs from iteration 6). This iteration also **removes the temporary minimal-rendering shim** introduced in iteration 3 — the lossy multi-repo task-commit display added there solely to keep the dashboard from breaking on v6 state (single-repo rendered correctly; multi-repo rendered minimally). Until iteration 7 lands, the dashboard is *honest but not rich* for multi-repo projects.

Topics in **Future Iterations** below are not assigned to specific iterations — they're open questions that fall *outside* this design entirely, to be picked up when needed.

---

## Other Considerations or Future Iterations

The following topics were intentionally not revisited in this brainstorming pass and should be considered for each iteration as appropriate or saved for a future follow-up project. Some are multi-repo specific, some are general improvements that apply regardless of repo count.

| Topic | What's needed |
|---|---|
| `/rad-repo` skill scope | Detailed skill instructions: registry CRUD, repo-group mgmt, worktree assist, bind flows |
| CLI subcommand surface | `radorch repo` / `repo-group` / `worktree` subcommand design; underlies the skill |
| Migration policy | v5 → v6 migration tooling, or v6 is new-projects-only and v5 finishes on v5 engine |
| `met / missing` final-review cross-repo | A requirement is `met` only when satisfied wherever owed — requires deciding how requirements get tagged with owed repos |
| Multi-repo skill discovery | Today's `## Repository Skills Available` block is single-repo by construction; need a multi-repo equivalent (union catalog vs. per-repo grouping) |
| Project-repos discovery script | Parallel to skill-discovery: orchestrator surfaces a `## Project Repos Available` block to the planner |
| `gh` auth scope per-host | Multi-repo doesn't account for repos targeting different GitHub hosts (github.com vs. enterprise) |
| `prompt-tests/` rework | Operator-committed baselines may need re-baselining once multi-repo state shapes flow through |
| Per-repo commit message + PR description templates | The exact spawn-prompt structure for the source-control agent's narrative work |
| Branch-naming convention | Exact pattern (e.g., `radorch/<PROJECT-SLUG>`) and per-project override mechanism |
| Worktree-removal CLI command | Specifics of `radorch worktree remove <project>` and its skill-side flow |
| Worktree custom-location override | Optional override for users who want worktrees outside `~/.radorc/worktrees/` |
| Failure-recovery details for PR pass-2 | Whether pass-2 idempotence detection uses placeholder-grep (cheap) or per-PR state tracking (robust) |
| `preferences.yml` / `preferences.local.yml` | Dropped from this design; will be addressed when `orchestration.yml` is split into team-portable + per-developer (separate concern from multi-repo) |
| **Registry-vs-worktree path resolution (hit live in MULTI-REPO-3)** | Until enrichment carries `repos[].path` (iters 4–5), an agent that resolves a target repo *by name* via the registry lands in the **canonical main clone**, not the project worktree — wrong branch, silent divergence. See the callout in **Pipeline Data Flow → Path resolution** and `MULTI-REPO-3-ERROR-LOG.md` Error 1. Ensure iter 4/5 closes this with `repos[].path` in every spawn prompt, and add a guardrail beyond prose (bind repo→worktree for the run, or fail-loud on writes outside the worktree). |

---

## Status

This direction is captured for the moment multi-repo work is picked up. Treat the locks above as direction, not finished specification — implementation will surface decisions this design intentionally leaves open. The **Future Iterations** table lists those open topics for the team to scope when ready.
