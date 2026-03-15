---
project: "PIPELINE-FEEDBACK"
status: "draft"
author: "architect-agent"
created: "2026-03-08T00:00:00Z"
---

# PIPELINE-FEEDBACK — Architecture

## Technical Overview

This project closes the review feedback loop in the orchestration system by introducing three coordinated changes to Markdown-based agent instruction files and the JSON state schema: (1) six new fields in `state.json` (three per task, three per phase) that give the Tactical Planner deterministic read paths to review documents and give the Orchestrator a mechanical gatekeep signal; (2) a new `triage-report` skill that encodes a complete, exhaustive decision table for every combination of task-report status and review verdict; (3) targeted instruction additions to the Tactical Planner (Modes 2, 3, and 4) and the Orchestrator (execution loop gatekeep). No new agents, no new pipeline tiers, and no increase in agent invocations on the happy path — all changes are additive modifications to existing instruction files and the state schema.

---

## System Layers

```
┌───────────────────────────────────────────────────────────────┐
│  Orchestration Layer  (orchestrator.agent.md)                 │
│  Reads state.json fields; gatekeep invariant check;           │
│  re-spawns Planner if triage invariant is violated            │
├───────────────────────────────────────────────────────────────┤
│  Planning Layer  (tactical-planner.agent.md)                  │
│  Sole writer of state.json; executes triage skill within      │
│  Mode 3 and Mode 4; writes verdict/action fields as proof     │
├───────────────────────────────────────────────────────────────┤
│  Skill Layer  (.github/skills/triage-report/SKILL.md)         │
│  Decision table, read sequences, triage outputs;              │
│  no standalone invocation — embedded in Mode 3 and Mode 4     │
├───────────────────────────────────────────────────────────────┤
│  State Layer  (state.json + state-json-schema.md)             │
│  Machine-readable project state; v2 schema adds 6 fields;     │
│  sole-writer: Tactical Planner                                 │
├───────────────────────────────────────────────────────────────┤
│  Review Document Layer  (reports/*.md)                        │
│  Code Reviews + Phase Reviews produced by Reviewer agent;     │
│  paths recorded in state.json by Planner (Mode 2)            │
└───────────────────────────────────────────────────────────────┘
```

---

## Module Map

| Module | Layer | Path | Responsibility |
|--------|-------|------|----------------|
| `state-schema` | State | `plan/schemas/state-json-schema.md` | Canonical schema definition; must be updated with v2 fields and validation rules |
| `triage-report-skill` | Skill | `.github/skills/triage-report/SKILL.md` | Full triage specification: read sequences, task-level decision table, phase-level decision table, state write contract |
| `tactical-planner` | Planning | `.github/agents/tactical-planner.agent.md` | Mode 2 additions (write `review_doc`, `phase_review`); Mode 3 triage step; Mode 4 triage step; Skills list update |
| `orchestrator` | Orchestration | `.github/agents/orchestrator.agent.md` | Task-level gatekeep check; phase-level gatekeep check; re-spawn instruction templates |
| `code-review-docs` | Review Document | `{PROJECT-DIR}/reports/CODE-REVIEW-P{NN}-T{NN}.md` | Produced by Reviewer; paths recorded in `task.review_doc`; consumed by triage |
| `phase-review-docs` | Review Document | `{PROJECT-DIR}/reports/PHASE-REVIEW-P{NN}.md` | Produced by Reviewer; paths recorded in `phase.phase_review`; consumed by triage |

---

## Contracts & Interfaces

### State Schema v2 — Task Entry

The task entry in `execution.phases[].tasks[]` gains three new fields. All three are `null` until the relevant event occurs. The Tactical Planner is the **sole writer** of all three fields.

```json
{
  "task_number": 1,
  "title": "Task Title",
  "status": "not_started|in_progress|complete|failed|halted",
  "handoff_doc": "tasks/PROJECT-TASK-P01-T01-TITLE.md",
  "report_doc": null,
  "retries": 0,
  "last_error": null,
  "severity": null,
  "review_doc": null,
  "review_verdict": null,
  "review_action": null
}
```

**Field definitions:**

| Field | Type | Written When | Enum Values |
|-------|------|-------------|-------------|
| `review_doc` | `string \| null` | Mode 2 — after Reviewer saves the Code Review | Relative path string (e.g., `reports/CODE-REVIEW-P01-T01.md`) or `null` |
| `review_verdict` | `string \| null` | Mode 4 triage — transcribed verbatim from review frontmatter `verdict` field | `"approved"` \| `"changes_requested"` \| `"rejected"` \| `null` |
| `review_action` | `string \| null` | Mode 4 triage — Planner's resolved decision after applying decision table | `"advanced"` \| `"corrective_task_issued"` \| `"halted"` \| `null` |

**Invariant (used by Orchestrator gatekeep):**
```
task.review_doc != null AND task.review_verdict == null  →  triage was skipped
```

---

### State Schema v2 — Phase Entry

The phase entry in `execution.phases[]` gains three new fields. Mirror of the task-level pattern at phase granularity.

```json
{
  "phase_number": 1,
  "title": "Phase Title",
  "status": "not_started|in_progress|complete|failed|halted",
  "phase_doc": "phases/PROJECT-PHASE-01-TITLE.md",
  "current_task": 0,
  "total_tasks": 0,
  "tasks": [],
  "phase_report": null,
  "human_approved": false,
  "phase_review": null,
  "phase_review_verdict": null,
  "phase_review_action": null
}
```

**Field definitions:**

| Field | Type | Written When | Enum Values |
|-------|------|-------------|-------------|
| `phase_review` | `string \| null` | Mode 2 — after Reviewer saves the Phase Review | Relative path string (e.g., `reports/PHASE-REVIEW-P01.md`) or `null` |
| `phase_review_verdict` | `string \| null` | Mode 3 triage — transcribed verbatim from review frontmatter `verdict` field | `"approved"` \| `"changes_requested"` \| `"rejected"` \| `null` |
| `phase_review_action` | `string \| null` | Mode 3 triage — Planner's resolved decision after applying decision table | `"advanced"` \| `"corrective_tasks_issued"` \| `"halted"` \| `null` |

> **Note:** Phase action uses `"corrective_tasks_issued"` (plural) vs task action `"corrective_task_issued"` (singular) — a phase review can result in multiple corrective tasks.

**Invariant (used by Orchestrator gatekeep):**
```
phase.phase_review != null AND phase.phase_review_verdict == null  →  phase triage was skipped
```

---

### State Schema v2 — Root Version Field

```json
{
  "$schema": "orchestration-state-v2",
  ...
}
```

The `$schema` string bumps from `"orchestration-state-v1"` to `"orchestration-state-v2"`. This change is informational only — no migration tooling is required. Backward compatibility is handled via the null-treatment policy (see Section 8).

---

### `triage-report` Skill — Interface Contract

The skill file at `.github/skills/triage-report/SKILL.md` must specify all of the following:

```
SKILL: triage-report
INVOCATION: Embedded step within Mode 3 and Mode 4 only — never standalone
PRODUCES: Updated state.json fields (no separate document)

INPUTS (Mode 4 — task-level triage):
  ALWAYS: Task Report at path from state.json → task.report_doc
  CONDITIONAL: Code Review at path from state.json → task.review_doc (only if non-null)

INPUTS (Mode 3 — phase-level triage):
  ALWAYS: Phase Report at path from state.json → phase.phase_report (if not first phase)
  CONDITIONAL: Phase Review at path from state.json → phase.phase_review (only if non-null)

WRITES (task-level):
  state.json → task.review_verdict  (verbatim from review frontmatter "verdict" field)
  state.json → task.review_action   (resolved from task-level decision table)

WRITES (phase-level):
  state.json → phase.phase_review_verdict  (verbatim from review frontmatter "verdict" field)
  state.json → phase.phase_review_action   (resolved from phase-level decision table)
```

---

### Task-Level Triage Decision Table

The Planner applies this table during Mode 4 triage. Every row maps to exactly one `review_action` value. No row requires Planner judgment.

| # | Task Report Status | Has Deviations? | Code Review Verdict | `review_verdict` Written | `review_action` Written | Planner Next Action |
|---|-------------------|-----------------|---------------------|--------------------------|-------------------------|---------------------|
| 1 | `complete` | No | `null` (no review yet) | *(skip — no review doc)* | *(skip — no review doc)* | Create next task handoff; carry any Recommendations from report into context |
| 2 | `complete` | No | `"approved"` | `"approved"` | `"advanced"` | Create next task handoff normally |
| 3 | `complete` | Yes — minor | `"approved"` | `"approved"` | `"advanced"` | Create next task handoff; surface minor deviations in context section |
| 4 | `complete` | Yes — architectural | `"approved"` | `"approved"` | `"advanced"` | Create next task handoff; include architectural deviation as carry-forward item |
| 5 | `complete` | Any | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` | Create corrective task handoff; inline specific issues from review Issues table |
| 6 | `complete` | Any | `"rejected"` | `"rejected"` | `"halted"` | Write halt to state.json; do NOT produce a handoff; signal Orchestrator to halt pipeline |
| 7 | `partial` | — | `null` (no review yet) | *(skip — no review doc)* | *(skip — no review doc)* | Assess severity: if minor issues → create corrective handoff; if blocking → halt |
| 8 | `partial` | — | `"changes_requested"` | `"changes_requested"` | `"corrective_task_issued"` | Create corrective handoff; merge partial-completion issues AND review issues into single handoff |
| 9 | `partial` | — | `"rejected"` | `"rejected"` | `"halted"` | Write halt to state.json; signal Orchestrator to halt |
| 10 | `failed` | — | Any or `null` | *(record if review doc exists)* | See note | If `retries < max_retries` AND `severity == "minor"` → `"corrective_task_issued"`; else → `"halted"` |
| 11 | `failed` | — | Any or `null` — critical severity | *(record if review doc exists)* | `"halted"` | Halt immediately regardless of retry budget |

**Row 10 clarification:** For a `failed` task with an existing review doc, write the `review_verdict` (transcribed from the review), then apply the retry-budget check to determine `review_action`. Critical severity always results in `"halted"` regardless of retries.

**Row 1 / Row 7 clarification:** When `review_doc` is `null` (no review exists yet), skip the verdict/action write entirely — both fields remain `null`. This is NOT a gatekeep violation because the invariant requires `review_doc != null` to trigger.

---

### Phase-Level Triage Decision Table

The Planner applies this table during Mode 3 triage (before producing the Phase Plan).

| # | Phase Review Verdict | Exit Criteria Assessment | `phase_review_verdict` Written | `phase_review_action` Written | Planner Next Action |
|---|---------------------|--------------------------|--------------------------------|-------------------------------|---------------------|
| 1 | `null` (no phase review yet) | — | *(skip — no review doc)* | *(skip — no review doc)* | Skip phase triage; proceed with phase planning using Phase Report only |
| 2 | `"approved"` | All exit criteria met | `"approved"` | `"advanced"` | Proceed to plan next phase normally |
| 3 | `"approved"` | Some exit criteria unmet | `"approved"` | `"advanced"` | Plan next phase; surface unmet criteria as explicit carry-forward tasks in Phase Plan |
| 4 | `"changes_requested"` | — | `"changes_requested"` | `"corrective_tasks_issued"` | Create corrective task(s) targeting integration issues from review; include review's Cross-Task Issues table in handoff context |
| 5 | `"rejected"` | — | `"rejected"` | `"halted"` | Write halt to state.json; do NOT produce a Phase Plan; signal Orchestrator to halt pipeline |

---

### Orchestrator Gatekeep — Pseudocode Contract

The gatekeep check is a pure field-level comparison. The Orchestrator reads two fields from state.json and makes a binary decision. No document parsing.

```
// Task-level gatekeep (runs after Planner writes review_doc via Mode 2)
RE-READ state.json
task = phases[current_phase].tasks[current_task]

IF task.review_doc != null AND task.review_verdict == null:
  triage_attempts += 1
  IF triage_attempts > 1:
    → HALT pipeline with error:
      "Triage invariant still violated after re-spawn. review_doc={task.review_doc}
       review_verdict=null. Pipeline halted — requires human intervention."
  ELSE:
    → RE-SPAWN Tactical Planner (Mode 4) with instruction:
      "Triage is incomplete. Task {task_number} has a code review at '{task.review_doc}'
       but review_verdict is null. Read the review document, execute the triage decision
       table from the triage-report skill, write review_verdict and review_action to
       state.json for task {task_number} in phase {phase_number}, then produce the
       Task Handoff for the next task."
    → RE-READ state.json
    → Verify invariant is now false before continuing

// Phase-level gatekeep (runs after Planner writes phase_review via Mode 2)
RE-READ state.json
phase = phases[current_phase]

IF phase.phase_review != null AND phase.phase_review_verdict == null:
  triage_attempts += 1
  IF triage_attempts > 1:
    → HALT pipeline with error:
      "Phase triage invariant still violated after re-spawn. phase_review={phase.phase_review}
       phase_review_verdict=null. Pipeline halted — requires human intervention."
  ELSE:
    → RE-SPAWN Tactical Planner (Mode 3) with instruction:
      "Phase triage is incomplete. Phase {phase_number} has a phase review at
       '{phase.phase_review}' but phase_review_verdict is null. Read the phase review
       document, execute the phase-level triage decision table from the triage-report
       skill, write phase_review_verdict and phase_review_action to state.json for
       phase {phase_number}, then produce the Phase Plan for phase {next_phase_number}."
    → RE-READ state.json
    → Verify invariant is now false before continuing
```

**Re-spawn limit enforcement (NFR-07):** The `triage_attempts` counter is local to the current Orchestrator invocation for a given task or phase transition. If after one re-spawn the verdict field is still null, the Orchestrator must halt the pipeline by writing a blocker to `errors.active_blockers` via the Tactical Planner (Mode 2), then displaying STATUS.md to the human. The Orchestrator does not loop indefinitely.

---

### Tactical Planner — Mode 2 Extended Write Contract

Mode 2 must explicitly handle two new write operations (in addition to existing operations):

```
// New operation A: Record review_doc after Reviewer saves Code Review
WHEN: Orchestrator informs Planner that code review is complete
WRITE: execution.phases[N].tasks[M].review_doc = "{PROJECT-DIR}/reports/CODE-REVIEW-P{NN}-T{NN}.md"
NOTE: review_verdict and review_action remain null — triage has not run yet

// New operation B: Record phase_review after Reviewer saves Phase Review
WHEN: Orchestrator informs Planner that phase review is complete
WRITE: execution.phases[N].phase_review = "{PROJECT-DIR}/reports/PHASE-REVIEW-P{NN}.md"
NOTE: phase_review_verdict and phase_review_action remain null — triage has not run yet
```

---

### Tactical Planner — Mode 3 Updated Read Sequence

```
1. Read Master Plan          → {PROJECT-DIR}/{NAME}-MASTER-PLAN.md
2. Read Architecture         → {PROJECT-DIR}/{NAME}-ARCHITECTURE.md
3. Read Design               → {PROJECT-DIR}/{NAME}-DESIGN.md
4. Read state.json           → current state, limits, phase.phase_review path
5. Read previous Phase Report → {PROJECT-DIR}/reports/{NAME}-PHASE-REPORT-P{N-1}.md
                                (skip if first phase)
6. IF state.json → phase.phase_review != null:
     Read Phase Review       → path from state.json → phase.phase_review
7. EXECUTE triage-report skill (phase-level decision table)
   WRITE state.json:
     phase.phase_review_verdict  ← verdict from Phase Review frontmatter (or skip if null)
     phase.phase_review_action   ← resolved from phase-level decision table (or skip if null)
8. PLAN: produce Phase Plan document based on triage outcome
   Save → {PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}.md
9. WRITE state.json: create phase entry with tasks, set phase status to "in_progress"
```

**Decision routing after triage (step 7→8):**

| `phase_review_action` value | What to produce in step 8 |
|-----------------------------|--------------------------|
| `"advanced"` or `null` (no review) | Normal Phase Plan for the next phase |
| `"advanced"` (some exit criteria unmet) | Phase Plan with explicit carry-forward task section addressing unmet criteria |
| `"corrective_tasks_issued"` | Phase Plan that opens with corrective tasks addressing the review's Cross-Task Issues; new tasks come after |
| `"halted"` | DO NOT produce a Phase Plan — write halt to state.json; stop |

---

### Tactical Planner — Mode 4 Updated Read Sequence

```
1. Read Phase Plan            → {PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}.md
2. Read Architecture          → {PROJECT-DIR}/{NAME}-ARCHITECTURE.md
3. Read Design                → {PROJECT-DIR}/{NAME}-DESIGN.md
4. Read Task Report(s)        → for each dependent completed task:
                                  path from state.json → task.report_doc
5. IF state.json → task.review_doc != null (for relevant completed task):
     Read Code Review         → path from state.json → task.review_doc
6. EXECUTE triage-report skill (task-level decision table)
   WRITE state.json:
     task.review_verdict  ← verdict from Code Review frontmatter (or skip if no review doc)
     task.review_action   ← resolved from task-level decision table (or skip if no review doc)
7. PLAN: produce Task Handoff (or corrective handoff, or halt) based on triage outcome
   Save → {PROJECT-DIR}/tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md
8. WRITE state.json: set task.handoff_doc path
```

**Decision routing after triage (step 6→7):**

| `review_action` value | What to produce in step 7 |
|-----------------------|--------------------------|
| `"advanced"` | Normal Task Handoff for next task; include any carry-forward items in context section |
| `"corrective_task_issued"` | Corrective Task Handoff; inline all Issues from Code Review; include original acceptance criteria |
| `"halted"` | DO NOT produce a Task Handoff — write halt to state.json; stop |
| `null` (no review doc) | Normal Task Handoff; include Task Report Recommendations in context section |

**Integration with existing Corrective Task Handoff sub-flow:** The existing Corrective Task Handoff sub-flow documented in Mode 4 (agent file lines 127–134) is subsumed into the triage step. When triage produces `review_action: "corrective_task_issued"`, the Planner follows the same corrective handoff construction rules (read original handoff, focus on fixing issues, include original acceptance criteria). The sub-flow is no longer a separate parallel path — it is now the output of triage row 5 or row 8.

---

## API Endpoints

This project modifies no HTTP API endpoints. All interfaces are agent instruction files (Markdown) and a JSON state file. There are no network calls, no REST endpoints, and no new external integrations.

---

## Dependencies

### External Dependencies

No new external dependencies. All components are Markdown instruction files consumed by the LLM agent runtime.

| Component | Type | Notes |
|-----------|------|-------|
| LLM agent runtime | Runtime | Existing — unchanged |
| `state.json` | JSON file | Existing — schema updated to v2 |
| Review document files | Markdown | Existing — produced by Reviewer; format unchanged |

### Internal Dependencies (module → module)

```
orchestrator
  └── reads state.json (v2 fields: review_doc, review_verdict, phase_review, phase_review_verdict)
  └── spawns tactical-planner (Mode 2, 3, 4) with explicit instructions

tactical-planner (Mode 2)
  └── writes state.json: task.review_doc, phase.phase_review

tactical-planner (Mode 3)
  └── reads state.json → phase.phase_review path
  └── reads phase-review-docs (conditional)
  └── uses triage-report-skill (phase-level decision table)
  └── writes state.json: phase.phase_review_verdict, phase.phase_review_action

tactical-planner (Mode 4)
  └── reads state.json → task.review_doc path
  └── reads code-review-docs (conditional)
  └── uses triage-report-skill (task-level decision table)
  └── writes state.json: task.review_verdict, task.review_action

triage-report-skill
  └── no file dependencies — it is an instruction document
  └── consumed by tactical-planner (Mode 3 and Mode 4)

code-review-docs
  └── produced by reviewer-agent (unchanged)
  └── paths tracked in state.json → task.review_doc

phase-review-docs
  └── produced by reviewer-agent (unchanged)
  └── paths tracked in state.json → phase.phase_review
```

---

## File Structure

### Files to CREATE

```
.github/
└── skills/
    └── triage-report/
        └── SKILL.md          # Full triage skill: read sequences, decision tables,
                              # state write contract, triage outputs specification
                              # NOTE: No templates/ subdirectory — triage produces
                              #       no document; decision tables ARE the deliverable
```

### Files to MODIFY

```
.github/
├── agents/
│   ├── tactical-planner.agent.md   # Add Mode 2 new write operations (review_doc, phase_review)
│   │                               # Rewrite Mode 3 read sequence (add steps 6-7)
│   │                               # Rewrite Mode 4 read sequence (add steps 5-6)
│   │                               # Update Corrective Handoff sub-flow note (subsumed by triage)
│   │                               # Add triage-report to Skills section
│   └── orchestrator.agent.md       # Add task-level gatekeep block in section 2d
│                                   # Add phase-level gatekeep block in section 2d
│                                   # Add re-spawn limit rule (NFR-07)
└── (skills/ — new directory, see above)

plan/
└── schemas/
    └── state-json-schema.md        # Bump $schema to orchestration-state-v2
                                    # Add review_doc, review_verdict, review_action to task entry
                                    # Add phase_review, phase_review_verdict, phase_review_action to phase entry
                                    # Add new Field Reference entries for all 6 fields
                                    # Add new validation rules for invariant checks
                                    # Update pseudocode to show gatekeep check
```

### Files That Do NOT Change

```
.github/
├── agents/
│   └── reviewer.agent.md           # Reviewer behavior and output paths unchanged
└── skills/
    ├── create-phase-plan/SKILL.md  # Template and workflow unchanged
    ├── create-task-handoff/SKILL.md # Template and workflow unchanged
    └── generate-phase-report/SKILL.md # Unchanged

plan/
└── schemas/
    ├── code-review-template.md     # Review format unchanged
    ├── phase-review-template.md    # Review format unchanged
    ├── task-report-template.md     # Task report format unchanged
    ├── task-handoff-template.md    # Handoff format unchanged
    └── phase-plan-template.md      # Phase plan format unchanged
```

---

## Cross-Cutting Concerns

| Concern | Strategy |
|---------|----------|
| **Sole-writer integrity** | All six new state.json fields are written exclusively by the Tactical Planner. The Reviewer writes review documents; the Orchestrator is read-only. These rules are enforced at the instruction level in each agent file and documented explicitly in the schema Field Reference. |
| **Triage determinism** | Every input combination in both decision tables maps to exactly one action. No row uses language like "use judgment" or "assess." The skill file must be exhaustive — if a row is missing, it is an architecture defect. |
| **Gatekeep re-spawn limit** | The Orchestrator enforces a maximum of one re-spawn per triage invariant violation (per task or phase). If after one re-spawn the invariant is still true, the pipeline halts with an explicit error added to `errors.active_blockers`. This prevents infinite loops (NFR-07). |
| **Backward compatibility** | All six new fields default to `null` when absent. The Orchestrator and Planner treat absent fields as `null`. The invariant `null != null` is `false` — legacy state files never trigger the gatekeep. Documented in schema Field Reference. |
| **Audit trail immutability** | Once `review_verdict` and `review_action` are written for a task, they must not be overwritten by subsequent triage of a different task. Each task's fields are indexed by `task_number` — the Planner writes to the specific task entry matching the task being triaged. |
| **Verbatim verdict transcription** | `review_verdict` values (`"approved"`, `"changes_requested"`, `"rejected"`) must match the Reviewer's frontmatter enum exactly — no casing normalization, no mapping. The triage skill specifies verbatim transcription. |
| **Error propagation** | If the Planner cannot read the review document at the path stored in `review_doc` / `phase_review`, it must report a specific error ("review document not found at `{path}`") and halt rather than silently skipping triage. Halt writes `errors.active_blockers` with the path. |
| **State consistency** | Triage verdict/action writes must happen in the same state.json update as (or before) the handoff doc path write. The Planner must not write `task.handoff_doc` without first writing `task.review_verdict` and `task.review_action` (when a review doc is present). |

---

## Data Flow Diagram

```
════════════════════════════════════════════════════════════════════════════
TASK-LEVEL FEEDBACK LOOP
════════════════════════════════════════════════════════════════════════════

 Coder Agent
     │
     │  produces
     ▼
 Task Report ──────────────────────────────────────────────────────────────┐
 (reports/TASK-REPORT-P{NN}-T{NN}.md)                                      │
                                                                            │ Planner (Mode 2)
 Reviewer Agent                                                             │ reads report
     │                                                                      │ writes state:
     │  produces                                                            │   task.report_doc
     ▼                                                                      │   task.status = "complete"
 Code Review                                                                │
 (reports/CODE-REVIEW-P{NN}-T{NN}.md)                                      │
     │                                                                      │
     │  Planner (Mode 2) records path ──────────────────────────────────►  │
     │  state.json: task.review_doc = "reports/CODE-REVIEW-..."            │
     │                                                                      │
     │  Orchestrator GATEKEEP CHECK:                                        │
     │  IF task.review_doc != null AND task.review_verdict == null          │
     │    → re-spawn Planner with explicit triage instruction               │
     │                                                                      │
     ▼                                                                      │
 Planner (Mode 4) — TRIAGE STEP                                            │
     │  1. Reads Task Report (always)  ◄──────────────────────────────────┘
     │  2. Reads Code Review (if review_doc non-null)
     │  3. Applies task-level decision table
     │  4. Writes state.json:
     │       task.review_verdict  ← verbatim from review frontmatter
     │       task.review_action   ← resolved from decision table
     │
     │  DECISION:
     ├─── review_action = "advanced"              ──► Normal Task Handoff
     ├─── review_action = "corrective_task_issued" ──► Corrective Task Handoff
     └─── review_action = "halted"               ──► Halt pipeline


════════════════════════════════════════════════════════════════════════════
PHASE-LEVEL FEEDBACK LOOP
════════════════════════════════════════════════════════════════════════════

 Planner (Mode 5) — generates Phase Report
     │  writes state.json: phase.phase_report = path
     │
     ▼
 Reviewer Agent
     │  produces
     ▼
 Phase Review
 (reports/PHASE-REVIEW-P{NN}.md)
     │
     │  Planner (Mode 2) records path
     │  state.json: phase.phase_review = "reports/PHASE-REVIEW-..."
     │
     │  Orchestrator GATEKEEP CHECK:
     │  IF phase.phase_review != null AND phase.phase_review_verdict == null
     │    → re-spawn Planner with explicit phase triage instruction
     │
     ▼
 Planner (Mode 3) — TRIAGE STEP
     │  1. Reads Phase Report (always, if not first phase)
     │  2. Reads Phase Review (if phase_review non-null)
     │  3. Applies phase-level decision table
     │  4. Writes state.json:
     │       phase.phase_review_verdict  ← verbatim from review frontmatter
     │       phase.phase_review_action   ← resolved from decision table
     │
     │  DECISION:
     ├─── phase_review_action = "advanced"              ──► Normal Phase Plan
     ├─── phase_review_action = "corrective_tasks_issued" ──► Phase Plan with corrective tasks
     └─── phase_review_action = "halted"               ──► Halt pipeline


════════════════════════════════════════════════════════════════════════════
ORCHESTRATOR FIELD-LEVEL READ (Gatekeep — no document parsing)
════════════════════════════════════════════════════════════════════════════

 state.json
 ┌──────────────────────────────────────────────────────┐
 │ task.review_doc:     "reports/CODE-REVIEW-P01-T01.md"│
 │ task.review_verdict: null  ◄── INVARIANT TRIGGERED   │
 │ task.review_action:  null                            │
 └──────────────────────────────────────────────────────┘
         │
         │  Orchestrator reads ONLY these two fields
         │  No review document parsing
         ▼
 IF review_doc != null AND review_verdict == null
   → Re-spawn Planner with explicit path + field names
```

---

## Backward Compatibility

### Policy: Absent Fields Equal Null

Any `state.json` file that lacks the new fields (`review_doc`, `review_verdict`, `review_action`, `phase_review`, `phase_review_verdict`, `phase_review_action`) must be treated as if all absent fields have value `null`. This applies to all readers: Orchestrator, Tactical Planner, and any tooling.

### Null-Treatment Table

| Field Absent From state.json | Treated As | Effect on Pipeline |
|------------------------------|-----------|-------------------|
| `task.review_doc` | `null` | Triage read step skipped — no error; `review_verdict` also absent → both null |
| `task.review_verdict` | `null` | Gatekeep: `review_doc` is also null → invariant is `null != null` = `false` → no re-spawn |
| `task.review_action` | `null` | Audit field missing — benign; no operational impact |
| `phase.phase_review` | `null` | Phase triage read step skipped — no error |
| `phase.phase_review_verdict` | `null` | Gatekeep: `phase_review` also null → invariant = `false` → no re-spawn |
| `phase.phase_review_action` | `null` | Audit field missing — benign; no operational impact |

### Gatekeep Safety Analysis

The gatekeep invariant is: `review_doc != null AND review_verdict == null`.

- **Legacy file (no new fields):** `null != null` evaluates to `false` → invariant not triggered → no re-spawn. ✅ Safe.
- **New file, no review yet:** `review_doc = null` → first condition false → invariant not triggered. ✅ Safe.
- **New file, review recorded, triage done:** `review_doc = <path>`, `review_verdict = "approved"` → second condition false → invariant not triggered. ✅ Safe.
- **New file, review recorded, triage skipped:** `review_doc = <path>`, `review_verdict = null` → both conditions true → invariant triggered → re-spawn. ✅ Correctly caught.

### Schema Version Detection

- Files with `"$schema": "orchestration-state-v1"` are legacy files — null-treatment policy applies.
- Files with `"$schema": "orchestration-state-v2"` are updated files — new fields may be present.
- Files missing the `$schema` field entirely should be treated as v1.
- The version bump is informational only. No automated migration is required or provided.

---

## Phasing Recommendations

> Advisory. The Tactical Planner makes final phasing decisions.

### Phase 1 — Schema Foundation (Recommended first)

**Goal:** Update the state schema definition and create the triage skill. These are the foundational contracts that all other changes depend on.

**Scope:**
- Update `plan/schemas/state-json-schema.md`:
  - Bump `$schema` to `"orchestration-state-v2"`
  - Add 3 new fields to task entry (with field reference entries and validation rules)
  - Add 3 new fields to phase entry (with field reference entries)
  - Add invariant documentation to Validation Rules section
  - Update pseudocode to show gatekeep check placeholder
- Create `.github/skills/triage-report/SKILL.md`:
  - Full skill header (name, invocation context, produces-no-document note)
  - Mode 4 read sequence (task-level triage)
  - Mode 3 read sequence (phase-level triage)
  - Complete task-level decision table (11 rows)
  - Complete phase-level decision table (5 rows)
  - State write contract (what fields are written, when, with what values)
  - Verbatim transcription rule for verdict values

**Exit criteria:** Schema doc updated with all 6 fields and their enums. Skill file created with exhaustive decision tables covering all input combinations.

---

### Phase 2 — Tactical Planner Updates (Depends on Phase 1)

**Goal:** Add triage steps to Mode 3 and Mode 4 and extend Mode 2 with the two new write operations.

**Scope:**
- Update `.github/agents/tactical-planner.agent.md`:
  - Mode 2: add "Record review_doc" and "Record phase_review" as explicit write operations
  - Mode 3: insert steps 6-7 (conditional Phase Review read + triage execution + state writes)
  - Mode 3: add decision routing table (what to produce based on `phase_review_action`)
  - Mode 4: insert steps 5-6 (conditional Code Review read + triage execution + state writes)
  - Mode 4: add decision routing table (what to produce based on `review_action`)
  - Mode 4: update Corrective Task Handoff sub-flow note (now subsumed by triage)
  - Skills section: add `triage-report` entry

**Exit criteria:** Both Mode 3 and Mode 4 have explicit triage steps. Mode 2 documents both new write operations. Corrective handoff sub-flow note is updated.

---

### Phase 3 — Orchestrator Gatekeep (Depends on Phase 1 and Phase 2)

**Goal:** Add the gatekeep invariant checks to the Orchestrator's execution loop.

**Scope:**
- Update `.github/agents/orchestrator.agent.md`:
  - Section 2d execution loop — task complete branch: add gatekeep check block after Planner Mode 2 write of `review_doc`
  - Section 2d execution loop — phase complete branch: add gatekeep check block after Planner Mode 2 write of `phase_review`
  - Add re-spawn limit rule (NFR-07: halt after one failed re-spawn)
  - Add re-spawn instruction templates (explicit path + field name format)

**Exit criteria:** Orchestrator execution loop contains both gatekeep checks with explicit re-spawn instructions and re-spawn limit enforcement.

---

### Phase 4 — Validation & Integration Testing (Depends on Phases 1–3)

**Goal:** Verify all changes work together end-to-end with both new and legacy state files.

**Scope:**
- Validate triage skill decision table completeness (no uncovered input combinations)
- Validate backward compatibility: run pipeline against a legacy `state.json` (v1 schema, no new fields) and confirm no errors or spurious gatekeep re-spawns
- Validate happy path: confirm no increase in agent invocations when Planner follows triage skill correctly
- Validate gatekeep: confirm invariant is caught and Planner is re-spawned with correct instruction
- Validate re-spawn limit: confirm pipeline halts after one failed re-spawn (not infinite loop)
- Validate audit trail: confirm both `review_verdict` and `review_action` are populated for every triaged task and phase

**Exit criteria:** All success metrics from PRD Section "Success Metrics" are verifiable. Zero pipeline errors against legacy state files. Zero increase in invocations on happy path.
