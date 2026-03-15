---
project: "AMENDMENT"
total_phases: 4
status: "draft"
author: "architect-agent"
created: "2026-03-13T00:00:00Z"
---

# AMENDMENT — Master Plan

## Executive Summary

The orchestration pipeline is strictly forward-only: once execution begins, planning documents cannot be formally amended. This project adds a plan amendment capability that lets a human amend any planning document (PRD, Design, Architecture, Master Plan) from both mid-execution and post-completion states using a single consistent workflow. The implementation extends the existing event-mutation-validate-resolve pipeline with backward tier transitions, a new `state.amendment` block, seven new mutation handlers, amendment-aware resolver routing, four additive validator invariants (V16–V19), a shared `amend-plan` skill with deterministic cascade analysis, and updates to all four affected agents. A pipeline-enforced re-approval gate ensures human oversight before execution resumes. The work is organized into 4 phases — engine core, resolver & skill, agent updates, and documentation sweep — and builds on the post-PIPELINE-HOTFIX codebase.

## Source Documents

| Document | Path | Status |
|----------|------|--------|
| Brainstorming | [AMENDMENT-BRAINSTORMING.md](.github/projects/AMENDMENT/AMENDMENT-BRAINSTORMING.md) | ✅ |
| Research Findings | [AMENDMENT-RESEARCH-FINDINGS.md](.github/projects/AMENDMENT/AMENDMENT-RESEARCH-FINDINGS.md) | ✅ |
| PRD | [AMENDMENT-PRD.md](.github/projects/AMENDMENT/AMENDMENT-PRD.md) | ✅ |
| Design | [AMENDMENT-DESIGN.md](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md) | ✅ |
| Architecture | [AMENDMENT-ARCHITECTURE.md](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md) | ✅ |
| PIPELINE-HOTFIX Master Plan | [PIPELINE-HOTFIX-MASTER-PLAN.md](.github/projects/PIPELINE-HOTFIX/PIPELINE-HOTFIX-MASTER-PLAN.md) | ✅ (dependency) |

## Key Requirements (from PRD)

Curated P0 functional and critical non-functional requirements that drive phasing — see [AMENDMENT-PRD.md](.github/projects/AMENDMENT/AMENDMENT-PRD.md) for the full set of 33 FRs and 10 NFRs.

- **FR-1**: Single `amend-plan` skill handles amendments to any planning document (PRD, Design, Architecture, Master Plan)
- **FR-2 / FR-3**: Cascade analysis identifies downstream documents affected by amendment; skill produces structured output (sections changed, cascade flags)
- **FR-4 / FR-5 / FR-6**: New `plan_amendment_requested` event accepted from `execution` tier (mid-execution) and `complete` tier (post-completion extension)
- **FR-8 / FR-9**: State includes a nullable `amendment` block tracking status, scope, affected docs, source tier, and human approval; `null` when inactive
- **FR-10 / FR-11**: Validator enforces additive invariants (V16–V19) for amendment block consistency, approval gate, backward tier transition guard, and completed phase immutability
- **FR-13**: Pipeline-enforced re-approval gate — execution cannot resume if amendment exists and is unapproved
- **FR-20 / FR-21**: Orchestrator routing table and event vocabulary include all new amendment actions and events
- **NFR-2**: Existing validator invariants V1–V15 remain intact and unmodified; all new invariants are strictly additive

## Key Technical Decisions (from Architecture)

Curated architectural decisions that constrain implementation — see [AMENDMENT-ARCHITECTURE.md](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md) for full contracts and interfaces.

- **`state.amendment` as nullable top-level block**: When no amendment is active, `state.amendment = null` (not an empty object). Simplifies resolver check to `if (state.amendment) { ... }` — refs: [Architecture State Schema](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#state-amendment-block-schema)
- **Seven new mutation handlers (19–25)**: `handlePlanAmendmentRequested`, `handleAmendmentApproved`, `handleAmendmentCancelled`, plus four `handleAmend*Completed` handlers. Mutations stay pure; I/O stays in the engine — refs: [Architecture Mutation Handlers](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#mutation-handler-interfaces-mutationsjs)
- **Amendment check before standard tier routing**: `resolveNextAction()` checks for `state.amendment` before the existing tier routing chain. `resolveAmendment()` routes through the amendment lifecycle: pending docs → cascade → awaiting approval → resume — refs: [Architecture Resolver Integration](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#resolver-integration-point-resolverjs)
- **Four additive validator invariants (V16–V19)**: V16 (amendment block field consistency), V17 (amendment approval gate), V18 (backward tier transition guard), V19 (completed phase immutability). Existing V1–V15 untouched — refs: [Architecture Validator Invariants](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#validator-invariants-state-validatorjs)
- **`resume_from_amendment` is an internal action**: Follows the same bounded re-resolve loop as `advance_phase` established by HOTFIX (max 1 internal iteration). Not in `EXTERNAL_ACTIONS` set — refs: [Architecture Pipeline Engine](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#pipeline-engine-changes-pipeline-enginejs)
- **`amendment_approved` pre-read reuses `plan_approved` pattern**: Reads amended Master Plan to get updated `total_phases` from frontmatter. Consistent with HOTFIX baseline — refs: [Architecture Pipeline Engine](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#pipeline-engine-changes-pipeline-enginejs)
- **Zero new external dependencies**: CommonJS + Node.js built-ins only. All changes land in existing modules plus one new skill directory — refs: [Architecture Dependencies](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#dependencies)
- **Deterministic cascade map in the skill, not the pipeline**: PRD → Design → Architecture → Master Plan. The pipeline only needs to know which docs were amended and whether re-approval is needed — refs: [Architecture amend-plan Skill](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#amend-plan-skill-interface)

## Key Design Constraints (from Design)

Curated design decisions that affect implementation — see [AMENDMENT-DESIGN.md](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md) for full flows, interviews, and interaction patterns.

- **Scope classification via `askQuestions` interview**: 3-question interview (primary document, amendment description, cascade behavior) with optional 4th question for manual cascade selection. Single invocation, not multi-turn — refs: [Design Interview 1](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md#interview-1-scope-classification)
- **Cancellation confirmation interview**: 1-question destructive action confirmation before discarding in-progress amendment work — refs: [Design Interview 2](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md#interview-2-cancellation-confirmation)
- **Structured re-approval prompt**: Summary of documents amended, sections changed, cascade path, and execution impact. Human approves, rejects, or skips re-approval — refs: [Design Re-Approval Prompt](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md#re-approval-prompt)
- **Amendment lifecycle states**: null → pending → in_progress → awaiting_approval → (approved/cancelled → null). No partial states between null and complete — refs: [Design Amendment Lifecycle](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md#amendment-lifecycle-states)
- **Agent amendment model is document-type-agnostic**: All three planning agents follow the same spawn → read existing doc → invoke `amend-plan` skill → return structured result pattern. Agents remain lightweight — refs: [Design Agent Interaction](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md#planning-agent-amendment-model)
- **Review-tier rejection is conversational**: The Orchestrator handles the rejection before any pipeline event fires. No state changes occur — refs: [Design Flow 3](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md#flow-3-amendment-rejected-during-final-review)
- **Re-approval override is not special pipeline logic**: The human tells the Orchestrator to skip re-approval; the Orchestrator signals `amendment_approved` immediately. The pipeline sees a normal approval event — refs: [Design Flow 4](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md#flow-4-override-the-re-approval-gate)

## Phase Outline

### Phase 1: Engine Core — State Schema, Mutations, Validator, Pipeline Engine

**Goal**: Implement the foundational pipeline machinery for amendments — the `AMENDMENT_STATUSES` enum, new `NEXT_ACTIONS` entries, all seven mutation handlers, four new validator invariants, and all pipeline engine changes (scaffold, tier guard, pre-reads, `EXTERNAL_ACTIONS`, internal action handling).

**Scope**:
- Add `AMENDMENT_STATUSES` enum and 7 new `NEXT_ACTIONS` entries to `constants.js` — refs: [FR-4](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements), [Architecture Constants](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#amendment-statuses-enum-constantsjs)
- Implement 7 mutation handlers (19–25) in `mutations.js`: `handlePlanAmendmentRequested`, `handleAmendmentApproved`, `handleAmendmentCancelled`, and 4 `handleAmend*Completed` handlers, plus the `handleAmendDocCompleted` shared helper. Add all 7 to `MUTATIONS` table — refs: [FR-8, FR-15, FR-16, FR-17, FR-19, FR-25, FR-27](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements), [Architecture Mutation Handlers](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#mutation-handler-interfaces-mutationsjs)
- Implement `checkV16()`, `checkV17()`, `checkV18()`, `checkV19()` in `state-validator.js`. Update `validateTransition()` to include V16–V19. Update `invariants_checked` from 15 → 19 — refs: [FR-10, FR-11, FR-13](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements), [Architecture Validator](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#validator-invariants-state-validatorjs)
- Update `pipeline-engine.js`: add `amendment: null` to `scaffoldInitialState()`, add amendment tier guard for `plan_amendment_requested`, add `amendment_approved` pre-read block, add 6 entries to `EXTERNAL_ACTIONS` set, add `resume_from_amendment` internal action handler — refs: [FR-5, FR-6, FR-7, FR-9, FR-24](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements), [Architecture Pipeline Engine](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#pipeline-engine-changes-pipeline-enginejs)
- Full test coverage for all new mutations, validator invariants, pipeline engine changes. Existing test suites pass unmodified — refs: [NFR-2, NFR-7](.github/projects/AMENDMENT/AMENDMENT-PRD.md#non-functional-requirements)

**Exit Criteria**:
- [ ] All existing test suites (`constants.test.js`, `resolver.test.js`, `state-validator.test.js`, `triage-engine.test.js`, `mutations.test.js`, `pipeline-engine.test.js`) pass unmodified
- [ ] All 7 new mutation handlers produce correct state transitions and are registered in the `MUTATIONS` table
- [ ] V16 rejects invalid amendment blocks (missing fields, invalid status, missing resume_point for execution-tier amendments)
- [ ] V17 blocks execution tier when active unapproved amendment exists
- [ ] V18 rejects backward tier transitions (`execution → planning`, `complete → planning`) without active amendment
- [ ] V19 prevents completed phase status changes
- [ ] Tier guard rejects `plan_amendment_requested` from review, planning, and halted tiers
- [ ] `amendment_approved` pre-read correctly loads `total_phases` from amended Master Plan
- [ ] `EXTERNAL_ACTIONS` includes all 6 new amendment external actions
- [ ] `scaffoldInitialState` includes `amendment: null`
- [ ] `resume_from_amendment` internal action follows bounded re-resolve loop (max 1 iteration)

**Phase Doc**: [phases/AMENDMENT-PHASE-01-ENGINE-CORE.md](.github/projects/AMENDMENT/phases/AMENDMENT-PHASE-01-ENGINE-CORE.md) *(created at execution time)*

---

### Phase 2: Resolver & Skill — Amendment Routing and amend-plan Skill

**Goal**: Implement amendment-aware resolver routing and create the `amend-plan` skill that planning agents use to amend documents with cascade analysis.

**Dependencies**: Phase 1 (constants, mutations, validator, and pipeline engine changes must be in place for resolver to reference `AMENDMENT_STATUSES`, `NEXT_ACTIONS`, and for end-to-end routing to work).

**Scope**:
- Implement `resolveAmendment()` in `resolver.js` with `AMENDMENT_DOC_ORDER` mapping. Add amendment check to `resolveNextAction()` before standard tier routing. Routes through: pending docs → spawn agents in cascade order → awaiting approval → resume — refs: [FR-12](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements), [Architecture Resolver](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#resolver-amendment-routing-resolverjs)
- Create `.github/skills/amend-plan/SKILL.md` with cascade analysis algorithm, input/output contracts, document amendment workflow, and Master Plan `total_phases` frontmatter update instructions — refs: [FR-1, FR-2, FR-3, FR-26](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements), [Architecture amend-plan Skill](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#amend-plan-skill-interface), [NFR-9](.github/projects/AMENDMENT/AMENDMENT-PRD.md#non-functional-requirements)
- Full resolver test coverage for all amendment routing paths (pending → spawn agents → in_progress → awaiting approval → resume). Existing resolver tests pass unmodified — refs: [NFR-7](.github/projects/AMENDMENT/AMENDMENT-PRD.md#non-functional-requirements)

**Exit Criteria**:
- [ ] `resolveAmendment()` returns correct spawn actions for each document type in cascade order
- [ ] Amendment check takes priority over standard tier routing in `resolveNextAction()`
- [ ] Resolver returns `request_amendment_approval` when all docs in `affected_docs` are in `completed_docs` and `human_approved` is false
- [ ] Resolver returns `resume_from_amendment` when amendment is approved
- [ ] `amend-plan` SKILL.md exists at `.github/skills/amend-plan/SKILL.md` with complete cascade analysis algorithm, input/output contracts, and document amendment workflow
- [ ] Skill instructions cover Master Plan `total_phases` frontmatter update when phases are added or removed
- [ ] All existing resolver tests pass unmodified

**Phase Doc**: [phases/AMENDMENT-PHASE-02-RESOLVER-SKILL.md](.github/projects/AMENDMENT/phases/AMENDMENT-PHASE-02-RESOLVER-SKILL.md) *(created at execution time)*

---

### Phase 3: Agent Updates — Orchestrator, Planning Agents

**Goal**: Update all affected agent definitions to support the amendment flow — new routing entries, event vocabulary, `askQuestions` interviews, skill references, and amendment mode instructions.

**Dependencies**: Phase 2 (resolver actions and skill must exist for agents to reference them).

**Scope**:
- Update `orchestrator.agent.md`: add 7 new action routing table entries (19–25 per Architecture), 7 new event signaling entries, amendment flow documentation section, and `askQuestions` interview instructions for scope classification and cancellation confirmation — refs: [FR-20, FR-21, FR-22](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements), [Architecture Orchestrator Routing](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#orchestrator-action-routing-table-additions), [Design Interviews](.github/projects/AMENDMENT/AMENDMENT-DESIGN.md#interview-1-scope-classification)
- Update `product-manager.agent.md`: add `amend-plan` skill to skill inventory, add brief amendment mode instructions — refs: [FR-23](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements), [Architecture Planning Agents](.github/projects/AMENDMENT/AMENDMENT-ARCHITECTURE.md#phase-3-agent-updates--orchestrator-planning-agents)
- Update `ux-designer.agent.md`: add `amend-plan` skill to skill inventory, add brief amendment mode instructions — refs: [FR-23](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)
- Update `architect.agent.md`: add `amend-plan` skill to skill inventory, add brief amendment mode instructions — refs: [FR-23](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)

**Exit Criteria**:
- [ ] Orchestrator routing table covers all 7 amendment actions with correct spawn targets and completion events
- [ ] Orchestrator event reference covers all 7 amendment events with correct context payloads
- [ ] Orchestrator includes `askQuestions` interview specifications for scope classification (3 questions + conditional 4th) and cancellation confirmation (1 question)
- [ ] All three planning agents (Product Manager, UX Designer, Architect) reference the `amend-plan` skill in their skill inventory
- [ ] Agent amendment mode instructions are brief and delegate all amendment mechanics to the skill

**Phase Doc**: [phases/AMENDMENT-PHASE-03-AGENT-UPDATES.md](.github/projects/AMENDMENT/phases/AMENDMENT-PHASE-03-AGENT-UPDATES.md) *(created at execution time)*

---

### Phase 4: Documentation Sweep

**Goal**: Update all documentation and instruction files to reflect the amendment capability as a first-class feature of the orchestration system. Every update describes current system behavior — no references to prior behavior.

**Dependencies**: Phases 1–3 (all code, skill, and agent changes must be finalized before documenting them).

**Scope**:
- `README.md`: add "Plan Amendment" to Key Features list, add amendment loop branch to pipeline flowchart — refs: [FR-28](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)
- `docs/pipeline.md`: new "Amendment Pipeline" section with backward tier transitions, sequence diagram, tier table updates — refs: [FR-29](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)
- `docs/skills.md`: add `amend-plan` to Planning Skills table, update agent-skill composition table (PM, UX Designer, Architect gain `amend-plan`) — refs: [FR-30](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)
- `docs/scripts.md`: add 7 new events to Event Vocabulary table, 7 new actions to Action Vocabulary table — refs: [FR-21](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)
- `docs/configuration.md`: document `amendments.max_per_project` configuration key — refs: [FR-31](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)
- `docs/agents.md`: update planning agent descriptions with amendment capability — refs: [FR-30](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)
- `.github/copilot-instructions.md`: add amendment reference to pipeline description and pipeline flowchart — refs: [FR-32](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)
- `.github/instructions/state-management.instructions.md`: add backward tier transitions under amendment, reference V16–V19 invariants — refs: [FR-10](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)
- `.github/orchestration.yml`: add `amendments.max_per_project` key under a new `amendments` section — refs: [FR-31](.github/projects/AMENDMENT/AMENDMENT-PRD.md#functional-requirements)

**Exit Criteria**:
- [ ] All 9 files listed above are updated
- [ ] No documentation references prior behavior, migration steps, or "before/after" language
- [ ] Pipeline flowchart in README and copilot-instructions shows amendment branch
- [ ] Agent-skill composition table in `docs/skills.md` reflects all three planning agents with `amend-plan`
- [ ] Event and action vocabularies in `docs/scripts.md` include all 7 new events and 7 new actions
- [ ] State management instructions reference backward tier transitions and V16–V19
- [ ] `orchestration.yml` contains the `amendments` section

**Phase Doc**: [phases/AMENDMENT-PHASE-04-DOCUMENTATION.md](.github/projects/AMENDMENT/phases/AMENDMENT-PHASE-04-DOCUMENTATION.md) *(created at execution time)*

---

## Execution Constraints

- **Max phases**: 10 (from `orchestration.yml` — this project uses 4)
- **Max tasks per phase**: 8 (from `orchestration.yml`)
- **Max retries per task**: 2 (from `orchestration.yml`)
- **Max consecutive review rejections**: 3 (from `orchestration.yml`)
- **Git strategy**: `single_branch`, prefix `orch/`, commit prefix `[orch]`, auto-commit enabled
- **Human gates**: After planning (master plan review) — hard default; execution mode: `ask`; after final review — hard default
- **Error severity**: Critical errors halt pipeline; minor errors auto-retry via corrective tasks

## PIPELINE-HOTFIX Sequencing Constraint

**PIPELINE-HOTFIX must complete all 3 phases before AMENDMENT begins execution.** Both projects modify the same core modules (`pipeline-engine.js`, `mutations.js`, `resolver.js`, `state-validator.js`, `constants.js`, and documentation files). AMENDMENT builds on HOTFIX patterns and the post-HOTFIX codebase:

| HOTFIX Pattern | AMENDMENT Usage |
|----------------|-----------------|
| Master Plan pre-read (`plan_approved` pre-read) | `amendment_approved` pre-read reuses the same `io.readDocument()` → extract `total_phases` pattern |
| Bounded re-resolve loop (`advance_phase` internal action) | `resume_from_amendment` follows the same bounded loop (max 1 internal iteration) |
| `EXTERNAL_ACTIONS` set as authoritative gate | 6 new amendment actions added to the set |
| Status normalization layer | Still applies after amendment resume — no bypass needed |
| Unmapped action guard (hard error) | Amendment actions must be properly registered to avoid triggering the guard |
| Documentation sweep (HOTFIX Phase 3) | AMENDMENT documentation builds on the post-HOTFIX baseline, not pre-HOTFIX versions |

Assumption **A-1** from the PRD: AMENDMENT planning references the HOTFIX Master Plan as the design baseline, but implementation runs on the post-HOTFIX codebase.

## Risk Register

| # | Risk | Impact | Mitigation | Owner |
|---|------|--------|-----------|-------|
| 1 | Backward tier transition introduces subtle validator violations (e.g., V7 `human_approved` check during `execution → planning`) | High | V7 only fires when tier IS `execution`, not when transitioning FROM it. `planning.human_approved` remains `true` from original approval. New backward transitions guarded by V18 (amendment-active check). Comprehensive test coverage for all tier transition combinations. | Coder / Reviewer |
| 2 | PIPELINE-HOTFIX changes conflict with AMENDMENT's additions to the same modules | High | AMENDMENT planning references the HOTFIX Master Plan as design baseline. Implementation runs after HOTFIX completes. Overlapping patterns (pre-read, internal action loop) are explicitly built upon rather than duplicated. | Architect / Orchestrator |
| 3 | Cascade analysis produces false positives, flagging documents that don't actually need amendment | Medium | Cascade flags are suggestions confirmed by the human before proceeding. Over-flagging is safer than under-flagging. The human can select "Let me choose" in the scope interview to manually control cascade targets. | Human / Orchestrator |
| 4 | Amendment from `complete` tier creates confusion about execution state (re-activating a finished project) | Medium | Clear `source_tier` tracking in state. Explicit phase-append semantics in `handleAmendmentApproved` — completed phases untouched, `current_phase` points to first new phase, `execution.status` re-initialized to `in_progress`. | Coder |
| 5 | Stale triage state after amendment causes incorrect loop detection or routing | Medium | `triage_attempts` resets to 0 in `handleAmendmentApproved` (FR-25). Prevents stale loop detection after amendment. | Coder |
| 6 | Documentation updates across 9+ files drift out of sync with each other | Medium | Documentation is its own phase (Phase 4) with an exhaustive file list. Each file is a discrete task with cross-reference verification. Phase review checks consistency. | Tactical Planner / Reviewer |
| 7 | Amendment cancellation leaves orphaned state or partially amended documents | Medium | `handleAmendmentCancelled` restores tier to `source_tier` and sets `amendment` to `null`. Documents are saved by agents; pipeline state is always consistent. Human can use git to revert document changes if needed. | Coder |
| 8 | 4 phases × multiple tasks may approach the `max_tasks_per_phase: 8` limit, especially in Phase 1 (engine core) | Low | Phase 1 has the most tasks but individual changes (constants, mutations, validator, engine, tests) can be grouped logically. Tactical Planner will respect the 8-task limit. | Tactical Planner |

## Success Criteria

From [AMENDMENT-PRD.md Success Metrics](.github/projects/AMENDMENT/AMENDMENT-PRD.md#success-metrics):

| Metric | Target | Measurement |
|--------|--------|-------------|
| Amendment from execution tier completes without manual state repair | 100% | End-to-end test: trigger → scope → amend docs → approve → resume — no manual `state.json` edits |
| Amendment from complete tier completes without manual state repair | 100% | End-to-end test: trigger → scope → amend docs → approve → new phases execute — no manual `state.json` edits |
| Review-tier amendment rejection is clear and non-destructive | 100% | Trigger during review — rejected with message, zero state changes |
| Cascade analysis flags all affected downstream documents | 100% accuracy | Amend PRD → Design, Architecture, Master Plan flagged; amend Architecture → Master Plan flagged |
| Existing validator invariants V1–V15 pass without modification | 0 regressions | Full existing test suite passes after all changes |
| All new pipeline actions, events, and mutations have test coverage | 100% | Each new mutation handler, validator invariant, resolver path, and external action has at least one passing test |
| Documentation accurately reflects the amendment capability | All 9 targets updated | README, pipeline docs, skills docs, configuration docs, scripts docs, agents docs, workspace instructions, state management instructions, orchestration.yml |
