---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 2
task: 7
title: "Instruction & Configuration File Updates"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 4
---

# Instruction & Configuration File Updates

## Objective

Update `copilot-instructions.md`, `project-docs.instructions.md`, `state-management.instructions.md`, and `orchestration.yml` to reflect the pipeline-driven architecture — replacing the Tactical Planner as sole state writer with the pipeline script, removing all `STATUS.md` references, and removing/updating any references to the deleted standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`).

## Context

The orchestration system has been refactored from 3 standalone scripts + agent-driven state writes to a single event-driven pipeline script (`pipeline.js`). No agent directly writes `state.json` — all state mutations flow through the pipeline script. `STATUS.md` is no longer generated; the dashboard reads `state.json` directly. The Tactical Planner is now a pure planning agent with 3 modes (Phase Plan, Task Handoff, Phase Report). The `state-management.instructions.md` file is scheduled for deletion in Phase 3, but must be updated now so it does not actively mislead agents that load it.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/copilot-instructions.md` | Update Orchestration System overview, agent table, key rules, project files |
| MODIFY | `.github/instructions/project-docs.instructions.md` | Update sole-writer table, remove STATUS.md row |
| MODIFY | `.github/instructions/state-management.instructions.md` | Rewrite to reflect pipeline.js as sole state writer, remove validate-state.js CLI instructions |
| MODIFY | `.github/orchestration.yml` | Verify no references to old scripts exist; no changes expected (config has none) |

## Implementation Steps

1. **Open `.github/copilot-instructions.md`** and make the following changes:

   a. In the **"How It Works"** section, change the "Check status" bullet from:
   ```
   - **Check status**: Use `@Orchestrator` and ask for project status. It reads `STATUS.md` for a human-readable summary.
   ```
   to:
   ```
   - **Check status**: Use `@Orchestrator` and ask for project status. It reads `state.json` to determine the current status.
   ```

   b. In the **Agents table**, change the Tactical Planner row from:
   ```
   | `@Tactical Planner` | Breaks phases into tasks, manages state — **sole writer of state.json and STATUS.md** |
   ```
   to:
   ```
   | `@Tactical Planner` | Breaks phases into tasks, creates task handoffs, generates phase reports |
   ```

   c. In **Key Rules**, change rule #3 from:
   ```
   3. **Only the Tactical Planner writes `state.json` and `STATUS.md`** — no other agent touches these.
   ```
   to:
   ```
   3. **No agent directly writes `state.json`** — all state mutations flow through the pipeline script (`pipeline.js`).
   ```

   d. In **Project Files → Contents**, change:
   ```
   - State: `state.json`, `STATUS.md`
   ```
   to:
   ```
   - State: `state.json`
   ```

2. **Open `.github/instructions/project-docs.instructions.md`** and make the following changes:

   a. In the **File Ownership (Sole Writer Policy)** table, change the `state.json` row from:
   ```
   | `state.json` | Tactical Planner |
   ```
   to:
   ```
   | `state.json` | Pipeline Script (`pipeline.js`) |
   ```

   b. **Remove** the entire `STATUS.md` row from the ownership table:
   ```
   | `STATUS.md` | Tactical Planner |
   ```
   Delete this row entirely.

3. **Open `.github/instructions/state-management.instructions.md`** and make the following changes:

   a. Change the **"Sole Writer" heading and content** from:
   ```
   ## Sole Writer: Tactical Planner

   Only the Tactical Planner agent may create, read-modify-write, or update these files. All other agents are read-only (or have no access at all).
   ```
   to:
   ```
   ## Sole Writer: Pipeline Script

   Only the pipeline script (`pipeline.js`) may create or update `state.json`. All agents are read-only. No agent directly writes state — all state mutations flow through the pipeline script.
   ```

   b. Change the `applyTo` frontmatter from:
   ```yaml
   applyTo: '**/state.json,**/*STATUS.md'
   ```
   to:
   ```yaml
   applyTo: '**/state.json'
   ```

   c. **Remove the entire `## STATUS.md Rules` section** (the heading and all its bullet points):
   ```
   ## STATUS.md Rules

   - Keep it human-readable — this is what the user checks for progress
   - Update after every significant event (task complete, phase advance, error, halt)
   - Include: current tier, current phase/task, completion percentages, active blockers
   ```
   Delete this entire section.

   d. **Replace the entire `## Pre-Write Validation` section** (heading through end of file) — remove all references to `validate-state.js` CLI, the CLI interface table, the output format examples, the required workflow steps, and the failure behavior section. Replace with:
   ```
   ## Pre-Write Validation

   Validation is handled internally by the pipeline script. The pipeline engine calls `state-validator.validateTransition(current, proposed)` after every mutation and after every triage mutation. On validation failure, the state is NOT written — the previous valid state is preserved.

   No agent needs to invoke validation manually. The pipeline script is the sole executor of validation.
   ```

4. **Open `.github/orchestration.yml`** and verify there are no references to `next-action.js`, `triage.js`, or `validate-state.js`. The current file contains only configuration keys (projects, limits, errors, git, human_gates) with no script references — **no changes are needed** unless stale references are found.

5. **Verify all changes** by scanning the four modified files:
   - Grep for `STATUS.md` — should appear in zero of the four files
   - Grep for `validate-state.js` — should appear in zero of the four files
   - Grep for `next-action.js` — should appear in zero of the four files
   - Grep for `triage.js` — should appear in zero of the four files
   - Grep for `sole writer of state.json` (case-insensitive) — should appear in zero of the four files
   - Grep for `Tactical Planner` in `state-management.instructions.md` — should appear zero times

## Contracts & Interfaces

No code contracts apply — all changes are to Markdown instruction files and a YAML configuration file.

### Expected Final State of Key Sections

**`copilot-instructions.md` — Agents Table (after edit):**
```markdown
| Agent | Purpose |
|-------|---------|
| `@Brainstormer` | Collaboratively brainstorms and refines project ideas — standalone, outside the pipeline |
| `@Orchestrator` | Coordinates the pipeline — spawns agents, reads state, asks human questions. **Never writes files.** |
| `@Research` | Explores codebase and external sources to gather context |
| `@Product Manager` | Creates PRDs from research findings |
| `@UX Designer` | Creates design documents from PRDs |
| `@Architect` | Creates architecture docs and master plans |
| `@Tactical Planner` | Breaks phases into tasks, creates task handoffs, generates phase reports |
| `@Coder` | Executes coding tasks from self-contained task handoffs |
| `@Reviewer` | Reviews code and phases against planning documents |
```

**`copilot-instructions.md` — Key Rules (after edit):**
```markdown
1. **Start with `@Brainstormer` (optional) or `@Orchestrator`** — brainstorm ideas first, or go directly to the Orchestrator if you have a clear idea.
2. **The Coder reads ONLY its Task Handoff** — everything it needs is self-contained in that one document.
3. **No agent directly writes `state.json`** — all state mutations flow through the pipeline script (`pipeline.js`).
4. **Human gates** are enforced after planning (Master Plan review) and after final review.
5. **Documents are the interface** — agents communicate through structured markdown files, never through shared state or memory.
```

**`project-docs.instructions.md` — Ownership Table (after edit):**
```markdown
| Document | Sole Writer |
|----------|-------------|
| `state.json` | Pipeline Script (`pipeline.js`) |
| `BRAINSTORMING.md` | Brainstormer |
| `RESEARCH-FINDINGS.md` | Research Agent |
| `PRD.md` | Product Manager |
| `DESIGN.md` | UX Designer |
| `ARCHITECTURE.md` | Architect |
| `MASTER-PLAN.md` | Architect |
| `PHASE-PLAN.md` | Tactical Planner |
| `TASK-HANDOFF.md` | Tactical Planner |
| `TASK-REPORT.md` | Coder |
| `CODE-REVIEW.md` | Reviewer |
| `PHASE-REPORT.md` | Tactical Planner |
| `PHASE-REVIEW.md` | Reviewer |
```

**`state-management.instructions.md` — Full Expected Content (after edit):**
```markdown
---
applyTo: '**/state.json'
---

# State Management Rules

When working with `state.json`:

## Sole Writer: Pipeline Script

Only the pipeline script (`pipeline.js`) may create or update `state.json`. All agents are read-only. No agent directly writes state — all state mutations flow through the pipeline script.

## state.json Invariants

- **Never decrease retry counts** — they only go up
- **Never skip states** — tasks progress: `not_started` → `in_progress` → `complete` | `failed`
- **Only one task `in_progress` at a time** across the entire project
- **`planning.human_approved` must be `true`** before `current_tier` can transition to `"execution"`
- **Always update `project.updated`** timestamp on every write
- **Validate limits before advancing**: `phases.length <= limits.max_phases`, `phase.tasks.length <= limits.max_tasks_per_phase`, `task.retries <= limits.max_retries_per_task`

## Pipeline Tiers

The pipeline has these tiers in order: `planning` → `execution` → `review` → `complete`

A pipeline can also be `halted` from any tier when a critical error occurs.

## Error Severity

Configured in `orchestration.yml`:
- **Critical** (pipeline halts): `build_failure`, `security_vulnerability`, `architectural_violation`, `data_loss_risk`
- **Minor** (auto-retry): `test_failure`, `lint_error`, `review_suggestion`, `missing_test_coverage`, `style_violation`

## Pre-Write Validation

Validation is handled internally by the pipeline script. The pipeline engine calls `state-validator.validateTransition(current, proposed)` after every mutation and after every triage mutation. On validation failure, the state is NOT written — the previous valid state is preserved.

No agent needs to invoke validation manually. The pipeline script is the sole executor of validation.
```

## Styles & Design Tokens

Not applicable — no UI changes.

## Test Requirements

- [ ] Run the full validation test suite (`node --test .github/orchestration/scripts/tests/*.test.js`) — all 321 tests must still pass (these files are Markdown/YAML, not code, so no regressions expected)
- [ ] Grep all four target files for `STATUS.md` — zero matches
- [ ] Grep all four target files for `validate-state.js` — zero matches
- [ ] Grep all four target files for `next-action.js` — zero matches
- [ ] Grep all four target files for `triage.js` — zero matches (note: `triage-engine.js` references in `state-management.instructions.md` are acceptable if present, but the old standalone `triage.js` script should not be referenced)
- [ ] Grep `state-management.instructions.md` for `Tactical Planner` — zero matches

## Acceptance Criteria

- [ ] `copilot-instructions.md` "Check status" bullet references `state.json` instead of `STATUS.md`
- [ ] `copilot-instructions.md` Agents table describes Tactical Planner as "Breaks phases into tasks, creates task handoffs, generates phase reports" (no "sole writer" language)
- [ ] `copilot-instructions.md` Key Rule #3 reads: "No agent directly writes `state.json` — all state mutations flow through the pipeline script (`pipeline.js`)."
- [ ] `copilot-instructions.md` Project Files section lists `State: state.json` (no `STATUS.md`)
- [ ] `project-docs.instructions.md` ownership table shows `state.json` → `Pipeline Script ('pipeline.js')`
- [ ] `project-docs.instructions.md` ownership table has no `STATUS.md` row
- [ ] `state-management.instructions.md` frontmatter `applyTo` no longer includes `STATUS.md` pattern
- [ ] `state-management.instructions.md` sole writer is "Pipeline Script" (not "Tactical Planner")
- [ ] `state-management.instructions.md` has no `STATUS.md Rules` section
- [ ] `state-management.instructions.md` Pre-Write Validation section references pipeline script internals (not `validate-state.js` CLI)
- [ ] `orchestration.yml` has no references to `next-action.js`, `triage.js`, or `validate-state.js`
- [ ] Zero occurrences of `STATUS.md` across all four files
- [ ] Zero occurrences of `validate-state.js` across all four files
- [ ] All 321 existing tests pass
- [ ] No lint errors in modified files

## Constraints

- Do NOT modify any agent definition files (`.github/agents/*.agent.md`) — those were updated in T02–T05
- Do NOT modify any skill files (`.github/skills/`) — those were updated in T04 and T06
- Do NOT modify `state.json` — the pipeline script is the sole writer
- Do NOT delete `state-management.instructions.md` — that deletion is scheduled for Phase 3 (Cleanup & Deletion); this task only updates its content
- Do NOT add new configuration keys to `orchestration.yml` — only verify/clean existing keys
- Do NOT modify any JavaScript files (`.github/orchestration/scripts/`) — those were handled in Phase 1 and T01
- Preserve all content in the target files that is not specifically called out for change — do not rewrite entire files unnecessarily
