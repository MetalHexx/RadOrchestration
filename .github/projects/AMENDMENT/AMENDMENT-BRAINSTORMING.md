---
project: "AMENDMENT"
author: "brainstormer-agent"
created: "2026-03-13T00:00:00.000Z"
---

# AMENDMENT — Brainstorming

## Problem Space

The orchestration pipeline is strictly linear: planning runs to completion, then execution runs forward-only. There is no mechanism to amend planning documents (PRD, Design, Architecture, Master Plan) once execution has begun. When a new idea or course correction emerges mid-execution, the only options today are to halt the pipeline or carry the deviation as informal context. This creates a gap between how real projects evolve and what the system can express.

## Validated Ideas

### Idea 1: Generic `amend-plan` Skill

**Description**: A single skill that handles amendments to any planning document (PRD, Design, Architecture, Master Plan). The skill provides the amendment workflow framework — scoped mutation with cascade analysis — while the invoking agent provides domain expertise. Product Manager amends PRDs, UX Designer amends Design, Architect amends Architecture and Master Plan, all using the same skill.

**Rationale**: Amendment is a workflow pattern (understand change → read existing doc → identify affected sections → produce targeted update → flag downstream invalidation), not a document type. One skill avoids duplicating cascade logic across four separate skills and keeps agents lightweight — they don't need "amendment mode" in their instructions, they invoke the skill when asked.

**Key considerations**:
- The skill must carry the cascade map: PRD change → check Design → check Architecture → check Master Plan
- Agents remain lightweight; heavy amendment mechanics live in the skill
- The skill should produce structured output that the pipeline can reason about (which docs were amended, what downstream docs are flagged)

### Idea 2: `plan_amendment_requested` Pipeline Event (Execution + Complete Tiers)

**Description**: A new event in the pipeline that routes to the amendment flow. Accepted from two tiers: `execution` (mid-project amendment) and `complete` (project extension with new requirements). From execution, the current task finishes before the amendment begins. From complete, there's no in-flight work — the flow begins immediately. The event carries context about the amendment scope.

**Rationale**: The pipeline is already event-driven — adding one new event is the minimal structural change. Using the same event for both mid-execution amendment and post-completion extension avoids a separate "reopen project" concept. A completed project is just an amendment where nothing is in flight.

**Key considerations**:
- From `execution`: current task completes before pausing (no in-flight work lost)
- From `complete`: no in-flight work, amendment begins immediately
- `state.amendment.source_tier` records entry point (`execution` or `complete`) so the resolver knows where to resume after approval
- From `review` tier: the event is rejected/deferred — let final review finish first
- State gets a new `amendment` block to track the amendment lifecycle
- State validator needs to permit `execution → planning` and `complete → planning` backward transitions under the amendment path
- Existing completed phases are untouched — they're history. New/amended phases append or replace only unstarted phases

### Idea 3: Scope Classification via Orchestrator Suggestion + Human Confirmation

**Description**: When a human triggers an amendment, the Orchestrator suggests which documents are affected and the cascade implications. The human confirms or adjusts. This is presented using the `askQuestions` tool for an efficient interview — one focused prompt covering scope and cascade decisions.

**Rationale**: Keeps agent judgement risk low (human confirms) while avoiding tedious manual scope analysis. The Orchestrator can read the current docs and the amendment request to make reasonable suggestions.

**Key considerations**:
- Orchestrator uses `askQuestions` to present scope and cascade as a single efficient interview
- Human can override suggestions
- Keep this interaction lightweight — one interview, not a multi-turn back-and-forth

### Idea 4: `state.amendment` Block with Pipeline-Enforced Re-Approval Gate

**Description**: A new section in `state.json` tracks the amendment lifecycle: `{ status, scope, affected_docs, source_tier, human_approved }`. The `source_tier` field records where the amendment was triggered from (`execution` or `complete`). The resolver checks: if an amendment exists and isn't approved, route to `request_amendment_approval`. After approval, the block is cleared and execution resumes from the appropriate point (resume current phase from `execution`, or start new phases from `complete`). The human can override re-approval by telling the Orchestrator to skip it.

**Rationale**: Pipeline-enforced gates are safer than agent judgement. This keeps the original `planning.human_approved` intact (it's a separate concern) and uses the same pattern the system already uses for plan approval and final review approval. The override escape hatch keeps it from being unnecessarily rigid.

**Key considerations**:
- This is a pipeline change (state + validator + resolver), not an agent mechanics change
- The override (skip re-approval) is just the Orchestrator signaling `amendment_approved` immediately — no special pipeline logic needed
- Validator needs a new invariant: if `state.amendment` exists and `human_approved` is false, execution cannot resume
- `source_tier` drives resume behavior: `execution` → back to current phase, `complete` → tier transitions to `execution` with new phases appended

### Idea 5: Targeted Phase Replanning (Current + Next Only)

**Description**: After an amendment completes and is approved, only the current phase and the next phase are re-planned. Later phases re-plan naturally when they're reached (the Tactical Planner already reads the Master Plan fresh each time).

**Rationale**: Re-planning all remaining phases is expensive and speculative — later phases may change again. Re-planning just current + next gives enough lookahead to catch immediate impacts without over-investing in plans that may shift further.

**Key considerations**:
- The Tactical Planner already reads the Master Plan when creating phase plans, so future phases naturally pick up amendments when they're reached
- "Current phase" replanning may mean re-issuing remaining tasks in the current phase if the amendment affects them

### Idea 7: Comprehensive Documentation Updates

**Description**: Update all documentation and the README to reflect the amendment capability as a first-class feature of the system.

Documents requiring updates:

| Document | What Changes |
|----------|-------------|
| `README.md` | Pipeline flowchart gains an amendment loop; Key Features gains a "Plan Amendment" entry; feature count updates |
| `docs/pipeline.md` | Tier model section updated to show `complete → planning` and `execution → planning` paths; new "Amendment Pipeline" section with sequence diagram; tier table gets amendment transition notes |
| `docs/skills.md` | `amend-plan` added to planning skills inventory; agent-skill composition table updated (Product Manager, UX Designer, Architect, Orchestrator all gain the skill) |
| `docs/configuration.md` | Any new `orchestration.yml` keys for amendment limits (e.g., `max_amendments_per_project`) |
| `.github/copilot-instructions.md` | Pipeline description updated to reference amendment capability |

**Rationale**: The amendment feature changes the pipeline from a strictly forward system to one that can evolve with the project. This is a significant enough capability shift that the docs need to accurately represent the amended tier model, the new skill, and the updated agent composition.

**Key considerations**:
- The README pipeline flowchart (Mermaid) needs an amendment branch that is visually distinct from the happy path
- `docs/pipeline.md` will need a new sequence diagram for the amendment flow, parallel to the existing planning/execution diagrams
- `docs/skills.md` agent composition table changes affect multiple agents — each planning agent gains `amend-plan`
- Documentation updates are their own phase/task in the Master Plan, not an afterthought

### Idea 6: Final Review Deferral

**Description**: If `plan_amendment_requested` is fired while `current_tier === 'review'`, the pipeline rejects the event with a clear message: "Final review is in progress — complete the review first, then amend." The human can amend after the project reaches `complete`.

**Rationale**: The final review tier is short and terminal-adjacent. Interrupting it creates awkward state (partially reviewed project with changed requirements). Simpler to let it finish — the amendment-from-complete flow handles the "add more after we're done" case cleanly.

**Key considerations**:
- This is a simple guard in the mutation handler: if tier is `review`, return an error result
- No state changes, no new invariants — just a rejected event

### Idea 8: PIPELINE-HOTFIX Sequencing Dependency

**Description**: The AMENDMENT project runs after the PIPELINE-HOTFIX project. During Research and Architecture, the PIPELINE-HOTFIX Master Plan (and any completed phase reports/task reports) must be read as input context to ensure AMENDMENT builds on the post-hotfix baseline — not the pre-hotfix codebase. Specific areas of overlap:

| HOTFIX Artifact | AMENDMENT Impact |
|----------------|-----------------|
| Master Plan pre-read pattern (HOTFIX Idea 1) | AMENDMENT's `plan_amendment_requested` mutation needs the same pre-read pattern to re-initialize/append phases from the amended Master Plan |
| Internal action handling loop (HOTFIX Idea 5) | AMENDMENT will likely need internal actions (e.g., clear `state.amendment` block, resume execution). Must follow the bounded re-resolve pattern HOTFIX establishes |
| Task report status normalization (HOTFIX Idea 3) | AMENDMENT's triage path after resuming execution inherits the normalization layer — no special handling needed, but must not bypass it |
| State validator (HOTFIX preserves V1–V15) | AMENDMENT adds new invariants (V16+) on top of the post-hotfix validator. Must be written against the HOTFIX-updated validator code |
| Documentation sweep (HOTFIX Idea 8) | AMENDMENT doc updates layer on top of HOTFIX docs. AMENDMENT should read the post-hotfix docs as baseline, not the current pre-hotfix versions |
| `log-error` skill (HOTFIX Idea 6) | AMENDMENT's new pipeline events and mutation handlers should be compatible with the Orchestrator's error-logging flow |

**Rationale**: Both projects modify the pipeline engine, mutations, resolver, validator, and documentation. Without explicit sequencing awareness, AMENDMENT could produce plans that conflict with HOTFIX changes — duplicate pre-read patterns, incompatible internal action handling, or doc updates that overwrite HOTFIX's doc sweep. Reading HOTFIX's Master Plan during AMENDMENT's planning phase catches these overlaps at design time rather than discovering them during execution.

**Key considerations**:
- The Research Agent should read HOTFIX's Master Plan and any available phase/task reports as part of codebase research
- The Architect should reference HOTFIX patterns (pre-read, internal action loop) when designing AMENDMENT's pipeline changes
- The documentation phase should explicitly start from the post-HOTFIX doc baseline

## Scope Boundaries

### In Scope
- New `amend-plan` skill with cascade analysis framework
- New `plan_amendment_requested` event and pipeline machinery
- `state.amendment` block in state.json (with `source_tier` for resume routing)
- Amendment from both `execution` and `complete` tiers (same event, same flow)
- State validator changes for backward tier transition and amendment invariants
- Orchestrator action routing table additions
- Re-approval gate (pipeline-enforced, human-overridable)
- Phase replanning strategy (current + next)
- Rejection guard for amendments during final review tier
- README.md updates (pipeline diagram, Key Features)
- docs/pipeline.md updates (tier model, amendment sequence diagram)
- docs/skills.md updates (amend-plan inventory entry, agent composition table)
- docs/configuration.md updates (any new orchestration.yml keys)
- .github/copilot-instructions.md updates (pipeline description)

### Out of Scope
- Agent-initiated amendments (only human-triggered for now)
- Automatic amendment detection (e.g., Reviewer auto-flagging plan drift)
- Amendment history/versioning (track only the current amendment, not a log)
- Changes to the Brainstormer agent
- Changes to the Coder agent (it reads only its handoff — amendment is invisible to it)

## Key Constraints

- Agents must stay lightweight — amendment logic lives in the `amend-plan` skill and pipeline machinery, not in agent instructions
- The pipeline script remains the sole writer of `state.json`
- The existing state validator invariants (V1–V15) remain intact; new invariants are additive
- Human triggers all amendments — no agent-initiated amendments in v1
- The amendment flow must be interruptible (human can cancel an in-progress amendment)
- PIPELINE-HOTFIX must complete first — AMENDMENT builds on the post-hotfix codebase, patterns, and documentation baseline

## Open Questions

- Should amendments have a limit (e.g., `max_amendments_per_project` in `orchestration.yml`)?
- Should the `amend-plan` skill produce a diff-style output (showing before/after for changed sections) or just rewrite the full document?
- How should the Tactical Planner know which tasks in the current phase are invalidated by the amendment vs. which are still valid?
- Does the amendment flow need its own triage engine, or is the existing triage sufficient once execution resumes?
- When extending a completed project, should `execution.current_phase` advance past existing phases or should new phases be appended with the pointer set to the first new phase?

## Summary

Add a plan amendment capability to the orchestration system that works from both mid-execution and post-completion. A single generic `amend-plan` skill handles amendments to any planning document, with cascade analysis to flag downstream impacts. The pipeline gets one new event (`plan_amendment_requested`) accepted from `execution` and `complete` tiers (rejected during `review`), a `state.amendment` block with `source_tier` for resume routing, and a pipeline-enforced re-approval gate (overridable by the human). Current work finishes before amendment begins, and only the current + next phases are re-planned afterward. Completed projects can be extended by amending to add new requirements and phases. Agents stay lightweight — heavy mechanics live in the skill and pipeline. All documentation (README.md, docs/pipeline.md, docs/skills.md, docs/configuration.md, copilot-instructions.md) is updated to reflect the amendment capability as a first-class feature. The project runs after PIPELINE-HOTFIX and builds on its patterns (master plan pre-read, internal action loop, status normalization) and post-hotfix documentation baseline.
