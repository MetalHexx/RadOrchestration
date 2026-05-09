# Global Install Refactor — Program Plan

**Status:** Brainstorming complete through Wave 7 (UI registry-aware). Wave 8+ open. Per-wave lock-ins are captured in this doc; no separate per-wave BRAINSTORMING.md files.
**Audience:** Maintainers planning the refactor.
**Scope:** Multi-wave program — moves rad-orchestration from per-repository installs to a single global install that drives multiple repos and "workspaces" of related repos. Replaces the smattering of skill-bound scripts with a unified `radorch` CLI.

This is a program-level plan. Per-wave BRAINSTORMING.md / planning documents will be spawned from this doc as each wave begins.

---

## Executive summary

The refactor moves rad-orchestration from per-repository installs (one orchestration system per repo, in `<repo>/.claude/` or `<repo>/.github/`) to a single global install at `~/.radorch/` driving multiple repos and named workspaces. Five intertwined shifts:

1. **Per-repo → global**: a single `~/.radorch/` install (overridable via `RADORCH_HOME`) holds the runtime, registry, projects, and worktrees; projects are decoupled from any repo and live at `~/.radorch/projects/<NAME>/`.
2. **Single-repo → multi-repo**: tasks declare their target repos explicitly via a plural `repos: string[]` handoff field; the same project can drive coordinated work across frontend / backend / infra repos grouped as a workspace.
3. **Scattered skill-bound scripts → unified `radorch` CLI**: today's `installer/` package and the per-skill scripts (`gather-context.js`, `git-commit.js`, `gh-pr.js`, `find-projects.js`, `create-worktree.js`, …) collapse into one TypeScript CLI shipped as `npm install -g radorch`.
4. **Agent-driven → skill-driven orchestration**: the `orchestrator` agent retires; the user's harness LLM running `/rad-execute` IS the orchestrator. Skills carry orchestration responsibility directly.
5. **Legacy `default` / `quick` templates → four tiered review-intensity templates** (`extra-high` / `high` / `medium` / `low`).

Worktree paths, registry paths, and other absolute paths derive from `RADORCH_HOME`-relative conventions, keeping versioned state portable across machines. The CLI and UI ship as one npm package (`radorch`), with the UI bundled via Next.js standalone output for atomic versioning.

---

## Pending waves (pick-up summary)

Wave 1 is closed. Remaining work, in dependency order — see §6 for full detail, §7 for Wave 1 constraints, §9 for parked open questions.

- **Wave 2 — `radorch` CLI scaffolding.** *(Brainstorming complete — see §7.5 for lock-ins.)* Greenfield in `cli/` folder. commander.js + typed wrapper. Vitest, ESLint+Prettier, pre-commit (typecheck+lint). First commands: `install`, `doctor`, `harness use`, `repo add`, `workspace create`. Coexists with old scripts until cutover. Can run in parallel with Wave 3. Ready for implementation.
- **Wave 3 — State schema v6.** *(Brainstorming complete — see §7.6 for lock-ins.)* `pipeline.source_control` becomes a map keyed by repo name. Worktree path derived, not stored. `IterationEntry` splits into `PhaseIterationEntry` (no repo) and `TaskIterationEntry` (required `repos: string[]`). Tasks primarily single-repo; multi-repo permitted for tightly-coupled work. `state.project.target` discriminated by kind. Per-task `commit_hashes: { [repo]: hash }` map. Working-directory propagation as `{ [repo]: path }` map. Explicit `radorch migrate` command. Source-control init per-repo, with CLI wrapper. Can run in parallel with Wave 2.
- **Wave 4 — Task handoff contract change.** *(Brainstorming complete — see §7.7 for lock-ins.)* Handoff carries `repos: string[]` (always array, plural). Master plan gains per-task `**Target repos:**` plural field with `**Files for <repo>:**` per-repo subsections (always, regardless of repo count). Explosion script extracts and propagates. Project-repos discovery mirrors the skills-discovery pattern. Task-scope correctives inherit `repos` from parent; phase-scope correctives can be multi-repo. Task code reviewer iterates per-repo via diff plan. Blocks on Wave 3.
- **Wave 5 — Skill migration to `radorch`.** *(Brainstorming complete — see §7.8 for lock-ins.)* `/rad-execute-parallel` and `/rad-execute` collapse into one `/rad-execute` skill. New `/rad-cleanup` and `/rad-archive` skills. `/rad-brainstorm` gains registry awareness; `/rad-plan` binds target via AskUserQuestion. Bottom-up migration in tiers (primitives → leaf commands → orchestration commands → skills). Per-test isolation, local-only git, mocked `gh`. Blocks on Wave 2.
- **Wave 6 — DAG template change + tiered template set.** *(Brainstorming complete — see §7.9 for lock-ins.)* Replaces `default`/`quick` with four tiered templates (`extra-high` / `high` / `medium` / `low`) — tiers vary by review intensity. Multi-repo commit and PR fan-out happens inside CLI commands (`radorch git commit` / `radorch git pr` iterate per repo internally) — no DAG-level iteration, single agent spawn per task/project. Mid-flight workspace expansion halts with a clear actionable message. v6 migration auto-rewrites template_id references. Blocks on Wave 3 + Wave 4.
- **Wave 7 — UI registry-aware.** *(Brainstorming complete — see §7.10 for lock-ins.)* Watches `~/.radorch/projects/` via `RADORCH_HOME`; drops `WORKSPACE_ROOT` / `ORCH_ROOT`. Per-invocation run model with port-collision handling and `radorch dashboard start/stop` CLI + matching skills. Active/Archived tabs (chokidar excludes `_archive/`). Read-only data; Archive and Cleanup buttons on DAG view with confirmation modals. Per-repo display in project detail.
- **Wave 8 — Migration story + publish/release pipeline.** v5 → v6 state migration (`migrate-to-v6.ts`). Per-repo install → global install upgrade path. Publish workflow restructure (`installer/` → `cli/`). Release version-bump file list updated. UI ships as Next.js standalone bundled inside `radorch` (single npm package; atomic versioning); copied at `radorch install` time to `~/.radorch/runtime/ui/`.
- **Wave 9 (deferred) — Pipeline fold-in into `radorch`.** Out of scope for this program; anticipated as a separate future effort with a rewrite, possibly accompanied by a v7 schema.

---

## 1. Motivation

### Today's friction

- **Per-repository install is confusing.** The installer writes assets into `<repo>/.claude/` or `<repo>/.github/`, which couples the orchestration system to a single repo. Users with multi-repo applications (frontend / backend / infra) can't drive coordinated work from one install.
- **Three concerns are conflated in `projects.base_path`.** Today this single config field overloads (a) where planning docs and `state.json` live, (b) the implicit target repo (via `git rev-parse --show-toplevel` in `gather-context.js`), and (c) what the UI watches. Splitting these is the central refactor.
- **The Coder has no explicit target repo.** Nothing in the task handoff, `state.json`, or spawn prompt tells the Coder which repo to edit. It works only because today's install *is* in the repo being edited and the Coder inherits cwd from the orchestrator. Multi-repo will expose this immediately.
- **`gather-context.js` is duplicated** in `rad-execute` and `rad-execute-parallel`, both deriving repo root from cwd's git toplevel via a hand-rolled flat-only YAML parser.
- **`pipeline.source_control` in v5 state is structurally single-repo.** The schema requires exactly one `branch`, one `worktree_path`, one `remote_url`, one `pr_url` per project. Multi-repo requires a v6 schema migration.
- **Scripts are scattered across skills.** Source control, context-gathering, project-finding, worktree-creation, theme injection, terminal launching, skills listing, installer logic — each lives in a different folder, each reinvents argument parsing and JSON output conventions, each is independently tested and versioned.

### What we want

- One global install at `~/.radorch/` (overridable via `RADORCH_HOME`).
- Projects decoupled from any repo — they live at `~/.radorch/projects/<NAME>/`.
- Repos as first-class registry entries; workspaces as named groupings of repos.
- Task handoffs that explicitly name the target repo; multi-repo execution with deterministic routing.
- A single `radorch` CLI that absorbs the scattered skill scripts and the installer, with clean code hygiene and easy extensibility.
- The pipeline runtime (`pipeline.js`) stays where it is for this program. A future fold-in into `radorch` is anticipated but deferred.

---

## 2. Goals & non-goals

### Goals

1. One install per machine; many repos and workspaces driven from that install.
2. Decouple project storage from repo location.
3. Make "which repo is this task editing?" explicit and contractual (carried in the handoff).
4. Replace the per-skill scripts with a unified CLI.
5. Preserve the skill-driven flow for pipeline work (planning, execution, review). Skills get *thinner*, not removed.
6. Provide a clean migration path from per-repo installs.

### Design principles

- **Keep things simple for the agent; lean on the CLI for mechanical, deterministic work.** Skills and agents drive single, idempotent, high-level commands. The CLI handles loops, retries, error recovery, and other deterministic logic. This principle shapes nearly every Wave 3+ decision — the per-repo `source_control_init` event with a CLI wrapper that loops, the consolidation of skill-bound scripts into `radorch` (Wave 5), and the eventual direction of `radorch` toward returning prompts and directives for agents to act on (Wave 9).
- **Skills, agents, and markdown are OS-agnostic and harness-agnostic.** Content must not assume a specific shell (bash vs. PowerShell) or harness (Claude Code vs. Copilot CLI vs. Copilot VS Code). Use direct CLI invocations that work uniformly across shells (e.g., `radorch repo list` — same syntax everywhere). Avoid shell-specific pipes, redirections, or operators. Don't reference harness-specific tool names (Read, Edit, etc.) in instruction body — adapters handle harness translation; skill content stays portable.
- **Use AskQuestions / AskUserQuestion for structured user interactions.** When a skill needs the user to choose among defined options or supply specific values for a decision point, it uses the structured AskQuestions / AskUserQuestion tool — not free-form conversational asking. Applies especially to /rad-plan and /rad-execute where structured choices (target, execution_mode, gate mode, branch base, etc.) are made. Free-form conversational asking is fine for open-ended exploration; structured commitments use the tool.

### Non-goals (this program)

- Folding `pipeline.js` into the CLI. Stays separate; future fold-in is its own program.
- Adding new pipeline features beyond what multi-repo demands.
- Supporting source control providers other than GitHub. (`source_control.provider` was reserved-only and is being dropped.)
- A configurable project naming convention. Project names are SCREAMING-CASE, hardcoded.

---

## 3. Conceptual model

### Vocabulary

| Term | Definition |
|---|---|
| **Install** | One per machine, rooted at `~/.radorch/` (or `$RADORCH_HOME`). Holds the runtime, config, registry, projects, and worktrees. |
| **Repo** | A first-class registry entry. Has a name, local path, default branch, and remote URL. The single source of truth for repo identity. |
| **Workspace** | A named, optional grouping of repos (e.g., `my-app-stack` = `[frontend, backend, infra]`). No defaults block, no primary. Exists only for project targeting, UI grouping, and validation. |
| **Project** | A unit of orchestration work. Lives at `~/.radorch/projects/<NAME>/` regardless of which repo(s) it touches. Targets either a single repo or a workspace. |
| **Worktree** | A git worktree of a registered repo, created transiently for one project's lifetime at `~/.radorch/worktrees/<PROJECT>/<REPO>/`. |
| **Task** | A unit of code change inside a project, executed by the Coder agent from a self-contained handoff. Names the target repo explicitly. |
| **Harness** | The AI coding tool the user runs (Claude Code, Copilot VS Code, Copilot CLI). All three are installed by default. Each developer's active harness is a per-machine preference that can be switched on the fly via `radorch harness use <name>` — no reinstall. |

### Decoupling diagram (conceptual)

```
~/.radorch/                       global install root
  config.yml                      user-editable preferences
  install.json                    installer-managed metadata
  registry.yml                    repos + workspaces
  projects/<NAME>/                project docs + state.json (no repo coupling)
  worktrees/<PROJECT>/<REPO>/     transient worktrees
  templates/                      DAG templates (Wave 2 detail)
  runtime/                        node_modules + compiled assets
```

A project at `~/.radorch/projects/BUILD-FOO/` targets `workspace: my-app-stack`. Its tasks specify `repos: ["backend"]` (always a plural array of registry keys; multi-repo tasks carry more than one). The Coder gets the worktree path resolved from `~/.radorch/worktrees/BUILD-FOO/backend/`. The source-control agent commits/PRs against that worktree's git remote.

---

## 4. Disk layout

```
~/.radorch/
  install.json           # installer-managed; VERSIONED so the team moves together on package_version
  config.yml             # per-developer preferences AND per-machine path bindings (repos, workspaces); gitignored
  registry.yml           # VERSIONED — abstract identity only (names, remotes, branches, workspace membership)
  .harness         # per-machine: name of developer's active harness; gitignored

  projects/
    BUILD-FOO/
      state.json         # VERSIONED — enables resuming a project from another machine or future cloud execution
      BRAINSTORMING.md   # VERSIONED — planning docs are team artifacts
      REQUIREMENTS.md
      MASTER_PLAN.md
      phases/
      tasks/
      reports/
      reviews/

  worktrees/             # transient; gitignored
    BUILD-FOO/
      frontend/
      backend/

  templates/             # DAG templates; system templates ship here, user overlays allowed (Wave 2)
  runtime/
    harnesses/
      claude/            # all three harness bundles installed by default
      copilot-vscode/
      copilot-cli/
    node_modules/        # gitignored
```

**Git-friendliness.** `~/.radorch/` ships with an opinionated default `.gitignore` that codifies our team-coordination stance:

- **Versioned** (team moves together): `install.json`, `registry.yml` (with portable path substitution), `projects/<NAME>/state.json`, `projects/<NAME>/{*.md, phases/, tasks/, reports/, reviews/}`.
- **Gitignored** (per-developer or transient): `config.yml`, `.harness`, `worktrees/`, `runtime/`.

`state.json` is intentionally versioned. Combined with the planning docs, this means a project can be cloned to another machine (or a future cloud-execution environment) and resumed from where it left off. `registry.yml` carries only abstract identity (names, remotes, branches, workspace membership) — no filesystem paths, so it survives cross-machine sharing without any substitution syntax. Per-machine path bindings (where each registered repo lives locally, where each workspace's parent folder is) live in `config.yml`, which is gitignored. The two files merge at read time: registry provides identity, config provides paths. Worktree paths are derived from `${RADORCH_HOME}/worktrees/<PROJECT>/<REPO>/` at read time (Wave 3 lock-in), so no absolute paths get stored in versioned `state.json` either.

---

## 5. `radorch` CLI architecture (high-level)

`radorch` becomes the unified CLI for setup, registry management, and the leaf operations that skills currently shell out to. Built in TypeScript, compiled to JS via `tsc` for both dev and ship — pure JS at runtime, no tsx in this package. Distributed via `npm install -g radorch` (already on npm). Replaces the current `installer/` package and absorbs the skill-bound scripts.

### Proposed package layout

```
cli/                              repo folder; npm package name is "radorch"
  src/
    main.ts                       entry point (invoked by bin/radorch)
    framework/
      argv-bridge.ts               typed CommandDef wrapper around commander.action
      command.ts                  CommandDef interface, register helpers
      output.ts                   envelope wrapping, emit, exit-code mapping
      errors.ts                   typed error hierarchy (UserError, SystemError, ...)
    commands/
      install/, update/, uninstall/, doctor/, version/
      repo/{add,list,remove}.ts
      workspace/{create,list,add,remove}.ts
      harness/{list,use,launch,scan}.ts
      context.ts                  ← consolidates gather-context.js (Wave 5)
      project/{find,list,create}.ts
      worktree/{create,inject-theme,remove}.ts
      git/{commit,pr}.ts          ← consolidates git-commit.js, gh-pr.js (Wave 5)
      skills/list.ts              ← consolidates list-repo-skills.mjs (Wave 5)
      validate.ts
    lib/
      paths.ts                    ~/.radorch/ resolution; RADORCH_HOME
      registry.ts                 registry.yml read/write
      config.ts                   config.yml + install.json
      yaml.ts                     js-yaml wrapper (no hand-rolled parsers)
      git.ts                      shared git exec helpers
    types/
  tests/                          vitest, mirrors src/ structure
  bin/radorch                     shim that runs main.ts
  package.json                    name: "radorch"
```

### Scripts that disappear

| Today's location | Replaced by |
|---|---|
| `installer/` package | `radorch install`, `radorch update`, `radorch uninstall`, `radorch doctor` |
| `installer/lib/cross-harness-scan.js` | `radorch harness scan` |
| `skills/rad-execute/scripts/gather-context.js` | `radorch context` |
| `skills/rad-execute-parallel/scripts/gather-context.js` (duplicate) | (same) |
| `skills/rad-source-control/scripts/git-commit.js` | `radorch git commit` |
| `skills/rad-source-control/scripts/gh-pr.js` | `radorch git pr` |
| `skills/rad-execute-parallel/scripts/find-projects.js` | `radorch project find` |
| `skills/rad-execute-parallel/scripts/create-worktree.js` | `radorch worktree create` |
| `skills/rad-execute-parallel/scripts/inject-theme.js` | `radorch worktree inject-theme` |
| `skills/rad-execute-parallel/scripts/launch-claude.js` | `radorch harness launch` |
| `skills/rad-orchestration/scripts/list-repo-skills.mjs` | `radorch skills list` |

### Scripts that stay

- `skills/rad-orchestration/scripts/pipeline.js` — the engine entry point. Untouched in this program. Future fold-in is anticipated as a separate effort once `radorch` is mature and stable.
- `skills/rad-orchestration/scripts/main.ts` and `lib/` — engine internals. Stay with pipeline.
- `skills/rad-orchestration/scripts/explode-master-plan.ts` — explosion script. Stays with pipeline (it's tightly coupled to the engine).
- `skills/rad-orchestration/scripts/migrate-to-v5.ts`, `fix-ghost-v5.ts` — migration CLIs. Stay; a `migrate-to-v6.ts` will join them.

### Skills become thinner

Skill markdown that today describes `node <skill-path>/scripts/X.js --flag value` invocations becomes `radorch <subcommand> --flag value`. The argument parsing, JSON output contract, and error handling move into the CLI's shared lib. The source-control skill's commit-message-prefix lookup table (today duplicated between an LLM agent and a script) moves into the CLI.

---

## 6. Wave structure

The program decomposes into the following waves. Waves are ordered by dependency, not strictly chronologically — some can run in parallel.

### Wave 1 — Vocabulary, disk layout, CLI architecture *(this brainstorm)*

Captured below in §7. Closes here.

### Wave 2 — `radorch` CLI scaffolding *(brainstorming complete — see §7.5)*

Stand up the `radorch` package skeleton in `cli/`. Implement framework wrapper, shared lib (`paths`, `registry`, `config`, `yaml`, `output`, `errors`). Land first proof-of-concept commands: `install`, `doctor`, `harness use`, `repo add`, `workspace create`. No skill rewires yet — coexists with old scripts.

Architectural decisions captured in §7.5. Templates-discovery model is parked until Wave 2 implementation surfaces a concrete need (likely deferred further).

### Wave 3 — State schema v6 *(brainstorming complete — see §7.6)*

Bump state schema to v6. Headline shape changes: `pipeline.source_control` becomes a per-repo map; `IterationEntry` splits into phase and task variants (task variant carries `repos: string[]` and `commit_hashes: { [repo]: hash }`); `state.project.target` declares the project's repo or workspace; worktree paths derived rather than stored; working_directories propagated as a `{ [repo]: path }` map. Tasks are primarily single-repo with multi-repo permitted for tightly-coupled work. Migration via explicit `radorch migrate` command. Can run in parallel with Wave 2.

Architectural decisions captured in §7.6.

### Wave 4 — Task handoff contract change *(brainstorming complete — see §7.7)*

Add `repos: string[]` (always array) to task handoff frontmatter. Working directories propagated as `{ [repo]: path }` map via spawn prompt (Wave 3 §7.6). Master plan gains per-task `**Target repos:**` plural field; file targets grouped per-repo via `**Files for <repo>:**` subsections (always). Explosion script extracts and emits `repos:` array. Project-repos discovery feeds the planner the same way `list-repo-skills.mjs` feeds the skills catalog. Multi-repo task support absorbs the "phase-scope finding spans repos" edge case naturally. Architectural decisions captured in §7.7.

Blocks on Wave 3.

### Wave 5 — Skill migration to `radorch` CLI *(brainstorming complete — see §7.8)*

Phased rewire of skills to call `radorch` subcommands instead of skill-bound scripts, plus structural skill changes for v6 multi-repo. `/rad-execute-parallel` and `/rad-execute` collapse into one `/rad-execute` skill. New `/rad-cleanup` and `/rad-archive` skills. `/rad-brainstorm` and `/rad-plan` get registry/target-binding updates. Bottom-up migration in five tiers: primitives → context → leaf commands → orchestration commands → skill rewrites. Old scripts retire as their last consumer moves over.

Architectural decisions captured in §7.8.

Blocks on Wave 2 (CLI must exist).

### Wave 6 — DAG template + tiered template set *(brainstorming complete — see §7.9)*

Replaces `default.yml` / `quick.yml` with four tiered templates (`extra-high` / `high` / `medium` / `low`) reflecting review intensity. Multi-repo commit and PR fan-out lives inside the CLI (`radorch git commit` / `radorch git pr` iterate per repo internally) — no DAG-level iteration, single agent spawn per task/project. Mid-flight workspace expansion is detected and halts the pipeline with a clear actionable message rather than auto-expanding. v1 templates retire with the v6 migration (auto-rewrite template_id).

Architectural decisions captured in §7.9.

Blocks on Wave 3 + Wave 4.

### Wave 7 — UI registry-aware *(brainstorming complete — see §7.10)*

Refactor `ui/` to read from `~/.radorch/` via `RADORCH_HOME`. Per-invocation run model with port-collision handling (`radorch dashboard start [--port]` and `radorch dashboard stop`, plus matching skills). Active vs. Archived tabs in the project list; chokidar explicitly excludes `_archive/`. Read-only data with Archive and Cleanup buttons on the DAG view (CLI-invoking via confirmation modals). Per-repo display in project detail pulls from `pipeline.source_control.by_repo`.

Architectural decisions captured in §7.10.

### Wave 8 — Migration story + publish/release pipeline

Four distinct concerns:
1. **v5 → v6 state.** Authored in `migrate-to-v6.ts`. Run via explicit `radorch migrate` command (per Wave 3 §7.6 — no auto-migrate on read).
2. **Per-repo install → global install.** Wizard-driven. `radorch install` detects existing `<repo>/.claude/` or `<repo>/.github/` installs, offers to import their projects into `~/.radorch/projects/`, and registers the host repo automatically. Old install dirs left alone (don't delete user files); user uninstalls via existing harness mechanisms when ready.
3. **Publish workflow restructure.**
   - `.github/workflows/publish.yml`'s `working-directory` changes from `installer/` to `cli/`. The published `radorch` npm package source is `cli/dist/`.
   - `sync-source.js` (or its successor) evolves: still runs at pre-pack time to copy canonical `agents/` + `skills/` into per-harness bundles, but bundles emit under `cli/dist/runtime/harnesses/<harness>/` (the global-install layout) rather than `installer/src/<harness>/`.
   - All version-bump files updated in lockstep at release time: `cli/package.json` (replaces `installer/package.json`) + `ui/package.json` + `skills/rad-orchestration/scripts/package.json`. `install.json`'s `package_version` is auto-stamped at build time from `cli/package.json`.
   - `rad-release.prompt.md` and `rad-test-release.prompt.md` updated for the new file list (Wave 5 §7.8).
4. **UI publishing — Next.js standalone bundled inside `radorch` (single package).**
   - **Strategy**: Next.js `output: 'standalone'` config produces a self-contained build (~20-50MB; only the dependencies actually used). Bundled into `cli/dist/runtime/ui/` at pre-pack time. One npm package (`radorch`); atomic versioning across CLI + UI.
   - **At install time**: `radorch install` copies `<global-node_modules>/radorch/dist/runtime/ui/` to `~/.radorch/runtime/ui/`. Same copy pattern as harness bundles. Works regardless of Node.js install location; no symlinks (Windows symlink fragility avoided).
   - **At runtime**: `radorch dashboard start` runs the standalone server entry from `~/.radorch/runtime/ui/` (`node server.js` with `RADORCH_HOME` env passed through). Compiled JS only — no tsx at runtime, matching the Wave 2 lock-in for the CLI.
   - **Dev workflow unchanged**: contributors continue running `cd ui && npm run dev` for hot-reload during local UI development. Standalone build is for shipping only; dev mode is regular `next dev`.
   - **`ui/` `next.config.js` adds `output: 'standalone'`**; `package.json` build script produces the standalone bundle; `cli/scripts/sync-source.js` (or its evolved equivalent) copies it into `cli/dist/runtime/ui/` pre-publish.

### Wave 9 (deferred) — Pipeline fold-in

Anticipated, not scoped here. `pipeline.js` and the engine in `skills/rad-orchestration/scripts/lib/` eventually fold into `radorch` as `radorch pipeline <event>`, with the engine internals becoming `src/lib/engine/`. Likely accompanied by a v7 state schema or further state cleanups discovered during the rewrite. Deferred to maintain stability while the rest of the program lands.

---

## 7. Wave 1 lock-ins

Decisions made during this brainstorm:

### Storage and conceptual model

- ✅ **Install root**: `~/.radorch/`, overridable via `RADORCH_HOME` env var. Folder name is `.radorch` (not `.rad`) to avoid collision with other tools that use `rad`.
- ✅ **Projects** live at `~/.radorch/projects/<NAME>/`, fully decoupled from any repo. `projects.base_path` is no longer a config knob — gone.
- ✅ **Worktrees** live at `~/.radorch/worktrees/<PROJECT>/<REPO>/`.
- ✅ **Repos** are first-class registry entries declared in `~/.radorch/registry.yml`. Each entry has `path`, `default_branch`, `remote`. Registry is the single source of truth for repo identity.
- ✅ **Workspaces** are named, optional groupings of repos in `registry.yml`. No defaults block. No `primary`. Exist only for project targeting, UI grouping, and task validation.
- ✅ **Single registry file** (`registry.yml`) for both repos and workspaces — not split across files at the *identity* level (per-machine paths are overlaid via `config.yml`).
- ✅ **Workspace root: per-machine path with strong-but-not-strict convention.**
  - `config.yml` (per-machine) holds the optional `root:` for each workspace; `registry.yml` does not.
  - `radorch workspace create A B C` infers `root` as the common parent of the given repo paths if one exists; user can override with `--root`.
  - `radorch workspace add <ws> <repo>` warns when the new repo isn't a child of the workspace's root ("typical for shared repos; proceed?") but does not reject. Convention nudges users toward strict layout; the warning is the discipline.
  - Sessions for workspace projects launch at the workspace root. Single-repo projects launch at the repo's local path.

### Config files

- ✅ **Metadata split**: `~/.radorch/install.json` (installer-managed, **team-versioned** — package_version stays here so the team moves together on the installed system version) + `~/.radorch/config.yml` (per-developer preferences AND per-machine path bindings for repos and workspaces, gitignored) + `~/.radorch/.harness` (per-machine active harness, gitignored). Active-harness selection lives in its own file, **not** in `install.json`, so a developer switching harness doesn't dirty a versioned file.
- ✅ **`projects.naming`**: dropped everywhere. Vestigial today (read but never applied). Project naming is hardcoded SCREAMING-CASE; real validation moves into project creation. The enum value `SCREAMING_CASE` (with underscore) was always misnamed; canonical naming uses hyphens.
- ✅ **`source_control.provider`**: dropped. Reserved-only, GitHub-only in v1, no demand for other providers in this program.
- ✅ **`auto_commit`, `auto_pr`, `human_gates.execution_mode`, `limits.*`, `default_template`**: stay at the global config level. They are user-preference / project-flow concerns, not per-repo policy. The `default.yml` template's `state_ref` lookups for `auto_commit` and `auto_pr` keep working.
- ✅ **`package_version`**: kept. Moves to `install.json` so users can't clobber it by editing `config.yml`.
- ✅ **`default_template`**: kept. Real (selects which DAG template to run, e.g., `templates/default.yml`). `default_template: ask` is also valid (prompt user at planning time).

### CLI architecture

- ✅ **`radorch` becomes a unified CLI**, written in TypeScript (`tsx` dev, compiled JS ship), distributed via `npm install -g radorch`. Absorbs today's `installer/` package and the scattered skill scripts.
- ✅ **Ship all three harnesses by default.** `radorch install` installs Claude Code, Copilot VS Code, and Copilot CLI bundles — no "pick one at install time" prompt. The wizard becomes shorter.
- ✅ **On-the-fly harness switching.** `radorch harness use <claude|copilot-vscode|copilot-cli>` flips the developer's active harness without reinstalling. Today's "must reinstall to switch" pain point goes away.

### Runtime layout

- ✅ **Pipeline runtime duplicated per-harness bundle**, not shared. Each `~/.radorch/runtime/harnesses/<harness>/` carries its own copy of `pipeline.js` + `lib/`. Simpler than a shared `runtime/pipeline/` with cross-bundle references; the duplication cost is low and the harness bundles stay self-contained.

### Git-friendliness defaults

- ✅ **Opinionated `.gitignore` ships with `~/.radorch/`.** Codifies the team-coordination stance below; teams can override.
- ✅ **Versioned**: `install.json`, `registry.yml` (with portable path substitution), `projects/<NAME>/state.json`, planning docs and review artifacts under `projects/<NAME>/`.
- ✅ **Gitignored**: `config.yml`, `.harness`, `worktrees/`, `runtime/`.
- ✅ **`state.json` is versioned** to enable project resumption across machines and future cloud execution.
- ✅ **Planning docs** (BRAINSTORMING, REQUIREMENTS, MASTER_PLAN, task handoffs, reviews) are versioned by default — they are team artifacts.
- ✅ **Registry split: identity vs. local paths.** `registry.yml` (versioned) carries only abstract identity — repo names, remote URLs, default branches, workspace membership. `config.yml` (gitignored, per-machine) carries local filesystem paths under `repos:` and `workspaces:` sections. They merge at read time. This **replaces** an earlier Wave 1 commitment to "portable path substitution" — overlay-by-file is simpler than substitution syntax, requires no parsing, and matches how team-shared vs. per-machine concerns naturally split. Dev2 picking up a project runs one `radorch workspace bind <name> <path>` command (or `radorch repo bind <name> <path>` for standalone repos) to populate their local config.yml.
- ✅ **`pipeline.js` stays separate** for stability throughout this program. Future fold-in is anticipated as a deferred effort (Wave 9), accompanied by a rewrite.
- ✅ **Phased migration** — old scripts coexist with `radorch` until each is fully replaced. Skills rewire one at a time.
- ✅ **Skills stay the entry point for pipeline work** — `/rad-brainstorm`, `/rad-execute`, etc. are unchanged in role. They get *thinner*: shell out to `radorch <subcommand>` instead of `node <path>/scripts/X.js`.

### Multi-repo contract

- ✅ **Task handoffs gain a `repos: string[]` frontmatter field** (always plural array; single-repo tasks carry a one-element array). The Coder's "self-contained handoff" rule (DO NOT read upstream docs) means this is the only legal channel to communicate the target repos to the Coder. Load-bearing. Exact array shape locked in §7.6 (Wave 3).
- ✅ **`pipeline.source_control` becomes per-repo** in v6 state. Exact shape decided in Wave 3.
- ✅ **`final_pr` becomes per-repo** in the v2 DAG template. Exact mechanics decided in Wave 6.

### User onboarding

- ✅ **Solo-repo path**: explicit `radorch repo add` is primary. Skills offer to register cwd as a fallback when the registry is empty and the user invokes `/rad-brainstorm` from inside a git repo.

---

## 7.5. Wave 2 lock-ins

Decisions made during the Wave 2 brainstorm. Read alongside §7 (Wave 1 constraints).

### Approach and layout

- ✅ **Greenfield in `cli/` folder** at the repo root. Coexists with existing `installer/` until cutover. No in-place evolution of `installer/`; the new package is built from scratch and migrates functionality over command-by-command (Wave 5).
- ✅ **npm package name stays `radorch`.** The repo folder is `cli/`; the published package is `radorch`. Same separation pattern as today's `installer/` folder publishing the `radorch` package.

### Framework

- ✅ **commander.js** for argument parsing. Zero runtime dependencies (verified at v14.0.3); requires Node ≥ 20.
- ✅ **Typed `CommandDef<Args, Flags, Result>` wrapper** around `commander.action()`. Every command is built the same way: declare a typed manifest (name, description, args, flags), implement a typed handler, register via the wrapper. The wrapper enforces context injection, envelope output, error mapping, and exit-code emission. Uniformity is enforced through the TypeScript type system, not convention.

### Interactive prompting (TTY-aware)

- ✅ **Framework-level wizard for missing required args.** When a required arg is omitted AND stdin is a TTY, the framework prompts the user for it. When stdin is not a TTY (skill invocations, CI, scripts), the command fails fast with `user_error` and an actionable message ("missing required arg `<name>`; provide via --flag or run interactively"). When all args are provided, runs non-interactively regardless of TTY. Free for every command — no per-command prompt code required for the basic case.
- ✅ **`--non-interactive` flag** explicitly disables prompts even on a TTY. Useful for tests and scripted CI.
- ✅ **Prompts on stderr; JSON envelope on stdout.** Preserves the stdio contract. `radorch X | jq ...` works on an interactive terminal because the wizard renders on stderr while the final emit stays on stdout.
- ✅ **Two interaction tiers.** Simple commands get the free missing-arg pattern. Multi-step flows (e.g., `radorch install`, `doctor` remediation) author their own sequences using a small framework `Prompter` utility — same TTY rule applies.
- ✅ **Why it matters for the dual-audience problem**: skills calling radorch in Wave 5 always provide args explicitly and never see prompts. Humans typing commands forget args and get gentle wizards. Same command surface, no per-command branching.

### TypeScript and distribution

- ✅ **Pure JS at runtime, even in dev.** No tsx in the `cli/` package. `tsc` produces `dist/`; both `npm install -g radorch` users and local dev run from compiled JS. Closes the gap between dev and production environments — bugs that only manifest under tsx or only under Node can't hide.
- ✅ **`tsc` for both build and typecheck.** `tsc --watch` for dev iteration; `tsc --noEmit` for pre-commit. One tool, sufficient for our scale. Swap to esbuild later only if compile time becomes painful.
- ✅ **No bundling in v1.** Ship multi-file `dist/`. Bundling (esbuild single-file output) is the escalation path if cold-start telemetry shows multi-file resolution is a real cost — Skills invoking radorch frequently (Wave 5) will be the natural source of that data.
- ✅ **Repo-wide tsx removal is future work, not Wave 2 scope.** The pipeline runtime (`pipeline.js`, `migrate-to-v5.ts`, `explode-master-plan.ts` under `skills/rad-orchestration/scripts/`) currently uses tsx; that stays untouched in this program. tsx remains a repo dependency for now and may be removed later as part of Wave 9 (pipeline fold-in) or independent cleanup.
- ✅ **Maximum TypeScript strictness**: `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`. Greenfield is the cheapest moment to set this; retrofitting later is painful.
- ✅ **ESM module system**: `"type": "module"` in `package.json`. TS imports use `.js` extensions per the ESM-on-TS convention. Native `node:` import prefix everywhere. Matches the pipeline runtime's existing ESM shape.
- ✅ **Node ≥ 20** declared in `engines`. Required by commander v14 anyway; lets us use native `fetch`, top-level await, and the `node:` import prefix freely.

### Output contract

- ✅ **Universal JSON envelope** on stdout for every command:
  ```json
  { "ok": true, "data": <command-specific-payload> }
  { "ok": false, "error": { "type": "user_error" | "system_error", "message": "..." } }
  ```
- ✅ **Envelope is open to extension** via optional fields. Future additions (`prompt?`, `warnings?`, `next_action?`) can be added without breaking consumers. New *required* fields require a breaking change.
- ✅ **Per-command data shape**: TS-typed via the `CommandDef` `Result` generic; verified by per-command tests that parse actual JSON output and assert keys. **No runtime data validation in v1** — TypeScript + tests carry the contract burden. Reassess if drift becomes a real problem (Zod-per-command is the escalation path).
- ✅ **Envelope shape itself is runtime-validated** by the framework before stdout. Catches handler-return-shape bugs early without the per-command overhead.
- ✅ **Prompt-return capability** (forward-looking, Wave 9 territory): when commands eventually need to return prompts or directives to drive agent behavior, they live in the `data` field for now. The envelope's open-to-extension design lets a dedicated optional `prompt?` field be promoted to the envelope level later without breaking compatibility.
- ✅ **Strict stdout/stderr separation.** stdout carries the JSON envelope **only** — exactly one final emit per invocation. stderr carries all human-readable output: progress, prompts, error context, debug. Skills can safely pipe `radorch X | jq ...` without contamination. An ESLint rule will block `console.log` outside the framework's `emit()` function.

### Exit codes

- ✅ **0 / 1 / 2** — success / user error / system error.
  - `0` — success.
  - `1` — user error (bad arguments, invalid state, missing required input). Maps to `error.type: "user_error"`.
  - `2` — system error (unexpected failure, network, filesystem). Maps to `error.type: "system_error"`.

### Tooling

- ✅ **Vitest** for tests, mirroring the pipeline runtime convention (`skills/rad-orchestration/scripts/tests/`). Tests live at `cli/tests/` mirroring `cli/src/` structure.
- ✅ **ESLint + Prettier** for lint and formatting.
- ✅ **Pre-commit hook**: `tsc --noEmit` + ESLint on the `cli/` package. Tests run in CI, not in the hook, to keep commits fast.
- ✅ **CI workflow lands with the first Wave 2 PR.** New `.github/workflows/cli.yml` runs `tsc --noEmit`, ESLint, and Vitest on changes to `cli/**`. Ships alongside the scaffold so every subsequent Wave 2 PR gets full CI coverage from day one.

### First commands (proof-of-concept set)

These exercise every architectural pattern end-to-end before the command surface scales out. Sequencing within Wave 2 is an implementation-time decision; the set itself is locked.

- `radorch install` — wizard; writes `~/.radorch/install.json` + `config.yml`; ships all three harness bundles to `~/.radorch/runtime/harnesses/<harness>/`.
- `radorch doctor` — health check (PATH, gh auth, registry consistency, harness assets present, install.json sanity).
- `radorch harness use <claude|copilot-vscode|copilot-cli>` — flips developer's active harness via `~/.radorch/.harness`.
- `radorch repo add [<path>]` — registers cwd (or given path) in `registry.yml`.
- `radorch workspace create <name> <repo1> <repo2>...` — creates a workspace entry in `registry.yml`.

### Shared lib structure

| Module | Responsibility |
|---|---|
| `paths.ts` | `~/.radorch/` resolution, `RADORCH_HOME` override, install-root paths |
| `registry.ts` | `registry.yml` read/write; repo + workspace types |
| `config.ts` | `config.yml` + `install.json` read/write |
| `yaml.ts` | `js-yaml` wrapper (replaces today's hand-rolled `parseSimpleYaml`) |
| `git.ts` | shared git exec helpers |
| `output.ts` | envelope wrapping, emit, exit-code mapping (lives under `framework/` not `lib/` since it's framework infrastructure) |
| `errors.ts` | typed error hierarchy (lives under `framework/` for the same reason) |

---

## 7.6. Wave 3 lock-ins

Decisions made during the Wave 3 brainstorm. Read alongside §7 (Wave 1) and §7.5 (Wave 2).

### Schema migration approach

- ✅ **Schema bumps to `orchestration-state-v6`.** Migration via explicit `radorch migrate` command, mirroring the existing v5 migration precedent (pure data transform + CLI scanner with `--dry-run`).
- ✅ **Pipeline errors clearly on v5 input** with a "run `radorch migrate`" hint. No auto-migration on read — predictable, auditable, dry-runnable.

### Multi-repo data model

- ✅ **Primarily single-repo per task; multi-repo permitted for tightly-coupled work.** Each task targets one or more repos via the handoff's `repos: string[]` field — always an array, single-repo tasks have a one-element array. Default planner guidance is one repo per task. Multi-repo tasks are reserved for cases where coupling makes splitting artificial (e.g., introducing a new API contract that requires both the route and its typed client at the same time, or large/XL tasks under the `quick` template where fewer review checkpoints let tasks naturally grow). Phase-scope corrective handoffs that need cross-repo fixes are also multi-repo tasks — no special-casing.
- ✅ **`pipeline.source_control` becomes a map keyed by repo name** — `by_repo: { frontend: {...}, backend: {...} }`. Each per-repo entry holds branch, base_branch, remote_url, compare_url, pr_url. Shared `auto_commit` and `auto_pr` stay at the **parent level inside `pipeline.source_control`** — siblings to `by_repo`, NOT inside `state.config`. The DAG template's `state_ref: pipeline.source_control.auto_commit` lookup requires this exact path, so the placement is contractual, not a stylistic choice. Direct lookup by registry name; adding a repo mid-flight is an upsert.
- ✅ **Worktree path is derived, not stored.** Computed at read time from `${RADORCH_HOME}/worktrees/<PROJECT>/<REPO>/`. Eliminates the absolute-path-portability problem in state entirely. If we ever need custom worktree locations, an optional override field can be added later.
- ✅ **`state.project.target` is discriminated by kind** — `{ kind: 'workspace' | 'repo', name: string }`. Single-repo project: `{ kind: 'repo', name: 'frontend' }`. Workspace project: `{ kind: 'workspace', name: 'my-app-stack' }`.

### Type-system rigor

- ✅ **`IterationEntry` splits into two types.** `PhaseIterationEntry` (no repo field) for the phase loop; `TaskIterationEntry` (required `repos: string[]`, minLength 1) for the task loop. Compiler enforces the invariant that task iterations always carry at least one repo. Real refactor cost in `mutations.ts`, the JSON schema (gains a `oneOf` discriminator), and migration code — but v6 is the cheapest moment to pay it.
- ✅ **`CorrectiveTaskEntry` carries `repos: string[]` explicitly**, not inherited from its parent task. Consistent with `TaskIterationEntry`; zero indirection at read time. Task-scope correctives copy parent's `repos` array verbatim. Phase-scope correctives may have a different `repos` array — the orchestrator chooses based on findings (see §7.7 Corrective handoffs).
- ✅ **Each `repos` entry is a string referencing a registry entry** (e.g., `"frontend"`). Validated at consumption time by `radorch` lookups against `registry.yml`. No richer shape in state.
- ✅ **`commit_hashes: { [repo]: string | null }` replaces v5's single `commit_hash`.** Map shape regardless of repo count. Single-repo task: one entry. Multi-repo task: one entry per repo. Each entry is independently nullable until that repo's commit completes.

### Event evolution

- ✅ **`source_control_init` becomes per-repo at the engine level.** Each call upserts one entry into `pipeline.source_control.by_repo`. Failure is isolated per repo — frontend init can fail while backend succeeds.
- ✅ **A CLI convenience wrapper** — e.g., `radorch project init-source-control` — iterates the project's target repos and fires the per-repo events. Skills call ONE high-level command; the loop lives in the CLI. Aligns with the program-wide principle (§2): keep agents simple, lean on the CLI for mechanical work.

### Spawn-prompt pre-resolution

The engine pre-resolves path arithmetic and diff scoping before handing the agent its spawn prompt. Agents read pre-resolved fields and act on them directly — no path math, no SHA derivation, no section-name-to-repo lookups for file edits. Aligns with the program-wide principle: keep agents simple, lean on the engine for mechanical work.

- ✅ **`working_directories: { [repo]: path }`** in `result.context` for repo-scoped actions (`execute_task`, `spawn_code_reviewer`, `spawn_phase_reviewer`, `spawn_final_reviewer`, `invoke_source_control_commit`, `invoke_source_control_pr`). Always a map regardless of repo count. Each path computed from `${RADORCH_HOME}/worktrees/<PROJECT>/<REPO>/`. Agents use this as cwd when running build/test commands per repo.
- ✅ **`file_operations`** in `result.context` for `execute_task`. Engine parses the handoff's per-repo `**Files for <repo>:**` subsections, joins each relative path with the matching `working_directories[<repo>]`, emits entries like `{ repo: 'frontend', op: 'create', path: '/abs/path/.../src/profile.tsx' }`. Coder edits files at the absolute paths directly — no path math, no section-header lookup.
- ✅ **`diff_plan`** in `result.context` for review actions. Shape varies by scope: task review → `{ [repo]: { head_sha } }`; phase review → `{ [repo]: { first_sha, head_sha } }`; final review → `{ [repo]: { base_sha, head_sha } }`. SHAs are independently nullable per repo (null when no commit was made for that repo). Reviewer iterates the map and runs `git diff` in each repo's worktree.
- ✅ **Orchestrator propagates pre-resolved fields verbatim** from `result.context` to the spawn prompt. No agent-side derivation; pure relay.
- ✅ **Parent session's cwd is irrelevant.** Supports both new-terminal-in-worktree mode and stay-put mode (the user drives a project from their existing session without spawning a new terminal in any worktree).

---

## 7.7. Wave 4 lock-ins

Decisions made during the Wave 4 brainstorm. Read alongside §7 (Wave 1), §7.5 (Wave 2), §7.6 (Wave 3).

### Handoff frontmatter

- ✅ **Handoff carries `repos: string[]` (array of registry-name strings) only.** Always a plural array — single-repo tasks have a one-element array. Not `working_directories:`. The absolute paths are engine-computed and propagated via spawn prompt (Wave 3 §7.6) — inlining them in the handoff would break portability when projects move between machines.

### Master plan format and explosion script

- ✅ **Repo assignment is per-task and always plural.** Each task carries `**Target repos:** <comma-list>` — always plural form, even for single-repo tasks (`**Target repos:** frontend`). Phase has no `Target repos` field — phases stay repo-agnostic, mixed-repo phases are supported, and small multi-repo projects don't pay phase-ceremony multiplication.
- ✅ **File Targets are grouped per-repo via `**Files for <repo>:**` subsections, always.** Replaces today's flat `**Files:**` list — uniform structure regardless of repo count. Single-repo tasks have one `**Files for <repo>:**` heading; multi-repo tasks have N. No format-shape switch when a task crosses 1.
- ✅ **Single-repo projects: planner can omit `**Target repos:**`.** When `state.project.target.kind === 'repo'`, the explosion script auto-fills `repos: ["<target-name>"]` on every emitted handoff. The per-repo `**Files for <repo>:**` heading is still required — it identifies the working directory for the task's files.
- ✅ **Multi-repo parse error.** Explosion script throws ParseError when `state.project.target.kind === 'workspace'` and a task is missing `**Target repos:**`. Caught at planning time, not at execution time.
- ✅ **Multi-repo validation is layered.** Explosion script validates each repo in `**Target repos:**` against the project's available repos (workspace member list or single-repo target). Engine validates each `TaskIterationEntry.repos` element against the registry at iteration construction. Source-control agent fails fast at runtime if any worktree path doesn't exist. Each layer catches a different class of error.

### Project-repos discovery (orchestrator → planner)

- ✅ **Mirror the skills-discovery pattern.** Orchestrator runs a project-repos manifest script before spawning the planner for both `spawn_requirements` and `spawn_master_plan`, parallel to today's `list-repo-skills.mjs` flow.
- ✅ **Output inlined under contractual heading `## Project Repos Available`.** Heading string is exact-match. Empty array → heading omitted entirely (single-repo escape hatch, same convention as the skills manifest).
- ✅ **Script reads `state.project.target`**, resolves to relevant repos via `registry.yml`, outputs JSON array of `{ name, remote, description? }`. Single-repo projects produce `[]`; workspace projects produce the full member list with descriptions.
- ✅ **Registry gains optional `description:` per repo entry** so the planner has enough context to assign tasks intelligently without grepping every repo. Small Wave 1 addendum, scoped to the registry schema.
- ✅ **Skill-driven orchestrator gains a "Project Repos Manifest" instruction block** in `skills/rad-orchestration/SKILL.md` (or its references) at Wave 5 — parallel to where the migrated "Planner Spawn Manifest" content lands (per §7.8 orchestrator-retirement clean-pass). Since `agents/orchestrator.md` retires in Wave 5, the new contract surfaces in the skill body, not in an agent file.

### Corrective handoffs

- ✅ **Task-scope correctives mechanically inherit `repos`** from the parent task's handoff frontmatter (copy the array verbatim). Not LLM judgment — the corrective necessarily targets the same repos as the task it's correcting.
- ✅ **Phase-scope correctives have orchestrator-determined `repos`.** The orchestrator authors a phase-scope corrective handoff after phase-review mediation; it picks `repos` based on which repos the actioned findings need to land in. Documented in the addendum's Finding Dispositions reason column (e.g., "F-1 → action (drift) — fix lands in `frontend` per file path `frontend/src/api-client.ts`"; "F-2 → action — fix coordinated across `frontend` and `backend`").
- ✅ **Cross-repo phase-scope findings naturally resolve as multi-repo correctives.** An earlier concern about "phase-scope finding spans repos in unfixable ways" disappears — multi-repo task support absorbs it. The orchestrator authors one phase-scope corrective with `repos: [frontend, backend]` when the fix genuinely needs both.

### Cross-repo task ordering

- ✅ **Existing `**Execution order:**` semantics still apply.** A task in `frontend` depending on a task in `backend` uses the same `T01 → T02` syntax already in the master plan format. Repo identity doesn't change dependency ordering — the engine respects the declared order regardless of which repo each task touches.

### Skill and script updates

- ✅ **`rad-execute-coding-task` SKILL.md**: Coder reads `working_directories: { [repo]: path }` (and `file_operations`) from the spawn prompt; treats File Targets as absolute (engine-resolved) or relative to the matching `working_directories[<repo>]`; runs build/test commands with the relevant `working_directories[<repo>]` as cwd, iterating per repo for multi-repo tasks.
- ✅ **`explode-master-plan.ts`**: parses `**Target repos:** <comma-list>` per task body (mirrors how `**Requirements:**` is already extracted); emits `repos: [<name>, ...]` (always a plural array) in task handoff frontmatter; applies single-repo auto-fill (one-element array); throws ParseError on missing field for multi-repo projects.

### Task code review under multi-repo

- ✅ **One reviewer spawn per task, multi-repo aware via per-repo diff plan.** Engine emits `diff_plan: { [repo]: { head_sha: string | null } }` in `result.context` for `spawn_code_reviewer` (see §7.6). Reviewer iterates per repo, runs `git diff` (or `git show <head_sha>`) in each repo's worktree, audits findings, writes ONE combined review doc. Single review cycle per task; the reviewer can reason about cross-repo coupling — critical for tasks where the whole point is coordinated changes.
- ✅ **Findings imply repo via `File:Line` references.** A finding's repo is derivable from the absolute path the reviewer cites (since the engine handed it absolute paths via `file_operations` and `working_directories`). Audit table rows naturally span repos when the task does.
- ✅ **Null head_sha is per-repo.** When `auto_commit: never` or no commit happened for a particular repo, that repo's `head_sha` is null independently. Reviewer falls back to `git diff HEAD` + untracked files in that repo's worktree.

### Phase review under multi-repo

- ✅ **Same pattern, scoped to the phase's cumulative range.** Engine groups `TaskIterationEntry.commit_hashes` and `CorrectiveTaskEntry.commit_hashes` values by repo across the phase's tasks to produce `diff_plan: { [repo]: { first_sha, head_sha } }`. Reviewer iterates per repo, runs `git diff <first_sha>~1..<head_sha>` in each worktree, writes ONE combined phase review doc. Cross-repo cumulative drift surfaces naturally because the reviewer sees all repos.

### Final review under multi-repo

- ✅ **One final reviewer spawn per project, per-repo diff plan.** Engine walks every `TaskIterationEntry.commit_hashes` and `CorrectiveTaskEntry.commit_hashes` across the entire project, groups by repo, computes per-repo `base_sha` (first chronological commit) and `head_sha` (last commit). Emits `diff_plan: { [repo]: { base_sha, head_sha } }`. Reviewer iterates per repo, audits each FR/NFR/AD/DD requirement against the union of changes across all repos, writes ONE combined final review doc.
- ✅ **`met | missing` status spans all repos.** A requirement is `met` only when satisfied wherever it's owed — across every repo a task targeting that requirement touched. `met` in `frontend` but `missing` in `backend` resolves to `missing` overall.
- ✅ **Single final-approval gate, regardless of repo count.** One review doc, one human approval. PR fan-out (Wave 6 — `radorch git pr` iterates internally over `pipeline.source_control.by_repo`) handles the per-repo step inside a single CLI invocation; final approval doesn't multiply.
- ✅ **Null head_sha per repo** matches the task/phase patterns: when a repo had no commits, reviewer falls back to `git diff HEAD` + untracked files in that worktree.

### Implications for Wave 6 (DAG template + reviewer skill changes)

Engine-level multi-repo support (per-repo diff plans, working_directories, file_operations) is fully locked in §7.6 and the review subsections above. Wave 6 picks up the remaining DAG-template and reviewer-skill consequences:

- 🟡 **`final_pr` step stays a single DAG node**, but the underlying CLI (`radorch git pr`) gains internal iteration: when called at project scope, it loops over `pipeline.source_control.by_repo` and opens one PR per repo. Single agent spawn per project; per-repo fan-out inside the CLI. Aggregated `## PR Result` block carries per-repo URLs.
- 🟡 **`commit_gate` and `pr_gate` stay project-level** — `auto_commit` and `auto_pr` are project-level configs (per Wave 1). The conditionals fire once; the per-repo expansion (for PR creation) lives inside the true branch.
- 🟡 **Reviewer skills (task, phase, final) update to read `diff_plan`** as a `{ [repo]: ... }` map and iterate per repo. Skill markdown change in Wave 6 (or alongside Wave 5's skill migration if convenient).

---

## 7.8. Wave 5 lock-ins

Decisions made during the Wave 5 brainstorm. Read alongside §7 (Wave 1), §7.5 (Wave 2), §7.6 (Wave 3), §7.7 (Wave 4).

### Skill consolidation and retirements

The skill / agent inventory shrinks meaningfully. Six retirements; the remainder are updated in place.

**Retirements:**

- ✅ **`/rad-execute-parallel` collapsed into `/rad-execute`.** Historical parallel-vs-non-parallel split goes away; v6's relevant choice is `execution_mode: worktree | in-place`, picked at first execution.
- ✅ **`/rad-plan-quick` collapsed into `/rad-plan`.** With four tiered templates (`extra-high` / `high` / `medium` / `low`) all selectable from `/rad-plan`'s template-choice prompt, a separate quick-mode skill is redundant.
- ✅ **`/rad-approve-plan` retired.** UI's `composePrompt` in `start-action/route.ts` swaps `/rad-approve-plan` → `/rad-execute`; one fewer slash command. The skill's only job (route between two skills) collapses since `/rad-execute-parallel` already retired.
- ✅ **`/rad-configure-system` retired.** First-time setup moves to `radorch install`. Reconfiguration moves to the Settings page (Wave 7) or `radorch config set` from the CLI. The skill's question groups become obsolete (`orchestration.yml` is gone; path-propagation logic doesn't apply).
- ✅ **`agents/brainstormer.md` retired.** `/rad-brainstorm` is invoked directly as a skill; no separate agent layer.
- ✅ **`agents/orchestrator.md` retired — clean-pass migration, not a clean removal.** Orchestration becomes fully skill-driven: the LLM running `/rad-execute`, `/rad-plan`, `/rad-cleanup`, `/rad-archive` IS the orchestrator. Most of the agent file's content is already redundant with `skills/rad-orchestration/` references (`/rad-execute` Step 1 says "You are an orchestrator" today; `pipeline-guide.md` and `corrective-playbook.md` cover the routing table and mediation flow). However, a small set of contractual content lives only in `agents/orchestrator.md` and must be folded into the `rad-orchestration` skill body or its references during Wave 5 PRs:
  - **Planner Spawn Manifest** — the `## Repository Skills Available` contractual heading and the manifest-script invocation contract (run on every planner spawn, no caching, exact-match heading). Today documented in `agents/orchestrator.md`; needs to land in `skills/rad-orchestration/SKILL.md` (or `references/pipeline-guide.md`) so the skill-driven orchestrator inherits it.
  - **Write-surface contract** — the explicit "you may only write `## Orchestrator Addendum` on existing review docs and corrective Task Handoff files under `tasks/`" guardrail. `references/context.md` mentions the addendum; `references/corrective-playbook.md` shows the addendum shape; but the consolidated narrow-write-surface statement currently lives only in `agents/orchestrator.md`.
  - **Mediation flow trigger** — the explicit trigger condition (`code_review_completed` / `phase_review_completed` with raw `verdict: changes_requested` enters the in-session mediation cycle BEFORE signaling the event), plus the "STOP and `/clear` if mediation context grows heavy" guidance. Trigger details exist in `pipeline-guide.md`; the start-here orientation needs to surface in the skill body.

  Actual content migration is implementation work in the Wave 5 PRs; this doc just captures the migration's scope.

**New skills introduced:**

- ✅ **`/rad-cleanup <NAME>`** — thin wrapper around `radorch project cleanup`.
- ✅ **`/rad-archive <NAME>`** — thin wrapper around `radorch project archive`.
- ✅ **`/rad-ui-start [--port <N>]`** and **`/rad-ui-stop`** — thin wrappers around the dashboard CLI commands (Wave 7).

**Cross-cutting design principles** (per §2):

- ✅ **All skill markdown is OS-agnostic and harness-agnostic.** Direct CLI invocations only — no shell-specific pipes or redirections, no harness-specific tool name references.
- ✅ **All skills use AskUserQuestion / AskQuestions for structured user interactions.** Free-form conversational asking only for open exploration; structured commitments use the tool.

### Updated `/rad-plan` flow

Replaces the merged shape of today's `/rad-plan` + `/rad-plan-quick`. Single skill handles all four template tiers.

- ✅ **Template selection via AskUserQuestion**, four options (`extra-high` / `high` / `medium` / `low`). Each option's description includes its review intensity AND a speed/token-cost hint (e.g., `extra-high` notes "highest token cost, longest run; defense in depth"; `low` notes "fastest, lowest token cost; only the final review"). Recommended marker defaults to `extra-high`. Skip the prompt if `--template` arg was passed.
- ✅ **Task size preference asked separately**, with the "Recommended" marker shifting per tier:
  - `extra-high`, `high` → recommended **Medium**
  - `medium` → recommended **Large**
  - `low` → recommended **Extra Large**
  - User can override; **Planner Decides** option always available.
- ✅ **Target binding step**: skill calls `radorch project status <NAME>`. If `target_unset`, AskUserQuestion prompts user to pick workspace or repo (options derived from `radorch repo list` + `radorch workspace list`). Skill calls `radorch project init <NAME> --target-kind <k> --target-name <n>`. Idempotent if already set.
- ✅ **Project-repos manifest**: skill runs the discovery script before spawning the planner, inlines output under contractual `## Project Repos Available` heading (Wave 4 §7.7).
- ✅ **No end-of-skill router**: previous "current branch vs. new worktree" question goes away. Final step just transitions to `/rad-execute` (or the user invokes it themselves).

### Updated `/rad-execute` approval flow

- ✅ **Step 2 reads `state.project.plan_approval_gate`.** If `gate_active: true` (pending), the user's invocation of `/rad-execute` IS the implicit approval — skill signals `plan_approved` to the pipeline. Confirms with a brief message ("Marking plan approved and starting execution.").
- ✅ **If plan already approved**, Step 2 is a no-op; skill proceeds to source-control init.
- ✅ **First-run AskUserQuestion for `execution_mode`** (worktree vs. in-place; default worktree). Result persists to `state.project.execution_mode`.
- ✅ Then calls `radorch project start <NAME>` and proceeds with the pipeline.

### Source-control agent narrative format

- ✅ **Commit bodies: 3-5 lines.** Header is mechanical (`{prefix}({taskId}): {title}`). Body is per-repo, agent-crafted: 3-5 bullets describing files changed in this repo + brief intent. Constrained shape keeps narrative actionable.
- ✅ **PR descriptions: ~200 words per repo.** Structure: project context (1-2 sentences), what changed in this repo (3-5 bullets from `file_operations`), testing notes (from execution notes), Linked PRs section (placeholder, filled in pass-2), reference to full audit (link to final review doc). Constrained length keeps tokens-per-spawn bounded.

### CLI command set

The Wave 5 CLI surface, in addition to Wave 2's first-cut commands:

| Command | Purpose |
|---|---|
| `radorch project init <NAME> --target-kind <k> --target-name <n>` | Initialize project state with target; idempotent |
| `radorch project status <NAME>` | Inspect project state (target_set, in_progress, completed, …) |
| `radorch project start <NAME>` | Orchestration entry; creates worktrees if mode=worktree; prompts execution_mode on first run |
| `radorch project cleanup <NAME>` | Remove worktrees + delete local branches (merge-state pre-flight) |
| `radorch project archive <NAME>` | Cleanup + move artifacts to `_archive/`; prompts if project not completed |
| `radorch project init-source-control <NAME>` | Wrapper that fires `source_control_init` per repo |
| `radorch project find [--name <N>]` | List execution-ready projects (replaces `find-projects.js`) |
| `radorch context` | Git env + config discovery (replaces both `gather-context.js` copies) |
| `radorch worktree create --project <P> --repo <R> --branch <B> --base-branch <BB>` | Create one worktree |
| `radorch worktree remove --project <P> [--repo <R>] [--force]` | Surgical worktree removal |
| `radorch worktree inject-theme --project <P>` | VS Code theme injection (replaces `inject-theme.js`) |
| `radorch git commit --project <P> --repo <R> --task-id <T> ...` | Commit (replaces `git-commit.js`); routes per-repo |
| `radorch git pr --project <P> --repo <R> ...` | PR creation (replaces `gh-pr.js`); per-repo |
| `radorch harness launch --project <P> [--worktree-of <R>]` | Cross-platform terminal/IDE launcher (replaces `launch-claude.js`) |
| `radorch skills list` | Skills manifest for orchestrator spawns (replaces `list-repo-skills.mjs`) |

`radorch repo list` (Wave 2) is enriched to include `local_path` from config.yml in its JSON output — needed by the brainstormer skill and any other consumer that does filesystem operations.

### Migration approach — bottom-up tiers

- ✅ **Tier 1**: `radorch git commit`, `radorch git pr` — primitives with no internal dependencies.
- ✅ **Tier 2**: `radorch context` — replaces both `gather-context.js` copies; consolidates the duplicate.
- ✅ **Tier 3**: `radorch worktree create`, `worktree inject-theme`, `project find`, `harness launch`.
- ✅ **Tier 4**: `radorch project start`, `cleanup`, `archive`, `init-source-control`, `init`, `status`. Build on Tier 3.
- ✅ **Tier 5**: skill rewrites — `/rad-execute`, `/rad-cleanup`, `/rad-archive`, plus Wave 5 updates to `/rad-brainstorm` (registry awareness) and `/rad-plan` (target prompting).
- ✅ **Each tier ships in independent PRs.** Skills migrate only after their CLI dependencies exist. Old scripts deleted in the PR that retires their last consumer.
- ✅ **In-flight projects span the migration naturally.** Old scripts coexist with new CLI; state migration (`radorch migrate` from Wave 3) handles v5→v6 schema. A project started under old `/rad-execute-parallel` resumes cleanly under new `/rad-execute` after migration.

### Worktree directory structure

- ✅ **Worktrees live at `${RADORCH_HOME}/worktrees/<PROJECT>/<REPO>/`** — project-folder parent, repos as siblings inside (mirrors the user's original workspace layout where repos sit under a common parent).
- ✅ **Session cwd for worktree-mode projects** is the project's worktree parent (`${RADORCH_HOME}/worktrees/<PROJECT>/`). An IDE pointed there sees member repos as siblings, just like opening their original workspace folder.
- ✅ **No registry entries for worktrees** — they are transient project artifacts derivable from project name + repo name + RADORCH_HOME. Tracked implicitly in state and on filesystem, not in `registry.yml`.

### Execution mode (per-project)

- ✅ **`state.project.execution_mode: 'worktree' | 'in-place'`** field, set at first `/rad-execute` invocation via AskUserQuestion. Persists to state.json; subsequent invocations don't re-ask.
- ✅ **Default**: `worktree` (the safer, parallel-safe option).
- ✅ **In-place mode pre-flight check** for each member repo before any operation: clean working tree, ability to switch branch. Refuses loudly if any repo has uncommitted changes or is on a divergent branch. Never silently switches a user's checkout.
- ✅ **Multi-repo + in-place is supported but constrained** by the pre-flight refusal — no silent surprise switches.
- ✅ **Multi-repo pre-flight failure surfaces every dirty repo at once.** If N of M repos are clean, the pre-flight fails with an explicit list of the dirty repos and what's wrong with each (e.g., `frontend: uncommitted changes`, `infra: on detached HEAD`), so the user can resolve all problems in one pass rather than one failure at a time. No partial-progress fallback.

### Project target binding (Wave 4 ↔ Wave 5 boundary)

- ✅ **`state.project.target` is set at `/rad-plan` invocation**, NOT at `/rad-brainstorm`. `/rad-brainstorm` is optional; binding target there would create a "skip caused state to be unset" failure mode at planning time.
- ✅ **`/rad-plan` flow**: skill calls `radorch project status <NAME>`. If `target_unset`, skill uses AskUserQuestion to prompt the user with options derived from `radorch repo list` + `radorch workspace list`. User picks. Skill calls `radorch project init <NAME> --target-kind <k> --target-name <n>`. Then proceeds to spawn the planner via the orchestrator's existing planner manifest pattern (Wave 4 §7.7).
- ✅ **`/rad-brainstorm` does NOT set target.** Brainstorming exploration can change scope freely without committing.

### Brainstormer registry awareness

- ✅ **`/rad-brainstorm` skill runs `radorch repo list` and `radorch workspace list` early** in its workflow (skill-LLM directly, no orchestrator involvement).
- ✅ **The skill uses the registry context** to suggest exploration (`"want me to look at how frontend already handles this?"`) and to help the user narrow scope conversationally.
- ✅ **`radorch repo list` includes `local_path`** in its output so the brainstormer can perform filesystem operations (Grep / Read / Glob) against the actual code.
- ✅ **No spawn manifest, no contractual heading** — `/rad-brainstorm` doesn't spawn a subagent, so the orchestrator-pattern manifest doesn't apply here. The skill is a direct LLM-driven workflow with the registry data inlined into the LLM's working context via the CLI calls it makes itself.

### Cleanup and archive

- ✅ **`/rad-cleanup <NAME>`** (skill) → `radorch project cleanup <NAME>` (CLI):
  - Pre-flight checks: clean working trees, all commits pushed, branches merged into base.
  - On success: `git worktree remove` per repo, `git worktree prune` in source repos, `git branch -d` for each per-project local branch.
  - Project artifacts at `~/.radorch/projects/<NAME>/` are kept (audit history, planning docs, state.json, reviews).
  - `--force` flag overrides safety checks; TTY mode prompts before destructive overrides.
- ✅ **`/rad-archive <NAME>`** (skill) → `radorch project archive <NAME>` (CLI):
  - Runs cleanup first (worktrees + branches gone).
  - Moves `~/.radorch/projects/<NAME>/` → `~/.radorch/projects/_archive/<NAME>/`.
  - If project is not in a completed state, prompts the user to confirm (incomplete archive is allowed but not silent).
- ✅ **`_archive/` is a peer subfolder under `projects/`**, not a separate top-level path. Archived projects retain their full directory shape; revival is `mv` back. UI lists active projects by default, optionally shows archived.

### Test discipline

- ✅ **Per-command integration tests**: each CLI command gets at least one happy-path integration test plus a few important error cases. Test exercises the full vertical (argv parsing → handler → lib → real filesystem / git).
- ✅ **Selective multi-command flow tests** (~5): cover key user journeys (install + setup, project lifecycle, cleanup + archive). Catch wiring problems that per-command tests miss.
- ✅ **Unit tests** cover internal logic with mocked deps (paths, registry, config, yaml, git wrappers, error mapping).
- ✅ **Per-test isolation**: each integration test creates its own temp `RADORCH_HOME` via `mkdtempSync`, tears it down via Vitest `afterEach` with `rmSync({ recursive: true, force: true })`. Cleanup is unconditional — partial-failure tests don't leak state.
- ✅ **No real remotes, ever**: integration tests use **local bare git repositories** as fake origins. `git push` writes to filesystem, never to GitHub. Tests assert on the bare repo state.
- ✅ **`gh` is mocked at PATH**: a PATH-level mock script replaces `gh` for any test exercising `radorch git pr`. Tests verify the CLI's interaction with `gh`'s output without ever calling real `gh pr create`.
- ✅ **Centralized fixture helpers** in `cli/tests/helpers/`: `makeTempRadorch()`, `makeLocalRepoFixture()`, `withMockedGh()`. Individual tests stay focused on assertions, not setup.
- ✅ **Existing skill/script tests migrate by retargeting their shell mocks** to new `radorch <subcommand>` invocations. As scripts retire, their mocks retire with them.

### Comprehensive skill / agent inventory under v6

The complete picture of what each skill and agent becomes:

| File | Action | Notes |
|---|---|---|
| `skills/rad-brainstorm/SKILL.md` | Update | Registry awareness: skill runs `radorch repo list` + `radorch workspace list` early. Standalone (not orchestrator-driven). Does NOT set `state.project.target`. |
| `skills/rad-plan/SKILL.md` | Update (substantial) | Four-tier template selection via AskUserQuestion with descriptions. Task-size preference with shifting recommendation. Target-binding step. Project-repos manifest. Drop end-of-skill router. |
| `skills/rad-plan-quick/SKILL.md` | **RETIRE** | Collapses into `/rad-plan` (which now handles all four tiers). |
| `skills/rad-approve-plan/SKILL.md` | **RETIRE** | UI's `composePrompt` in `start-action/route.ts` swaps `/rad-approve-plan` → `/rad-execute`. |
| `skills/rad-configure-system/SKILL.md` | **RETIRE** | First-time setup → `radorch install`; reconfiguration → Settings page or `radorch config set`. |
| `skills/rad-execute/SKILL.md` | Update | Collapsed (absorbs `/rad-execute-parallel`). Step 2 approval flow: treat invocation as implicit approval if gate pending. First-run AskUserQuestion for `execution_mode`. Calls `radorch project start`. |
| `skills/rad-execute-parallel/SKILL.md` | **RETIRE** | Collapsed into `/rad-execute`. |
| `skills/rad-execute-coding-task/SKILL.md` | Update | Coder reads `working_directories` and `file_operations` from spawn prompt. Treats paths as absolute. Sets cwd to `working_directories[<repo>]` for build/test per repo. CWD hygiene rule simplifies. |
| `skills/rad-create-plans/references/master-plan/workflow.md` | Update | Multi-repo planning guidance: `**Target repos:**` per task (always plural). `**Files for <repo>:**` per-repo subsections. Single-repo-by-default convention; multi-repo permitted for tightly-coupled work. |
| `skills/rad-code-review/{task,phase,final}-review/workflow.md` | Update (each mode) | Engine provides `diff_plan: { [repo]: { ... } }`. Workflow iterates per repo, runs git diff in each worktree. Single audit table spanning repos with stable F-IDs. One review doc per spawn, single verdict. |
| `skills/rad-plan-audit/references/audit-rubric.md` | Update | Codebase Accuracy: validate `**Files for <repo>:**` paths exist in named repo's local clone (Modify/Delete) or parent dirs exist (Create). Buildability: validate `**Target repos:**` present per task and reference project's available repos. |
| `skills/rad-run-tests/SKILL.md` | Update | Per-repo runner discovery for multi-repo tasks. Coder iterates the task's `repos`: for each, set cwd to `working_directories[<repo>]`, discover and run that repo's test runner. Serial execution. Aggregated report with per-repo sections. |
| `skills/rad-source-control/SKILL.md` | Update | Narrative-crafting role: agent crafts per-repo commit bodies (3-5 lines each) and PR descriptions (~200 words each) via LLM. Header for commits is mechanical; body is LLM. Aggregated `## Commit Result` and `## PR Result` blocks with per-repo maps. |
| `skills/rad-log-error/SKILL.md` | Update | Add optional `Repo` field to entry template for multi-repo error context (alongside Phase / Task fields). |
| `skills/rad-orchestration/references/action-event-reference.md` | Update | New context fields (`working_directories`, `file_operations`, `diff_plan`). New event payloads (`--commit-hashes-json`, `--pr-urls-json`, per-repo `source_control_init`). |
| `skills/rad-orchestration/references/pipeline-guide.md` | Update | Reflect v6 CLI flags, source-control PR mode (per-repo descriptions, two-pass creation), error handling for partial multi-repo failures. |
| `skills/rad-orchestration/references/corrective-playbook.md` | Update | Phase-scope correctives can be multi-repo. Task-scope correctives inherit `repos` from parent. Examples updated for multi-repo cases. |
| **NEW: `skills/rad-cleanup/SKILL.md`** | Create | Thin wrapper calling `radorch project cleanup`. Confirmation modal pattern. |
| **NEW: `skills/rad-archive/SKILL.md`** | Create | Thin wrapper calling `radorch project archive`. Pre-flight check on completion state. |
| **NEW: `skills/rad-ui-start/SKILL.md`** | Create | Thin wrapper calling `radorch dashboard start`. Wave 7. |
| **NEW: `skills/rad-ui-stop/SKILL.md`** | Create | Thin wrapper calling `radorch dashboard stop`. Wave 7. |
| `agents/brainstormer.md` | **RETIRE** | Replaced by `/rad-brainstorm` skill invoked directly. |
| `agents/orchestrator.md` | **RETIRE (clean-pass migration)** | Orchestration is skill-driven; user's session LLM running `/rad-execute`, `/rad-plan`, etc. IS the orchestrator. Most content is already covered by `skills/rad-orchestration/` references; the non-redundant essentials (Planner Spawn Manifest with `## Repository Skills Available` contractual heading, narrow-write-surface contract, mediation-flow trigger condition) fold into `rad-orchestration` skill body or its references during Wave 5 PRs. Not a no-op removal — small but contractual migration. |
| `agents/coder.md` | Stay | Behavior changes inherited via `rad-execute-coding-task` skill updates. |
| `agents/coder-junior.md` | Stay | Inherited via skills. Same as `coder.md`. |
| `agents/coder-senior.md` | Stay | Inherited via skills. Same as `coder.md`. |
| `agents/planner.md` | Stay | Behavior changes inherited via `rad-create-plans` skill + project-repos manifest pattern. |
| `agents/reviewer.md` | Stay | Behavior changes inherited via `rad-code-review` skill updates. |
| `agents/source-control.md` | Stay | Skill-content updates expand the agent's role to narrative crafting (commit bodies + PR descriptions). |

All updates respect §2 design principles: OS-agnostic, harness-agnostic content; AskUserQuestion for structured choices.

### Dev-only `.agents/` skills and prompts

The repo carries non-production skills under `.agents/` (per CLAUDE.md) for contributor tooling. Several need v6 attention because the framework's shape changes underneath them.

| File | Action | Notes |
|---|---|---|
| `.agents/skills/pipeline-changes/references/pipeline-schema-ui.md` | **Major rewrite** | Today's content is structured around `orchestration.yml` and `state-v4.schema.json`. Under v6, the file checklists for adding config fields target `config.yml` / `install.json` / `registry.yml` instead, and the state checklists target `state-v6.schema.json`. References to `ui/lib/config-field-meta.ts` already match Wave 7's restructured metadata. Gotcha sections need updates for v6's per-machine vs versioned file split. |
| `.agents/skills/pipeline-changes/references/pipeline-internals.md` | Update | Module map adds the new `result.context` fields (`working_directories`, `file_operations`, `diff_plan`). Stages around source_control and PR creation update for the per-repo + aggregated-payload pattern. |
| `.agents/skills/pipeline-changes/references/pipeline-patterns.md` | Update | Add v6 change patterns: per-repo events, aggregated event payloads, multi-repo task handling. |
| `.agents/skills/pipeline-changes/references/pipeline-testing.md` | Update | v6 schema migration tests. Multi-repo state fixtures. New aggregated-payload event tests. |
| `.agents/skills/pipeline-changes/references/pipeline-documentation.md` | Update | Doc paths under v6 (configuration moves into Settings page guide; `orchestration.yml`-related docs retire). |
| `.agents/skills/rad-build-harness/SKILL.md` | Major rewrite | Output target changes — builds emit to `~/.radorch/runtime/harnesses/<harness>/`, NOT `.claude/` / `.github/` in repo (dogfood pattern shifts; see below). The `projects.base_path` question and patch step are removed entirely (field is gone in v6). |
| `.agents/skills/rad-create-skill/SKILL.md` | Update | Reference v6 patterns when scaffolding new skills (drop orchestration.yml mentions; reflect new design principles). |
| `.agents/skills/rad-create-agent/SKILL.md` | Update | Reference v6 patterns when scaffolding new agents (the orchestrator and brainstormer agent files are gone; document the skill-driven orchestration pattern). |
| `.agents/prompts/rad-release.prompt.md` | Update | Version-bump file list switches `installer/package.json` → `cli/package.json` (everything else stays). Step 3b's note about orchestration.yml auto-stamp updates to: `install.json`'s `package_version` is auto-stamped at build time from `cli/package.json`. |
| `.agents/prompts/rad-test-release.prompt.md` | Update | Mirror the changes in `rad-release.prompt.md` (same file-list updates, same auto-stamp note). |

### Dogfood pattern shifts to global install

- ✅ **Dev contributors install radorch globally** for development testing (`~/.radorch/`), not via the in-repo `.claude/` / `.github/` dogfood folders. Rationale: accurate fully-integrated test experience matching production users; physical files move out of the repo, reducing the chance of code changes interacting badly with project runs on the development repo.
- ✅ **`npm run build:<harness>` outputs to `~/.radorch/runtime/harnesses/<harness>/`** (not `.claude/` or `.github/`). Adapter scripts (`adapters/<harness>/adapter.js`, `scripts/build.js`, `adapters/run.js`) update target-dir resolution.
- ✅ **`.claude/` and `.github/` in the repo become obsolete artifacts** — already gitignored per CLAUDE.md; can be removed entirely once dev contributors migrate. Repo doesn't need them.
- ✅ **`rad-build-harness` skill** loses its `projects.base_path` step and its post-build YML patch step. Skill becomes simpler: ask which harness, run the npm script, report the result.

### CI workflow restructure

Per Wave 2 §7.5 lock-in plus this round:

- ✅ **Keep `.github/workflows/ci.yml`** for adapter unit tests + integration test + smoke build all harnesses (existing; minimal updates).
- ✅ **Add `.github/workflows/cli.yml`** (lands with the first Wave 2 PR) running `tsc --noEmit` + ESLint + Vitest on changes to `cli/**`. Path-filtered so unrelated PRs don't trigger it unnecessarily.
- ✅ **Pipeline-runtime tests stay in their existing CI integration** (today's setup runs them as part of build-related testing).
- ✅ **No merger into a single workflow** — separate files keep scope clear and parallel-runnable.

---

## 7.9. Wave 6 lock-ins

Decisions made during the Wave 6 brainstorm. Read alongside §7 (Wave 1), §7.5 (Wave 2), §7.6 (Wave 3), §7.7 (Wave 4), §7.8 (Wave 5).

### Tiered template set replaces `default` / `quick`

Four shipped templates, tiered by review intensity. Plan approval gate (after planning) and final approval gate (after final review) are mandatory in every tier — currently enforced by the config validator. Final review is mandatory in every tier (PR-readiness gate, human approval anchor). Tiers vary only in **defensive-review depth** between planning and final approval.

| Template | Per-task code review | Phase review | Final review | Use case |
|---|---|---|---|---|
| `extra-high.yml` | ✓ | ✓ | ✓ | Production-critical, regulated, untrusted contributors. Maximum defense in depth. |
| `high.yml` | ✓ | ✗ | ✓ | High-value work where per-task feedback matters but phase-level review is redundant given task-level coverage. |
| `medium.yml` | ✗ | ✓ | ✓ | Trusted team / well-understood scope. Skip per-task ceremony but keep phase-level cross-task audit + final. |
| `low.yml` | ✗ | ✗ | ✓ | Quick exploration, prototyping, hot fixes. Final review still gates merge. |

- ✅ Tier names communicate the cost/safety trade-off directly. The previous `default` / `quick` names were uninformative ("default" implies value judgment; "quick" hides what's missing).
- ✅ All four tiers ship together as system templates. User-authored custom templates remain supported on top of these.

### Template version migration policy

- ✅ **v1 templates (`default.yml`, `quick.yml`, `full.yml`) retire** with the v6 schema migration. All three v1 files deleted from `templates/` in the same release that ships v6. (`full.yml` was already deprecated and kept for back-compat; the four-tier replacement supersedes it.) (superseded — retired ahead of v6 by TIERED-PROCESS-TEMPLATES, see addendum below)
- ✅ **`migrate-to-v6.ts` auto-rewrites `graph.template_id`** for in-flight projects: `default` → `extra-high`, `quick` → `low`, `full` → `extra-high`. Behavior preserved for any project mid-flight at migration time. (superseded — see addendum below)
- ✅ **`default_template` config field's sentinels remap** in code: the `default` value (the sentinel resolved by `template-resolver.ts`) now resolves to `extra-high`; `quick` resolves to `low`; `full` resolves to `extra-high`. `ask` sentinel ("prompt user at planning time") still works unchanged.
- ✅ **No coexist period.** Clean cut. The release that ships v6 ships only the four tier templates.

### Addendum — tier rename shipped via TIERED-PROCESS-TEMPLATES (2026-05-08)

The tier-rename portion of this Wave 6 plan has shipped as a standalone
project ahead of the v6 schema migration. The brainstorming, requirements,
and master-plan documents for that project live in the operator's external
project workspace (under the configured `projects.base_path`) and were not
checked into this repo.

What that project delivered:

- Four tier templates (`extra-high.yml`, `high.yml`, `medium.yml`,
  `low.yml`) replace `default.yml`, `quick.yml`, and `full.yml`.
- `template-resolver.ts` config-sentinel remap (`default` →
  `extra-high`, `quick` → `low`, `full` → `extra-high`) plus the new
  hardcoded fallback (`extra-high`).
- Config validator allowlist for `default_template` updated to the four
  tier names plus `ask` plus the empty string.
- `/rad-plan` SKILL.md re-authored end-to-end with two tool-routed
  questions (tier + Project Size), `Custom` size option, tier-aware
  `(Recommended)` markers per a monotonic mapping. `/rad-plan-quick`
  retired.
- One-time dogfood-only cleanup script reconciled in-flight projects
  under the operator's configured `projects.base_path` and was `git
  rm`'d before merge — end users were not in scope for migration
  tooling.

What that project did NOT deliver (still parked in GW-06):

- Multi-repo commit/PR fan-out, two-pass PR creation, mid-flight
  workspace expansion, source-control narrative-crafting upgrade.
- v6 schema migration as a whole.

`migrate-to-v6.ts`'s historical `template_id` rewrite logic
(`default → extra-high`, `quick → low`, `full → extra-high`) is
superseded by the standalone cleanup script that has already run.
GW-06's remaining scope can drop the `template_id` rewrite line item
when v6 lands.

### DAG structure changes for multi-repo

The v2 templates stay structurally close to v1. No new node kinds, no DAG-level iteration over repos. Multi-repo fan-out for commits and PRs lives inside the CLI commands the existing nodes invoke — the agent / orchestrator dispatch surface stays single-shot per task and per project.

- ✅ **`commit_gate` keeps a single `commit` step in its true branch.** The step's action is `invoke_source_control_commit`, fired once per task regardless of repo count. The source-control agent runs `radorch git commit --project X --task-id Y` (no `--repo` flag); the CLI iterates internally over the task's `repos` array, runs git commit in each repo's worktree, returns aggregated JSON.
- ✅ **`pr_gate` keeps a single `final_pr` step in its true branch.** Same shape — one `invoke_source_control_pr` action at project end. Agent runs `radorch git pr --project X`; CLI iterates over `pipeline.source_control.by_repo`, opens one PR per repo, returns aggregated JSON.
- ✅ **`commit_gate` and `pr_gate` themselves stay project-level conditionals** (per Wave 1: `auto_commit` and `auto_pr` are project-level config). They fire once.
- ✅ **No `for_each_repo` DAG node kind** — explicitly NOT introduced. Multi-repo iteration is mechanical work; the CLI is the right home for it. Avoids spawning N source-control agents for an N-repo task (one spawn, one CLI call, internal loop).
- ✅ **Review steps (`code_review`, `phase_review`, `final_review`) stay as single-step nodes.** Multi-repo awareness handled by engine pre-resolution of `diff_plan` in `result.context` (Wave 3 §7.6). One review spawn per task / phase / project regardless of repo count.

### Result aggregation and event payloads

- ✅ **Source-control agent's `## Commit Result` block carries a per-repo results map** when the task has multiple repos:
  ```json
  { "results": { "frontend": { "committed": true, "commitHash": "abc", "pushed": true },
                 "backend":  { "committed": true, "commitHash": "def", "pushed": true } } }
  ```
  For single-repo tasks the map has one entry. Orchestrator extracts the map and signals `commit_completed` with an aggregated `--commit-hashes-json` payload (replacing today's per-repo `--commit-hash`/`--pushed` flags). Engine writes per-repo hashes into `TaskIterationEntry.commit_hashes`.
- ✅ **`## PR Result` block uses the same per-repo map shape** — entries per repo with `pr_created`, `pr_url`, `pr_number`, `pr_existed`, `error`. Orchestrator signals `pr_created` with an aggregated `--pr-urls-json` payload; engine writes per-repo URLs into `pipeline.source_control.by_repo[<repo>].pr_url`.

### Per-repo commit messages

- ✅ **Source-control agent crafts per-repo commit message bodies via LLM narrative.** Header is mechanical (`{prefix}({taskId}): {title}` — same across repos for a given task); body is per-repo, written by the agent from each repo's slice of `file_operations` + the handoff's `**Files for <repo>:**` intent text. Different code per repo → different commit body per repo.
- ✅ **Single agent spawn per task.** Spawn prompt carries structural inputs for all the task's repos: file_operations grouped by repo, intent text per repo, repo list, working_directories. Agent crafts all per-repo messages in one pass, then issues ONE CLI call: `radorch git commit --project X --task-id Y --messages-json '{...}'`.
- ✅ **CLI iterates per repo using the agent-supplied messages.** No fallback message generation in the CLI — if the agent didn't supply a message for a repo in the task's `repos` array, the CLI errors. Forces the agent to take ownership of the narrative.
- ✅ **Single-repo tasks** still go through the same shape — agent supplies one message in the map, CLI commits one repo. Uniform code path.

### Per-repo PR descriptions

- ✅ **Source-control agent crafts per-repo PR description bodies via LLM narrative.** Spawn prompt carries project planning summary (from master plan + brainstorming if present), per-repo file changes (cumulative across the project), final review verdict summary, and the list of repos with their roles in the project. Agent writes a digestible PR description per repo — shared project context + per-repo specifics — at a level appropriate for human PR review (NOT the dense audit shape of the final review doc).

- ✅ **Default PR description template** the agent fills in per repo:
  ```markdown
  # {Project Name}: {What this PR delivers in <repo>}

  ## Summary
  {2–3 sentence per-repo summary of what this PR contributes to the project.}

  ## Project Context
  {1-2 sentence intent of the broader project, drawn from master plan.}

  ## What changed in this repo
  - {file change with brief intent}
  - …

  ## Linked PRs
  {placeholder; filled in pass 2 by CLI}

  ## Testing
  {test results / acceptance criteria status}

  ## Full audit
  Final review: {link to project's final review doc}
  ```

- ✅ **Single agent spawn per project at PR time.** Agent crafts all per-repo descriptions, hands them to the CLI as a JSON map: `radorch git pr --project X --descriptions-json '{"frontend":"...","backend":"..."}'`.
- ✅ **PR description is a separate artifact from the final review doc.** Final review remains the dense audit (audit table, findings, evidence) — kept as the project record. PR description is the human-review-friendly summary, generated fresh at PR time.

### Linked PRs (two-pass creation)

GitHub doesn't have a true cross-repo PR linking feature, but cross-references in PR bodies are auto-rendered as clickable links with status badges. The CLI handles this via two-pass creation:

- ✅ **Pass 1**: For each repo, CLI runs `gh pr create` with the agent-supplied description body (containing a placeholder where the Linked PRs section will go). Captures each PR's URL.
- ✅ **Pass 2**: CLI collects all PR URLs from pass 1. For each repo's PR, calls `gh pr edit --body <updated>` substituting the placeholder with the actual sibling PR URLs.
- ✅ **Failure recovery**: if pass 1 succeeds but pass 2 fails for some repo's update, the PRs still exist with the placeholder text intact. User can re-run `radorch git pr` (idempotent — detects existing PRs and re-runs only pass 2) to retry the link-update.
- ✅ **No tracking issue for v1.** Cross-references in PR bodies are sufficient for typical workflows. Tracking-issue creation is parked as potential future work if real demand surfaces.

### Failure handling and recovery

- ✅ **Per-repo commits are independent.** Commit failure (commit didn't happen) → engine treats as task failure; pipeline halts with a clear message naming the failed repo. Push failure (commit succeeded, push didn't) → state records `pushed: false` for that repo; pipeline continues. Same as today's single-repo behavior, just per-repo'd.
- ✅ **Idempotent re-run of `radorch git commit`** skips repos that already committed for this task; retries the rest.
- ✅ **PR creation partial failure**: pass-1 partial failure leaves some PRs created; idempotent re-run skips existing and retries missing. Pass-2 partial failure leaves placeholder text in some PRs; re-run retries pass-2 only. *Pass-2 idempotence detection is an implementation detail* — the CLI needs either a placeholder-text grep against each PR's body (cheap, fragile against user edits) or a small state-tracking field per PR in `pipeline.source_control.by_repo[<repo>]` (more robust). Pick one in Wave 6 implementation.
- ✅ **Final review doc shape stays unchanged under v6.** It remains the dense audit artifact (audit table, findings, evidence, exit criteria) — intentionally thorough, the project's official record. PR descriptions are a separate, more digestible artifact crafted by the source-control agent at PR time. The two artifacts serve different audiences and don't replace each other.
- ✅ **Source-control agent model bumps from `haiku` to `sonnet`** given its expanded narrative-crafting role (commit message bodies + PR descriptions). Model change lands in the Wave 5/6 PR that rewrites the agent's skill markdown.

### Mid-flight workspace expansion — halt with clear message

- ✅ **Detect at `/rad-execute` invocation start.** Specifically at the start of each `/rad-execute` skill invocation (not at every engine event, not during `/rad-plan` or `/rad-brainstorm`), the skill compares the project's target workspace's current member list (from `registry.yml`) against the project's operational repo set (`pipeline.source_control.by_repo` keys). If the workspace has gained repos the project doesn't know about, `/rad-execute` halts before signaling any pipeline event.
- ✅ **Halt is explicit and actionable.** Halt message: *"Workspace `<NAME>` has gained the repo(s) `<NEW_REPOS>` since this project's master plan was approved. The new repo(s) will not be incorporated mid-flight. Either start a new project to include them, or run a follow-up project iteration after this one completes to reconcile."*
- ✅ **No automatic incorporation.** The project's master plan and task assignments are locked at planning time; the system never retroactively expands scope. Preserves planner authority, avoids surprise expansions.
- ✅ **Resumption requires user choice.** User either: (a) abandons the project and starts a new one with the expanded workspace, or (b) accepts the halt as a non-fatal detection and explicitly reverts (e.g., removes the new repo from the workspace temporarily) — the system itself does not auto-resolve.

### Wave 6 implementation surface

Wave 6's actual code work, summarized:

- Author `templates/extra-high.yml`, `high.yml`, `medium.yml`, `low.yml` — derived from current `default.yml` and `quick.yml` with the tier-specific review steps included or omitted. **This is not a pure subset operation**: dropping a review step requires rewiring `depends_on` chains downstream (e.g., `task_gate.depends_on: [code_review]` breaks when `code_review` is dropped from the `medium` and `low` tiers — its dependency must collapse to whatever now precedes the gate). Each tier's DAG needs an explicit dependency-graph audit, not a mechanical line deletion.
- Update `radorch git commit` to accept `--messages-json` (per-repo messages map). CLI iterates over the task's `repos` and runs git commit in each worktree using the supplied messages. Errors if a repo is missing a message.
- Update `radorch git pr` to accept `--descriptions-json` (per-repo descriptions map). CLI does two-pass creation: pass 1 opens PRs with agent-supplied descriptions (containing the Linked PRs placeholder); pass 2 updates each PR's body to substitute the placeholder with sibling URLs. Idempotent on re-runs (skips already-created PRs in pass 1; updates existing in pass 2).
- Update the source-control agent skill markdown for narrative-crafting role expansion: instructions for crafting per-repo commit message bodies (from file_operations + handoff intent) and per-repo PR descriptions (from master plan + final review summary + per-repo file changes); emit aggregated `## Commit Result` / `## PR Result` blocks.
- Update mutations and event handlers for `commit_completed` and `pr_created` to accept the aggregated `--commit-hashes-json` / `--pr-urls-json` payloads and write per-repo into state.
- Update `template-resolver.ts` sentinel mappings (`default` → `extra-high`, `quick` → `low`).
- Update `migrate-to-v6.ts` to rewrite `graph.template_id` for in-flight projects.
- Add workspace-expansion detection at engine startup (or as a startup validation step in `/rad-execute`'s skill flow).
- Update reviewer skills (`rad-code-review`, plus any phase/final variants) to consume `diff_plan` per Wave 5 §7.8 (may have already landed alongside Wave 5 PRs).
- Delete `templates/default.yml`, `templates/quick.yml`, and `templates/full.yml` after migration tooling proves green.

---

## 7.10. Wave 7 lock-ins

Decisions made during the Wave 7 brainstorm. Read alongside §7 (Wave 1), §7.5 (Wave 2), §7.6 (Wave 3), §7.7 (Wave 4), §7.8 (Wave 5), §7.9 (Wave 6).

### Path discovery and storage layout

- ✅ **UI reads `RADORCH_HOME` env var** (default `~/.radorch/`) — mirrors CLI's discovery exactly. Drops today's `WORKSPACE_ROOT` and `ORCH_ROOT` env vars entirely.
- ✅ **Project tree at `~/.radorch/projects/`** is the only thing the UI watches.
- ✅ **Registry merge at read time**: UI reads `~/.radorch/registry.yml` (versioned, abstract identity) and `~/.radorch/config.yml` (per-machine, paths) and merges them in-memory the same way the CLI does. No bespoke UI-side data layer.
- ✅ **`ui/.env.local` generation is dropped** from the installer — replaced by `RADORCH_HOME` discovery.

### Run model — per-invocation with port management

- ✅ **Per-invocation, NOT a daemon.** User starts the UI when needed; stops when done. No auto-start on login, no system tray, no system service.
- ✅ **CLI commands**: `radorch dashboard start [--port <N>] [--no-open]` and `radorch dashboard stop`. Each writes/reads a `~/.radorch/dashboard.pid` file to track its own process.
- ✅ **`radorch dashboard start` opens the browser by default** at the configured port after the server is ready. Cross-platform launch (macOS `open`, Windows `start`, Linux `xdg-open`). `--no-open` flag skips the browser launch (useful for headless / CI scenarios). Per the program-wide principle (§2), the browser-launch logic lives in the CLI; skills are thin invokers.
- ✅ **Skills for both**: `/rad-ui-start` and `/rad-ui-stop` — thin markdown wrappers around the CLI commands (one-line invocation each). Lets users start/stop from inside their harness without leaving for a terminal. Skill does NOT contain browser-launch logic — just calls the CLI; the CLI handles everything.
- ✅ **Port-collision handling on start**: if the requested port is already occupied by a previous `radorch dashboard` process (PID file matches a live process owning the port), `radorch dashboard start` kills the old instance and restarts cleanly. If occupied by a different process, fails with a clear error suggesting `--port <N>` override.
- ✅ **Default port**: a non-mainstream port to avoid common-dev-tool collisions (3000 / 5173 / 8080 are heavily used). Recommended `7373` or similar; final pick is an implementation detail. Override via `--port`.
- ✅ **`radorch dashboard stop`** reads the PID file, kills the process, removes the PID file. No-op if no PID file present. Browser stays open (user closes the tab themselves; nothing to kill server-side).

### UI ↔ CLI interaction — read-only data; lifecycle buttons

- ✅ **UI is read-only for state.** Never edits `state.json`, planning docs, or `registry.yml` directly. Renders current state via filesystem reads + chokidar updates.
- ✅ **DAG / project-detail view gains action buttons** for project lifecycle:
  - **Archive button**: triggers `radorch project archive <NAME>` after a UI-side confirmation modal. Same pre-flight semantics as the CLI (warns if project not completed).
  - **Cleanup button**: triggers `radorch project cleanup <NAME>` after a UI-side confirmation modal. Same pre-flight semantics as the CLI (warns on uncommitted changes / unmerged branches).
- ✅ **Confirmation modals are mandatory** for both buttons. Use the UI's existing modal pattern; surface the CLI's pre-flight warnings (uncommitted changes, branches not yet merged, etc.) in the modal text.
- ✅ **Other UI-invokable CLI commands** (status refresh, repo management, etc.) can be added incrementally as the read path stabilizes. No v1 commitment.
- ✅ **Auth/permissions**: UI runs as the local user; same filesystem access as the CLI. No additional auth layer for v1. Destructive ops gated by explicit UI confirmation only.

### Active vs. archived projects

- ✅ **Two-tab project list**: "Active" (default landing tab) and "Archived". Both populations easy to access, neither cluttered.
- ✅ **Active tab**: chokidar-driven real-time updates. Lists projects directly under `~/.radorch/projects/` (excluding `_archive/`).
- ✅ **chokidar EXPLICITLY excludes `~/.radorch/projects/_archive/`** from its watch set. Archived projects don't change unless re-archived or restored — real-time watching is wasted effort and a performance hog as `_archive/` accumulates over time.
- ✅ **Archived tab**: reads on-demand when the user clicks the tab. Manual refresh button to re-read. No real-time updates.
- ✅ **`_archive/` NEVER appears in the active project list.** Today's UI surfaces `_archive/` as a project (regression to fix in the Wave 7 rewrite).

### Multi-repo display in project detail

- ✅ **Project detail page shows target context**: workspace name + member repos (or single-repo target). Pulled from `state.project.target`.
- ✅ **Per-repo source-control rendering uses the existing `SourceControlSection` component**, stacked vertically — one card per entry in `pipeline.source_control.by_repo`. Each card shows that repo's branch (linked to compare URL), PR link with status, auto-commit/auto-pr badges. Single-repo projects render one card (identical to today's UX).
- ✅ **Compare URL is available per repo from `source_control_init` onward** — useful pre-PR for surfacing in-progress work.
- ✅ **Linked-PRs cross-references** rendered as a small link or popover within each repo's `SourceControlSection` card — surfaces sibling PR URLs without interactive cross-highlighting.
- ✅ **Commit links on task nodes** — single-repo tasks render inline today's exact UX (`Commit: abc1234 ↗`). Multi-repo tasks render a dropdown trigger (`Commits (N) ▾`) that reveals per-repo commit links labeled with repo name (`frontend: abc1234 ↗`, `backend: def5678 ↗`). Same pattern applies to corrective task commits (per Wave 4 §7.7, correctives inherit `repos` from parent).
- ✅ **DAG node detail panels are multi-repo aware**: commit nodes show per-repo hashes, PR nodes show per-repo URLs+status, review nodes show per-repo diff summaries (from `diff_plan`). Single-repo nodes render today's shape.
- ✅ **Per-repo diff display deferred for v1.** Users click PR / compare links for GitHub's native diff view (more capable anyway).

### Settings page (replaces gear-icon slide-out)

- ✅ **Gear icon retained as entry point** to a new `/settings` page. The previous slide-out panel (`config-editor-panel.tsx`) is removed; gear icon now navigates rather than opening a sheet.
- ✅ **Gear icon visible on every view.** Today it only renders on the projects view (regression to fix). Lives in `app-header.tsx` and persists across `/projects`, `/process-editor`, and `/settings`.
- ✅ **`/settings` page at `ui/app/settings/page.tsx`**, mirroring `/process-editor`'s structure (own layout, no project context). UI is fully editable for the system — write paths route through `radorch` CLI subprocesses.
- ✅ **Four tabs**: Preferences | Repos | Workspaces | About.
  - **Preferences**: form-shaped; single Save button at the bottom; reuses `config-form.tsx`, `config-field-row.tsx`, `config-section.tsx`.
  - **Repos**: collection view; per-row Edit / Remove (modals); top-level "Add Repo" button (modal-with-save).
  - **Workspaces**: same pattern as Repos.
  - **About**: read-only display from `install.json` (package_version, install_date, harnesses installed).
- ✅ **Tabs primitive added** at `ui/components/ui/tabs.tsx` (shadcn-style; no Tabs primitive exists today).
- ✅ **All UI writes go through `radorch` CLI subprocesses** via API routes — extends the existing pattern in `launch-claude-project-invoke.ts`. UI never directly mutates `~/.radorch/registry.yml` or `config.yml`. Single source of truth for write logic; UI mistakes can't corrupt files in ways the CLI couldn't.
- ✅ **`CONFIG_FIELDS` metadata in `lib/config-field-meta.ts` restructured for v6**: drop dead fields (`system.orch_root`, `projects.base_path`, `projects.naming`, `source_control.provider`); remove hard-coded mandatory gates from the editable surface; regroup to match Settings tabs.

### Active harness chip (header)

- ✅ **New component** `ui/components/layout/active-harness-chip.tsx`. Renders in `app-header.tsx` right side alongside theme toggle and SSE connection indicator.
- ✅ **Displays current active harness** (read from `~/.radorch/.harness`). Click → dropdown with claude / copilot-vscode / copilot-cli (Wave 1 lock-in). Selection invokes `radorch harness use <name>` via API route.
- ✅ **Visible on every view** alongside the gear icon.

### Wave 7 implementation surface

- Refactor `ui/lib/path-resolver.ts` and `ui/lib/fs-reader.ts` to discover via `RADORCH_HOME` instead of `WORKSPACE_ROOT` / `ORCH_ROOT`.
- Add `radorch dashboard start [--port <N>] [--no-open]` and `radorch dashboard stop` CLI commands. Implement PID file management, port-collision detection, and cross-platform browser launching (default-on; `--no-open` skips).
- Add `/rad-ui-start` and `/rad-ui-stop` skills as thin CLI wrappers — one-line invocation each, no browser logic in the skill markdown.
- Update chokidar configuration in `ui/app/api/events/route.ts` to exclude `_archive/`.
- Add "Active" / "Archived" tabs to the project list page; archived tab uses on-demand reads.
- Add Archive and Cleanup buttons to the DAG / project-detail view with confirmation modals; route to the corresponding `radorch project ...` commands via API routes.
- Refactor project detail page to render per-repo data (branches, PRs, status badges) by mapping over `pipeline.source_control.by_repo` and rendering one `SourceControlSection` per entry.
- Add per-repo commit link rendering on DAG task nodes: inline for single-repo, dropdown for multi-repo. Affects `dag-node-row.tsx`, `task-card.tsx`, and related components.
- Add `Tabs` primitive at `ui/components/ui/tabs.tsx`.
- Build new `/settings` page at `ui/app/settings/page.tsx` with four tabs (Preferences / Repos / Workspaces / About).
- Move gear icon from projects-view-only to global header (always rendered in `app-header.tsx`); update click handler to navigate to `/settings` rather than opening a sheet.
- Delete `ui/components/config/config-editor-panel.tsx`; repurpose `config-form.tsx`, `config-field-row.tsx`, `config-section.tsx` for the Settings Preferences tab.
- Build `ui/components/layout/active-harness-chip.tsx` for the header.
- Restructure `CONFIG_FIELDS` in `lib/config-field-meta.ts` for v6 (drop dead fields, regroup).
- Add API routes invoking `radorch` CLI commands for write paths (config set, repo add/update/remove, workspace create/update/remove, harness use, project cleanup, project archive). Pattern extends `launch-claude-project-invoke.ts`.
- Drop `ui/.env.local` generation from `installer/lib/env-generator.js`.

---

## 8. Risks and watchouts

- **Coder's self-contained handoff rule is teeth, not aspiration.** Anything multi-repo needs the Coder to know must be inlined in the handoff. Wave 3 + Wave 4 must respect this hard contract.
- **`pipeline.source_control` shape change is the deepest part of the refactor.** v6 migration will touch `mutations.ts`, the validator, the schema, every test fixture, and the UI. Plan capacity accordingly.
- **`gather-context.js` is duplicated and uses a hand-rolled flat-only YAML parser.** Moving this into `radorch context` requires upgrading to `js-yaml` (which the engine already uses). Both copies retire when `radorch context` ships.
- **DAG template's `state_ref` paths are stable for `auto_commit`/`auto_pr`** because we kept those at the project level. If we'd moved them per-repo, every conditional in `default.yml` would need redesign. Watch for this trap if scope creeps.
- **Distribution: `npm install -g radorch` requires Node on PATH.** Not a regression — today's installer is also Node-based. But if we later want to ship a binary (e.g., `pkg`-compiled), that's a separate effort.
- **`pipeline.js` JIT-installs `node_modules` into the install root** (lines 37-76). Under global install, this happens once at `~/.radorch/runtime/`, not per-repo. Verify the install path resolution doesn't drift.
- **Versioned `state.json` means high-churn commits during active execution.** Diff noise is a real cost — tasks complete frequently, mutations land often. The trade-off is intentional (project portability across machines / cloud), but worth flagging that teams will see noisy commit history on `state.json`. UI commit-coalescing or a `.gitattributes` merge strategy might be useful future polish, but not Wave 1.
- **Absolute paths in versioned files were the original cross-cutting concern, now resolved by structural choices.** (a) `registry.yml` carries no paths — abstract identity only, with per-machine paths overlaid from `config.yml` (Wave 1 revision). (b) `state.json` stores no absolute paths — worktree paths are derived from `${RADORCH_HOME}/worktrees/<PROJECT>/<REPO>/` at read time (Wave 3 §7.6); doc paths are already relative. The substitution-syntax approach originally planned for Wave 5 is no longer needed.
- **Harness asset placement is harness-specific.** Each harness has its own discovery rules — Claude Code reads from `~/.claude/` (user-scoped) and per-repo `.claude/`; Copilot VS Code and Copilot CLI use different conventions. Shipping all three by default means the installer has to write each bundle to the location its harness will find. Mechanism (copy vs. symlink, global vs. per-repo for each harness) is an open question parked for Wave 5.
- **Cross-machine registry paths.** The registry stores local absolute paths that differ across machines. If users version-control `~/.radorch/`, registry diffs will be noisy. Wave 5 needs an answer (env-var substitution, per-machine overlay, or accept the friction).
- **Per-skill testing patterns assume script files exist.** Wave 5 migration includes test rework — many tests today mock `execFileSync` against specific script paths. Consolidation changes the mock surface.
- **CLI cold-start time matters under skill invocation.** Skills in Wave 5 will shell out to `radorch` frequently inside agent loops; every command invocation pays a Node startup + module-resolution cost. Wave 2's "ship multi-file `dist/`" choice keeps the build simple but means more `require()` overhead per invocation. Worth measuring cold-start once the first POC commands land in Wave 2 — if it's painful, bundling (esbuild single-file output) is the escalation path.

---

## 9. Open questions parked for later waves

These came up in the Wave 1 conversation but are not Wave 1 decisions:

1. ~~**CLI command framework**~~ — RESOLVED in §7.5: commander.js with a typed `CommandDef` wrapper.
2. **Templates overlay model** — system + user templates with overlay precedence (Wave 2).
3. ~~**Exact portable-path substitution mechanism**~~ — RESOLVED. No substitution syntax is needed. Per the Wave 1 revision, `registry.yml` carries only abstract identity (no paths); per-machine paths live in `config.yml`. State.json worktree paths are derived (Wave 3 §7.6), not stored. Versioned files have no absolute paths to substitute.
4. ~~**Exact `pipeline.source_control` per-repo shape** in v6~~ — RESOLVED in §7.6: map keyed by repo name (`by_repo`).
5. ~~**Whether a task can touch multiple repos** or strictly one~~ — RESOLVED in §7.6: primarily single-repo per task; multi-repo permitted for tightly-coupled work (e.g., a new API contract requiring both the route and its typed client at once). Handoff frontmatter is always `repos: string[]` regardless.
6. ~~**`source_control_init` event evolution**~~ — RESOLVED in §7.6: per-repo engine event + CLI convenience wrapper.
7. ~~**DAG behavior when a project's workspace gains a new repo mid-flight**~~ — RESOLVED in §7.9: detect at execution start, halt with clear message; user starts a new project or runs a follow-up iteration to reconcile. No automatic incorporation.
8. ~~**UI run model**~~ — RESOLVED in §7.10: per-invocation with port-collision handling, `radorch dashboard start/stop` commands, matching skills.
9. ~~**Validation strictness for task `repos:` field**~~ — RESOLVED in §7.7: layered validation (explosion script validates each repo against the project's available repos; engine validates each `TaskIterationEntry.repos` element against the registry; source-control agent fails fast at runtime if any worktree path doesn't exist).
10. **Old install retirement UX** — what `radorch` does when it sees a `<repo>/.claude/` install (Wave 8).
11. **Harness asset placement mechanism** — copy vs. symlink, and the exact discovery location per harness for global install. Need to verify Claude Code's `~/.claude/` precedence over repo `.claude/`, Copilot VS Code's discovery behavior, and Copilot CLI's config location (Wave 5).
12. **`radorch harness use` semantics** — does switching active harness only affect CLI behavior (e.g., `radorch harness launch`), or does it also rewrite/reactivate harness assets (e.g., toggle which `~/.claude/agents/` symlink is live)? Depends on §9.11 (Wave 5).
13. **v5 → v6 migration: how single-repo v5 projects map their existing `pipeline.source_control` into v6's `by_repo` map.** What name keys the single entry? Options: infer from registry by matching `remote_url`; prompt the user during migration; use a sentinel name. Affects `migrate-to-v6.ts` design (Wave 8).

---

## 10. Per-wave brainstorming model

Per-wave lock-ins are captured **in this doc** as new sections (§7 = Wave 1, §7.5 = Wave 2, etc.). No separate per-wave BRAINSTORMING.md files. This keeps a single source of truth and avoids the doc-discovery problem of "which file holds the latest call on X?"

Each wave's section references back to prior-wave constraints and resolves the relevant items from §9 (open questions). Resolved items in §9 are crossed out with a pointer to the section that resolved them, preserving the audit trail.

This document is the program-level source of truth. Update it when material decisions in any wave invalidate or refine an earlier wave's lock-in; otherwise the latest-numbered section's lock-ins govern.

---

## 11. Execution sequencing

The architecture across §7.1–§7.10 is dependency-ordered but not strictly sequential. Several waves can run in parallel.

### Dependency graph

```
Wave 1 (vocabulary, disk layout, CLI architecture)  ← foundation; complete
   │
   ├── Wave 2 (radorch CLI scaffolding)
   │      └── Wave 5 (skill migration to radorch CLI)
   │
   ├── Wave 3 (state schema v6)
   │      ├── Wave 4 (handoff contract)
   │      └── Wave 6 (DAG + tiered templates)
   │
   └── Wave 7 (UI registry-aware)

Wave 8 (migration story + publish/release pipeline)  ← convergence; needs 3/5/6/7 mostly done
Wave 9 (pipeline fold-in)  ← deferred; future program
```

### Phased rollout

**Phase A — parallel foundation.** No dependencies between these; can start simultaneously:
- Wave 2 — CLI scaffolding, framework, shared lib, first POC commands
- Wave 3 — schema v6 types, JSON schema, `migrate-to-v6.ts`, mutations.ts + validator updates
- Wave 7 — UI refactor for `RADORCH_HOME` discovery, Settings page, Active/Archived tabs (only needs Wave 1's storage layout)

**Phase B — building on the foundation.** Each blocks on Phase A items as noted:
- Wave 4 (handoff contract) — needs Wave 3 schema stable
- Wave 5 (skill migration) — needs Wave 2 CLI commands ready; staged migration in tiers (per §7.8 bottom-up tiers)
- Wave 6 (DAG + tiered templates) — needs Wave 3; can start mid-Wave-5 once schema lands
- `.agents/` skill updates and dev-only tooling rewrites land alongside the relevant Wave 5 PRs

**Phase C — convergence.**
- Wave 8 — `radorch install` migration UX, publish workflow flip from `installer/` to `cli/`, UI bundling via Next.js standalone

### Critical path

The longest chain: **Wave 3 → Wave 4 → Wave 5 (skill migration tier 5: skill rewrites)**. Wave 5 has the most PR surface (every skill + agent updated, ~20 file groups touched) — expect the longest elapsed time.

Wave 7 runs in parallel with the critical path; no risk of blocking it.

### Risk hotspots

- **Wave 3 schema migration**: breaks every state-shaped test fixture across the codebase. `migrate-to-v6.ts` and updated test helpers need to land in the *first* Wave 3 PR before downstream waves can rely on v6 shapes.
- **Wave 5 dogfood pattern shift**: dev contributors moving from in-repo `.claude/`/`.github/` to global install (`~/.radorch/runtime/`) introduces onboarding friction mid-program. Consider a transition window where both patterns work.
- **Wave 5 PR sprawl**: ~20 skill/agent files updated, plus tests rewired. The bottom-up tier ordering keeps individual PRs small but the wave's elapsed time will be substantial.
- **Wave 8 UI publishing**: Next.js standalone build is mostly mechanical, but the `radorch install` copy logic from `<global-node_modules>/radorch/dist/runtime/` to `~/.radorch/runtime/` is new code that the entire user-facing UX depends on. Land this with extensive integration tests.
- **Wave 8 cross-machine state portability**: versioned `state.json` (Wave 1 lock-in) sees its first real test under Wave 8's dev2-picks-up-dev1's-project flow. Edge cases likely surface here.

### Per-wave project spawn order (for the project series)

Recommended order to spawn per-wave brainstorming → planning → execution projects:

1. Wave 2 + Wave 3 (parallel)
2. Wave 7 (in parallel with #1, lower priority)
3. Wave 4 (after Wave 3)
4. Wave 5 (in tiers, after Wave 2; can overlap Wave 4 closing)
5. Wave 6 (after Wave 3, ideally with Wave 5 mostly stable)
6. Wave 8 (last; convergence)

Each per-wave project's BRAINSTORMING.md derives from this doc's §7.x lock-ins (constraints) and the relevant entries from §9 open questions (still to resolve at brainstorm time). Plus §12 below — gap considerations surfaced by comprehensive code review, organized by wave.

---

## 12. Gap considerations (from comprehensive code-reality review)

These are findings from a deep gap-and-reality review of the doc against the actual codebase. They're not blocking the program plan but **should be picked up when each wave's per-wave brainstorming happens** — they identify code areas, edge cases, or concerns the wave-by-wave lock-ins didn't enumerate.

### Cross-cutting (any wave; address as appropriate)

- **Concurrency policy**: no project-level lockfile spec today. Edge cases: two `/rad-execute` invocations against same project; UI Archive/Cleanup button while CLI is running; two skills issuing `radorch git commit` against different worktrees of the same repo.
- **Environment variable inventory beyond `RADORCH_HOME`**: `CHOKIDAR_USEPOLLING` (Docker / WSL), `EDITOR` (used by `gh pr create` interactive), `GH_TOKEN` / `GITHUB_TOKEN` (alternate auth), `NO_COLOR`, `npm_config_*` (corporate registries affecting `pipeline.js` JIT install).
- **Windows MAX_PATH risk** under nested `~/.radorch/runtime/harnesses/<h>/skills/rad-orchestration/scripts/node_modules/...`. Already a problem on long-pathed repos today; gets worse under global install.
- **`gh` auth scope** per-host (github.com vs. enterprise) — `gh auth status` is per-host; multi-repo doesn't account for repos targeting different GitHub hosts.
- **Internationalization / locale**: project names ASCII-only (implicit, not stated); commit/PR bodies may contain non-ASCII (LLM-crafted); Windows path-separator and codepage behavior with non-ASCII paths.
- **File permissions / umask**: who chmods worktree directories? Cross-process readability if UI runs under a different uid (Docker scenarios).
- **Logging flow**: `rad-log-error` mentioned in Wave 5 inventory but log-file path under v6 (`~/.radorch/projects/<NAME>/errors.md`?) and write ownership (skill / orchestrator / `radorch log-error` CLI?) not locked.

### Wave 2 considerations (CLI scaffolding)

- **`installer/lib/{cross-harness-scan, hash-check, catalog, manifest, installed-version, remove}.js`** — manifest-aware install/upgrade machinery shipping per-version manifests at `installer/src/<harness>/manifests/v*.json`. Today's installer detects user-modified files via SHA-256 and surgically removes orphans on uninstall. The plan doesn't say how this survives in `cli/`. Either fold into `radorch install` / `radorch update` / `radorch uninstall`, or design a replacement. **Biggest blind spot in the plan.**
- **`radorch uninstall` symmetric story not specified**: remove harness assets, remove `~/.radorch/runtime/`, leave `projects/` intact for archival? Currently undocumented.
- **`setup-hooks.js` and `.githooks/pre-commit`**: today's hook only `tsc --noEmit` on `skills/rad-orchestration/scripts/`. Wave 2 adds `cli/`-package hook. Two hook scripts? One that handles both? Where does `setup-hooks.js` live under v6 (it's currently inside `skills/rad-orchestration/scripts/`)?

### Wave 3 considerations (state schema v6)

- **`migrate-to-v6.ts` is NOT a pure data transform** like `migrate-to-v5.ts` was. It needs registry-binding (lookup by `remote_url` match against `~/.radorch/registry.yml`, fallback to user prompt) to bind the v5 single `source_control` into v6's `by_repo` map. Order-of-operations matters: install global → import existing project → run migrate. The plan's "mirrors `migrate-to-v5.ts` precedent" elides this.
- **`orchRoot` derivation is positional** — `lib/orch-root.ts` and `pipeline.js` derive it from the directory name three/four levels above the script. Under `~/.radorch/runtime/harnesses/<harness>/skills/rad-orchestration/scripts/`, the detected `orchRoot` becomes the harness folder name (`claude` / `copilot-vscode` / `copilot-cli`), not the install-root. Migration story needed; possibly switch to reading `RADORCH_HOME` directly.

### Wave 5 considerations (skill migration)

- **`skills/rad-orchestration/validate/`** — entire 7-category orchestration validator harness (`validate-orchestration.js`, `lib/checks/{structure,agents,skills,config,instructions,prompts,cross-refs}.js`, `__tests__/`, own `package.json`). The `config` check today validates `orchestration.yml` shape — every field is dropped under v6. Either fold into `radorch doctor` or retire explicitly. Plan never mentions it.
- **`tests/scripts/`** — 9 cross-cutting tests at repo level. `test-pipeline-source-skill-refs.test.mjs`, `test-prose-skill-refs.test.mjs`, `test-agent-skill-refs.test.mjs` cross-reference skills and agents — the retirements (`rad-execute-parallel`, `rad-approve-plan`, `rad-configure-system`, `rad-plan-quick`, `brainstormer.md`, `orchestrator.md`) will break these unless updated in lockstep. `test-claude-md-reserved-namespace.test.mjs` may need v6 path updates.
- **UI test infrastructure** (`fs-reader-bootstrap.test.ts`, `fs-reader-config-rw.test.ts`, etc., ~7 files) — today validates `ORCH_ROOT` env-var bootstrap behavior. Substantial rewrite under `RADORCH_HOME` discovery, not deletion.
- **Config validator dependency on dropped fields**: `installer/lib/wizard.js`, `installer/lib/prompts/{orch-root, project-storage, source-control}.js`, and `validate/lib/checks/config.js` all validate fields the plan drops. Cleanup needed when those skills retire.

### Wave 6 considerations (DAG + tiered templates)

- **Multi-repo `gh pr create`** works fine when each call sets cwd to the right worktree, but `gh auth status` is per-host: if registered repos point to different GitHub hosts (github.com vs. enterprise), the per-host auth check needs explicit handling.
- **`prompt-tests/`** is deeper than the plan acknowledges. `plan-pipeline-e2e/` and `quick-pipeline-e2e/` reference `default.yml` / `quick.yml` by name. Folder names will be misleading after the rename — likely become `extra-high-pipeline-e2e` / `low-pipeline-e2e`, plus new behaviors for `high` and `medium`. `_runner.md` and `user-instructions.md` reference `WORKSPACE_ROOT` / `ORCH_ROOT` — need rewrite. Operator-committed baselines may need re-baselining post-v6.

### Wave 7 considerations (UI)

- **UI's `composePrompt` for `start-planning`** sends `/rad-plan ${projectName}`. Under Wave 5, `/rad-plan` requires AskUserQuestion target binding — but the user clicked a UI button without that context. The handoff between UI button → harness skill needs design (the UI may need to surface workspace/repo selection BEFORE composing the prompt).
- **chokidar `_archive/` exclusion regex form**: today's `IGNORED_PROJECT_DIR_RE` is a path-segment regex matching `/node_modules/`, etc. Adding `_archive/` requires the same `[\\/]_archive[\\/]` form — a string glob like `**/_archive/**` won't pre-empt directory-recursion the same way.
- **Cross-platform browser launch is harder than the lock-in suggests**: Windows `start` has known quoting hazards with `&` in URLs. `launch-claude.js` already pays this engineering tax (uses `wt.exe` with Base64 `-EncodedCommand`). The Wave 7 lock-in's "macOS `open`, Windows `start`, Linux `xdg-open`" understates the engineering.
- **`installer/lib/docker-generator.js` and Docker UI flow** — generates `docker-compose.yml` with `WORKSPACE_ROOT` / `ORCH_ROOT` / `PROJECTS_DIR` env vars and a Node container. Wave 7 drops those env vars but doesn't address Docker. Needs explicit decision: drop / preserve / rewrite. `installer/lib/path-utils.js:toDockerPath` would move/retire alongside.

### Wave 8 considerations (migration + publish)

- **Harness asset placement (§9-11)** is currently parked but **blocks Wave 8 migration UX authoring**. Once `radorch install` ships harness assets to `~/.radorch/runtime/harnesses/claude/`, how does Claude Code see them? Symlink to `~/.claude/`? Copy? Both? Copilot VS Code reads `<repo>/.github/skills/` — how do those locations get populated under global install? **Resolve before Wave 8 starts.**
- **In-flight migration state matrix** — a v5 project at migration time can be in any of: mid-planning, mid-execution-pre-commit, mid-corrective-cycle, awaiting plan-approval-gate, awaiting final-approval-gate. Each has different implications for worktree migration, source_control mapping, gate state preservation, PR-existence handling. None enumerated.
- **Existing PR descriptions** lack the `## Linked PRs` placeholder for pass-2 substitution. After migration, the user's `radorch git pr` re-run finds existing PRs without the placeholder — pass-2 behavior at this seam is undefined.
- **Worktree-state migration**: old v5 worktrees at non-canonical paths (`<repo>/.worktrees/...` or sibling) with possibly uncommitted work. "Old install dirs left alone" doesn't address worktree contents.
- **`docs/` user-facing rewrite** — ~8 files (getting-started, configuration, dashboard, harnesses, agents, skills, pipeline, project-structure) describe the per-repo install model and `orchestration.yml`. Wave 8 release should enumerate them.
- **`docs/internals/{scripts.md, system-architecture.md, validation.md}`** — internal docs mirroring the structure the refactor breaks.
- **CLAUDE.md, AGENTS.md (top-level)** — encode the canonical-vs-runtime rule. Under v6, the runtime location changes; both files need updates.
- **`assets/dashboard-screenshot.png`** — captured against current UI; Wave 7's rewrite (Active/Archived tabs, Settings page, header chip) dates it. Release-checklist deliverable.
- **CHANGELOG.md** — release flow appends per-version sections; mentioned by `rad-release.prompt.md` but not by the plan.
- **`installer/scripts/sync-source.js` evolution** — current sync-source generates per-version manifests AND copies UI source. Under Wave 8's "Next.js standalone bundled inside `radorch`," does sync-source produce the standalone bundle or invoke `next build` on `ui/`? Build-time dependency graph between `ui/` and `cli/` packages not specified.

### Out of scope (flag-and-confirm)

- **`archive/` folder** at repo root — historical canonical material; likely irrelevant. Confirm out-of-scope.
- **`archive/schemas/`** — old state schemas (v3, v4); a v3 project would skip an intermediate hop in v6 migration. Confirm out-of-scope (or one sentence noting v3 not supported).

---

## 13. Addendum — Plugin-native delivery pivot (2026-05-08)

This section captures an architectural pivot that emerged from brainstorming for what was previously planned as a small follow-on to iter 01. The pivot is significant enough to reshape several waves below; rather than rewrite §1–§12, this addendum overlays the changes and links to the iteration's full brainstorm for the underlying reasoning.

**Iteration brainstorm (canonical reasoning):** [`GLOBAL-WORKSPACES-1.1-CLAUDE-PLUGIN-BRAINSTORMING.md`](../../../../../orchestration-projects/GLOBAL-WORKSPACES-1.1-CLAUDE-PLUGIN/GLOBAL-WORKSPACES-1.1-CLAUDE-PLUGIN-BRAINSTORMING.md) — read this for the full context behind every decision below.

### Summary of the pivot

Replace the custom `radorch install` CLI command with a Claude Code plugin that ships everything pre-built — bundled CLI (esbuild → single `.mjs`), bundled pipeline runtime (esbuild → single `.js`), Next.js standalone UI, skills, hooks. User installs once via `/plugin install rad-orchestration@rad-orchestration-marketplace` from `MetalHexx/RadOrchestration`. State at canonical `~/.radorch/`, code in plugin cache. No two-step install. No `npm install -g`. No system PATH manipulation. The `~/.radorch/.harness` file and `radorch harness use` command are removed — plugin-native activation eliminates the "single active harness" concept entirely. Each harness's plugin lifecycle is independent; users mix and match at the harness level.

The iteration is framed as a **vertical-slice spike**: ship the model end-to-end on Claude only (UI launch path through `/rad-orchestration:ui-start` skill → bundled CLI → detached Next.js standalone), with the Copilot CLI and VS Code Copilot bundles built but their plugin manifests deferred. Every link in the plugin → skill → CLI → bundle → detached UI → state-folder chain is exercised by one end-to-end scenario.

### Wave displacements

The pivot reshapes work the original §6 wave structure assigned to later waves:

- **Wave 8 (Migration / Publish) — most of §3 (publish workflow restructure) and §4 (UI publishing) are absorbed into 1.1.** The "atomic versioning across CLI + UI" goal still holds, now via a single plugin tarball lockstep. The "harness asset placement" parked open question (§9-11, §12) is **resolved** — the plugin system IS the asset-placement mechanism. `sync-source.js`, the `installer/lib/{cross-harness-scan, hash-check, catalog, manifest, installed-version, remove}.js` machinery, and the manifest-aware install/upgrade infrastructure are all retired by the plugin pivot. What remains in Wave 8: the per-repo → global migration story for users with iter-01 custom installs, the `installer/` package retirement, and any leftover doc rewrites.

- **Wave 9 (Pipeline fold-in) — likely collapses to a rename.** The pipeline runtime now ships inside the plugin (bundled by esbuild) and is invoked by the CLI as a library. Wave 9's "fold pipeline.js into radorch CLI" goal becomes nearly trivial since the pipeline already lives next to the CLI in the same plugin bundle. May reduce to "rename the binary entry point and its slash form."

### What stays unchanged

Waves 3 (state v6), 4 (handoff contract), 5 (skill migration), 6 (DAG / tiered templates), and 7 (UI registry-aware) all proceed as planned in §6. The plugin-native model affects how their outputs are *distributed*, not what they do.

### Things to consider for later

These are deferred items that should be picked up at the right wave. They're not part of 1.1's scope but they're known and should not be re-discovered.

1. **Copilot CLI plugin packaging.** Researched, viable. `copilot plugin marketplace add` accepts absolute local paths; manifest format nearly identical to Claude's; Copilot CLI natively reads `.claude-plugin/` manifests. Gaps: no documented plugin-root path token (`${COPILOT_PLUGIN_ROOT}` analog), hook execution semantics around `cwd` not fully specified, persistent-data dir at `~/.copilot/plugin-data/` exists but no env-var token. Worth its own iteration once docs settle.

2. **VS Code Copilot plugin packaging.** Researched, viable but with caveats. `chat.pluginLocations` registers a plugin in-place from absolute path with no copy. `chat.plugins.marketplaces` accepts file:// for local marketplaces. Plugin manifest at `.github/plugin.json`. Gaps: explicitly NO plugin-root path token for Copilot-format plugins, no documented persistent-data dir, system in Preview behind `chat.plugins.enabled`. Defers further than Copilot CLI.

3. **`rad-` prefix rename.** Under plugin-native, Claude namespaces plugin-shipped skills as `<plugin>:<skill>`. `rad-orchestration:rad-brainstorm` is a redundant double-prefix. Clean follow-on iteration drops the `rad-` prefix from canonical skill names. Likely combined with iter 05 (skill migration).

4. **Agent namespacing in iter 05.** Confirmed: plugin agents are invoked as `Task(subagent_type='<plugin>:<agent>')`. Bare names only resolve for `~/.claude/agents/` and `.claude/agents/`. The orchestrator agent's spawn prompts (which dispatch to coder, reviewer, coder-junior, coder-senior) need rewriting to use namespaced subagent_type values when shipped via plugin. Iter 05 owns this alongside its skill migration sweep.

5. **iter-01 installer retirement.** The iter-01 `radorch install` command and the `installer/` npm package are end-of-life under plugin-native. They stay through 1.1 (additive — plugin install doesn't break iter-01 users). A focused retirement iteration removes them once telemetry shows nobody's using the iter-01 path.

6. **Per-repo → global migration story.** Users with iter-01 custom installs who want to move to plugin-native. State at `~/.radorch/` is identical so it's mostly "uninstall iter-01 + install plugin," but worth its own validation pass once telemetry shows real users in this state.

7. **Cross-plugin version coordination.** When Copilot CLI and VS Code Copilot plugins also ship, multiple plugins on one machine each carry their own bundled CLI. The `last_writer_version` check in `~/.radorch/install.json` is the discipline; planning across plugins gets explicit.

8. **Build-artifact reproducibility.** Developers commit built artifacts manually this iteration. Future iteration could add CI freshness check (rebuild + diff against committed artifacts). Not load-bearing now.

9. **Separate releases repo.** If `MetalHexx/RadOrchestration` repo size becomes a problem (committed plugin artifacts grow), splitting to `MetalHexx/radorch-releases` is a clean follow-on. No architectural change required, just a publish target.

10. **Marketplace name reservation.** Verify the chosen plugin/marketplace name (`rad-orchestration`, `rad-orchestration-marketplace`) isn't on Claude's reserved-names list before publishing. Reserved names include `claude-plugins-official`, `anthropic-plugins`, `agent-skills`, etc.

### Research findings to preserve

The brainstorm conversation produced authoritative answers that should outlive the session:

- **Claude plugin system.** `/plugin marketplace add <owner>/<repo>` clones default branch. `.claude-plugin/marketplace.json` at repo root for discovery. `${CLAUDE_PLUGIN_ROOT}` token interpolated in hook commands and skill content. `${CLAUDE_PLUGIN_DATA}` is a persistent dir that survives `/plugin update`. `bin/` is on Bash tool's PATH only (NOT user shell PATH). Monitors and MCP servers are session-scoped. `/plugin install` accepts `--scope user|project|local`. Plugin removal preserves `~/.radorch/`.

- **Copilot CLI plugin system.** `copilot plugin marketplace add` accepts absolute local paths. Plugin manifest discovery at `plugin.json`, `.plugin/plugin.json`, `.github/plugin/plugin.json`, OR `.claude-plugin/plugin.json` (Claude-shape natively read). Persistent data at `~/.copilot/plugin-data/<marketplace>/<plugin>/`. MCP-only for long-lived processes. Plugin code at `~/.copilot/installed-plugins/`.

- **VS Code Copilot plugin system.** `chat.pluginLocations` registers in-place from absolute path. `chat.plugins.marketplaces` accepts file:// URIs. Plugin manifest at `.github/plugin.json`. `chat.agentSkillsLocations` is an orthogonal user-configurable list of skill paths. No `${PLUGIN_ROOT}` token for Copilot-format plugins (explicitly "Not defined" per official docs). Marketplace install clones into `agentPlugins/github.com/<org>/<repo>` per platform. Plugin system gated by `chat.plugins.enabled` (Preview, default false).

- **Plugin agent namespacing (Claude).** `Task(subagent_type='<plugin>:<agent>')` confirmed via Claude docs. Bare names only resolve for `~/.claude/agents/` and `.claude/agents/`. Same applies to `@-mention` typeahead and `--agent` CLI flag. Other harnesses presumed similar but not verified per-harness.

- **Superpowers reference architecture (`obra/superpowers`).** Ships skills only (no agents folder). Uses each harness's native plugin manager — explicitly rejects "manually copying skill files into `~/.claude/skills/`" as a fake integration. Per-harness manifests + bootstrap hooks differ; skill bodies identical across all harnesses. Confirmed VS Code Copilot is excluded from their target harness list, validating that the asymmetry isn't unique to radorch.

### Pointer back

When the deferred items above come up for their own iteration, the [GLOBAL-WORKSPACES-1.1-CLAUDE-PLUGIN brainstorm](../../../../../orchestration-projects/GLOBAL-WORKSPACES-1.1-CLAUDE-PLUGIN/GLOBAL-WORKSPACES-1.1-CLAUDE-PLUGIN-BRAINSTORMING.md) is the source of truth for the architectural reasoning. The decisions there were grounded in the research findings above; if those findings change (Microsoft/GitHub adds plugin-root path tokens to Copilot, e.g.), revisit.
