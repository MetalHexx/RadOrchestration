---
project: "AMENDMENT"
author: "research-agent"
created: "2026-03-13T00:00:00Z"
---

# AMENDMENT — Research Findings

## Research Scope

Explored the orchestration system codebase to map all insertion points for a plan amendment capability — covering the pipeline engine, state structure, validator, resolver, mutations, triage engine, agent definitions, skill patterns, documentation, and configuration. Special attention was given to the PIPELINE-HOTFIX sequencing dependency, as AMENDMENT runs after HOTFIX and must build on its patterns.

## Codebase Analysis

### Relevant Existing Code

| File/Module | Path | Relevance |
|-------------|------|-----------|
| Pipeline Engine | `.github/orchestration/scripts/lib/pipeline-engine.js` | Core orchestration loop — mutation → validate → triage → resolve. Amendment event handling, pre-read patterns, internal action loop, and EXTERNAL_ACTIONS set all need changes here. |
| Mutations | `.github/orchestration/scripts/lib/mutations.js` | Event-to-handler lookup table (`MUTATIONS` record). Needs new `plan_amendment_requested` handler and amendment-related mutations. Currently 18 handlers. |
| Resolver | `.github/orchestration/scripts/lib/resolver.js` | Pure function mapping state → next action. Needs amendment-aware routing: check `state.amendment` block before standard tier routing. Currently routes by `PIPELINE_TIERS` with 5 branches. |
| State Validator | `.github/orchestration/scripts/lib/state-validator.js` | 15 invariants (V1–V15). Amendment needs new invariants (V16+) for backward tier transitions and amendment block consistency. Uses `checkV*()` pattern with `makeError()` helper. |
| Constants | `.github/orchestration/scripts/lib/constants.js` | Frozen enums for all pipeline values. Needs new `NEXT_ACTIONS` entries for amendment actions and possibly a new `AMENDMENT_STATUSES` enum. Currently 35 NEXT_ACTIONS values. |
| Triage Engine | `.github/orchestration/scripts/lib/triage-engine.js` | Task/phase decision tables. No direct changes expected — amendment resumes normal execution flow after approval. |
| State I/O | `.github/orchestration/scripts/lib/state-io.js` | `readState`, `writeState`, `readConfig`, `readDocument`. No changes expected — existing I/O functions sufficient for amendment flow. Uses `extractFrontmatter()` for document pre-reads. |
| Pipeline CLI | `.github/orchestration/scripts/pipeline.js` | CLI entry point — passes through to `executePipeline()`. No changes expected. |
| Orchestrator Agent | `.github/agents/orchestrator.agent.md` | 18-action routing table + 19-event vocabulary. Needs new amendment actions/events added to both tables. |
| Product Manager Agent | `.github/agents/product-manager.agent.md` | Planning agent — will invoke `amend-plan` skill for PRD amendments. Currently invokes `create-prd` only. |
| UX Designer Agent | `.github/agents/ux-designer.agent.md` | Planning agent — will invoke `amend-plan` skill for Design amendments. Currently invokes `create-design` only. |
| Architect Agent | `.github/agents/architect.agent.md` | Planning agent — will invoke `amend-plan` skill for Architecture/Master Plan amendments. Currently invokes `create-architecture` and `create-master-plan`. |
| orchestration.yml | `.github/orchestration.yml` | System configuration. May need new amendment limits (e.g., `max_amendments_per_project`). |
| copilot-instructions.md | `.github/copilot-instructions.md` | Workspace instructions loaded by Copilot. Pipeline description needs amendment reference. |

### Existing Patterns

- **Event-Mutation-Validate-Triage-Resolve Pipeline**: The `executePipeline()` function in `pipeline-engine.js` (lines 1–430) follows a strict linear recipe. Events are mapped to mutation handlers via the `MUTATIONS` lookup table in `mutations.js`. After mutation, validation runs, then triage (for 3 specific events), then resolution. The amendment event must follow this same pattern.

- **Pre-Read Pattern**: Two pre-read patterns exist in `pipeline-engine.js`:
  1. **Master Plan pre-read** (for `plan_approved` event, ~line 155): reads master plan document via `io.readDocument()`, extracts `total_phases` from frontmatter, injects into `context` before passing to mutation handler.
  2. **Task Report pre-read** (for `task_completed` event, ~line 175): reads task report, extracts status/severity/deviations, normalizes status vocabulary, injects into `context`.
  
  The `plan_amendment_requested` event will likely need a similar pre-read to load the amendment scope or affected documents into context before mutation.

- **Internal Action Handling (Bounded Re-Resolve)**: `pipeline-engine.js` (~line 380) handles `advance_phase` internally — it applies phase advancement mutations, re-validates, re-resolves, and checks the EXTERNAL_ACTIONS guard. The loop is bounded to 1 internal iteration. Amendment may need its own internal actions (e.g., clearing `state.amendment` block after approval, resuming execution).

- **EXTERNAL_ACTIONS Guard**: A `Set<string>` of 18 external actions defined at module scope in `pipeline-engine.js` (lines 14–35). Any resolved action not in this set after internal handling triggers a hard error. New amendment-related external actions must be added to this set.

- **Mutation Handler Pattern**: Each handler in `mutations.js` takes `(state, context)`, mutates `state` in place, and returns `{ state, mutations_applied: string[] }`. Handlers are pure except for state mutation — no I/O. The `plan_amendment_requested` handler would follow this exact pattern.

- **Validator Invariant Pattern**: Each invariant in `state-validator.js` is a standalone `checkV*()` function that takes `(proposed)` or `(current, proposed)` and returns `InvariantError[]`. New amendment invariants (V16+) would follow this pattern and be appended to the `validateTransition()` aggregation.

- **Resolver Tier Routing**: `resolveNextAction()` in `resolver.js` routes by `state.pipeline.current_tier` through a 5-branch if/else chain: halted → complete → planning → execution → review. Amendment-aware routing would need to check for `state.amendment` before or within this chain.

- **Skill Structure**: Skills follow a consistent pattern:
  - `SKILL.md` with YAML frontmatter (`name`, `description`) and structured instructions
  - `templates/` directory with output document templates
  - Optional `scripts/`, `references/`, `assets/` directories
  - Used by agents via description-based matching

- **Agent Structure**: Agents have YAML frontmatter (`name`, `description`, `tools`, `agents`) and markdown instructions. Planning agents (PM, UX Designer, Architect) all follow the same pattern: read inputs → apply domain expertise → invoke skill → save output. They are lightweight — they contain domain rules but delegate workflow mechanics to skills.

- **State Schema**: `state.json` has these top-level blocks: `$schema`, `project`, `pipeline`, `planning`, `execution`, `final_review`, `errors`, `limits`. The `state.amendment` block would be a new top-level sibling to these.

- **`scaffoldInitialState()` Pattern**: In `pipeline-engine.js` (~line 45), new projects are scaffolded with default values for all blocks. The `state.amendment` block would need to be initialized here (likely as `null` or an empty object).

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Runtime | Node.js | v18+ | CommonJS modules, `'use strict'`, zero external dependencies |
| Testing | `node:test` | Built-in | Node.js native test runner |
| Config | YAML | N/A | `orchestration.yml` parsed via custom `yaml-parser.js` |
| State | JSON | N/A | `state.json` — sole source of pipeline truth |
| Documents | Markdown | N/A | Frontmatter (YAML) + body (Markdown), parsed via `extractFrontmatter()` |
| UI | Next.js + React | N/A | Dashboard UI in `ui/` — reads `state.json` for display (separate concern) |

## PIPELINE-HOTFIX Overlap Analysis

PIPELINE-HOTFIX is currently in execution (Phase 1, task 6 of 7 — engine fixes). Its master plan defines 3 phases. Key patterns established by HOTFIX that AMENDMENT must build on:

### HOTFIX Status

- **Current tier**: `execution` (Phase 1 in progress)
- **Total phases**: 3 (Engine Fixes → Skills/Agents → Documentation)
- **HOTFIX is not yet complete** — AMENDMENT planning should reference the HOTFIX Master Plan as the post-hotfix baseline, but the actual codebase may not yet reflect all HOTFIX changes.

### Pattern Overlap Map

| HOTFIX Pattern | Location | AMENDMENT Impact |
|----------------|----------|-----------------|
| **Master Plan pre-read** | `pipeline-engine.js` ~L155 (for `plan_approved`) | AMENDMENT's `plan_amendment_requested` mutation needs a similar pre-read to load amendment scope into context. Follow the same `io.readDocument()` → extract frontmatter → inject into `context` pattern. |
| **Internal action handling (bounded re-resolve)** | `pipeline-engine.js` ~L380 (`advance_phase`) | Amendment may need internal actions (e.g., `clear_amendment`, `resume_execution`). Must follow the same bounded loop pattern: apply mutations → re-validate → re-resolve → check EXTERNAL_ACTIONS. Max 1 internal iteration per pass. |
| **Task report status normalization** | `pipeline-engine.js` ~L175 (`task_completed` pre-read) | After amendment approval and execution resumption, the normalization layer still applies. AMENDMENT doesn't bypass it — no special handling needed. |
| **State validator (V1–V15 preserved)** | `state-validator.js` (all 15 `checkV*` functions) | AMENDMENT adds V16+ invariants on top. Existing invariants must be preserved. Key concern: V7 (`human_approved` before `execution`) needs careful handling since amendment causes backward tier transition from `execution → planning`. V7 still passes because `planning.human_approved` remains `true` from the original approval. |
| **EXTERNAL_ACTIONS set** | `pipeline-engine.js` L14–35 | New amendment external actions must be added to this set. Currently 18 actions. |
| **`MUTATIONS` lookup table** | `mutations.js` L340–360 | New amendment event handler must be added to this table. Currently 18 entries. |
| **`log-error` skill** (HOTFIX Phase 2) | `.github/skills/log-error/` (not yet created) | AMENDMENT's new pipeline events and mutation handlers should produce error results compatible with the Orchestrator's error-logging flow. |
| **Documentation sweep** (HOTFIX Phase 3) | `docs/`, `README.md`, `.github/copilot-instructions.md` | AMENDMENT doc updates layer on top of HOTFIX docs. AMENDMENT should target the post-HOTFIX doc baseline, not current pre-HOTFIX versions. Both projects update the same files. |
| **`generate-task-report` vocabulary** (HOTFIX Phase 2) | `.github/skills/generate-task-report/` | AMENDMENT doesn't change task report vocabulary — no conflict. |
| **`total_phases` in Master Plan frontmatter** (HOTFIX Phase 2) | `.github/skills/create-master-plan/templates/` | Amendment of the Master Plan could change `total_phases`. The `amend-plan` skill must update this frontmatter field when phases are added/removed. |

### HOTFIX Architecture Reference

Key architectural decisions from the HOTFIX Master Plan that constrain AMENDMENT:
- Mutations stay pure — I/O stays in the engine
- `PHASE_STATUSES` imported from constants wherever phase status is referenced
- The `EXTERNAL_ACTIONS` set is the authoritative gate between internal and external actions
- Hard errors (exit 1) for all new failure conditions — no silent failures
- Zero new dependencies — CommonJS + Node.js built-ins only

## Specific Insertion Points

### 1. Pipeline Engine (`pipeline-engine.js`)

| Change | Location | Details |
|--------|----------|---------|
| New pre-read block | After task report pre-read (~L195), before `mutation()` call | If `event === 'plan_amendment_requested'`, read amendment scope from context or documents |
| Tier guard for review rejection | Inside pre-read or early in mutation path | If `state.pipeline.current_tier === 'review'`, return error result rejecting the event |
| New internal action handlers | After `advance_phase` handling (~L380) | Handle amendment-related internal actions (e.g., `clear_amendment_block`, `resume_from_amendment`) following the same bounded re-resolve pattern |
| EXTERNAL_ACTIONS additions | Module-scope `Set` (L14–35) | Add new amendment-related external actions (e.g., `request_amendment_approval`, `spawn_amend_prd`, `spawn_amend_design`, `spawn_amend_architecture`, `spawn_amend_master_plan`) |
| `scaffoldInitialState()` update | ~L45–80 | Add `amendment: null` (or empty object) to initial state template |

### 2. Mutations (`mutations.js`)

| Change | Location | Details |
|--------|----------|---------|
| New handler: `handlePlanAmendmentRequested` | After `handleFinalRejected` (~L330) | Sets `state.amendment` block with status, scope, affected_docs, source_tier. If `source_tier === 'execution'`, records current phase/task position for resume. If `source_tier === 'complete'`, marks for new phase append. |
| New handler: `handleAmendmentApproved` | After amendment handler | Clears `state.amendment.human_approved = true`, transitions tier back to execution or appends new phases |
| New handler: `handleAmendmentRejected` | After amendment approved handler | Clears amendment block, resumes from `source_tier` position |
| `MUTATIONS` table additions | L340–360 | Add new event-to-handler mappings |
| Possible: amendment-aware phase replanning | Near `handlePhasePlanCreated` | After amendment approval, current + next phases may need re-planning signals |

### 3. Resolver (`resolver.js`)

| Change | Location | Details |
|--------|----------|---------|
| Amendment check in `resolveNextAction()` | Before tier routing (~L430) | If `state.amendment` exists and is active: route to amendment-specific actions (e.g., `request_amendment_approval` if not approved, `spawn_amend_*` for pending doc amendments) |
| New `resolveAmendment()` function | New section between `resolvePlanning` and `resolveExecution` | Routes through amendment lifecycle: scope confirmation → doc amendments → cascade check → re-approval gate → resume |
| Resume routing from amendment | End of `resolveAmendment()` | Uses `state.amendment.source_tier` to determine resume point: `execution` → back to current phase, `complete` → start new phases |

### 4. State Validator (`state-validator.js`)

| Change | Location | Details |
|--------|----------|---------|
| V16: Amendment block consistency | New `checkV16()` function | If `state.amendment` exists: validate required fields (`status`, `source_tier`, `scope`), validate `source_tier` is `execution` or `complete` |
| V17: Amendment approval gate | New `checkV17()` function | If `state.amendment` exists and `human_approved === false`, `pipeline.current_tier` cannot be `execution` (blocks premature resume) |
| V18: Backward tier transition guard | New `checkV18()` function | `execution → planning` or `complete → planning` transitions only valid when `state.amendment` is active |
| `validateTransition()` update | After V15 checks (~L440) | Append `checkV16()`, `checkV17()`, `checkV18()` to the aggregation. Update `invariants_checked` count from 15 to 18. |

### 5. Constants (`constants.js`)

| Change | Location | Details |
|--------|----------|---------|
| New NEXT_ACTIONS entries | In `NEXT_ACTIONS` freeze block (~L240) | Add amendment-specific actions: `REQUEST_AMENDMENT_APPROVAL`, `SPAWN_AMEND_PRD`, `SPAWN_AMEND_DESIGN`, `SPAWN_AMEND_ARCHITECTURE`, `SPAWN_AMEND_MASTER_PLAN`, `RESUME_FROM_AMENDMENT`, etc. Total grows from 35. |
| Possible: AMENDMENT_STATUSES enum | After existing enums | `{ PENDING: 'pending', IN_PROGRESS: 'in_progress', APPROVED: 'approved', REJECTED: 'rejected' }` |

### 6. Orchestrator Agent (`orchestrator.agent.md`)

| Change | Location | Details |
|--------|----------|---------|
| Action Routing Table additions | Table rows 19+ | New amendment actions with corresponding spawn/gate operations |
| Event Signaling Reference additions | After `final_rejected` | New events: `plan_amendment_requested`, `amendment_approved`, `amendment_rejected`, `amend_prd_completed`, `amend_design_completed`, `amend_architecture_completed`, `amend_master_plan_completed` |
| Amendment flow documentation | New section after Recovery | Brief description of amendment flow and how it integrates with the event loop |

### 7. Planning Agents (Product Manager, UX Designer, Architect)

| Change | Location | Details |
|--------|----------|---------|
| `amend-plan` skill reference | Each agent's skills section | Add `amend-plan` to the skills list. Agents remain lightweight — the skill contains all amendment mechanics. |
| Amendment mode instructions | Brief addition to each agent's Workflow section | "When spawned for amendment: invoke the `amend-plan` skill with the existing document and amendment scope." |

### 8. orchestration.yml

| Change | Location | Details |
|--------|----------|---------|
| Amendment limits | New `amendments` section or under `limits` | `max_amendments_per_project: N` (optional rate limiter) |

### 9. Documentation Files

| File | Changes Needed |
|------|---------------|
| `README.md` | Pipeline flowchart: add amendment loop branch. Key Features: add "Plan Amendment" entry. |
| `docs/pipeline.md` | New "Amendment Pipeline" section with sequence diagram. Tier model updated for backward transitions. Tier table notes. |
| `docs/skills.md` | `amend-plan` added to Planning Skills table. Skill-Agent Composition table updated (PM, UX Designer, Architect gain `amend-plan`). |
| `docs/configuration.md` | New amendment configuration keys documented. |
| `docs/scripts.md` | New events added to Event Vocabulary table. New actions added to Action Vocabulary. |
| `.github/copilot-instructions.md` | Pipeline description updated to reference amendment capability. |
| `.github/instructions/state-management.instructions.md` | Pipeline Tiers note updated for backward transitions under amendment. New invariants referenced. |
| `.github/instructions/project-docs.instructions.md` | File Ownership: no new doc types from amendment (amended docs retain original ownership). |

## Constraints Discovered

- **V7 Invariant Sensitivity**: V7 checks `planning.human_approved === true` when `current_tier === 'execution'`. Since amendment causes a temporary backward transition to planning tier, V7 is unaffected (it only fires when tier IS execution, not when transitioning FROM it). However, the amendment block must correctly manage tier transitions to avoid V7 and V12 (task status transition) violations.

- **Single In-Progress Task (V6)**: Only one task can be `in_progress` at a time. The "current task finishes before amendment begins" requirement aligns with this — no amendment while a task is in progress.

- **`triage_attempts` Reset**: When execution resumes after amendment, `triage_attempts` should be reset to 0 to avoid stale loop detection.

- **Completed Phase Immutability**: Completed phases should not be modified by amendment. The brainstorming doc specifies "existing completed phases are untouched — they're history." The validator should enforce this (potentially V19).

- **`total_phases` Frontmatter Coupling**: Master Plan amendments that add/remove phases must update `total_phases` in frontmatter. The `plan_approved` pre-read pattern reads this value — but after amendment, a different event (e.g., `amendment_approved`) needs to re-read it to re-initialize `execution.phases[]`.

- **No State History**: `state.json` tracks only current state, not history. Amendment block tracks current amendment only — no amendment log.

- **Zero Dependencies Constraint**: All changes must use CommonJS + Node.js built-ins only. No external packages.

- **HOTFIX Not Yet Complete**: PIPELINE-HOTFIX is in execution. AMENDMENT planning should reference the HOTFIX Master Plan as the post-hotfix design baseline, but actual code may still reflect pre-hotfix state. AMENDMENT implementation (coding phase) must run after HOTFIX completes.

## Recommendations

- **Follow the `advance_phase` internal action pattern exactly**: The bounded re-resolve loop established by HOTFIX for `advance_phase` is the right model for amendment internal actions. Keep max internal iterations at 1 per pass.

- **`state.amendment` as a nullable top-level block**: When no amendment is active, `state.amendment` should be `null` (not an empty object). This makes the resolver check trivial: `if (state.amendment) { ... }`.

- **Reuse the `plan_approved` pre-read pattern for amendment approval**: When `amendment_approved` fires, pre-read the amended Master Plan to get updated `total_phases` and re-initialize/extend `execution.phases[]` accordingly.

- **New validator invariants should be additive only**: Keep V1–V15 untouched. Add V16–V18 (or more) for amendment-specific constraints. Update `invariants_checked` count.

- **The `amend-plan` skill should produce structured output**: The skill's output should include `{ amended_doc, cascade_flags[], sections_changed[] }` so the pipeline (or Orchestrator) can reason about downstream impacts without re-reading the full document.

- **Tier transition for amendment is `execution → planning` or `complete → planning`**: The resolver should recognize these backward transitions as valid only when `state.amendment` is active. The validator should enforce this as an invariant.

- **Documentation should be its own phase**: Both the brainstorming doc and HOTFIX's Master Plan treat documentation updates as a dedicated phase. AMENDMENT should follow this pattern.

- **Consider the UI dashboard impact**: The `ui/` directory reads `state.json` for display. The new `state.amendment` block should be visible in the dashboard. This is likely out of scope for the AMENDMENT project itself but should be noted as a follow-up.

- **Test strategy**: Follow HOTFIX's regression test pattern — add tests for every new mutation, validator invariant, resolver path, and EXTERNAL_ACTIONS membership. Use the existing test file structure (`mutations.test.js`, `pipeline-engine.test.js`, etc.).

- **Amendment from `complete` tier should set `execution.status = 'in_progress'`**: When appending new phases to a completed project, the execution status needs to be re-activated and `current_phase` set to the first new phase index.

- **Cascade analysis in the skill, not the pipeline**: The `amend-plan` skill should own cascade logic (PRD change → flag Design → flag Architecture → flag Master Plan). The pipeline only needs to know which docs were amended and whether re-approval is needed.
