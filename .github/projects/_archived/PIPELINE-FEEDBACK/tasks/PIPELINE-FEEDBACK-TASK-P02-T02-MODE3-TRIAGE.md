---
project: "PIPELINE-FEEDBACK"
phase: 2
task: 2
title: "Update Tactical Planner Mode 3 (Create Phase Plan)"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Update Tactical Planner Mode 3 (Create Phase Plan)

## Objective

Replace the Tactical Planner's Mode 3 numbered-step sequence (currently 13 steps) with a consolidated 9-step sequence that inserts phase-level triage (conditional Phase Review read + triage-report skill execution) as steps 6–7, adds a decision routing table between triage and planning, and consolidates the original planning sub-steps (check limits, break into tasks, map dependencies, execution order, exit criteria, use skill, save) into step 8.

## Context

The file `.github/agents/tactical-planner.agent.md` contains 5 modes. Mode 3 ("Create Phase Plan") currently has 13 numbered steps. Phase 1 of this project created the `triage-report` skill (`.github/skills/triage-report/SKILL.md`) with a phase-level decision table. Phase 2 Task 1 already added two new bullets to Mode 2 for recording `review_doc` and `phase_review` paths. This task (T2) modifies ONLY Mode 3 to embed triage before phase planning. Mode 4 and the Skills section will be updated in T3.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/tactical-planner.agent.md` | Mode 3 section ONLY — replace the 13-step numbered list with a 9-step list, add decision routing table |

## Implementation Steps

1. **Locate the Mode 3 section** — find the heading `## Mode 3: Create Phase Plan` in `.github/agents/tactical-planner.agent.md`. The section starts with the heading and the line "When spawned to plan a phase:" and contains 13 numbered steps. It ends just before `## Mode 4: Create Task Handoff`.

2. **Preserve the section heading and intro line** — keep these two lines exactly as-is:
   ```
   ## Mode 3: Create Phase Plan

   When spawned to plan a phase:
   ```

3. **Replace the entire 13-step numbered list** (steps 1–13) with the following 9-step list. Copy this EXACTLY:

   ```markdown
   1. **Read the Master Plan** — find the phase outline for the current phase
   2. **Read the Architecture** — module map, contracts, file structure
   3. **Read the Design** — components, design tokens (if applicable)
   4. **Read `state.json`** — current state, limits, `phase.phase_review` path
   5. **Read previous Phase Report** (if not first phase) — carry-forward items
   6. **IF `state.json → phase.phase_review != null`**:
      Read the Phase Review at the path from `state.json → phase.phase_review`
   7. **Execute `triage-report` skill** (phase-level decision table):
      - Write `phase.phase_review_verdict` ← verdict from Phase Review frontmatter (or skip if `phase_review` is null)
      - Write `phase.phase_review_action` ← resolved from phase-level decision table (or skip if `phase_review` is null)
   ```

4. **Insert the decision routing table** immediately after step 7 (before step 8). Copy this EXACTLY:

   ```markdown
   **Decision routing after triage (step 7→8):**

   | `phase_review_action` value | What to produce in step 8 |
   |-----------------------------|--------------------------|
   | `"advanced"` or `null` (no review) | Normal Phase Plan for the next phase |
   | `"advanced"` (some exit criteria unmet) | Phase Plan with explicit carry-forward task section addressing unmet criteria |
   | `"corrective_tasks_issued"` | Phase Plan that opens with corrective tasks addressing the review's Cross-Task Issues; new tasks come after |
   | `"halted"` | DO NOT produce a Phase Plan — write halt to state.json; stop |
   ```

5. **Add steps 8–9** after the decision routing table. Step 8 consolidates original steps 6–12 (check limits, break into tasks, map dependencies, execution order, exit criteria, use skill, save). Step 9 is the state write (original step 13 renumbered). Copy this EXACTLY:

   ```markdown
   8. **PLAN**: Produce Phase Plan document based on triage outcome:
      - **Check limits**: Ensure task count won't exceed `limits.max_tasks_per_phase`
      - **Break the phase into tasks**: Each task achievable in a single Coder session
      - **Map dependencies**: Which tasks depend on other tasks' outputs
      - **Define execution order**: Sequential order with parallel-ready pairs marked
      - **Set exit criteria**: From Master Plan plus standard criteria (build passes, tests pass)
      - **Use the `create-phase-plan` skill** to produce the document
      - **Save** to `{PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}.md`
   9. **Update `state.json`**: Create phase entry with tasks, set phase status to `"in_progress"`
   ```

6. **Verify no changes outside Mode 3** — do NOT edit any text before the `## Mode 3: Create Phase Plan` heading or after the last line of Mode 3 (the line for step 9). Mode 1, Mode 2, Mode 4, Mode 5, Skills, Output Contract, and Quality Standards must remain untouched.

7. **Verify step count** — the final Mode 3 section must contain exactly 9 numbered steps (1–9), no more, no less.

8. **Verify the "Check limits" constraint is preserved** — the first sub-bullet of step 8 must be "Check limits: Ensure task count won't exceed `limits.max_tasks_per_phase`".

## Contracts & Interfaces

### Current Mode 3 Content (REPLACE THIS)

The current Mode 3 numbered list is exactly:

```markdown
1. **Read the Master Plan** — find the phase outline for the current phase
2. **Read the Architecture** — module map, contracts, file structure
3. **Read the Design** — components, design tokens (if applicable)
4. **Read `state.json`** — current state, limits, previous phase reports
5. **Read previous Phase Report** (if not first phase) — carry-forward items
6. **Check limits**: Ensure task count won't exceed `limits.max_tasks_per_phase`
7. **Break the phase into tasks**: Each task achievable in a single Coder session
8. **Map dependencies**: Which tasks depend on other tasks' outputs
9. **Define execution order**: Sequential order with parallel-ready pairs marked
10. **Set exit criteria**: From Master Plan plus standard criteria (build passes, tests pass)
11. **Use the `create-phase-plan` skill** to produce the document
12. **Save** to `{PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}.md`
13. **Update `state.json`**: Create phase entry with tasks, set phase status to `"in_progress"`
```

### New Mode 3 Content (FULL REPLACEMENT — copy verbatim)

```markdown
1. **Read the Master Plan** — find the phase outline for the current phase
2. **Read the Architecture** — module map, contracts, file structure
3. **Read the Design** — components, design tokens (if applicable)
4. **Read `state.json`** — current state, limits, `phase.phase_review` path
5. **Read previous Phase Report** (if not first phase) — carry-forward items
6. **IF `state.json → phase.phase_review != null`**:
   Read the Phase Review at the path from `state.json → phase.phase_review`
7. **Execute `triage-report` skill** (phase-level decision table):
   - Write `phase.phase_review_verdict` ← verdict from Phase Review frontmatter (or skip if `phase_review` is null)
   - Write `phase.phase_review_action` ← resolved from phase-level decision table (or skip if `phase_review` is null)

**Decision routing after triage (step 7→8):**

| `phase_review_action` value | What to produce in step 8 |
|-----------------------------|--------------------------|
| `"advanced"` or `null` (no review) | Normal Phase Plan for the next phase |
| `"advanced"` (some exit criteria unmet) | Phase Plan with explicit carry-forward task section addressing unmet criteria |
| `"corrective_tasks_issued"` | Phase Plan that opens with corrective tasks addressing the review's Cross-Task Issues; new tasks come after |
| `"halted"` | DO NOT produce a Phase Plan — write halt to state.json; stop |

8. **PLAN**: Produce Phase Plan document based on triage outcome:
   - **Check limits**: Ensure task count won't exceed `limits.max_tasks_per_phase`
   - **Break the phase into tasks**: Each task achievable in a single Coder session
   - **Map dependencies**: Which tasks depend on other tasks' outputs
   - **Define execution order**: Sequential order with parallel-ready pairs marked
   - **Set exit criteria**: From Master Plan plus standard criteria (build passes, tests pass)
   - **Use the `create-phase-plan` skill** to produce the document
   - **Save** to `{PROJECT-DIR}/phases/{NAME}-PHASE-{NN}-{TITLE}.md`
9. **Update `state.json`**: Create phase entry with tasks, set phase status to `"in_progress"`
```

### Phase-Level Decision Table (reference — the triage-report skill encodes this)

The `triage-report` skill at `.github/skills/triage-report/SKILL.md` contains the phase-level decision table that step 7 executes:

| # | Phase Review Verdict | Exit Criteria Assessment | `phase_review_verdict` Written | `phase_review_action` Written | Planner Next Action |
|---|---|---|---|---|---|
| 1 | `null` (no phase review yet) | — | *(skip — no review doc)* | *(skip — no review doc)* | Skip phase triage; proceed with phase planning using Phase Report only |
| 2 | `"approved"` | All exit criteria met | `"approved"` | `"advanced"` | Proceed to plan next phase normally |
| 3 | `"approved"` | Some exit criteria unmet | `"approved"` | `"advanced"` | Plan next phase; surface unmet criteria as explicit carry-forward tasks in Phase Plan |
| 4 | `"changes_requested"` | — | `"changes_requested"` | `"corrective_tasks_issued"` | Create corrective task(s) targeting integration issues from review; include review's Cross-Task Issues table in handoff context |
| 5 | `"rejected"` | — | `"rejected"` | `"halted"` | Write halt to state.json; do NOT produce a Phase Plan; signal Orchestrator to halt pipeline |

> **Note:** `phase_review_action` uses `"corrective_tasks_issued"` (plural) — a phase review can result in multiple corrective tasks. This is intentionally different from task-level `review_action` which uses `"corrective_task_issued"` (singular). Do NOT normalize.

### State Fields Written by Step 7

After executing the phase-level decision table, write to `state.json → execution.phases[N]`:

| Field | Value Source | Allowed Values |
|-------|-------------|----------------|
| `phase_review_verdict` | Verbatim from Phase Review frontmatter `verdict` field | `"approved"` \| `"changes_requested"` \| `"rejected"` \| `null` |
| `phase_review_action` | Resolved from phase-level decision table | `"advanced"` \| `"corrective_tasks_issued"` \| `"halted"` \| `null` |

**Write ordering:** Verdict and action fields MUST be written to `state.json` BEFORE the Phase Plan entry (step 9). The Planner must never create the phase entry without first writing `phase_review_verdict` and `phase_review_action` when `phase_review` is non-null.

## Styles & Design Tokens

N/A — this is a Markdown agent instruction file, not a UI component.

## Test Requirements

- [ ] The file `.github/agents/tactical-planner.agent.md` is valid Markdown with valid frontmatter
- [ ] Count the numbered steps in Mode 3: must be exactly 9
- [ ] Step 4 reads `state.json` and includes `phase.phase_review` path in its description
- [ ] Step 6 is conditional: it only reads the Phase Review if `phase.phase_review != null`
- [ ] Step 7 references execution of `triage-report` skill and writes `phase_review_verdict` and `phase_review_action`
- [ ] Decision routing table has exactly 4 rows (plus header)
- [ ] Step 8 contains sub-bullets for: check limits, break into tasks, map dependencies, execution order, exit criteria, use skill, save
- [ ] Step 9 writes state.json to create phase entry with tasks
- [ ] Existing orchestration validation passes (`tests/agents.test.js`, `tests/frontmatter.test.js`)

## Acceptance Criteria

- [ ] Mode 3 has exactly 9 numbered steps
- [ ] Step 6 is a conditional Phase Review read (only if `phase.phase_review != null`)
- [ ] Step 7 executes the triage-report skill and writes `phase_review_verdict` and `phase_review_action` to state.json
- [ ] Decision routing table with 4 rows is present after the triage step (between steps 7 and 8)
- [ ] Steps 8–9 cover the planning and state write (with the key sub-steps from the original 6–13 preserved as guidance within step 8)
- [ ] The "Check limits" constraint is preserved (first sub-bullet of step 8: `limits.max_tasks_per_phase`)
- [ ] No other sections of the file are modified (Mode 1, Mode 2, Mode 4, Mode 5, Skills, Output Contract, Quality Standards are unchanged)
- [ ] All tests pass
- [ ] Build succeeds

## Constraints

- ONLY modify the Mode 3 section of `.github/agents/tactical-planner.agent.md`
- Do NOT touch Mode 1, Mode 2, Mode 4, Mode 5, Corrective Task Handoffs sub-section, Skills, Output Contract, or Quality Standards
- Preserve the section heading `## Mode 3: Create Phase Plan` exactly as-is
- Preserve the intro line `When spawned to plan a phase:` exactly as-is
- Do NOT add `triage-report` to the Skills section — that is T3's responsibility
- Do NOT modify any frontmatter in the agent file
- Use `"corrective_tasks_issued"` (plural) for phase-level action — NOT singular
