# Changelog

All notable changes to this project are documented here. Each `## v{version}` entry below is the source of that release's notes on the [GitHub Releases page](https://github.com/MetalHexx/RadOrchestration/releases) — the publish workflow slices the matching block into the release.

---

## Unreleased

_(none)_

---

## v1.0.0-alpha.14 — 2026-09-08

### What's New

**Session tracking — save a conversation and pick it back up**
- Ask in plain language ("save this session", "what was I working on") or use `/rad-session`.
- The pipeline also records automatically as it works, so most of the trail builds itself.
- Every project now has an **Overview** page listing its documents and its session history, with how long you were actively working in each one.
- **Continue Session** reopens a saved conversation in a fresh terminal; **View Telemetry** jumps to its costs.
- Special Note: Copilot in VS Code isn't covered — it has no resume path.

**A help system that ships with your install**
- The full documentation set now lands on your machine with every install, so it works offline and always matches the version you have.
- Read it in the dashboard via the question-mark icon — real pages with working links, screenshots, and deep links you can bookmark or share.
- `/rad-help` answers questions from those docs conversationally, offers a guided tour, or walks you through building something small to learn the ropes. `/rad-help <skill-name>` explains any skill.

**Amendments — change an already-approved plan in place**
- `/rad-amend <PROJECT>` adds, revises, or drops phases and tasks on a project that's already planned, mid-run, halted, or even already completed.
- **Anything already done stays done.**
- You get a link to read the amendment before approving it, and an optional subagent reviewer can audit it first.

**Communication styles — tune how the agent talks to you**
- Four styles ship — High-Level, Direct, Caveman, and Socratic — off by default. `/rad-communication` switches or enables them.
- Talk to the skill to craft your own. Your styles survive upgrades untouched.
- A style governs tone and pacing only, never what the agent does or the shape of code, docs, plans, and reviews.

**Delete a project**
- A trash control in the project header, with a confirmation that itemizes what will be removed and what's protected.
- Repositories you registered yourself are never removed, and you can keep a worktree a related project is still using.
- Also available as `radorch project delete`, with `--preview`.
- Special Note: there is no undo. The preview is the safeguard.

**Ambient Awareness Preamble Verbosity**
- Four levels — `verbose`, `minimal`, `silent`, `off` — set from the dashboard or with `/rad-init <level>`.
- `minimal` and `silent` change what you see; the agent still gets everything.
- Only `off` saves some tokens, but your agent will no longer be aware of the world around it.
- `/rad-init` on its own loads the full briefing manually whenever you want it, without changing your setting.

**Smaller additions**
- `/rad-execute` now asks which workspace to use when starting fresh, naming the base branch before anything is created — closing a case where follow-up work could branch off a place you didn't expect.
- `/rad-plan` can re-run its audit when the first pass turns up an unusual number of problems, up to three passes, instead of finalizing on faith.
- A new **Work Graph** page draws your projects and the relationships between them, filterable and shareable by URL. **Early preview, development still underway** — it's a snapshot at page load rather than a live view, and the page may change shape between releases.
- Coder and reviewer agents can now drive a real browser using Claude in Chrome, the Playwright MCP, or the Chrome DevTools MCP, so a task can include end-to-end or visual verification.

**Portfolios — early preview**
- `/rad-portfolio` gives long-running initiatives a home: a place to hold the design record for work that spans months and many sessions, so decisions don't get re-litigated every time a fresh session starts. Iterations are ordinary projects that run through the normal pipeline.
- **This is an early preview and development is still underway.** The shape of the feature is still moving, its documentation page hasn't been written yet, and details may change between releases. It's included so you can try it and tell us what's missing — not because it's finished.

### What's Fixed

**The dashboard document viewer is genuinely live**
- Documents now update as they're written instead of needing a refresh, newly created ones open on the first click, and your scroll position survives an update.

**Every surface reports the same project state**
- The same project could read "Complete" in one place and "Pending Review" in another. There's now one vocabulary used everywhere — project list, project page, work graph, CLI, and the session briefing.

**Planning and review correctness**
- The final reviewer could be handed a commit range that missed an amendment's work entirely; it's now derived from real git history and halts loudly if it can't be trusted.
- Master Plans that numbered tasks continuously across phases were silently accepted and later crashed. They're now rejected at plan time with a clear message.
- Looking up a repository's own skills was broken end to end, so a repo's conventions never reached a coder. It now resolves repositories by registered name.

**Fewer wasted turns and stalled runs**
- The pipeline now hands the orchestrator ready-to-run commands instead of a sentence it had to assemble, which used to cause rejected guesses and retries on nearly every run.
- Fixed a bogus "no task is in progress" error when completing a code review, and plan-explosion parse failures that never signalled at all.

**The config panel no longer breaks on an upgraded install**
- It rendered blank — and failed to save — on an install that upgraded into the new settings.

### Changes

**The session briefing now defaults to `minimal`**
- Fresh installs get the one-line form, which now names the project you're standing in — the part that actually changes session to session.
- **An existing setting is never touched.** The new default only reaches a fresh install.

**Session start tells you where you're standing**
- The briefing names the project whose workspace you're in, its branch and repos, and related projects sharing it — and says nothing in a plain clone.

**The dashboard opens on Overview**
- Projects open on Overview rather than the pipeline graph, with a header toggle that remembers your choice. This replaces the old launch screen.

**The dashboard config panel was reshaped**
- Two new sections: Ambient Awareness and Communication Style.
- **Raw YAML editing is gone**, and with it the Human Gates section. Those settings still work at their current values, but changing them is now a file edit.

**The dashboard's terminal launch buttons are hidden**
- As built they always opened Claude Code in a shared folder with none of the project's code in front of it, and Copilot was unreachable from the dashboard. Approve Plan and Approve Final Review are untouched.

**The final approval gate now offers two choices**
- Approve, or request changes in your own words — the agent decides whether that's a corrective or an amendment, and tells you what a change would cost before you choose.

**The Source Control panel was rebuilt**
- Cleaner styling that reads as part of the page, readable labels at any width, and worktree or in-place location reported per repo rather than one verdict for the whole project.

**The orchestrator no longer repairs pipeline state on its own**
- On stale state it halts, explains the diagnosis and the options, and lets you choose. Starting, resuming, and recovering all route through `/rad-execute`.

**The documentation was rewritten from the ground up**
- The docs had last been accurate several releases earlier. Every page was rewritten or replaced, and a number of claims that were simply untrue are corrected.

**Command-line output**
- `radorch project list` and `project show` now lead with the project's state. Anything parsing that text will need updating.
- `radorch config` became a command group — the read is now `radorch config get`.

**Upgrade notes**
- Changes to agent instructions and shipped documentation take effect after you reinstall or upgrade.
- Auto-updates for third-party marketplaces are **off by default** in Claude Code, so you may be silently pinned to an old version. Enabling it is worth doing once.
- Projects already underway keep the workflow they started with.

## v1.0.0-alpha.13 — 2026-08-10

### What's New

**Final review can now spawn corrective tasks**
- Final reviews now create corrective tasks, just like phase and task reviews.
- If a final review is "rejected" (as opposed to changes requested), the run stops and agent asks for help.
- The UI timeline now displays the corrective # on the timeline.
- Special Note: Only high or extra-high review intensity levels will re-review corrective tasks at this time.

**Run a project on a branch you've already started**
- You can now execute a Rad Orc project from a non-main (non-default) branch from your main repo clone.
  - Running a project in this scenario will also halt and assist if you had uncommitted changes.
  - By design and for safety, multi-repo projects will refuse to start in this scenario.

**Pull requests**
- Pull requests now open in draft mode.
- This will be a better communication signal to team members to ensure PR reviews are not enacted prematurely.
- The description is a written summary of the work, not a link or a pointer to another document.

**Repo Registration is now required**
- Projects will now require the repo to be registered and will direct the user to `/rad-repo` if it is not.

### What's Fixed

**UI Dashboard**
- When switching from a planned project to an unplanned project, the previous project will no longer leak UI state and properly render the unplanned project.
- SSE updates will now keep retrying after a network drop instead of going dead until you reload the browser.
- Reconnecting refreshes the project you're looking at, not just the project list.
- Projects added or removed while the dashboard is open now appear and disappear from the project list automatically without requiring a browser refresh.
- Supporting folders like `.git`, `_archived` and `_future`, no longer show up in the project list.
  - Only SCREAMING-CASE projects will display.
- A project that fails to load offers a retry instead of spinning forever.
- A run waiting on you now consistently reads "Pending Review" everywhere, instead of three different labels.
- A gate waiting on you reads as in progress rather than not started.

**Observability: Cost Tracking**
- Costs showed as "price unavailable" whenever a new model shipped (Opus 4.8 -> Opus 5)
  - Observability session or detail views will no longer display "price unavailable" for sessions that used Opus agents.
  - Pricing now follows the model family, so a new release prices correctly on its own.

**Resuming Projects**
- Resuming a project with `/rad-execute <PROJECT-NAME>` from somewhere other than `~/.radorc/worktrees/<PROJECT-NAME>` will no longer re-ask questions.
  - Instead, `/rad-execute <PROJECT-NAME>` is quiet and simply relaunches a new terminal to the appropriate worktree workspace in `~/.radorc/worktrees/<PROJECT-NAME>`
- A project whose workspace folder is missing is re-created from remote instead of outright failing or creating a duplicate.
  - This is an edge case where perhaps a user resumes the work from another machine where the in-progress worktree is missing.

**Only repos you actually change are included in a project run**
- Repos you only read for reference are no longer pulled into the run.
  - They get no workspace, no branch, and no pull request.
- Planning is now hardened and will stop if a repo is listed as changing but no task actually changes it.
- Brainstorming will now confirm if a repo is only for reference as a front gate.

**Multi-repo reviews**
- Repos are now included in project code reviews to reinforce that corrective tasks write to the correct repo.
- Findings say which repo they're in, so fixes land in the right one.
- Special Note: This was not an actual issue, but is a preventative change to reinforce safe coding operations.

**Reinforced Pull Request Descriptions**
- Reinforced instructions to make sure PR descriptions are a written summary of the work, not a link or a pointer to another document.
  - Not a common issue, but it happened once. This should prevent that.

### Changes

**The plugin marketplace moved**
- Plugins are now available from our new [rad-orc-marketplace](https://github.com/MetalHexx/rad-orc-marketplace)
- Instructions can be found in the repo's README.md.

**Launching sessions**
- All launched Claude Code sessions now default to Sonnet to ensure cost efficiency.
  - Previously, sessions would launch with the last agent you chose (e.g., Opus or Haiku)
  - Sonnet has been tested and is very capable (and cheaper) as an orchestration agent.
- On Windows and Linux a new session opens as a tab in your current terminal window instead of a new window.
  - If a terminal is not supported, fallback will open a new terminal window instead of tab.
  - macOS still opens a new window for now.
- If you're already in Claude Code, you're not asked which tool to launch -- it launches Claude Code CLI automatically.
- You're no longer asked to pick a permission mode. Terminal launches default to Auto-Mode.
  - bypassPermissions is no longer an option. Auto-mode is safer.
- Side-projects open their own terminal instead of running wherever you happened to be standing for consistency.
- A project spanning several repos can't run inside a single checkout — it stops and explains why, and `/rad-repo` has a new guide to how multi-repo projects are laid out.

**Upgrade notes**
- Projects already underway keep the workflow they started with, so "Final Review" corrective tasks only work going forward on new projects.
- Changes to agent instructions take effect after you reinstall or upgrade.
- Be sure to enable auto-updates in Claude Code to receive new Rad Orc plug-in updates automatically.

## v1.0.0-alpha.12 — 2026-07-29

### What's New
- feat(P01-T01): add plan resolve read-only planning classifier
- feat(P01-T02): plan prepare - stamp approval and seal the planning parameters

### What's Fixed
- fix(P01-T02-corrective1): plan prepare guards a missing Requirements doc
- fix(P02-T01-corrective1): restore silent Open-Questions resolution and fix stale template docstring
- fix(rad-plan): decouple review-tier and Phase/Task Size questions
- fix(rad-release): lockstep-bump graph-service, lib/graph-*, and examples/ packages

### Changes
- docs(P02-T01): rewrite /rad-plan as a thin relay
- chore: cleaned up some of the question prose for added clarity.
- chore: catch up graph-service, lib/graph-*, and examples/ to 1.0.0-alpha.11

## v1.0.0-alpha.11 — 2026-07-28

### What's Fixed
- Upgrades from 1.0.0-alpha.9 no longer fail with `bundled manifest not found` — the release engine was deleting each harness's prior-version manifest on every bump, violating the installer's own upgrade contract (AD-4). Manifests now accumulate correctly for the standard installer, and each plugin's single hand-authored manifest is renamed forward as before.
- `npx rad-orc` now always installs the newest published version. The npm `latest` dist-tag was stuck on the very first published version (1.0.0-alpha.9) because npm force-tags a package's first-ever publish regardless of the `--tag` flag used; CI now always repoints `latest` at whatever version it just published.

This release ships the actual fix for both issues to npm — 1.0.0-alpha.10 was published before the manifest fix landed, so anyone still on alpha.9 needs this version to upgrade cleanly.
## v1.0.0-alpha.10 — 2026-07-28

### What's New
_(none)_

### What's Fixed
- fix(ci): stop manifest drift gate from clobbering published ui.tgz (#193)

### Changes
- Enable telemetry by default, pin UI port, and make config gear icon global (#194)

## v1.0.0-alpha.9 — 2026-07-28

The largest release since the process refactor: a brand-new observability and telemetry stack, multi-repo orchestration, a work-graph that relates projects to each other, a rebuilt installer and plugin distribution story, and a planning flow that collapses to a single requirements conversation plus a Master Plan.

### What's New

- **Observability & telemetry** — An entirely new subsystem, off by default and opt-in via `orchestration.yml`. A harness-neutral capture library records per-request token usage to NDJSON with daily partitioning, and a new **Observability** dashboard section reads it live over SSE. Includes an all-sessions surface with spend/duration/rate cards and time-range filters, a per-session detail view with a spend-rate chart and subagent cost breakdown, and an **Agent Inspector** with a live transcript viewer plus Overview, Tools, and Files Touched facets. Costs are priced per model and per token class (input, output, cache-read, cache-create) at the record's own timestamp.
- **Multi-repo orchestration** — Projects can now span several repositories. A new repo registry manages repos and repo-groups; each Master Plan task declares a **Target repo**, phases derive their repo set as the union of their tasks, and the pipeline fans out per-repo across signal, state, execution, review, and source control. A new **Source Control** panel shows per-repo branch, bind status, and location kind (worktree / in-place / side-project), deep-linked to the Repo Registry.
- **Work graph & project relationships** — A new work-graph library and `/rad-project` skill let projects declare relationships to one another, resolve where you're working from, and surface the active set. A structured session preamble reports registered repos, repo-groups, and active projects at session start.
- **`/rad-repo` skill** — Register, bind, describe, and group repositories from chat, so work that spans repos no longer assumes the current directory is the whole system.
- **`/rad-visual-docs` skill** — Extracted into a standalone skill for wireframes, UI mockups, and architecture / data-flow / sequence diagrams. Mockups are clean and grounded by default — annotations are opt-in, and every rendered element must trace back to the conversation.
- **Live dashboard** — Artifacts, project state, and the registry now stream to the UI over SSE with a supervised file watcher, so documents and pipeline state update in place instead of on refresh. Adds a launch screen with an artifact viewer, a unified document modal that addresses every document (including phase plans, task handoffs, and review reports) by path with deep links and toggleable frontmatter, and DAG planning cards that surface Requirements/Master Plan status inline.
- **Configurable dashboard port** — The UI port is sourced from `orchestration.yml` (`ui.port`, default `1337`) and editable from the dashboard config editor.
- **UI control skills** — `/rad-ui-start`, `/rad-ui-status`, and `/rad-ui-stop` for launching, diagnosing, and stopping the dashboard.

### What's Changed

- **Planning overhaul** — The requirements document is now requirement-grouped (`R{n}`), co-locating functional, design, and technical detail per requirement in place of the old FR/NFR/AD/DD ledger. `/rad-brainstorm` is a pure collaboration partner — there is no longer a separate brainstorming document; the requirements doc is scribed inline as consensus forms, and `/rad-plan` starts from it. Master Plan authoring, the plan audit, and approval all moved onto the main agent, retiring the standalone `planner` agent and the `rad-plan-audit` / `rad-approve-plan` skills. Tasks route by **complexity** (`simple` / `standard` / `complex`) rather than requirement tags, and the prescriptive per-phase task caps are gone.
- **New distribution model** — The installer was rearchitected and the npm package renamed **`rad-orchestration` → `rad-orc`**. Alongside the standard installer, the system now ships as three marketplace plugins — Claude Code, GitHub Copilot CLI, and Copilot in VS Code — published to a satellite marketplace repo. The canonical user-data root is standardized at `~/.radorc`. Publishing is now CI-owned: pushing a `v*` tag builds, gates, publishes to npm with provenance, and cuts the GitHub Release.
- **Worktree-launch folded into `/rad-execute`** — The separate worktree-launch command is retired. Running `/rad-execute` from the main clone launches a fresh worktree and branch automatically; running it from inside an existing worktree executes in place after a confirmation.
- **Lower agent token spend** — Coder and reviewer skills were reworked for turn economy, and task handoffs are now *compile-complete*: the planner inlines each external dependency's import-ready contract so the coder never sweeps engine source to orient. Measured on an A/B benchmark: cache-read **14.9M → 6.5M (−57%)**, engine-source file reads 22 → 0, peak context 281K → 176K, with identical output.
- **Orchestrator agent retired** — The pipeline drives from skills; the `orchestrator` agent and its Copilot launch pin are gone. Also retired: the `rad-configure-system`, `rad-execute-parallel`, `rad-plan-quick`, and `rad-run-tests` skills.
- **Monorepo on npm workspaces** — Shared libraries (`repo-registry`, `work-graph`, `telemetry`) build to `dist/` and are consumed by name across the CLI, UI, and installers.
- **CI coverage** — New gates for installer-manifest drift and the four installer test suites, which were previously never run in CI. Installer manifests are now a hash-free path catalog that regenerates byte-identically on any OS, ending the recurring manifest-resync churn.

### What's Fixed

- **Dashboard cost now reconciles with terminal `/cost`** — Claude Code writes 100% 1-hour prompt cache, but capture flattened cache-creation to a single total and priced all of it at the 5-minute rate, undercounting spend. Cache-creation is now split by TTL and priced correctly.
- **Token totals no longer inflated** — Transcript parsing summed every raw line instead of one contribution per request, multiplying cache-read and output tokens up to 4× on multi-line requests. Both the harvest and modal paths now resolve a single final value per request.
- **Cross-harness install on Windows** — Installing one harness while another's dashboard held a lock on `~/.radorc/ui/` raised an EPERM that bricked the install. Every install path now stops a live UI first, keeps staging retry-safe, and no longer wipes the plugin payload on a transient failure.
- **Spawned agents can open their documents** — Doc paths on the pipeline envelope (handoff, review report, phase plan, requirements) are now emitted absolute, so a coder or reviewer can open them directly from its worktree.
- **Dashboard navigation** — Stale document pulses and badges on project switch and cold load are gone, the sidebar filter survives selecting a project, and the document modal's delete action now resolves subfolder documents correctly.
- **Observability UI** — Token breakdown wrapped in a proper card shell with a tooltip; scroll-lock and repaint-safe reveal fixed in the agent inspector.

---

## v1.0.0-alpha.8 — 2026-05-04

A release focused on multi-harness support, a new pluggable adapter architecture, and a substantially revised documentation set.

### What's New

- **Multi-harness support** — The system now works across Claude Code, GitHub Copilot in VS Code, and GitHub Copilot CLI. A pluggable adapter layer compiles canonical `agents/` and `skills/` into each harness's required shape. Upgrades are manifest-aware — only changed files are updated, preserving local customizations. Uninstall is also supported.
- **Repo skill discovery** — The pipeline now automatically discovers workspace-local `SKILL.md` files and injects them into the planner spawn prompt as a `## Repository Skills Available` section, so the planner can incorporate project-specific tooling without manual wiring.
- **Quick pipeline template** — A lightweight `quick` template for simpler projects that skips brainstorming and goes straight to a single-phase execution loop.
- **Requirements workflow** — The planning skill now includes an explicit requirements phase before the master plan.
- **CI workflow** — GitHub Actions CI now runs tests on every push.

### What's Fixed

- Skill visibility (user-facing vs. agent-internal) is now explicit and consistently enforced across all harnesses.
- Removed a stale `scheduled_tasks.lock` file that could accumulate in long-running projects.
- Repaired broken references left behind from the RAD-SKILL-DISCOVERY rename.

### Changes

- **Documentation rewrite** — All user-facing docs revised for clarity, including a reorganized getting-started guide and a new `harnesses.md`.
- **Prompt regression harnesses** — New end-to-end harnesses for instructions-reach, quick pipeline, and repo skill discovery.
- **Adapter test coverage** — Each harness adapter ships with its own test file.

---

## v1.0.0-alpha.7 — 2026-04-28

A polish release focused on the dashboard — start projects without leaving the UI, a cleaner DAG timeline, smarter sidebar sorting, and a handful of cross-platform fixes.

### What's New

- **Start projects from the dashboard** — the project pane now has a **Start** action that launches a brainstorming or planning session directly into a Claude Code terminal.
- **Unified approval & execution dialogs** — plan approval, final approval, and execute-plan share a single, consistent confirmation popup.
- **DAG timeline, simplified** — execution timeline collapses to a two-layer accordion. Task iterations fold their substeps into the badge label, **Code Review** surfaces as a header link, and a new **Corrected** pill leads the trailing-link cluster on iterations that recovered from a corrective cycle. Iteration vocabulary is unified across **Coding**, **Reviewing**, **Correcting**, **Failed**, and **Halted**, with stage colors resolved consistently across the list and details header.
- **Smarter sidebar sorting** — **Urgency-first** ordering surfaces projects that need attention; **Done-first** reverses while keeping *Not Initialized* pinned to the bottom; **Updated (newest first)** is the new default secondary sort; undefined dates now respect direction. The active tier badge mirrors between the sidebar list and the details header with the in-progress spinner.
- **DAG-ordered planning documents** — phase plans and task handoffs are emitted in topological order so the docs you read match the order the pipeline will execute. Corrective handoffs use a clean `CT-*` label scheme; tail-bucket project prefixes are stripped and title-cased.

### What's Fixed

- **Project names with dots** (e.g., `RELEASE-1.7-TEST`) no longer get rejected by the approve dialog or start-action route.
- **Claude Code terminal launch on Windows** no longer prefixes `/rad-execute` with an unnecessary directory path.
- **Execution skill** loads properly — a stray `disable-model-invocation` flag that blocked model invocation has been removed.
- **`next build`** runs clean — a stray `require()` in the document-ordering tests was tripping the production lint gate.
- **Planning skill task-size descriptions** sharpened so junior/standard/senior coder routing is easier to reason about.

---

## v1.0.0-alpha.6 — 2026-04-24

Large release landing the process refactor — DAG-based pipeline engine, requirements-first planning, orchestrator-mediated corrective cycles, a rewritten executor and reviewer, and a monitoring UI rebuilt on the new state shape.

### Added

- **v5 DAG pipeline engine** — YAML pipeline templates driving a TypeScript engine, structurally validated at load time. Projects snapshot their template at creation. New `orchestration-state-v5.schema.json` with a v4 migration path.
- **Requirements-first planning** — planning collapses from five docs to two (**Requirements** + **Master Plan**); a single `planner` agent authors both, and an explosion step fans the approved plan out into per-phase and per-task docs before approval.
- **Diff-based scoped code review** — task, phase, and final reviews audit the scoped commit diff against the Requirements contract with per-requirement audit tables, scope-aware status (on-track / drift / regression at task/phase; met / missing at final), and an evidence-not-intent rule.
- **Orchestrator-mediated corrective cycles** — on `changes_requested`, the Orchestrator judges findings, writes an addendum, and authors a fresh corrective handoff. Task- and phase-scope cycles share one uniform pattern; reviewers do not carry prior-attempt memory.
- **Executor rewritten to one uniform contract** — `execute-coding-task` is handoff-only, no mode branching; code tasks run mandatory RED-GREEN with an anti-pattern gate and Execution Notes appendix.
- **Coder tiers** — `coder-junior` / `coder` / `coder-senior`, sized per handoff.
- **`rad-plan-audit` as a first-class action** — severity-based audit of Requirements + Master Plan before execution; runs pipeline-spawned or from chat.
- **Per-project source-control preferences** — commit/PR gates read `state.pipeline.source_control.*` instead of global config; `ask`/missing fails fast.
- **Monitoring UI rebuilt on v5** — multi-route App Router with shared header; v5 DAG timeline on `/projects`; new `/process-editor` route with a ReactFlow canvas and YAML↔graph serializer; two-tier sort builder in the sidebar; parallelized project discovery; rebranded to **Rad Orchestration** with the package version in the header.
- **Prompt regression harness** — new top-level `prompt-tests/` covering planning flow, task- and phase-level corrective mediation, code-review rework, and executor rework.
- **Agent + skill surface moved from `.github/` to `.claude/`**; installer gains a `claude-code` AI-tool option.
- **Brainstormer rework** — four new reference docs plus clearer open-questions verification; output feeds straight into the planner handoff.

### Fixed

- **UI memory crash** — SSE watcher and project-file walker no longer descend into `node_modules` / `.git` / `.next` / `.cache`, which had produced Windows EPERM floods and eventually OOM'd Next.js.
- **Autonomous pipeline stall** — `doc_path` is now a first-class iteration field, synthetic `phase_planning` / `task_handoff` step nodes are gone, and the walker self-heals missing body nodes on re-entry.
- **Iteration & corrective Doc button** — restored on iteration headers and corrective-task accordions with proper keyboard reachability.
- **Post-rollout engine bugs** — auto-resolution of phase/task indices, cross-platform path normalization, relative `doc_path` resolution, gate enrichment, and scaffolding ordering.

### Changed

- **Legacy planning surface retired** — `product-manager`, `research`, `architect`, and `ux-designer` agents and their create-* skills removed. `full.yml` stays on disk as a deprecated artifact; `default.yml` is the new default.
- **Source-control agent slimmed** — same `git-commit.js` / `gh-pr.js` execution path as before, but a much thinner driver around them with a clearer responsibility boundary and lower per-invocation cost.
- **Reviewers work from docs, not `state.json`** — state.json references removed from final and phase review workflows.
- **`/projects-v4` hidden from header nav** — route still resolves directly.
- **Version field** present in `installer`, `ui`, and `scripts` package.json so all three stay in lockstep.
