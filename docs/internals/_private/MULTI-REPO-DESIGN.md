# Multi-Repo Design

**Status:** Deferred. This doc captures the multi-repo direction. Earlier brainstorming bundled this with global-install work; the install-refactor work has now split off into its own track and is no longer cross-linked here. Multi-repo work is parked until picked up as its own iteration; the lock-ins below describe the direction agreed during earlier brainstorming.

---

## Problem space

Today rad-orchestration projects target a single repo. Users with multi-repo applications (frontend / backend / infra) can't drive coordinated work from one project; each repo is its own project, each commit happens in isolation, cross-repo coupling has no expression in the model.

The multi-repo design closes that gap. Repos become first-class registry entries; named **workspaces** group repos that ship together; tasks declare their target repos explicitly; the pipeline tracks per-repo branch, PR, and commit state inside one project's state.json.

---

## Goals & non-goals

### Goals

1. Decouple project storage from any single repo.
2. Make "which repo is this task editing?" explicit and contractual (carried in the handoff).
3. Support projects that target multiple repos under one workspace, with deterministic per-repo execution.
4. Preserve single-repo project ergonomics — multi-repo is opt-in, not a tax.

### Non-goals

- Supporting source control providers other than GitHub. (`source_control.provider` is reserved-only and being dropped.)
- A configurable project naming convention. Project names are SCREAMING-CASE, hardcoded.

---

## Vocabulary

| Term | Definition |
|---|---|
| **Install** | One per machine, rooted at `~/.radorch/`. Holds the runtime, config, registry, projects, and worktrees. |
| **Repo** | A first-class registry entry. Has a name, local path, default branch, and remote URL. The single source of truth for repo identity. |
| **Workspace** | A named, optional grouping of repos (e.g., `my-app-stack` = `[frontend, backend, infra]`). No defaults block, no primary. Exists only for project targeting, UI grouping, and validation. |
| **Project** | A unit of orchestration work. Lives at `~/.radorch/projects/<NAME>/` regardless of which repo(s) it touches. Targets either a single repo or a workspace. |
| **Worktree** | A git worktree of a registered repo, created transiently for one project's lifetime at `~/.radorch/worktrees/<PROJECT>/<REPO>/`. |
| **Task** | A unit of code change inside a project, executed by the Coder agent from a self-contained handoff. Names the target repo(s) explicitly. |

A project at `~/.radorch/projects/BUILD-FOO/` targets `workspace: my-app-stack`. Its tasks specify `repos: ["backend"]` (always a plural array of registry keys; multi-repo tasks carry more than one). The Coder gets the worktree path resolved from `~/.radorch/worktrees/BUILD-FOO/backend/`. The source-control agent commits/PRs against that worktree's git remote.

---

## Registry and preferences — the four-file model

The repo registry and the user preferences each split across two files: one team-portable (versioned), one per-machine (gitignored). Identity-of-repos lives in the versioned file; local filesystem bindings live in the per-machine file. They merge at read time.

| File | Versioned? | Purpose |
|---|---|---|
| `repo-registry.yml` | yes | Team identity — repos + workspaces with names, remotes, default branches, descriptions, workspace memberships |
| `repo-registry.local.yml` | no (gitignored) | Per-machine path bindings — `repos:` and `workspaces.<name>.root:` mapping registered names to local filesystem paths |
| `preferences.yml` | yes | Team-shared preference defaults — `auto_commit`, `auto_pr`, `human_gates.execution_mode`, `default_template`, `limits.*` |
| `preferences.local.yml` | no (gitignored) | Per-developer preference overrides; deep-merges over team file at read time |

The `.local.yml` suffix carries the "don't commit; deep-merges over the team file" semantic via the well-established `.env.local` convention.

**Workspace root: per-machine path with strong-but-not-strict convention.**

- `repo-registry.local.yml` (per-machine) holds the optional `root:` for each workspace; `repo-registry.yml` does not.
- `radorch workspace create A B C` infers `root` as the common parent of the given repo paths if one exists; user can override with `--root`.
- `radorch workspace add <ws> <repo>` warns when the new repo isn't a child of the workspace's root ("typical for shared repos; proceed?") but does not reject. Convention nudges users toward strict layout; the warning is the discipline.
- Sessions for workspace projects launch at the workspace root. Single-repo projects launch at the repo's local path.

**Pipeline-as-path-resolver.** The engine pre-resolves all paths into `result.context.working_directories` per Wave 3. The engine enumerates the project's repos via `state.project.target` (the `{kind, name}` discriminator) plus the live `repo-registry.yml` (resolves workspace targets to their current member list; single-repo targets resolve to themselves). No frozen "snapshot" field on `state.json` — registry edits flow through to the next engine call, and projects see live registry state on each spawn. The pipeline is the deterministic resolver each spawn.

**Two-moment path-resolution flow.** (Worth being explicit since the local-bound path and the worktree path are different things.)
1. **At worktree creation** — `radorch worktree create <project> <repo>` reads `repo-registry.local.yml` to find the source repo's local path on this machine, then runs `git worktree add ${RADORCH_HOME}/worktrees/<project>/<repo>/ <branch>` from that source.
2. **At engine runtime, every spawn** — engine derives `working_directories[repo]` purely from `${RADORCH_HOME}/worktrees/<project>/<repo>/` by convention, with no file reads.

The `.local.yml` path is the *source* git location; the worktree path is the project's *workspace* git location. Worktree creation is the only moment the bridge is needed.

Subagents (coder, reviewer, source-control) receive paths via the spawn prompt and never call out to resolve them. Zero extra tool calls per spawn for path resolution.

---

## Wave 3 lock-ins — state schema v6 (multi-repo)

The schema bumps to `orchestration-state-v6`. Migration via explicit `radorch migrate` command, mirroring the existing v5 migration precedent (pure data transform + CLI scanner with `--dry-run`). Pipeline errors clearly on v5 input with a "run `radorch migrate`" hint. No auto-migration on read — predictable, auditable, dry-runnable.

### Multi-repo data model

- **Primarily single-repo per task; multi-repo permitted for tightly-coupled work.** Each task targets one or more repos via the handoff's `repos: string[]` field — always an array, single-repo tasks have a one-element array. Default planner guidance is one repo per task. Multi-repo tasks are reserved for cases where coupling makes splitting artificial (e.g., introducing a new API contract that requires both the route and its typed client at the same time). Phase-scope corrective handoffs that need cross-repo fixes are also multi-repo tasks — no special-casing.
- **`pipeline.source_control` becomes a map keyed by repo name** — `by_repo: { frontend: {...}, backend: {...} }`. Each per-repo entry holds branch, base_branch, remote_url, compare_url, pr_url. Shared `auto_commit` and `auto_pr` stay at the parent level inside `pipeline.source_control` — siblings to `by_repo`, NOT inside `state.config`. The DAG template's `state_ref: pipeline.source_control.auto_commit` lookup requires this exact path, so the placement is contractual, not a stylistic choice. Direct lookup by registry name; adding a repo mid-flight is an upsert.
- **Worktree path is derived, not stored.** Computed at read time from `${RADORCH_HOME}/worktrees/<PROJECT>/<REPO>/`. Eliminates the absolute-path-portability problem in state entirely. If we ever need custom worktree locations, an optional override field can be added later.
- **`state.project.target` is discriminated by kind** — `{ kind: 'workspace' | 'repo', name: string }`. Single-repo project: `{ kind: 'repo', name: 'frontend' }`. Workspace project: `{ kind: 'workspace', name: 'my-app-stack' }`.

### Type-system rigor

- **`IterationEntry` splits into two types.** `PhaseIterationEntry` (no repo field) for the phase loop; `TaskIterationEntry` (required `repos: string[]`, minLength 1) for the task loop. Compiler enforces the invariant that task iterations always carry at least one repo. Real refactor cost in `mutations.ts`, the JSON schema (gains a `oneOf` discriminator), and migration code — but v6 is the cheapest moment to pay it.
- **`CorrectiveTaskEntry` carries `repos: string[]` explicitly**, not inherited from its parent task. Consistent with `TaskIterationEntry`; zero indirection at read time. Task-scope correctives copy parent's `repos` array verbatim. Phase-scope correctives may have a different `repos` array — the orchestrator chooses based on findings.
- **Each `repos` entry is a string referencing a registry entry** (e.g., `"frontend"`). Validated at consumption time by `radorch` lookups against `repo-registry.yml`. No richer shape in state.
- **`commit_hashes: { [repo]: string | null }` replaces v5's single `commit_hash`.** Map shape regardless of repo count. Single-repo task: one entry. Multi-repo task: one entry per repo. Each entry is independently nullable until that repo's commit completes.

### Event evolution

- **`source_control_init` becomes per-repo at the engine level.** Each call upserts one entry into `pipeline.source_control.by_repo`. Failure is isolated per repo — frontend init can fail while backend succeeds.
- **A CLI convenience wrapper** — e.g., `radorch project init-source-control` — iterates the project's target repos and fires the per-repo events. Skills call ONE high-level command; the loop lives in the CLI.

### Spawn-prompt pre-resolution

The engine pre-resolves path arithmetic and diff scoping before handing the agent its spawn prompt. Agents read pre-resolved fields and act on them directly — no path math, no SHA derivation, no section-name-to-repo lookups for file edits.

- **`working_directories: { [repo]: path }`** in `result.context` for repo-scoped actions (`execute_task`, `spawn_code_reviewer`, `spawn_phase_reviewer`, `spawn_final_reviewer`, `invoke_source_control_commit`, `invoke_source_control_pr`). Always a map regardless of repo count. Each path computed from `${RADORCH_HOME}/worktrees/<PROJECT>/<REPO>/`. Agents use this as cwd when running build/test commands per repo.
- **`file_operations`** in `result.context` for `execute_task`. Engine parses the handoff's per-repo `**Files for <repo>:**` subsections, joins each relative path with the matching `working_directories[<repo>]`, emits entries like `{ repo: 'frontend', op: 'create', path: '/abs/path/.../src/profile.tsx' }`. Coder edits files at the absolute paths directly.
- **`diff_plan`** in `result.context` for review actions. Shape varies by scope: task review → `{ [repo]: { head_sha } }`; phase review → `{ [repo]: { first_sha, head_sha } }`; final review → `{ [repo]: { base_sha, head_sha } }`. SHAs are independently nullable per repo (null when no commit was made for that repo). Reviewer iterates the map and runs `git diff` in each repo's worktree.
- **Orchestrator propagates pre-resolved fields verbatim** from `result.context` to the spawn prompt. No agent-side derivation; pure relay.

---

## Wave 4 lock-ins — task handoff contract change

### Handoff frontmatter

- **Handoff carries `repos: string[]` (array of registry-name strings) only.** Always a plural array — single-repo tasks have a one-element array. Not `working_directories:`. The absolute paths are engine-computed and propagated via spawn prompt (Wave 3) — inlining them in the handoff would break portability when projects move between machines.

### Master plan format and explosion script

- **Repo assignment is per-task and always plural.** Each task carries `**Target repos:** <comma-list>` — always plural form, even for single-repo tasks (`**Target repos:** frontend`). Phase has no `Target repos` field — phases stay repo-agnostic, mixed-repo phases are supported, and small multi-repo projects don't pay phase-ceremony multiplication.
- **File Targets are grouped per-repo via `**Files for <repo>:**` subsections, always.** Replaces today's flat `**Files:**` list — uniform structure regardless of repo count. Single-repo tasks have one `**Files for <repo>:**` heading; multi-repo tasks have N. No format-shape switch when a task crosses 1.
- **Single-repo projects: planner can omit `**Target repos:**`.** When `state.project.target.kind === 'repo'`, the explosion script auto-fills `repos: ["<target-name>"]` on every emitted handoff. The per-repo `**Files for <repo>:**` heading is still required — it identifies the working directory for the task's files.
- **Multi-repo parse error.** Explosion script throws ParseError when `state.project.target.kind === 'workspace'` and a task is missing `**Target repos:**`. Caught at planning time, not at execution time.
- **Multi-repo validation is layered.** Explosion script validates each repo in `**Target repos:**` against the project's available repos (workspace member list or single-repo target). Engine validates each `TaskIterationEntry.repos` element against the registry at iteration construction. Source-control agent fails fast at runtime if any worktree path doesn't exist. Each layer catches a different class of error.

### Project-repos discovery (orchestrator → planner)

- **Mirror the skills-discovery pattern.** Orchestrator runs a project-repos manifest script before spawning the planner for both `spawn_requirements` and `spawn_master_plan`, parallel to today's `list-repo-skills.mjs` flow.
- **Output inlined under contractual heading `## Project Repos Available`.** Heading string is exact-match. Empty array → heading omitted entirely (single-repo escape hatch, same convention as the skills manifest).
- **Script reads `state.project.target`**, resolves to relevant repos via `repo-registry.yml`, outputs JSON array of `{ name, remote, description? }`. Single-repo projects produce `[]`; workspace projects produce the full member list with descriptions.
- **Registry gains optional `description:` per repo entry** so the planner has enough context to assign tasks intelligently without grepping every repo.

### Corrective handoffs

- **Task-scope correctives mechanically inherit `repos`** from the parent task's handoff frontmatter (copy the array verbatim). Not LLM judgment — the corrective necessarily targets the same repos as the task it's correcting.
- **Phase-scope correctives have orchestrator-determined `repos`.** The orchestrator authors a phase-scope corrective handoff after phase-review mediation; it picks `repos` based on which repos the actioned findings need to land in. Documented in the addendum's Finding Dispositions reason column (e.g., "F-1 → action (drift) — fix lands in `frontend` per file path `frontend/src/api-client.ts`"; "F-2 → action — fix coordinated across `frontend` and `backend`").
- **Cross-repo phase-scope findings naturally resolve as multi-repo correctives.** An earlier concern about "phase-scope finding spans repos in unfixable ways" disappears — multi-repo task support absorbs it. The orchestrator authors one phase-scope corrective with `repos: [frontend, backend]` when the fix genuinely needs both.

### Cross-repo task ordering

- **Existing `**Execution order:**` semantics still apply.** A task in `frontend` depending on a task in `backend` uses the same `T01 → T02` syntax already in the master plan format. Repo identity doesn't change dependency ordering — the engine respects the declared order regardless of which repo each task touches.

### Task code review under multi-repo

- **One reviewer spawn per task, multi-repo aware via per-repo diff plan.** Engine emits `diff_plan: { [repo]: { head_sha: string | null } }` in `result.context` for `spawn_code_reviewer`. Reviewer iterates per repo, runs `git diff` (or `git show <head_sha>`) in each repo's worktree, audits findings, writes ONE combined review doc. Single review cycle per task; the reviewer can reason about cross-repo coupling — critical for tasks where the whole point is coordinated changes.
- **Findings imply repo via `File:Line` references.** A finding's repo is derivable from the absolute path the reviewer cites (since the engine handed it absolute paths via `file_operations` and `working_directories`). Audit table rows naturally span repos when the task does.
- **Null head_sha is per-repo.** When `auto_commit: never` or no commit happened for a particular repo, that repo's `head_sha` is null independently. Reviewer falls back to `git diff HEAD` + untracked files in that repo's worktree.

### Phase review under multi-repo

- **Same pattern, scoped to the phase's cumulative range.** Engine groups `TaskIterationEntry.commit_hashes` and `CorrectiveTaskEntry.commit_hashes` values by repo across the phase's tasks to produce `diff_plan: { [repo]: { first_sha, head_sha } }`. Reviewer iterates per repo, runs `git diff <first_sha>~1..<head_sha>` in each worktree, writes ONE combined phase review doc. Cross-repo cumulative drift surfaces naturally because the reviewer sees all repos.

### Final review under multi-repo

- **One final reviewer spawn per project, per-repo diff plan.** Engine walks every `TaskIterationEntry.commit_hashes` and `CorrectiveTaskEntry.commit_hashes` across the entire project, groups by repo, computes per-repo `base_sha` (first chronological commit) and `head_sha` (last commit). Emits `diff_plan: { [repo]: { base_sha, head_sha } }`. Reviewer iterates per repo, audits each FR/NFR/AD/DD requirement against the union of changes across all repos, writes ONE combined final review doc.
- **`met | missing` status spans all repos.** A requirement is `met` only when satisfied wherever it's owed — across every repo a task targeting that requirement touched. `met` in `frontend` but `missing` in `backend` resolves to `missing` overall.
- **Single final-approval gate, regardless of repo count.** One review doc, one human approval. PR fan-out (Wave 6 — `radorch git pr` iterates internally over `pipeline.source_control.by_repo`) handles the per-repo step inside a single CLI invocation; final approval doesn't multiply.

---

## Wave 6 lock-ins — DAG and multi-repo execution

The v2 templates stay structurally close to v1. No new node kinds, no DAG-level iteration over repos. Multi-repo fan-out for commits and PRs lives inside the CLI commands the existing nodes invoke — the agent / orchestrator dispatch surface stays single-shot per task and per project.

### DAG structure changes for multi-repo

- **`commit_gate` keeps a single `commit` step in its true branch.** The step's action is `invoke_source_control_commit`, fired once per task regardless of repo count. The source-control agent runs `radorch git commit --project X --task-id Y` (no `--repo` flag); the CLI iterates internally over the task's `repos` array, runs git commit in each repo's worktree, returns aggregated JSON.
- **`pr_gate` keeps a single `final_pr` step in its true branch.** Same shape — one `invoke_source_control_pr` action at project end. Agent runs `radorch git pr --project X`; CLI iterates over `pipeline.source_control.by_repo`, opens one PR per repo, returns aggregated JSON.
- **`commit_gate` and `pr_gate` themselves stay project-level conditionals** — `auto_commit` and `auto_pr` are project-level config. They fire once.
- **No `for_each_repo` DAG node kind** — explicitly NOT introduced. Multi-repo iteration is mechanical work; the CLI is the right home for it. Avoids spawning N source-control agents for an N-repo task (one spawn, one CLI call, internal loop).
- **Review steps (`code_review`, `phase_review`, `final_review`) stay as single-step nodes.** Multi-repo awareness handled by engine pre-resolution of `diff_plan` in `result.context`. One review spawn per task / phase / project regardless of repo count.

### Result aggregation and event payloads

- **Source-control agent's `## Commit Result` block carries a per-repo results map** when the task has multiple repos:
  ```json
  { "results": { "frontend": { "committed": true, "commitHash": "abc", "pushed": true },
                 "backend":  { "committed": true, "commitHash": "def", "pushed": true } } }
  ```
  For single-repo tasks the map has one entry. Orchestrator extracts the map and signals `commit_completed` with an aggregated `--commit-hashes-json` payload (replacing today's per-repo `--commit-hash`/`--pushed` flags). Engine writes per-repo hashes into `TaskIterationEntry.commit_hashes`.
- **`## PR Result` block uses the same per-repo map shape** — entries per repo with `pr_created`, `pr_url`, `pr_number`, `pr_existed`, `error`. Orchestrator signals `pr_created` with an aggregated `--pr-urls-json` payload; engine writes per-repo URLs into `pipeline.source_control.by_repo[<repo>].pr_url`.

### Per-repo commit messages

- **Source-control agent crafts per-repo commit message bodies via LLM narrative.** Header is mechanical (`{prefix}({taskId}): {title}` — same across repos for a given task); body is per-repo, written by the agent from each repo's slice of `file_operations` + the handoff's `**Files for <repo>:**` intent text. Different code per repo → different commit body per repo.
- **Single agent spawn per task.** Spawn prompt carries structural inputs for all the task's repos: file_operations grouped by repo, intent text per repo, repo list, working_directories. Agent crafts all per-repo messages in one pass, then issues ONE CLI call: `radorch git commit --project X --task-id Y --messages-json '{...}'`.
- **CLI iterates per repo using the agent-supplied messages.** No fallback message generation in the CLI — if the agent didn't supply a message for a repo in the task's `repos` array, the CLI errors. Forces the agent to take ownership of the narrative.
- **Single-repo tasks** still go through the same shape — agent supplies one message in the map, CLI commits one repo. Uniform code path.

### Per-repo PR descriptions

- **Source-control agent crafts per-repo PR description bodies via LLM narrative.** Spawn prompt carries project planning summary (from master plan + brainstorming if present), per-repo file changes (cumulative across the project), final review verdict summary, and the list of repos with their roles in the project. Agent writes a digestible PR description per repo — shared project context + per-repo specifics — at a level appropriate for human PR review (NOT the dense audit shape of the final review doc).

- **Default PR description template** the agent fills in per repo:
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

- **Single agent spawn per project at PR time.** Agent crafts all per-repo descriptions, hands them to the CLI as a JSON map: `radorch git pr --project X --descriptions-json '{"frontend":"...","backend":"..."}'`.
- **PR description is a separate artifact from the final review doc.** Final review remains the dense audit (audit table, findings, evidence) — kept as the project record. PR description is the human-review-friendly summary, generated fresh at PR time.

### Linked PRs (two-pass creation)

GitHub doesn't have a true cross-repo PR linking feature, but cross-references in PR bodies are auto-rendered as clickable links with status badges. The CLI handles this via two-pass creation:

- **Pass 1**: For each repo, CLI runs `gh pr create` with the agent-supplied description body (containing a placeholder where the Linked PRs section will go). Captures each PR's URL.
- **Pass 2**: CLI collects all PR URLs from pass 1. For each repo's PR, calls `gh pr edit --body <updated>` substituting the placeholder with the actual sibling PR URLs.
- **Failure recovery**: if pass 1 succeeds but pass 2 fails for some repo's update, the PRs still exist with the placeholder text intact. User can re-run `radorch git pr` (idempotent — detects existing PRs and re-runs only pass 2) to retry the link-update.
- **No tracking issue for v1.** Cross-references in PR bodies are sufficient for typical workflows. Tracking-issue creation is parked as potential future work if real demand surfaces.

### Failure handling and recovery

- **Per-repo commits are independent.** Commit failure (commit didn't happen) → engine treats as task failure; pipeline halts with a clear message naming the failed repo. Push failure (commit succeeded, push didn't) → state records `pushed: false` for that repo; pipeline continues. Same as today's single-repo behavior, just per-repo'd.
- **Idempotent re-run of `radorch git commit`** skips repos that already committed for this task; retries the rest.
- **PR creation partial failure**: pass-1 partial failure leaves some PRs created; idempotent re-run skips existing and retries missing. Pass-2 partial failure leaves placeholder text in some PRs; re-run retries pass-2 only. Pass-2 idempotence detection is an implementation detail — either placeholder-text grep (cheap, fragile) or a small state-tracking field per PR in `pipeline.source_control.by_repo[<repo>]` (more robust).
- **Final review doc shape stays unchanged under v6.** It remains the dense audit artifact (audit table, findings, evidence, exit criteria) — intentionally thorough, the project's official record. PR descriptions are a separate, more digestible artifact crafted by the source-control agent at PR time.
- **Source-control agent model bumps from `haiku` to `sonnet`** given its expanded narrative-crafting role (commit message bodies + PR descriptions).

### Mid-flight workspace expansion — halt with clear message

- **Detect at `/rad-execute` invocation start.** The skill compares the project's target workspace's current member list (from `repo-registry.yml`) against the project's operational repo set (`pipeline.source_control.by_repo` keys). If the workspace has gained repos the project doesn't know about, `/rad-execute` halts before signaling any pipeline event.
- **Halt is explicit and actionable.** Halt message: *"Workspace `<NAME>` has gained the repo(s) `<NEW_REPOS>` since this project's master plan was approved. The new repo(s) will not be incorporated mid-flight. Either start a new project to include them, or run a follow-up project iteration after this one completes to reconcile."*
- **No automatic incorporation.** The project's master plan and task assignments are locked at planning time; the system never retroactively expands scope. Preserves planner authority, avoids surprise expansions.
- **Resumption requires user choice.** User either: (a) abandons the project and starts a new one with the expanded workspace, or (b) accepts the halt as a non-fatal detection and explicitly reverts (e.g., removes the new repo from the workspace temporarily) — the system itself does not auto-resolve.

---

## Open questions (multi-repo specific)

These were parked during earlier brainstorming and remain unresolved:

1. **v5 → v6 migration: how single-repo v5 projects map their existing `pipeline.source_control` into v6's `by_repo` map.** What name keys the single entry? Options: infer from registry by matching `remote_url`; prompt the user during migration; use a sentinel name. Affects the migration tool's design.
2. **`gh` auth scope per-host.** Multi-repo doesn't account for repos targeting different GitHub hosts (github.com vs. enterprise). Per-host `gh auth status` checks need explicit handling.
3. **Cross-machine registry paths.** The local-bindings file stores per-machine absolute paths. The four-file model resolves the versioning question (identity in `repo-registry.yml`, paths in `.local.yml`) but cross-machine onboarding (dev2 picking up dev1's project) still needs a one-command bind flow.
4. **`prompt-tests/` rework under multi-repo.** Operator-committed baselines may need re-baselining once multi-repo state shapes flow through.
5. **Workspace-expansion detection placement.** The lock-in says detect at `/rad-execute` invocation start. Alternative: engine-side check at every spawn. Trade-off between fast-fail and orchestration overhead.

---

## Status

This direction is captured for the moment multi-repo work is picked up as its own iteration. Until then, the document is parked. The state.json schema is at v5; no v6 migration tooling exists yet. The registry / workspace files don't ship in `~/.radorch/` today — they're a forward design, not current behavior.

When this work is scheduled, spawn a project brainstorm derived from these lock-ins; do not assume the design is implementation-ready as-is.
