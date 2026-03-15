---
project: "AMENDMENT"
status: "draft"
author: "product-manager-agent"
created: "2026-03-13T00:00:00Z"
---

# AMENDMENT — Product Requirements

## Problem Statement

The orchestration pipeline is strictly linear: once execution begins, planning documents cannot be amended. When new requirements, course corrections, or scope changes emerge mid-execution or after project completion, there is no mechanism to formally amend the PRD, Design, Architecture, or Master Plan. Teams are forced to either halt the pipeline entirely or carry deviations as informal context, leading to plan drift that compounds across phases. This gap between how real projects evolve and what the system can express undermines the reliability of the document-driven model.

## Goals

- **G-1**: Enable formal amendment of any planning document (PRD, Design, Architecture, Master Plan) from both mid-execution and post-completion states, using a single consistent workflow
- **G-2**: Provide cascade analysis that automatically identifies which downstream documents are affected when an upstream document is amended
- **G-3**: Enforce a pipeline-level re-approval gate before execution resumes after any amendment, ensuring human oversight of plan changes
- **G-4**: Preserve completed work — amendments affect only current and future phases, never retroactively modify completed phases
- **G-5**: Keep agents lightweight — amendment mechanics are centralized in a shared skill and pipeline machinery, not duplicated across agent definitions
- **G-6**: Update all system documentation to reflect plan amendment as a first-class capability

## Non-Goals

- **NG-1**: Agent-initiated amendments — only humans may trigger amendments in this version
- **NG-2**: Automatic amendment detection (e.g., Reviewer auto-flagging plan drift)
- **NG-3**: Amendment history or versioning — tracking only the current active amendment, not a log of past amendments
- **NG-4**: Changes to the Brainstormer or Coder agents — Brainstormer operates before the pipeline, and Coder reads only its task handoff (amendment is invisible to it)
- **NG-5**: UI dashboard changes for the amendment block — noted as a follow-up, not part of this project
- **NG-6**: Agent-to-agent amendment negotiation or multi-party amendment workflows

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| 1 | Human operator | amend a planning document mid-execution when requirements change | the project adapts to new information without halting the pipeline or carrying informal deviations | P0 |
| 2 | Human operator | amend planning documents after a project completes to extend it with new requirements | I can build on completed work instead of starting a new project from scratch | P0 |
| 3 | Human operator | see which downstream documents are affected by my amendment | I can confirm the amendment scope before changes propagate, reducing unintended side effects | P0 |
| 4 | Human operator | approve or reject amended plans before execution resumes | no amended plan enters execution without my explicit review and consent | P0 |
| 5 | Human operator | override the re-approval gate and skip re-approval for minor amendments | trivial changes don't block execution with unnecessary ceremony | P1 |
| 6 | Human operator | receive a clear rejection message when requesting an amendment during final review | I understand why the system deferred my request and know to retry after review completes | P1 |
| 7 | Human operator | cancel an in-progress amendment | I can abort an amendment that is no longer needed without leaving the project in an inconsistent state | P1 |
| 8 | Orchestrator agent | route amendment requests to the correct planning agent with the appropriate scope | the right domain expert (Product Manager, UX Designer, Architect) handles each document type | P0 |
| 9 | Planning agent (PM, UX Designer, Architect) | invoke a shared amendment skill with a consistent interface | I can amend my owned documents using the same workflow pattern without needing custom amendment logic | P0 |
| 10 | Tactical Planner agent | replan only the current and next phases after an amendment is approved | replanning is scoped and efficient, and later phases naturally pick up changes when they are reached | P1 |
| 11 | Human operator | have amendments work consistently whether triggered from execution or completion | one mental model for amendments regardless of project state | P1 |
| 12 | Human operator | find amendment documentation in the README, pipeline docs, and skills docs | I can learn about the amendment capability from the system's official documentation | P2 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | The system shall provide a single `amend-plan` skill that handles amendments to any planning document (PRD, Design, Architecture, Master Plan) | P0 | One skill, invoked by the appropriate planning agent based on document type |
| FR-2 | The `amend-plan` skill shall perform cascade analysis — identifying which downstream documents are potentially invalidated by the amendment | P0 | Cascade direction: PRD → Design → Architecture → Master Plan |
| FR-3 | The `amend-plan` skill shall produce structured output including the amended document, a list of sections changed, and cascade flags for affected downstream documents | P0 | Enables pipeline and Orchestrator to reason about downstream impact without re-reading the full document |
| FR-4 | The pipeline shall accept a new `plan_amendment_requested` event | P0 | Single event for all amendment entry points |
| FR-5 | The `plan_amendment_requested` event shall be accepted when the current tier is `execution` (mid-execution amendment) | P0 | Current in-progress task must complete before the amendment flow begins |
| FR-6 | The `plan_amendment_requested` event shall be accepted when the current tier is `complete` (post-completion extension) | P0 | No in-flight work; amendment begins immediately |
| FR-7 | The `plan_amendment_requested` event shall be rejected with a clear message when the current tier is `review` | P1 | Deferral, not permanent rejection — human can amend after review completes |
| FR-8 | The state shall include a new `amendment` block tracking: status, scope, affected documents, source tier, and human approval flag | P0 | `source_tier` records whether amendment originated from `execution` or `complete` for resume routing |
| FR-9 | When no amendment is active, the amendment block shall be null (not an empty object) | P0 | Simplifies amendment detection across resolver and validator |
| FR-10 | The state validator shall enforce new invariants (additive to existing V1–V15) for: amendment block field consistency, amendment approval gate, and backward tier transition guard | P0 | New invariants must not modify or weaken existing V1–V15 |
| FR-11 | Backward tier transitions (`execution → planning` and `complete → planning`) shall be valid only when an active amendment exists in state | P0 | Prevents accidental backward transitions outside the amendment flow |
| FR-12 | The resolver shall check for an active amendment block before standard tier routing and route to amendment-specific actions accordingly | P0 | Amendment routing takes priority over normal tier routing when amendment is active |
| FR-13 | The pipeline shall enforce a re-approval gate: if an amendment exists and is not approved, execution cannot resume | P0 | Same pattern as existing plan approval and final review gates |
| FR-14 | The human shall be able to override the re-approval gate by instructing the Orchestrator to skip it | P1 | Override is the Orchestrator signaling approval immediately — no special pipeline logic needed |
| FR-15 | The mutation handler for `plan_amendment_requested` shall record the current phase/task position when source tier is `execution`, for resume after approval | P0 | Enables returning to the correct execution point |
| FR-16 | After amendment approval from `execution` tier, the pipeline shall resume at the current phase | P0 | Execution continues from where it paused |
| FR-17 | After amendment approval from `complete` tier, new phases shall be appended and execution shall begin at the first new phase | P0 | Completed phases remain untouched |
| FR-18 | After amendment approval, only the current phase and next phase shall be replanned | P1 | Later phases replan naturally when the Tactical Planner reaches them |
| FR-19 | Completed phases shall not be modified by amendment | P0 | Completed phases are immutable history |
| FR-20 | The Orchestrator's action routing table shall include new amendment-related actions | P0 | Consistent with the existing action routing pattern |
| FR-21 | The Orchestrator's event signaling reference shall include new amendment-related events | P0 | Amendment events join the existing event vocabulary |
| FR-22 | The Orchestrator shall present amendment scope and cascade suggestions to the human for confirmation before proceeding | P1 | Uses the existing question/interview capability for efficient scope confirmation |
| FR-23 | Planning agents (Product Manager, UX Designer, Architect) shall each gain the `amend-plan` skill in their skill inventory | P0 | Agents remain lightweight — the skill contains all amendment mechanics |
| FR-24 | The initial state scaffold for new projects shall include the amendment block (initialized as null) | P0 | Ensures consistent state shape from project creation |
| FR-25 | Triage attempts shall reset when execution resumes after an amendment | P1 | Prevents stale loop detection after amendment |
| FR-26 | Master Plan amendments that add or remove phases shall update the phase count in the document metadata | P0 | Downstream pre-read patterns depend on accurate phase counts |
| FR-27 | The system shall support amendment cancellation — an in-progress amendment can be aborted, returning the project to its pre-amendment state | P1 | Ensures amendment flow is interruptible |
| FR-28 | The README shall be updated with a plan amendment entry in Key Features and an amendment branch in the pipeline flowchart | P2 | Documentation reflects the new capability |
| FR-29 | Pipeline documentation shall be updated with amendment tier transitions, a new Amendment Pipeline section, and a sequence diagram | P2 | First-class documentation for the amendment flow |
| FR-30 | Skills documentation shall be updated with the `amend-plan` skill entry and updated agent-skill composition table | P2 | All planning agents gain the new skill in the composition table |
| FR-31 | Configuration documentation shall be updated with any new amendment-related configuration keys | P2 | e.g., amendment limits if introduced |
| FR-32 | Workspace instructions shall be updated to reference the amendment capability in the pipeline description | P2 | Ensures Copilot instructions reflect the updated pipeline model |
| FR-33 | New pipeline events and mutation handlers shall produce error results compatible with the system's error-logging flow | P1 | Amendment failures should be observable through the same error channels as existing failures |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Reliability | Amendment flow must leave the project in a consistent state at every step — if interrupted at any point, the state must be recoverable without manual state editing |
| NFR-2 | Reliability | Existing validator invariants (V1–V15) must remain intact and unmodified; all new invariants are strictly additive |
| NFR-3 | Consistency | The amendment flow must follow the same event-mutation-validate-resolve pattern as all existing pipeline operations — no special bypass paths |
| NFR-4 | Consistency | All new constants, actions, and events must follow existing naming conventions and be registered in the system's canonical enumerations |
| NFR-5 | Simplicity | Agent definitions must remain lightweight — amendment mechanics live in the shared skill and pipeline machinery, not in agent instructions |
| NFR-6 | Simplicity | Zero new external dependencies — all changes must use existing runtime capabilities and built-in modules only |
| NFR-7 | Testability | Every new mutation handler, validator invariant, resolver path, and external action must have corresponding test coverage |
| NFR-8 | Performance | Amendment cascade analysis must complete within a single skill invocation — no multi-pass cascade resolution |
| NFR-9 | Maintainability | The `amend-plan` skill must be document-type-agnostic — it provides the amendment workflow framework while the invoking agent provides domain expertise |
| NFR-10 | Correctness | Backward tier transitions must be impossible without an active amendment — no regression path exists outside the amendment flow |

## Assumptions

- **A-1**: The PIPELINE-HOTFIX project will complete before AMENDMENT enters execution. AMENDMENT planning references the HOTFIX Master Plan as the design baseline, but implementation builds on the post-HOTFIX codebase.
- **A-2**: The existing event-mutation-validate-resolve pipeline pattern is sufficient for amendment handling — no new pipeline loop constructs are needed.
- **A-3**: The Tactical Planner already reads the Master Plan fresh when creating phase plans, so phases beyond current + next will naturally pick up amendments without explicit replanning.
- **A-4**: Cascade analysis (which downstream documents are affected) is deterministic based on the document hierarchy: PRD → Design → Architecture → Master Plan.
- **A-5**: Humans will provide sufficient context about the desired amendment when triggering the request — the system does not need to infer amendment intent.
- **A-6**: Completed phases are immutable and do not need retroactive amendment, even if the planning documents that informed them have changed.

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | Backward tier transition introduces subtle validator violations (e.g., V7 human_approved check during execution → planning transition) | High | New invariants are additive only; backward transitions are guarded by amendment-active check; comprehensive test coverage for all tier transition combinations |
| 2 | PIPELINE-HOTFIX changes to the pipeline engine, mutations, or validator conflict with AMENDMENT's additions | High | AMENDMENT planning references the HOTFIX Master Plan as the design baseline; implementation runs after HOTFIX completes; overlapping patterns (pre-read, internal action loop) are explicitly built upon rather than duplicated |
| 3 | Cascade analysis produces false positives, flagging documents that don't actually need amendment | Medium | Cascade flags are suggestions, not mandates — human confirms scope before amendments proceed; over-flagging is safer than under-flagging |
| 4 | Amendment from `complete` tier creates confusion about execution state (re-activating a finished project) | Medium | Clear `source_tier` tracking in state; explicit phase append semantics; execution state is re-initialized cleanly for new phases only |
| 5 | Stale triage state after amendment causes incorrect loop detection or routing | Medium | Triage attempts reset when execution resumes after amendment (FR-25) |
| 6 | Documentation updates across multiple files drift out of sync with each other | Low | Documentation is its own phase with explicit task breakdown; each file is a discrete task with cross-reference verification |
| 7 | Amendment cancellation leaves orphaned state or partially amended documents | Medium | Cancellation handler restores state to pre-amendment snapshot; documents are atomic (fully amended or untouched) |

## Constraints

| # | Constraint | Rationale |
|---|-----------|-----------|
| C-1 | PIPELINE-HOTFIX must complete execution before AMENDMENT begins execution | Both projects modify the pipeline engine, mutations, resolver, validator, and documentation; AMENDMENT builds on HOTFIX patterns (pre-read, internal action loop, status normalization) and post-HOTFIX documentation baseline |
| C-2 | Existing state validator invariants (V1–V15) must remain unchanged | Downstream projects and existing tests depend on current invariant behavior |
| C-3 | The pipeline script remains the sole writer of state | Core architectural invariant of the orchestration system |
| C-4 | Only humans may trigger amendments | Agent-initiated amendments are out of scope (NG-1) and would require a separate trust/authorization model |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Amendment from execution tier completes without manual state repair | 100% of attempts | Test a mid-execution amendment end-to-end: trigger → scope → amend docs → approve → resume execution — no manual state.json edits required |
| Amendment from complete tier completes without manual state repair | 100% of attempts | Test a post-completion amendment end-to-end: trigger → scope → amend docs → approve → new phases execute — no manual state.json edits required |
| Review-tier amendment rejection is clear and non-destructive | 100% of attempts | Trigger amendment during review tier — event is rejected with human-readable message, no state changes occur |
| Cascade analysis flags all affected downstream documents | 100% accuracy on known cascade paths | Amend a PRD and verify Design, Architecture, and Master Plan are flagged; amend Architecture and verify Master Plan is flagged |
| Existing validator invariants (V1–V15) pass without modification | 0 regressions | Full existing test suite passes after amendment changes are applied |
| All new pipeline actions, events, and mutations have test coverage | 100% coverage | Each new mutation handler, validator invariant, resolver path, and external action has at least one passing test |
| Documentation accurately reflects the amendment capability | All 6 documentation targets updated | README, pipeline docs, skills docs, configuration docs, workspace instructions, and state management instructions all reference the amendment flow correctly |
