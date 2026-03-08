---
project: "PIPELINE-FEEDBACK"
author: "research-agent"
created: "2026-03-08T00:00:00Z"
---

# PIPELINE-FEEDBACK — Research Findings

## Research Scope

Investigation of the existing orchestration system to determine exactly what must change to add review-document tracking to `state.json`, introduce a `triage-report` skill for the Tactical Planner, and add an Orchestrator gatekeep invariant. All six input agent files, all nine schema files, and all existing skill `SKILL.md` files were read in full.

---

## Codebase Analysis

### Relevant Existing Files

| File/Module | Path | Relevance |
|-------------|------|-----------|
| State schema | `plan/schemas/state-json-schema.md` | Defines the exact JSON fields that must be extended |
| Tactical Planner agent | `.github/agents/tactical-planner.agent.md` | Mode 3 and Mode 4 read sequences and write contracts |
| Orchestrator agent | `.github/agents/orchestrator.agent.md` | Routing logic, execution loop, where gatekeep fits |
| Reviewer agent | `.github/agents/reviewer.agent.md` | Defines review verdicts and output paths |
| Code Review template | `plan/schemas/code-review-template.md` | Frontmatter fields: `verdict`, `severity` |
| Phase Review template | `plan/schemas/phase-review-template.md` | Frontmatter fields: `verdict`, `severity` |
| Task Report template | `plan/schemas/task-report-template.md` | Frontmatter field: `status`; sections: Deviations, Recommendations |
| Task Handoff template | `plan/schemas/task-handoff-template.md` | Self-contained Coder input; no review context |
| Phase Plan template | `plan/schemas/phase-plan-template.md` | Phase-level planning document |
| Skill: `create-phase-plan` | `.github/skills/create-phase-plan/SKILL.md` | Inputs table, workflow — Mode 3 reference |
| Skill: `create-task-handoff` | `.github/skills/create-task-handoff/SKILL.md` | Inputs table, workflow — Mode 4 reference |
| Skill: `generate-phase-report` | `.github/skills/generate-phase-report/SKILL.md` | Already reads Code Reviews — pattern to follow |

---

## RQ1: Current State Audit — Tactical Planner Mode 3 & Mode 4

### Mode 3: Create Phase Plan

**What it reads (agent file + skill):**

| Step | Document | Source |
|------|----------|--------|
| 1 | Master Plan | `{NAME}-MASTER-PLAN.md` |
| 2 | Architecture | `{NAME}-ARCHITECTURE.md` |
| 3 | Design | `{NAME}-DESIGN.md` |
| 4 | `state.json` | current state, limits |
| 5 | Previous Phase Report | `{NAME}-PHASE-REPORT-P{N-1}.md` (if not first phase) |
| ❌ | ~~Previous Phase Review~~ | **Not read. No path in state.json.** |

**What it writes:**
- Phase Plan document → `{PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}.md`
- `state.json` update: creates phase entry with tasks, sets phase status to `"in_progress"`, sets `phase_doc` path

**Gap:** Phase Reviews exist at `{PROJECT-DIR}/reports/PHASE-REVIEW-P{NN}.md` but are not tracked in `state.json` and are not part of the Mode 3 read sequence. The Planner has no deterministic way to find them.

---

### Mode 4: Create Task Handoff

**What it reads (agent file + skill):**

| Step | Document | Source |
|------|----------|--------|
| 1 | Phase Plan | `{NAME}-PHASE-{NN}-{TITLE}.md` |
| 2 | Architecture | `{NAME}-ARCHITECTURE.md` |
| 3 | Design | `{NAME}-DESIGN.md` |
| 4 | Previous Task Report | `{NAME}-TASK-REPORT-P{NN}-T{NN}.md` (dependent tasks only) |
| ❌ | ~~Code Review~~ | **Not read. No path in state.json.** |

**What it writes:**
- Task Handoff document → `{PROJECT-DIR}/tasks/{NAME}-TASK-P{NN}-T{NN}-{TITLE}.md`
- `state.json` update: sets `task.handoff_doc` path

**Gap:** Code Reviews exist at `{PROJECT-DIR}/reports/CODE-REVIEW-P{NN}-T{NN}.md` and are read by `generate-phase-report`, but they are not tracked in `state.json` and are not part of the Mode 4 read sequence. A completed task that received a `changes_requested` code review generates a corrective handoff, but that corrective cycle reads the review via the **Corrective Task Handoff** sub-flow (agent file lines 127-134), not via a triage step.

**Critical observation — Corrective Handoff sub-flow:** The agent file already documents a sub-flow for corrective handoffs that reads the Code Review. However, this only runs *after* the Orchestrator has already determined a corrective cycle is needed from its routing logic — it is not a triage step run *before* planning. The Planner only reads the review at the Orchestrator's explicit direction, not autonomously.

---

### Mode 5: Generate Phase Report (for context)

Mode 5 already reads all Task Reports AND all Code Reviews for the phase (via `generate-phase-report` skill). This establishes an existing precedent for the Planner consuming review documents. The new triage step follows this same pattern but applied earlier (Mode 3 and Mode 4).

---

## RQ2: Schema Gap Analysis

### Current Task Entry (state.json)

```json
{
  "task_number": 1,
  "title": "Task Title",
  "status": "not_started|in_progress|complete|failed|halted",
  "handoff_doc": "tasks/PROJECT-TASK-P01-T01-TITLE.md",
  "report_doc": null,
  "retries": 0,
  "last_error": null,
  "severity": null
}
```

**Missing fields:**

| Field | Type | Written By | Values | Purpose |
|-------|------|-----------|--------|---------|
| `review_doc` | `string \| null` | Tactical Planner (after Reviewer saves the doc) | Path string or `null` | Deterministic path for the Planner to find the Code Review |
| `review_verdict` | `string \| null` | Tactical Planner (during triage) | `"approved" \| "changes_requested" \| "rejected" \| null` | Gatekeep signal for the Orchestrator; proof that triage ran |
| `review_action` | `string \| null` | Tactical Planner (during triage) | See action enum below | Planner's resolved decision — audit trail for what happened |

**Proposed `review_action` enum:** `"advanced" | "corrective_task_issued" | "halted" | null`

---

### Current Phase Entry (state.json)

```json
{
  "phase_number": 1,
  "title": "Phase Title",
  "status": "not_started|in_progress|complete|failed|halted",
  "phase_doc": "phases/PROJECT-PHASE-01-TITLE.md",
  "current_task": 0,
  "total_tasks": 0,
  "tasks": [...],
  "phase_report": null,
  "human_approved": false
}
```

**Missing fields:**

| Field | Type | Written By | Values | Purpose |
|-------|------|-----------|--------|---------|
| `phase_review` | `string \| null` | Tactical Planner (after Reviewer saves the doc) | Path string or `null` | Deterministic path for Mode 3 triage |
| `phase_review_verdict` | `string \| null` | Tactical Planner (during triage) | `"approved" \| "changes_requested" \| "rejected" \| null` | Gatekeep signal; proof that phase triage ran |
| `phase_review_action` | `string \| null` | Tactical Planner (during triage) | `"advanced" \| "corrective_tasks_issued" \| "halted" \| null` | Planner's resolved phase-level decision |

---

### Write Sequencing (Who Writes What, When)

The Reviewer's output path naming convention is already established:
- Code Review: `{PROJECT-DIR}/reports/CODE-REVIEW-P{NN}-T{NN}.md`
- Phase Review: `{PROJECT-DIR}/reports/PHASE-REVIEW-P{NN}.md`

The Tactical Planner currently writes `report_doc` to state.json after the Coder completes a task (Mode 2). The same Mode 2 invocation should also write `review_doc` after the Reviewer completes a code review. This preserves the sole-writer rule: the Planner records the path, not the Reviewer.

**Updated write sequence for a task:**

```
1. Coder completes → Planner (Mode 2) writes: task.report_doc = path, task.status = "complete"
2. Reviewer runs code review → Planner (Mode 2) writes: task.review_doc = path
3. Planner (Mode 4 triage) reads review → writes: task.review_verdict, task.review_action
```

**Updated write sequence for a phase:**

```
1. Planner (Mode 5) generates phase report → state.json: phase.phase_report = path
2. Reviewer runs phase review → Planner (Mode 2) writes: phase.phase_review = path
3. Planner (Mode 3 triage) reads review → writes: phase.phase_review_verdict, phase.phase_review_action
```

---

## RQ3: Triage Skill Design — Full Decision Table

### Skill: `triage-report`

**Invocation context:** Called as a mandatory step *within* Mode 3 (Create Phase Plan) and Mode 4 (Create Task Handoff). Not a standalone mode.

**Inputs:**

| Input | Required | Condition |
|-------|----------|-----------|
| Task Report | Yes (Mode 4) | Always — factual account of what was built |
| Code Review | Conditional (Mode 4) | Only if `task.review_doc != null` in state.json |
| Previous Phase Report | Yes (Mode 3) | If not first phase |
| Phase Review | Conditional (Mode 3) | Only if `phase.phase_review != null` in state.json |

**Outputs:**
1. Updated verdict/action fields in `state.json`
2. The Planner's next action decision (advance / corrective handoff / halt signal)

**Note:** Triage does NOT produce a separate document. It is a decision step, not a reporting step.

---

### Task-Level Decision Table (Mode 4)

| Task Report Status | Deviations? | Code Review Verdict | Decision | Planner Action |
|-------------------|-------------|---------------------|----------|----------------|
| `complete` | No | `null` (no review yet) | Advance | Create next task handoff normally; carry any Recommendations forward |
| `complete` | No | `approved` | Advance | Mark `review_action: "advanced"`; create next task handoff |
| `complete` | Yes (minor) | `approved` | Advance with notes | Surface deviations in next handoff context; `review_action: "advanced"` |
| `complete` | Yes (architectural) | `approved` | Flag + advance | Include deviation in carry-forward; `review_action: "advanced"` |
| `complete` | Any | `changes_requested` | Corrective task | Create corrective handoff inlining specific issues from review; `review_action: "corrective_task_issued"` |
| `complete` | Any | `rejected` | Halt | Set `review_action: "halted"`; signal Orchestrator to halt pipeline |
| `partial` | — | `null` | Assess severity | If minor issues: create corrective handoff; if blocking: halt |
| `partial` | — | `changes_requested` | Corrective task | Merge task partial-completion issues + review issues into corrective handoff |
| `partial` | — | `rejected` | Halt | `review_action: "halted"` |
| `failed` | — | Any | Assess retry budget | If retries < max AND severity == minor: corrective handoff; else halt |
| `failed` | — | — | Critical severity | Halt immediately regardless of retries |

**Key rule:** Task report is always read first. Even a `complete` task can carry deviations or recommendations relevant to the next handoff's context section.

---

### Phase-Level Decision Table (Mode 3)

| Phase Review Verdict | Exit Criteria | Decision | Planner Action |
|---------------------|---------------|----------|----------------|
| `null` (no review yet) | — | Skip phase triage | No verdict to write; proceed with phase planning using Phase Report |
| `approved` | All met | Advance | `phase_review_action: "advanced"`; proceed to plan next phase |
| `approved` | Some unmet | Flag + advance | Surface unmet criteria as carry-forward tasks in new phase plan |
| `changes_requested` | — | Corrective tasks | Create corrective task(s) targeting integration issues from review; `phase_review_action: "corrective_tasks_issued"` |
| `rejected` | — | Halt | `phase_review_action: "halted"`; signal Orchestrator to halt pipeline |

---

### Read Sequence (Mode 4 with Triage)

```
1. Read Phase Plan          → task outline, dependencies
2. Read Architecture        → contracts, interfaces
3. Read Design              → design tokens (if UI task)
4. Read Task Report(s)      → always, for dependent completed tasks
5. IF task.review_doc != null:
     Read Code Review        → verdict, issues list
6. TRIAGE                   → decision table → write verdict/action to state.json
7. PLAN                     → produce task handoff based on triage decision
```

### Read Sequence (Mode 3 with Triage)

```
1. Read Master Plan         → phase scope, exit criteria
2. Read Architecture        → module map, contracts
3. Read Design              → components (if applicable)
4. Read state.json          → current state, limits
5. Read previous Phase Report (if not first phase)
6. IF phase.phase_review != null:
     Read Phase Review       → verdict, integration issues
7. TRIAGE                   → decision table → write verdict/action to state.json
8. PLAN                     → produce phase plan based on triage decision
```

---

## RQ4: Orchestrator Gatekeep Logic

### The Invariant

The Orchestrator performs a **field-level check** — no document parsing. The check is:

```
IF task.review_doc != null AND task.review_verdict == null:
  → triage was skipped; re-spawn Planner with explicit triage instruction

IF phase.phase_review != null AND phase.phase_review_verdict == null:
  → phase triage was skipped; re-spawn Planner with explicit triage instruction
```

**What the invariant proves:** A non-null `review_verdict` alongside a non-null `review_doc` is mechanical proof that the Planner read the review and executed the decision table. This cannot be faked by the Planner without writing the field.

**Re-spawn instruction template:**

> "Triage is incomplete. Task {NN} has a code review at `{review_doc}` but `review_verdict` is null. Read the review, execute the triage decision table, write the verdict and action fields to state.json, then continue with the planned handoff."

---

### Where It Fits in Orchestrator Routing

The gatekeep check belongs in the execution loop **after** the Planner updates state from the Reviewer's output, but **before** the Orchestrator advances to the next task or phase. In the current pseudocode from the orchestrator agent:

**Current flow (task complete branch):**
```
IF task.status == "complete":
  → Spawn Reviewer for code review
  → Spawn Tactical Planner to update state from review     ← Planner writes review_doc here
  → IF review verdict is "changes_requested": retry loop
  → IF review verdict is "rejected": halt
  → Advance to next task
```

**Proposed flow (task complete branch):**
```
IF task.status == "complete":
  → Spawn Reviewer for code review
  → Spawn Tactical Planner to update state (write review_doc path)  ← Mode 2
  → RE-READ state.json
  → GATEKEEP: IF task.review_doc != null AND task.review_verdict == null:
      → Re-spawn Planner with explicit triage instruction
      → Re-read state.json
  → Advance to next task (triage decision encoded in review_verdict/review_action)
```

**Current flow (phase complete branch):**
```
IF all tasks in phase complete:
  → Spawn Tactical Planner to generate Phase Report
  → Spawn Reviewer for Phase Review
  → Spawn Tactical Planner to update state from phase review
  → Advance to next phase
```

**Proposed flow (phase complete branch):**
```
IF all tasks in phase complete:
  → Spawn Tactical Planner to generate Phase Report
  → Spawn Reviewer for Phase Review
  → Spawn Tactical Planner to update state (write phase_review path)  ← Mode 2
  → RE-READ state.json
  → GATEKEEP: IF phase.phase_review != null AND phase.phase_review_verdict == null:
      → Re-spawn Planner with explicit triage instruction
      → Re-read state.json
  → Advance to next phase (triage decision encoded in phase_review_verdict/phase_review_action)
```

**Zero overhead on happy path:** When the Planner follows the triage skill correctly, verdicts are populated in the same invocation that produces the handoff or phase plan. The gatekeep check becomes a no-op — it reads two fields and continues.

---

## RQ5: File Change Inventory

### Files to Modify

| File | Change Type | What Changes |
|------|-------------|-------------|
| `plan/schemas/state-json-schema.md` | Modify | Add `review_doc`, `review_verdict`, `review_action` to task entry; add `phase_review`, `phase_review_verdict`, `phase_review_action` to phase entry; update Field Reference and Validation Rules sections |
| `.github/agents/tactical-planner.agent.md` | Modify | Mode 3: add triage step (step 6, before planning); Mode 4: add triage step (after reading reports, before producing handoff); Skills section: add `triage-report` |
| `.github/agents/orchestrator.agent.md` | Modify | Execution loop section 2d: add gatekeep check after Planner updates state from code review; add gatekeep check after Planner updates state from phase review |

### Files to Create

| File | Type | What It Contains |
|------|------|-----------------|
| `.github/skills/triage-report/SKILL.md` | New skill | Skill description, inputs table, full decision table, read sequence for both Mode 3 and Mode 4 contexts |
| `.github/skills/triage-report/templates/` | New directory | (Optional: triage decision worksheet if a template format is useful) |

### Files That Do NOT Change

| File | Why Not |
|------|---------|
| `.github/agents/reviewer.agent.md` | Reviewer behavior and output formats are explicitly out of scope |
| `plan/schemas/code-review-template.md` | Review document format unchanged |
| `plan/schemas/phase-review-template.md` | Review document format unchanged |
| `plan/schemas/task-report-template.md` | Task report format unchanged |
| `plan/schemas/task-handoff-template.md` | Handoff format unchanged (context section carries triage findings via Planner judgment) |
| `plan/schemas/phase-plan-template.md` | Phase plan format unchanged |
| All other skills | No changes to existing skill logic |

---

## RQ6: Backward Compatibility

### Policy

> Existing `state.json` files that lack `review_doc`, `review_verdict`, `review_action`, `phase_review`, `phase_review_verdict`, or `phase_review_action` fields **treat all absent fields as `null`.**

### Implications by Field

| Absent Field | Treated As | Effect |
|-------------|-----------|--------|
| `task.review_doc` absent | `null` | Triage read step skipped for that task — no error |
| `task.review_verdict` absent | `null` | Orchestrator gatekeep: `review_doc` also null → invariant not triggered → no re-spawn |
| `task.review_action` absent | `null` | No action recorded — benign omission |
| `phase.phase_review` absent | `null` | Phase triage read step skipped — no error |
| `phase.phase_review_verdict` absent | `null` | Gatekeep: `phase_review` also null → invariant not triggered |
| `phase.phase_review_action` absent | `null` | No action recorded — benign omission |

### Gatekeep Safety

The invariant is: `review_doc != null AND review_verdict == null`. If both fields are absent (null/null), the invariant is `null != null` which is `false` — the gatekeep does not fire. This is the correct behavior: an old state file with no review fields means "no review has been tracked yet," not "triage was skipped."

The only dangerous case is `review_doc = <path>` and `review_verdict = null` — this means a review path was written but triage wasn't run. This is exactly the condition the gatekeep is designed to catch.

### Schema Version

The schema version string should be bumped from `"orchestration-state-v1"` to `"orchestration-state-v2"` to allow future tooling to distinguish old from new state files. No migration tooling is needed — the null-treatment policy handles existing files transparently.

---

## RQ7: Open Question Resolution — `review_verdict` vs `review_action`

### The Question

Should `review_verdict` carry only the raw reviewer verdict, or also a Planner-resolved action field?

### Analysis

These serve fundamentally different purposes:

| Field | Owner | Content | Audience |
|-------|-------|---------|----------|
| `review_verdict` | Tactical Planner records (from Reviewer's document) | What the Reviewer said: `approved \| changes_requested \| rejected` | Orchestrator (gatekeep signal, routing) |
| `review_action` | Tactical Planner resolves (via triage decision table) | What the Planner did: `advanced \| corrective_task_issued \| halted` | Audit log, human operators, future planners |

**Recommendation: Carry both fields.**

**Rationale:**
1. `review_verdict` is the **input** to the triage decision table — it is the Reviewer's raw verdict, transcribed by the Planner from the review document's frontmatter. This is what the Orchestrator's gatekeep checks.
2. `review_action` is the **output** of the triage decision table — it records what the Planner actually decided to do. This is the operational truth: "we got `changes_requested`, and we issued a corrective task" vs "we got `changes_requested`, and we halted because retries were exhausted."
3. Keeping them separate preserves the audit trail. A future Planner reading state.json can see both "the Reviewer said X" and "the previous Planner did Y with that information" — these can diverge (e.g., verdict was `changes_requested` but retries were exhausted so action was `halted`).
4. The Orchestrator only needs `review_verdict` for its invariant check. `review_action` is supplementary.

**Verdict enum** (transcribed from Reviewer document):
- `"approved"` — maps directly from review frontmatter `verdict: "approved"`
- `"changes_requested"` — maps from `verdict: "changes_requested"`
- `"rejected"` — maps from `verdict: "rejected"`
- `null` — review not yet triaged (gatekeep trigger when `review_doc != null`)

**Action enum** (resolved by Planner):
- `"advanced"` — Planner created next handoff/advanced normally
- `"corrective_task_issued"` — Planner created a corrective task handoff
- `"halted"` — Planner signaled halt (via state update)
- `null` — triage not yet run

---

## Existing Patterns

### Pattern: Sole Writer Rule
The Tactical Planner is the sole writer of `state.json`. This is enforced at the instruction level across all agent files. The new fields follow this same rule: the Reviewer writes review documents; the Planner reads them and records verdicts. No exceptions.

### Pattern: Path-in-State Navigation
Existing: `task.report_doc` stores the path to the Task Report. The Planner writes this path; downstream agents navigate to the document via state.json rather than constructing paths independently. The new `review_doc` and `phase_review` fields follow this identical pattern.

### Pattern: Skill as Decision Guide
Existing skills (`create-phase-plan`, `create-task-handoff`, `generate-phase-report`) each define: inputs table, workflow steps, key rules, and a template reference. The new `triage-report` skill should follow the same structure, replacing "template reference" with "decision table" since triage produces no document.

### Pattern: Conditional Reads
The `generate-phase-report` skill already uses conditional reading: "Read ALL Code Reviews for this phase." The new triage read is similarly conditional: read the Code Review only if `review_doc` is non-null in state.json. This is consistent with how the system handles optional documents.

### Pattern: Mode 2 as State Recorder
Mode 2 ("Update State") is the Planner's bookkeeping mode — it records events after they happen. Writing `review_doc` after the Reviewer saves the review document is a natural Mode 2 operation, consistent with how `report_doc` and `phase_report` are currently written.

---

## Constraints Discovered

- **No separate triage invocation**: Triage must happen within Mode 3 and Mode 4, not as a new standalone mode. Adding a mode would require Orchestrator changes to spawn it separately. The brainstorming document and architecture of the system favor zero-overhead on the happy path.
- **Orchestrator is read-only**: The gatekeep check must be a read-then-spawn pattern; the Orchestrator cannot write the verdict fields itself even if it could determine them from reading the review document.
- **Reviewer output paths are deterministic**: Code Review at `reports/CODE-REVIEW-P{NN}-T{NN}.md` and Phase Review at `reports/PHASE-REVIEW-P{NN}.md` — the Planner can verify the file exists after the Reviewer runs and record the path in state.json.
- **`review_verdict` values must match Reviewer frontmatter exactly**: The Reviewer's `code-review-template.md` and `phase-review-template.md` both use `verdict: "approved|changes_requested|rejected"`. The new state fields use the same enum — no mapping or translation needed.
- **One task in progress at a time**: The existing constraint (only one task `in_progress` across the project) means triage decisions about corrective tasks can be made without concurrency concerns.

---

## Recommendations

1. **Add `review_action` alongside `review_verdict`** — both fields carry different but complementary information. The cost is two extra null fields per task; the benefit is a complete audit trail.

2. **Update Mode 2 explicitly** for the two new write operations: (a) write `task.review_doc` after Reviewer saves Code Review; (b) write `phase.phase_review` after Reviewer saves Phase Review. These currently happen implicitly (Planner reads the Orchestrator instruction) but should be documented as explicit state update operations in the Mode 2 section.

3. **Define triage-report skill with an explicit decision table** — not prose — so the Planner has a deterministic lookup, not a judgment call. The brainstorming document has the right framing; the skill should formalize it as a two-column table (condition → action).

4. **Bump schema version** from `orchestration-state-v1` to `orchestration-state-v2` in the `$schema` field. This is low-cost and allows future tooling to handle the migration transparently.

5. **Do NOT add `review_doc` writes to the Reviewer agent** — the Reviewer saves its document and the Orchestrator spawns the Planner to record the path. The sole-writer rule is absolute.

6. **`triage-report` skill needs no template file** — unlike `create-phase-plan` or `create-task-handoff`, triage produces no document. The skill's deliverable is the decision, not a document. The `templates/` subdirectory can be omitted for this skill.

---

## Technology Stack

| Component | Type | Format | Notes |
|-----------|------|--------|-------|
| state.json | Machine-readable state | JSON | Sole-writer: Tactical Planner |
| Agent files | LLM instruction | Markdown + YAML frontmatter | Read by agent runtime |
| Skill files | LLM instruction | Markdown + YAML frontmatter | Read by agents |
| Review documents | LLM-produced reports | Markdown + YAML frontmatter | Produced by Reviewer; read by Planner |
| Phase/Task documents | LLM-produced plans | Markdown + YAML frontmatter | Produced by Planner; read by agents |
