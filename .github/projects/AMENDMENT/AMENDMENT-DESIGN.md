---
project: "AMENDMENT"
status: "draft"
author: "ux-designer-agent"
created: "2026-03-13T00:00:00Z"
---

# AMENDMENT — Design

## Design Overview

The amendment system is a pipeline capability, not a GUI — the "user experience" is the developer's interaction with the Orchestrator agent through VS Code's chat interface. This design specifies the conversational flows, information architecture, and interaction patterns that govern how a human triggers, scopes, approves, cancels, and overrides plan amendments. It also defines the agent-facing interaction model: how planning agents invoke the `amend-plan` skill with a consistent interface.

## User Flows

### Flow 1: Amend a Planning Document Mid-Execution

**User Stories**: US-1, US-3, US-4, US-8, US-11

```
Human requests amendment
  → Orchestrator checks tier (execution — accepted)
  → Orchestrator confirms current task will finish first
  → Orchestrator presents scope classification interview (askQuestions)
  → Human confirms/adjusts scope
  → Orchestrator signals `plan_amendment_requested` event
  → Pipeline transitions to planning tier (backward transition)
  → Orchestrator spawns appropriate planning agent(s) with `amend-plan` skill
  → Agent produces amended document + cascade flags
  → If cascade flags → Orchestrator spawns next agent(s) for downstream docs
  → All amendments complete
  → Orchestrator presents amended plan summary for re-approval
  → Human approves
  → Pipeline resumes execution at current phase
```

**Detail — Step-by-step**:

| Step | Actor | What Happens | Information Shown to Human |
|------|-------|-------------|---------------------------|
| 1 | Human | Tells Orchestrator: "I need to change the PRD — requirement X needs to be Y" | — |
| 2 | Orchestrator | Reads `state.json`, confirms `current_tier === 'execution'` | "The project is mid-execution (Phase 2, Task 3). I can amend the plan — the current task will finish before the amendment begins." |
| 3 | Orchestrator | Presents scope classification interview (see [Interview Design](#interview-1-scope-classification)) | askQuestions interaction (see below) |
| 4 | Human | Confirms or adjusts scope selections | — |
| 5 | Orchestrator | Signals `plan_amendment_requested` via pipeline script | "Amendment recorded. Transitioning to planning for document updates." |
| 6 | Pipeline | Mutation: sets `state.amendment` block, records `source_tier: 'execution'`, records current phase/task position. Tier transitions `execution → planning`. | — |
| 7 | Orchestrator | Resolver returns `spawn_amend_prd` (or appropriate action). Orchestrator spawns Product Manager with amendment scope. | "Spawning Product Manager to amend the PRD..." |
| 8 | PM Agent | Invokes `amend-plan` skill. Reads existing PRD, applies amendment, produces cascade flags. | — |
| 9 | Orchestrator | Reads cascade flags. If Design is flagged, spawns UX Designer. If Architecture flagged, spawns Architect. Continues until cascade is resolved. | "PRD amended. Cascade analysis: Design and Architecture are affected. Spawning UX Designer..." |
| 10 | Orchestrator | All documents amended. Presents summary for re-approval. | See [Re-Approval Prompt](#re-approval-prompt) |
| 11 | Human | Reviews and approves (or rejects — see [Flow 5](#flow-5-cancel-an-in-progress-amendment)) | — |
| 12 | Pipeline | `amendment_approved` event. Clears amendment block, triage_attempts reset, resumes execution. | "Amendment approved. Resuming execution at Phase 2." |

---

### Flow 2: Amend a Planning Document After Project Completion

**User Stories**: US-2, US-3, US-4, US-8, US-11

```
Human requests amendment on completed project
  → Orchestrator checks tier (complete — accepted)
  → Orchestrator presents scope classification interview (askQuestions)
  → Human confirms/adjusts scope
  → Orchestrator signals `plan_amendment_requested` event
  → Pipeline transitions to planning tier (backward transition)
  → Orchestrator spawns appropriate planning agent(s) with `amend-plan` skill
  → Agent produces amended document + cascade flags
  → Cascade resolution (same as Flow 1)
  → All amendments complete
  → Orchestrator presents amended plan summary for re-approval
  → Human approves
  → Pipeline appends new phases, begins execution at first new phase
```

**Key difference from Flow 1**: No in-flight work to finish. `source_tier: 'complete'` means new phases are appended (completed phases untouched) and execution begins at the first new phase.

| Step | Actor | What Happens | Information Shown to Human |
|------|-------|-------------|---------------------------|
| 1 | Human | Tells Orchestrator: "I want to extend this project with new requirements" | — |
| 2 | Orchestrator | Reads `state.json`, confirms `current_tier === 'complete'` | "This project is complete. I can amend the plan to add new requirements — completed phases will remain untouched." |
| 3–11 | — | Same as Flow 1 steps 3–11 | Same prompts, adapted for completion context |
| 12 | Pipeline | `amendment_approved` event. Appends new phases, sets `current_phase` to first new phase, `execution.status = 'in_progress'`. | "Amendment approved. 2 new phases added. Beginning execution at Phase 4." |

---

### Flow 3: Amendment Rejected During Final Review

**User Stories**: US-6

```
Human requests amendment during final review
  → Orchestrator checks tier (review — rejected)
  → Orchestrator presents clear rejection message
  → Human waits for review to complete, then amends from `complete` tier
```

| Step | Actor | What Happens | Information Shown to Human |
|------|-------|-------------|---------------------------|
| 1 | Human | Requests an amendment | — |
| 2 | Orchestrator | Reads `state.json`, finds `current_tier === 'review'` | — |
| 3 | Orchestrator | Rejects with clear message | "Final review is in progress — amendments are not accepted during review. Complete the review first, then amend from the completed state." |

**No state changes occur.** The pipeline event is never fired. The Orchestrator handles the rejection conversationally.

---

### Flow 4: Override the Re-Approval Gate

**User Stories**: US-5

```
Human tells Orchestrator to skip re-approval
  → Orchestrator signals `amendment_approved` immediately
  → Pipeline resumes execution
```

| Step | Actor | What Happens | Information Shown to Human |
|------|-------|-------------|---------------------------|
| 1 | Orchestrator | Presents re-approval prompt (see [Re-Approval Prompt](#re-approval-prompt)) | Summary of changes + approval request |
| 2 | Human | "Skip re-approval" or "Approve and continue" | — |
| 3 | Orchestrator | Signals `amendment_approved` immediately without further review | "Re-approval skipped. Resuming execution." |

**Note**: The override is not special pipeline logic — it's the Orchestrator signaling approval on the human's instruction. The pipeline sees a normal `amendment_approved` event.

---

### Flow 5: Cancel an In-Progress Amendment

**User Stories**: US-7

```
Human tells Orchestrator to cancel the amendment
  → Orchestrator signals `amendment_cancelled` event
  → Pipeline restores pre-amendment state
  → Project resumes from source tier
```

| Step | Actor | What Happens | Information Shown to Human |
|------|-------|-------------|---------------------------|
| 1 | Human | "Cancel this amendment" (at any point during amendment flow) | — |
| 2 | Orchestrator | Confirms cancellation intent | "Cancel the amendment and return to {execution at Phase 2 / completed state}? This will discard any document changes made during the amendment." |
| 3 | Human | Confirms | — |
| 4 | Orchestrator | Signals `amendment_cancelled` via pipeline script | — |
| 5 | Pipeline | Restores tier to `source_tier`, clears `state.amendment` block. Documents revert (amendment-in-progress docs are not committed). | "Amendment cancelled. Returning to {execution at Phase 2, Task 3 / completed state}." |

---

### Flow 6: Cascade Amendment Across Multiple Documents

**User Stories**: US-3, US-9

```
Primary document amended
  → amend-plan skill produces cascade flags
  → Orchestrator reads cascade flags
  → Orchestrator spawns next agent for each flagged document
  → Each agent invokes amend-plan skill for its document
  → Cascade flags from each agent checked (multi-hop)
  → Loop until no new cascade flags
```

**Cascade direction** (deterministic):
```
PRD → Design → Architecture → Master Plan
       Design → Architecture → Master Plan
                Architecture → Master Plan
                               Master Plan (terminal — no further cascade)
```

| Primary Amendment | Cascades To |
|-------------------|-------------|
| PRD | Design, Architecture, Master Plan |
| Design | Architecture, Master Plan |
| Architecture | Master Plan |
| Master Plan | (none — terminal) |

**Information shown during cascade**:

After each agent completes, the Orchestrator reports:
- "PRD amended. Sections changed: [list]. Cascade: Design and Architecture flagged."
- "Design amended. Sections changed: [list]. Cascade: Architecture flagged."
- "Architecture amended. Sections changed: [list]. Cascade: Master Plan flagged."
- "Master Plan amended. Phase count updated: 5 → 7."

---

## Information Architecture

### Orchestrator Message Taxonomy

The Orchestrator communicates amendment state through a consistent set of message types:

| Message Type | When Used | Template |
|-------------|-----------|----------|
| **Tier Confirmation** | After reading state, before interview | "The project is {mid-execution (Phase N, Task M) / complete}. I can amend the plan{— the current task will finish first / — completed phases will remain untouched}." |
| **Scope Interview** | After tier confirmation | askQuestions interaction (see [Interview Design](#interview-1-scope-classification)) |
| **Amendment Recorded** | After pipeline event accepted | "Amendment recorded. Transitioning to planning for document updates." |
| **Agent Spawn** | Before each planning agent | "Spawning {Product Manager / UX Designer / Architect} to amend the {PRD / Design / Architecture / Master Plan}..." |
| **Cascade Report** | After each agent completes | "{Document} amended. Sections changed: [{list}]. Cascade: {downstream docs flagged / no further cascade}." |
| **Re-Approval Prompt** | After all amendments complete | See [Re-Approval Prompt](#re-approval-prompt) |
| **Approval Confirmation** | After human approves | "Amendment approved. {Resuming execution at Phase N / N new phases added. Beginning execution at Phase M}." |
| **Rejection Message** | When tier is `review` | "Final review is in progress — amendments are not accepted during review. Complete the review first, then amend from the completed state." |
| **Cancellation Prompt** | Human requests cancel | "Cancel the amendment and return to {state}? This will discard any document changes made during the amendment." |
| **Cancellation Confirmation** | After cancellation | "Amendment cancelled. Returning to {state}." |
| **Error Report** | On pipeline error | "Amendment failed: {error description}. The project state has been preserved — no partial changes were applied." |

### Re-Approval Prompt

The re-approval prompt is a structured summary the Orchestrator presents after all document amendments are complete:

```
## Amendment Summary

**Scope**: {Primary document} amendment from {execution / completion}
**Source**: "{Human's original amendment description}"

### Documents Amended
| Document | Sections Changed |
|----------|-----------------|
| PRD      | FR-12 (modified), FR-34 (added) |
| Design   | Flow 3 (updated), New Component: AmendmentPanel |
| Master Plan | Phase 5 added, Phase 3 exit criteria updated |

### Cascade Path
PRD → Design → Master Plan

### Execution Impact
- **Resume point**: Phase 2 (current + next phase will be re-planned)
- **Completed phases**: Phases 1 — unchanged
- **New phases**: None / Phase 5–6 added

**Approve this amendment to resume execution?** (You can also say "skip re-approval" for minor changes.)
```

### State Change Communication

During the amendment flow, the Orchestrator communicates tier transitions clearly:

| State Transition | Message to Human |
|-----------------|-----------------|
| `execution → planning` | "Pausing execution. Entering planning mode for amendment." |
| `complete → planning` | "Re-entering planning mode to extend the project." |
| `planning → execution` (resume) | "Planning complete. Resuming execution at Phase {N}." |
| `planning → execution` (new phases) | "Planning complete. Beginning execution at Phase {N} (new)." |

---

## Interview Design

### Interview 1: Scope Classification

**Trigger**: Human requests an amendment (Flows 1 and 2, Step 3)

**Purpose**: Classify the amendment scope — which document is the primary target, what's the nature of the change, and should cascade analysis run.

**Implementation**: Single `askQuestions` invocation with 3 questions.

#### Question 1: Primary Document

```
header: "Primary Document"
question: "Which planning document should be amended?"
options:
  - label: "PRD"
    description: "Change requirements, user stories, or functional specs"
  - label: "Design"
    description: "Change user flows, interaction patterns, or component specs"
  - label: "Architecture"
    description: "Change system structure, module design, or API contracts"
  - label: "Master Plan"
    description: "Change phases, scope boundaries, or execution strategy"
multiSelect: false
allowFreeformInput: false
```

#### Question 2: Amendment Description

```
header: "Amendment Description"
question: "Describe the change you want to make (be specific — this guides the planning agent)."
allowFreeformInput: true
```

#### Question 3: Cascade Behavior

```
header: "Cascade Behavior"
question: "Should downstream documents be updated to reflect this change?"
options:
  - label: "Yes — update all affected downstream documents"
    description: "Recommended for requirement or structural changes"
    recommended: true
  - label: "No — amend only the selected document"
    description: "Use for isolated cosmetic or minor changes"
  - label: "Let me choose which downstream documents to update"
    description: "You'll select from the affected documents"
multiSelect: false
allowFreeformInput: false
```

#### Conditional Question 4: Cascade Selection

**Shown only if** Question 3 answer is "Let me choose which downstream documents to update".

```
header: "Cascade Selection"
question: "Which downstream documents should be updated?"
options: (dynamically determined by primary document)
  # If primary = PRD:
  - label: "Design"
  - label: "Architecture"
  - label: "Master Plan"
  # If primary = Design:
  - label: "Architecture"
  - label: "Master Plan"
  # If primary = Architecture:
  - label: "Master Plan"
multiSelect: true
allowFreeformInput: false
```

### Interview 2: Cancellation Confirmation

**Trigger**: Human requests amendment cancellation (Flow 5, Step 2)

**Purpose**: Confirm destructive action — discards in-progress amendment work.

**Implementation**: Single `askQuestions` invocation with 1 question.

```
header: "Confirm Cancellation"
question: "Cancel the amendment? All document changes from this amendment will be discarded."
options:
  - label: "Yes — cancel and discard changes"
  - label: "No — continue with the amendment"
    recommended: true
allowFreeformInput: false
```

---

## Agent Interaction Patterns

### Planning Agent Amendment Model

All three planning agents (Product Manager, UX Designer, Architect) follow the same interaction pattern when spawned for amendment:

```
Orchestrator spawns agent with amendment context
  → Agent reads existing document (its owned document)
  → Agent reads amendment scope (from spawn context)
  → Agent invokes `amend-plan` skill
  → Skill reads existing document, applies targeted amendments
  → Skill produces: amended document + sections_changed[] + cascade_flags[]
  → Agent saves amended document to project directory
  → Agent returns structured result to Orchestrator
```

#### Spawn Context (Orchestrator → Agent)

The Orchestrator provides each planning agent with:

| Field | Type | Description |
|-------|------|-------------|
| `document_path` | string | Path to the existing document to amend |
| `amendment_description` | string | Human's description of the desired change |
| `cascade_context` | string or null | If this agent was spawned due to cascade (not primary), the upstream change summary |
| `project_dir` | string | Project directory path |

#### Agent Return (Agent → Orchestrator)

Each planning agent returns:

| Field | Type | Description |
|-------|------|-------------|
| `amended_document_path` | string | Path to the saved amended document |
| `sections_changed` | string[] | List of section identifiers that were modified (e.g., "FR-12", "Flow 3", "Phase 5") |
| `cascade_flags` | string[] | Downstream document types that may need amendment (e.g., `["Design", "Architecture"]`) |

#### Agent-Specific Behavior

| Agent | Owned Documents | Amendment Expertise |
|-------|----------------|-------------------|
| Product Manager | PRD | Amend requirements, user stories, functional specs. Cascade flags Design and Architecture when requirements change. |
| UX Designer | Design | Amend user flows, interaction patterns, component specs. Cascade flags Architecture when interaction model changes. |
| Architect | Architecture, Master Plan | Amend system structure, module design, API contracts. For Architecture: cascade flags Master Plan. For Master Plan: update phase count in frontmatter, add/remove/modify phase outlines. |

### Orchestrator Amendment Routing

The Orchestrator's action routing table maps amendment actions to agent spawns:

| Action (from Resolver) | Orchestrator Behavior |
|------------------------|----------------------|
| `spawn_amend_prd` | Spawn Product Manager with amendment context |
| `spawn_amend_design` | Spawn UX Designer with amendment context |
| `spawn_amend_architecture` | Spawn Architect with amendment context (Architecture doc) |
| `spawn_amend_master_plan` | Spawn Architect with amendment context (Master Plan doc) |
| `request_amendment_approval` | Present re-approval prompt to human |
| `resume_from_amendment` | Signal execution resume (internal — pipeline handles) |

### Skill Invocation Pattern

The `amend-plan` skill is document-type-agnostic. The invoking agent provides domain expertise:

```
Agent invokes amend-plan:
  Input:
    - existing_document: the current document content
    - amendment_description: what to change
    - cascade_context: upstream changes (if cascade-triggered)
    - document_type: "PRD" | "Design" | "Architecture" | "Master Plan"
  
  Skill behavior:
    1. Parse existing document structure
    2. Identify sections affected by the amendment
    3. Apply targeted changes (preserve unaffected sections)
    4. Run cascade analysis (deterministic map based on document_type)
    5. If document_type === "Master Plan": update total_phases frontmatter
  
  Output:
    - amended_document: full amended document content
    - sections_changed: ["FR-12", "FR-34 (new)"]
    - cascade_flags: ["Design", "Architecture"] (or empty)
```

---

## States & Interactions

### Amendment Lifecycle States

| State | `amendment.status` | Description | Valid Transitions |
|-------|-------------------|-------------|-------------------|
| **No Amendment** | `null` | Normal pipeline operation. No amendment block in state. | → Pending |
| **Pending** | `pending` | Amendment requested, scope classified. Pipeline transitioning to planning. | → In Progress, → Cancelled |
| **In Progress** | `in_progress` | Planning agent(s) actively amending documents. | → Awaiting Approval, → Cancelled |
| **Awaiting Approval** | `awaiting_approval` | All documents amended. Waiting for human re-approval. | → Approved, → Cancelled |
| **Approved** | (block cleared) | Human approved. Amendment block cleared, execution resumes. | → No Amendment |
| **Cancelled** | (block cleared) | Human cancelled. Amendment block cleared, state restored. | → No Amendment |

### State Transition Diagram

```
[No Amendment]
       │
       ▼ (plan_amendment_requested)
   [Pending]
       │
       ├──────────────────────┐
       ▼                      ▼
  [In Progress]          [Cancelled] ──→ [No Amendment]
       │
       ▼
 [Awaiting Approval]
       │
       ├──────────────────────┐
       ▼                      ▼
  [Approved]             [Cancelled] ──→ [No Amendment]
       │
       ▼
 [No Amendment]
```

### Pipeline Tier Transitions During Amendment

| Source Tier | Amendment Active | Target Tier | Validity |
|-------------|-----------------|-------------|----------|
| `execution` | Yes | `planning` | Valid — backward transition for amendment |
| `complete` | Yes | `planning` | Valid — backward transition for amendment |
| `review` | — | — | Rejected — amendment not accepted during review |
| `planning` | Yes (approved) | `execution` | Valid — resume or start new phases |
| `execution` | No | `planning` | **Invalid** — backward transition blocked without amendment |
| `complete` | No | `planning` | **Invalid** — backward transition blocked without amendment |

---

## Error States

### Error Taxonomy

| Error | Trigger | Severity | Message to Human | State Impact |
|-------|---------|----------|-----------------|--------------|
| **Review-Tier Rejection** | Amendment requested during `review` tier | Info | "Final review is in progress — amendments are not accepted during review. Complete the review first, then amend from the completed state." | None — no state change |
| **Mutation Failure** | Pipeline mutation handler error during amendment | Critical | "Amendment failed: {error}. The project state has been preserved — no partial changes were applied." | State rolled back to pre-amendment |
| **Validation Failure** | State validator rejects post-amendment state | Critical | "Amendment produced an invalid state: {invariant violated}. The amendment has been rolled back." | State rolled back to pre-amendment |
| **Agent Failure** | Planning agent fails to produce amended document | Major | "The {agent} failed to amend the {document}: {error}. You can retry the amendment or cancel." | Amendment remains `in_progress` — retryable |
| **Cascade Failure** | Downstream agent fails during cascade | Major | "Cascade amendment failed on {document}: {error}. The primary document ({primary}) was amended successfully. You can retry the cascade or proceed with partial amendments." | Primary amendment persists; cascade is retryable |

### Recovery Patterns

| Scenario | Recovery Action |
|----------|----------------|
| Agent failure (retryable) | Orchestrator re-spawns the agent. Amendment state preserved. |
| Human wants to abort after agent failure | Human says "cancel amendment" → cancellation flow (Flow 5) |
| Validation failure | Amendment is rolled back automatically. Human receives error details and can retry with different scope. |
| Pipeline crash during amendment | On restart, `state.amendment` block is present. Resolver detects active amendment and routes to the appropriate resume point. |

---

## Accessibility

Since this is a chat-based interaction (not a GUI), accessibility is governed by the VS Code chat interface and the `askQuestions` tool:

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation | Handled by VS Code chat UI — all interactions are keyboard-accessible by default |
| Screen reader support | All Orchestrator messages are plain text/markdown — fully screen-reader compatible |
| askQuestions accessibility | The `askQuestions` tool renders as standard VS Code quick-pick UI, which is natively accessible |
| Structured output | Amendment summaries use markdown tables and headers for scannable structure |
| No color-only information | Status is always communicated through text labels, never color alone |
| Clear error messages | All errors include: what happened, what the current state is, and what the human can do next |

## Responsive Behavior

Not applicable — this is a pipeline/chat system, not a visual application. The interaction medium is the VS Code chat panel, which handles its own responsive behavior.

## Design System Additions

### New Interaction Patterns

| Pattern | Name | Description | Used By |
|---------|------|-------------|---------|
| Interview | `scope-classification` | 3-question askQuestions interview for amendment scope | Orchestrator |
| Interview | `cancellation-confirmation` | 1-question confirmation for destructive cancellation | Orchestrator |
| Prompt | `re-approval-prompt` | Structured amendment summary with approval request | Orchestrator |
| Message | `cascade-report` | Per-document amendment result with cascade flags | Orchestrator |
| Message | `tier-confirmation` | Current state + amendment capability confirmation | Orchestrator |

### New Agent Capabilities

| Agent | New Skill | New Actions |
|-------|-----------|-------------|
| Product Manager | `amend-plan` | Amend PRD with cascade analysis |
| UX Designer | `amend-plan` | Amend Design with cascade analysis |
| Architect | `amend-plan` | Amend Architecture and Master Plan with cascade analysis |
| Orchestrator | (routing only) | 6 new actions in routing table: `spawn_amend_prd`, `spawn_amend_design`, `spawn_amend_architecture`, `spawn_amend_master_plan`, `request_amendment_approval`, `resume_from_amendment` |

### Amendment State Block Schema

The `state.amendment` block when active:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `'pending' \| 'in_progress' \| 'awaiting_approval'` | Current amendment lifecycle state |
| `source_tier` | `'execution' \| 'complete'` | Tier the amendment was triggered from |
| `scope.primary_document` | `'PRD' \| 'Design' \| 'Architecture' \| 'Master Plan'` | Primary document being amended |
| `scope.description` | `string` | Human's description of the desired change |
| `scope.cascade` | `'all' \| 'none' \| string[]` | Cascade behavior selection |
| `affected_documents` | `string[]` | Documents amended so far |
| `sections_changed` | `Record<string, string[]>` | Per-document list of sections changed |
| `resume_point.phase` | `number \| null` | Phase index to resume at (execution source) |
| `resume_point.task` | `number \| null` | Task index to resume at (execution source) |
| `human_approved` | `boolean` | Whether the human has approved the amendment |

When no amendment is active: `state.amendment = null`
