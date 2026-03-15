---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 4
task: 4
title: "Update getting-started.md"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Update getting-started.md

## Objective

Update `docs/getting-started.md` to replace all references to deleted standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`), removed artifacts (`STATUS.md`), and the old Tactical-Planner-as-state-authority model with accurate descriptions of the unified `pipeline.js` event-driven system.

## Context

The orchestration system has been refactored so that a single pipeline script (`pipeline.js`) is the sole state-mutation authority. It replaced three standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`). `STATUS.md` has been removed — the Orchestrator now reads `state.json` directly (or calls `pipeline.js --event start`) to determine project status. The current `docs/getting-started.md` still contains references to the "Next-Action Resolver" and `STATUS.md`, both of which no longer exist.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/getting-started.md` | Replace stale references; update workflow descriptions to reflect pipeline.js |

## Implementation Steps

1. **Line ~77 — "Continuing a Project" section**: Replace the sentence `The deterministic [Next-Action Resolver](scripts.md) ensures consistent routing regardless of how many times you resume.` with a sentence explaining that the pipeline script (`pipeline.js`) provides deterministic event-driven routing via its 19-event vocabulary and ~18-action output set, ensuring consistent behavior on every resume.

2. **Line ~83-85 — "Checking Status" section**: Replace the entire paragraph that reads:
   ```
   The Orchestrator reads `STATUS.md` — a human-readable summary that's updated after every significant event (task completion, phase advance, error, halt).
   ```
   with a paragraph explaining that the Orchestrator reads `state.json` directly to determine project status, or calls `pipeline.js --event start` to get the current state and recommended next action. Remove all mentions of `STATUS.md`.

3. **Verify the "What Happens Next" section (lines ~55-69)**: Confirm that the numbered pipeline sequence does NOT reference deleted scripts or the Tactical Planner writing state. The current content appears correct (agents are listed by role, not by state-writing authority), but verify no stale language exists.

4. **Verify the "Key Commands" table (lines ~93-101)**: Confirm the table does not reference `STATUS.md`, `next-action.js`, `triage.js`, or `validate-state.js`. The current table appears clean, but verify.

5. **Verify the "Running Validation" section (lines ~87-91)**: Confirm it references the `validate-orchestration.js` script (which still exists) and does NOT reference `validate-state.js`. The current content appears correct.

6. **Verify the "Next Steps" links section (lines ~103-107)**: Confirm all cross-doc links still resolve. `[Pipeline](pipeline.md)` and `[Scripts](scripts.md)` — these files have been rewritten in T01/T02 but their filenames are unchanged, so links should work. No action required unless broken.

7. **Final pass**: Grep the entire file for: `STATUS.md`, `next-action`, `triage.js`, `validate-state`, `state-json-schema`, `state-management.instructions`, `triage-report`, `review-code` (as a skill name). Confirm zero matches.

## Contracts & Interfaces

**Pipeline CLI invocation** (the canonical usage the Orchestrator calls):

```
node .github/orchestration/scripts/pipeline.js \
  --event <event-name> \
  --project-dir <path-to-project> \
  [--config <path-to-orchestration.yml>] \
  [--context '<json-string>']
```

**19 event vocabulary** (the full set of events `pipeline.js` accepts):

| Event | Description |
|-------|-------------|
| `start` | Initialize new project or resume existing |
| `research_completed` | Research phase done |
| `prd_completed` | PRD created |
| `design_completed` | Design doc created |
| `architecture_completed` | Architecture doc created |
| `master_plan_completed` | Master plan created |
| `plan_approved` | Human approves master plan |
| `plan_rejected` | Human rejects master plan |
| `phase_plan_created` | Phase plan written |
| `task_handoff_created` | Task handoff written |
| `task_completed` | Coder finished task |
| `code_review_completed` | Reviewer finished code review |
| `phase_report_created` | Phase report written |
| `phase_review_completed` | Reviewer finished phase review |
| `gate_approved` | Human approves gate |
| `gate_rejected` | Human rejects gate |
| `final_review_completed` | Final review done |
| `final_approved` | Human approves final |
| `final_rejected` | Human rejects final |

**Pipeline result shape** (what `pipeline.js` outputs on stdout):

```json
{
  "success": true,
  "action": "<next-action-string>",
  "context": { "...": "..." },
  "mutations_applied": ["<mutation-name>"],
  "triage_ran": false,
  "validation_passed": true
}
```

## Styles & Design Tokens

Not applicable — documentation-only task.

## Test Requirements

- [ ] `docs/getting-started.md` contains zero occurrences of `STATUS.md`
- [ ] `docs/getting-started.md` contains zero occurrences of `Next-Action Resolver` or `next-action.js`
- [ ] `docs/getting-started.md` contains zero occurrences of `triage.js` or `validate-state.js`
- [ ] `docs/getting-started.md` contains zero occurrences of `state-json-schema` or `state-management.instructions`
- [ ] `docs/getting-started.md` contains zero occurrences of `triage-report` or `review-code` (as a skill name)
- [ ] All markdown links in the file resolve to valid targets (no broken cross-references)

## Acceptance Criteria

- [ ] "Continuing a Project" section references `pipeline.js` event-driven routing instead of "Next-Action Resolver"
- [ ] "Checking Status" section explains reading `state.json` directly (or calling `pipeline.js --event start`) — no `STATUS.md` mention
- [ ] No reference to any deleted script (`next-action.js`, `triage.js`, `validate-state.js`) exists anywhere in the file
- [ ] No reference to `STATUS.md` exists anywhere in the file
- [ ] All existing correct content (Prerequisites, Installation, Your First Project, Running Validation, Key Commands, Next Steps) is preserved and accurate
- [ ] File is valid Markdown with no syntax errors

## Constraints

- Do NOT rewrite sections that are already accurate — only change lines with stale references
- Do NOT add new sections or significantly expand the document's scope
- Do NOT reference planning documents (PRD, Architecture, Design, Master Plan) in the output
- Do NOT modify any other file — this task targets `docs/getting-started.md` only
- Do NOT update `state.json`
