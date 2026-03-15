---
project: "PIPELINE-SIMPLIFICATION"
author: "research-agent"
created: "2026-03-14T00:00:00Z"
---

# PIPELINE-SIMPLIFICATION — Research Findings

## Research Scope

Analyzed the entire orchestration pipeline engine (7 modules + entry point), all 20 test files, 9 agent definitions, 17 skills, 14 skill templates, 5 archive templates, orchestration.yml config, state.json schema, and all docs — scoped to what the pipeline simplification project will modify, replace, or align.

## Codebase Analysis

### Pipeline Engine Modules (Target of Refactor)

| File/Module | Path | Lines (approx) | Relevance |
|-------------|------|----------------|-----------|
| Entry point | `.github/orchestration/scripts/pipeline.js` | ~48 | CLI wrapper; arg parsing, DI construction, delegates to engine. Minimal changes needed — swap `require` paths after lib-v3 swap |
| Pipeline engine | `.github/orchestration/scripts/lib/pipeline-engine.js` | ~340 | **Primary refactor target.** 3 code paths (init, cold-start, standard); standard forks into triage vs non-triage with deferred validation, V8/V9 filtering, internal action loop (MAX_INTERNAL_ITERATIONS=2), timestamp racing workaround. Contains `scaffoldInitialState`, `normalizeContextPaths`, `createProjectAwareReader`, all pre-read logic (4 events: `plan_approved`, `task_completed`, `phase_plan_created`, `code_review_completed` via triage) |
| Mutations | `.github/orchestration/scripts/lib/mutations.js` | ~380 | 18 event handlers + `needsTriage()` + `applyTaskTriage()` + `applyPhaseTriage()` + `normalizeDocPath()`. The `applyTaskTriage/applyPhaseTriage` functions are the second half of the split-write that should be absorbed. `needsTriage()` is the trigger — returns `{ shouldTriage, level }` for 3 events |
| Triage engine | `.github/orchestration/scripts/lib/triage-engine.js` | ~460 | **Deletion target.** 11-row task decision table (`triageTask`), 5-row phase decision table (`triagePhase`), `executeTriage` dispatcher, `checkRetryBudget` helper, `makeError`/`makeSuccess` result builders, `VALID_VERDICTS` set, immutability checks. The actual decision logic is ~80 lines; the rest is scaffolding, document re-reads, state validation guards, result builders, and type definitions |
| Resolver | `.github/orchestration/scripts/lib/resolver.js` | ~450 | `resolveNextAction()` main entry, `resolvePlanning()`, `resolveExecution()`, `resolveReview()`, `resolveTaskLifecycle()`, `resolvePhaseLifecycle()`, `resolveHumanGateMode()`. Returns one of 35 NEXT_ACTIONS values. Planning resolver is clean. Execution resolver references 16 internal actions that need removal. Internal actions from resolver: `ADVANCE_TASK`, `ADVANCE_PHASE`, `TRANSITION_TO_EXECUTION`, `TRANSITION_TO_REVIEW`, `TRANSITION_TO_COMPLETE`, `UPDATE_STATE_FROM_TASK`, `HALT_TASK_FAILED`, `UPDATE_STATE_FROM_REVIEW`, `TRIAGE_TASK`, `HALT_TRIAGE_INVARIANT`, `RETRY_FROM_REVIEW`, `HALT_FROM_REVIEW`, `UPDATE_STATE_FROM_PHASE_REVIEW`, `TRIAGE_PHASE`, `HALT_PHASE_TRIAGE_INVARIANT`, `CREATE_CORRECTIVE_HANDOFF` |
| State validator | `.github/orchestration/scripts/lib/state-validator.js` | ~440 | 15 invariant checks (V1–V15). V1-V7 are structural (keep). V8 (review_doc without verdict) and V9 (phase_review without verdict) exist solely for split-write protection — removable with atomic writes. V10 is structural guard (keep). V11-V13 are current→proposed comparisons (keep, simplify). V14 (write-ordering: review_doc + verdict in same write) exists solely for split-write — removable. V15 (cross-task immutability) is also split-write protection — removable |
| Constants | `.github/orchestration/scripts/lib/constants.js` | ~270 | 12 frozen enums. `NEXT_ACTIONS` has 35 values (18 external + 17 internal). Needs to shrink to ~19 external-only. All type definitions for StateJson, Phase, Task, PlanningStep live here as JSDoc. Enums: `PIPELINE_TIERS`, `PLANNING_STATUSES`, `PLANNING_STEP_STATUSES`, `PHASE_STATUSES`, `TASK_STATUSES`, `REVIEW_VERDICTS`, `REVIEW_ACTIONS`, `PHASE_REVIEW_ACTIONS`, `SEVERITY_LEVELS`, `HUMAN_GATE_MODES`, `TRIAGE_LEVELS`, `NEXT_ACTIONS` |
| State I/O | `.github/orchestration/scripts/lib/state-io.js` | ~130 | `readState`, `writeState`, `readConfig`, `readDocument`, `ensureDirectories`, `DEFAULT_CONFIG`. External deps: reuses `fs-helpers`, `yaml-parser`, `frontmatter` from validate-orchestration skill scripts. **Largely unchanged** in refactor — pure I/O isolation |

### Test Suite (Target of Rewrite)

| File | Path | Relevance |
|------|------|-----------|
| Behavioral tests | `.github/orchestration/scripts/tests/pipeline-behavioral.test.js` | **Full rewrite.** ~2,200+ lines, 10 describe blocks covering: full happy path, multi-phase multi-task, task triage, phase triage, human gate modes, retry & corrective cycles, halt paths, cold-start resume, pre-read failures, frontmatter-driven flows. Tightly coupled to split-write/triage/internal-action architecture |
| Engine integration tests | `.github/orchestration/scripts/tests/pipeline-engine.test.js` | **Rewrite.** Tests engine paths including triage forking, deferred validation, internal action loop |
| Mutation unit tests | `.github/orchestration/scripts/tests/mutations.test.js` | **Rewrite.** Tests current mutation signatures. Factories (`makeBaseState`, `makePlanningState`, `makeExecutionState`) define the current schema shape |
| Resolver tests | `.github/orchestration/scripts/tests/resolver.test.js` | **Rewrite.** Tests 35 action resolution including 16 internal actions being removed |
| Validator tests | `.github/orchestration/scripts/tests/state-validator.test.js` | **Rewrite.** Tests V1-V15; V8/V9/V14/V15 tests deleted with invariants |
| Triage engine tests | `.github/orchestration/scripts/tests/triage-engine.test.js` | **Delete** along with the module |
| CLI tests | `.github/orchestration/scripts/tests/pipeline.test.js` | Minor update for new entry point |
| Constants tests | `.github/orchestration/scripts/tests/constants.test.js` | Update for reduced action enum |
| State I/O tests | `.github/orchestration/scripts/tests/state-io.test.js` | Likely unchanged |
| Validation suite tests | `tests/{agents,config,cross-refs,frontmatter,fs-helpers,instructions,prompts,reporter,skills,structure,yaml-parser}.test.js` | **Not in scope** — these test the validate-orchestration skill, not the pipeline engine |

### Agent Definitions (Alignment Targets)

| Agent | Path | Alignment Impact |
|-------|------|------------------|
| Orchestrator | `.github/agents/orchestrator.agent.md` | **High.** 18-action routing table needs update: remove `create_corrective_handoff` (merged into `create_task_handoff` with `is_correction` context), update halt actions to generic `display_halted`. Event signaling table unchanged. References to `triage_attempts` stay (2 mentions: "never track" instruction, recovery note) but may need rewording when field is removed from schema |
| Tactical Planner | `.github/agents/tactical-planner.agent.md` | **Medium.** Prior Context Routing tables reference `corrective_task_issued` action value — this stays but the routing instruction changes from `CREATE_CORRECTIVE_HANDOFF` to `CREATE_TASK_HANDOFF` with `is_correction` context |
| Coder | `.github/agents/coder.agent.md` | **Low.** No pipeline-specific routing; reads handoff, writes code/report. No changes expected |
| Reviewer | `.github/agents/reviewer.agent.md` | **Low.** Verdict field requirements (`verdict`, `exit_criteria_met`) unchanged. No pipeline-specific actions referenced |
| Research | `.github/agents/research.agent.md` | None |
| Product Manager | `.github/agents/product-manager.agent.md` | None |
| UX Designer | `.github/agents/ux-designer.agent.md` | None |
| Architect | `.github/agents/architect.agent.md` | None |
| Brainstormer | `.github/agents/brainstormer.agent.md` | None |

### Skills (Alignment Targets)

| Skill | Path | Alignment Impact |
|-------|------|------------------|
| `create-task-handoff` | `.github/skills/create-task-handoff/SKILL.md` | **Medium.** Prior Context Routing table references `corrective_task_issued` — stays, but Corrective Task Handoff section may need update for `is_correction` context flag. References "triage outcomes" in inputs table |
| `generate-task-report` | `.github/skills/generate-task-report/SKILL.md` | **Medium.** References "triage engine" for `has_deviations`/`deviation_type` (2 occurrences). After refactor, the consumer is the mutation handler, not a separate triage engine. Update consumer column |
| `review-phase` | `.github/skills/review-phase/SKILL.md` | **Medium.** References "triage engine" for `exit_criteria_met` (3 occurrences). Same update — consumer becomes mutation handler |
| `create-phase-plan` | `.github/skills/create-phase-plan/SKILL.md` | **Low.** References `phase_review_action` values which stay. Corrective handling routing table stays |
| `generate-phase-report` | `.github/skills/generate-phase-report/SKILL.md` | None |
| `review-task` | `.github/skills/review-task/SKILL.md` | None |
| `log-error` | `.github/skills/log-error/SKILL.md` | None |
| `run-tests` | `.github/skills/run-tests/SKILL.md` | None |
| Others (brainstorm, research-codebase, create-prd, create-design, create-architecture, create-master-plan, create-agent, create-skill, validate-orchestration) | `.github/skills/*/SKILL.md` | None |

### Skill Templates (Alignment Targets)

| Template | Path | Alignment Impact |
|----------|------|------------------|
| Task Report | `.github/skills/generate-task-report/templates/TASK-REPORT.md` | **Low.** Frontmatter fields (`status`, `has_deviations`, `deviation_type`) remain pipeline-critical. No field changes needed |
| Phase Review | `.github/skills/review-phase/templates/PHASE-REVIEW.md` | **Low.** `exit_criteria_met` field stays pipeline-critical. No field changes needed |
| Code Review | `.github/skills/review-task/templates/CODE-REVIEW.md` | **Low.** `verdict` field stays pipeline-critical. No field changes needed |
| Phase Plan | `.github/skills/create-phase-plan/templates/PHASE-PLAN.md` | **Low.** `tasks` array stays pipeline-critical. No field changes needed |
| Task Handoff | `.github/skills/create-task-handoff/templates/TASK-HANDOFF.md` | None — consumed by Coder, not by pipeline |
| Phase Report | `.github/skills/generate-phase-report/templates/PHASE-REPORT.md` | None |
| All others | Various | None |

### Archive Templates

| Template | Path | Impact |
|----------|------|--------|
| Task Handoff | `archive/schemas/task-handoff-template.md` | None — archive copy, not referenced by pipeline |
| Task Report | `archive/schemas/task-report-template.md` | None — archive copy |
| Phase Report | `archive/schemas/phase-report-template.md` | None — archive copy |
| Phase Review | `archive/schemas/phase-review-template.md` | None — archive copy |
| Code Review | `archive/schemas/code-review-template.md` | None — archive copy |

### Documentation (Update Targets)

| File | Path | Update Impact |
|------|------|---------------|
| Pipeline docs | `docs/pipeline.md` | **Medium.** Describes triage, internal actions, triage_attempts lifecycle. Narrative flow stays, but triage section, internal action references, and triage_attempts explanation need updating |
| Script docs | `docs/scripts.md` | **High.** Restates every event (19), every action (35 including 17 internal), module architecture, result shapes. Internal action tables need removal. Module architecture section needs update (triage-engine deleted, pre-reads.js added). Consider replacing exhaustive action list with pointer to `constants.js` |
| Validation docs | `docs/validation.md` | **Medium.** Lists invariant catalog V1-V15. V8/V9/V14/V15 rows removed. "Validation runs twice" note changes to "validation runs once" |
| Agents docs | `docs/agents.md` | **Low.** Describes agent roles, not pipeline internals. Orchestrator blurb mentions `triage_attempts` — update |
| Skills docs | `docs/skills.md` | **Low.** Skill inventory tables. No pipeline-specific content |
| README | `README.md` | **Low.** High-level descriptions. Update module count, line count claims, action count if mentioned |
| Config docs | `docs/configuration.md` | None |
| Dashboard docs | `docs/dashboard.md` | None |
| Getting started | `docs/getting-started.md` | None |
| Project structure | `docs/project-structure.md` | None |

### Configuration

| File | Path | Relevance |
|------|------|-----------|
| orchestration.yml | `.github/orchestration.yml` | **No changes.** Schema stays: `projects.base_path`, `limits.*`, `errors.*`, `human_gates.*`, `git.*`. The pipeline reads `max_retries_per_task`, `max_phases`, `max_tasks_per_phase`, `max_consecutive_review_rejections`, `execution_mode` — all stay |

### Instructions

| File | Path | Relevance |
|------|------|-----------|
| Project docs | `.github/instructions/project-docs.instructions.md` | **Low.** Naming rules and sole writer policy unchanged. No pipeline-specific content |
| State management | `.github/instructions/state-management.instructions.md` | **Medium.** Mentions "pipeline engine calls `state-validator.validateTransition(current, proposed)` after every mutation and after every triage mutation." The "after every triage mutation" clause removed. Triage_attempts lifecycle note may need update |

## Existing Patterns

- **Dependency injection for I/O**: `createMockIO()` factory constructs `{ readState, writeState, readConfig, readDocument, ensureDirectories }` — enables pure testing with no filesystem. This pattern is clean and should be preserved
- **Lookup table mutation dispatch**: `MUTATIONS` record maps event → handler function. Clean pattern, stays
- **Node.js native test runner**: All tests use `node:test` and `node:assert/strict`. No external test frameworks. Must stay zero-dependency
- **Factory functions for test state**: `createBaseState()`, `makePlanningState()`, `makeExecutionState()` with spreads/overrides. Pattern is good
- **Frozen enum objects**: All constants use `Object.freeze()`. Pattern stays
- **JSDoc type definitions**: All type contracts defined in `constants.js` as JSDoc `@typedef`. No TypeScript. Pattern stays
- **Pre-read enrichment**: Pipeline reads agent output documents before mutation to extract/validate frontmatter fields. Currently in `pipeline-engine.js` as inline blocks per event. In refactor, moves to dedicated `pre-reads.js` module
- **Project-aware document reader**: `createProjectAwareReader(readDocument, projectDir)` tries path as-is, then joins with projectDir. Used for triage document reads. Should be preserved for pre-reads
- **Path normalization**: `normalizeDocPath()` strips workspace-relative prefix. `normalizeContextPaths()` normalizes path-valued context keys. Both stay

## Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | (no version pinned) | Zero external dependencies. No `package.json` for scripts |
| Test runner | `node:test` (built-in) | Node.js built-in | `describe`/`it`/`beforeEach` from `node:test`, `assert` from `node:assert/strict` |
| Config | YAML | Parsed by local `yaml-parser.js` | Custom parser in validate-orchestration skill scripts |
| Frontmatter | Custom | Parsed by local `frontmatter.js` | Custom extractor in validate-orchestration skill scripts |
| State format | JSON | `state.json` per project | Schema version: `orchestration-state-v2` (bumps to v3) |
| Agent defs | Markdown | `.agent.md` with YAML frontmatter | VS Code / Copilot agent format |
| Skills | Markdown | `SKILL.md` with YAML frontmatter | Copilot skill format |
| UI Dashboard | Next.js / React / TypeScript | package.json in `ui/` | **Out of scope** — reads state.json, not modified by pipeline |

## External Research

| Source | Key Finding |
|--------|-------------|
| Brainstorming doc (PIPELINE-SIMPLIFICATION-BRAINSTORMING.md) | 11 validated goals covering: atomic event processing, triage elimination, internal action elimination, validator reduction, artifact enforcement preservation, execution sequence preservation, linear engine recipe, test rewrite, write-new-then-swap delivery, documentation updates, agent/skill/template alignment |
| Analysis doc | Referenced in brainstorming but does not exist at the expected path. Full technical inventory, bug patterns, decision tables, invariant analysis, and action inventory are described inline in the brainstorming doc |

## Constraints Discovered

- **Zero external dependencies**: Pipeline scripts must remain dependency-free Node.js. No npm packages
- **Schema version bump required**: Current `orchestration-state-v2` bumps to `orchestration-state-v3`. Existing projects will need to restart — no in-place migration (per brainstorming resolved question)
- **`triage_attempts` field removed from schema**: With atomic writes, the "triage ran twice" scenario is impossible by construction. `triage_attempts` exists at both `execution.triage_attempts` (global) and `phase.triage_attempts` (per-phase) — both removed
- **`partial` task report status maps to `failed`**: Simplifies the task decision table from 11 rows to 8. Pre-read accepts `complete` or `failed` (plus synonyms `pass`/`fail`). `partial` maps to `failed`
- **`create_corrective_handoff` merged into `create_task_handoff`**: Distinguished via `is_correction` context flag. Reduces action count
- **Halt actions consolidated**: `halt_task_failed`, `halt_from_review`, and specific halt actions merge into generic `display_halted` with reason in `result.context.details`
- **State I/O depends on validate-orchestration skill scripts**: `state-io.js` imports `fs-helpers`, `yaml-parser`, `frontmatter` from `.github/skills/validate-orchestration/scripts/lib/utils/`. This cross-dependency stays or is internalized
- **Pre-read validation is non-negotiable**: 5 event types require pre-read document validation: `plan_approved` (total_phases), `task_completed` (status, has_deviations, deviation_type), `code_review_completed` (verdict — currently done by triage, moves to pre-read), `phase_plan_created` (tasks array), `phase_review_completed` (verdict, exit_criteria_met — currently done by triage, moves to pre-read)
- **Validator ALLOWED_TASK_TRANSITIONS map**: `not_started→in_progress`, `in_progress→complete|failed|halted`, `failed→in_progress`, `complete→[]`, `halted→[]`. This stays unchanged
- **Internal action loop in engine**: Currently `MAX_INTERNAL_ITERATIONS=2` with re-validate + re-write per iteration. Handles `ADVANCE_TASK` and `ADVANCE_PHASE`. In refactor, these become part of the mutation — no loop needed
- **writeState double-timestamps**: `state-io.writeState()` sets `project.updated` internally, and `pipeline-engine.js` also sets `project.updated` before validation. This creates a double-write pattern that should be rationalized in the refactor
- **Orchestrator routing table exactly matches EXTERNAL_ACTIONS set**: The 18-action table in `orchestrator.agent.md` maps 1:1 to the `EXTERNAL_ACTIONS` set in `pipeline-engine.js`. After refactor, both need consistent update
- **Orchestrator sees `create_corrective_handoff` as action #7 variant**: Row 7 in the routing table says "If `result.context.corrective` is true, instruct Planner to create a corrective handoff." This means the Orchestrator already dispatches `create_task_handoff` with corrective context — the `create_corrective_handoff` action in the resolver would just be renamed/merged

## Recommendations

- **New module `pre-reads.js`**: Extract all 5 pre-read blocks from `pipeline-engine.js` into a dedicated module. Each pre-read is a pure function: `(event, context, readDocument) → enrichedContext | error`. This centralizes artifact validation and makes the engine's linear recipe readable
- **Decision table helpers as pure functions**: The 8 task rows and 5 phase rows from `triage-engine.js` move into utility functions called directly by the relevant mutation handlers in `mutations.js`. Functions like `resolveTaskOutcome(reportStatus, verdict, hasDeviations, deviationType, retries, maxRetries)` returning `{ taskStatus, reviewVerdict, reviewAction }`
- **Resolver shrinks significantly**: Remove all 16 internal actions. The execution resolver's `resolveTaskLifecycle` simplifies: after mutation, the task is already in its final state, so the resolver just inspects and returns the external action. No `ADVANCE_TASK` / `TRIAGE_TASK` / `HALT_TASK_FAILED` — those are effects, not actions
- **Validator becomes proposed-only for most checks**: With atomic writes, V11 (retry monotonicity) and V12 (status transitions) still need current→proposed comparison. V13 (timestamp) simplifies. V8/V9/V14/V15 deleted. Invariant count drops from 15 to ~10
- **Test factory reuse**: The `createMockIO` pattern and state factory pattern are clean. Port them to the new test files. Add v3 schema factory (`createBaseStateV3`)
- **State schema v3 changes**: Remove `execution.triage_attempts`, remove `phase.triage_attempts`, change `$schema` to `orchestration-state-v3`. All other fields stay. The `scaffoldInitialState` function in the engine updates accordingly
- **Delivery path**: Write new modules in `.github/orchestration/scripts/lib-v3/` → write and run new test suite → verify → swap to `lib/` (rename old to `lib-old/`) → update `pipeline.js` require path → final cleanup
- **Agent/skill alignment is a final pass**: After pipeline modules are stable, audit all `.agent.md` and `SKILL.md` files. Changes are minor: update "triage engine" references to "mutation handler" in consumer columns, remove references to deleted actions, update Orchestrator routing table from 18 to ~16 rows
