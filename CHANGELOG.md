# Changelog

All notable changes to this project are documented here. For full per-release detail, see the `RELEASE-NOTES-v*.md` files or the [GitHub Releases page](https://github.com/MetalHexx/RadOrchestration/releases).

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
