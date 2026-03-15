---
project: "PIPELINE-FEEDBACK"
phase: 2
task: 1
title: "Update Tactical Planner Mode 2 (Update State)"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Update Tactical Planner Mode 2 (Update State)

## Objective

Add two new write-operation bullets to the Tactical Planner's Mode 2 "Apply the update" list — one for recording `task.review_doc` after a code review completes, and one for recording `phase.phase_review` after a phase review completes.

## Context

The Tactical Planner agent file (`.github/agents/tactical-planner.agent.md`) contains a Mode 2 section titled "Update State." Its step 2 has a bullet list of named write operations the Planner performs when the Orchestrator reports an event. Two new events — "code review complete" and "phase review complete" — must be added to this list so the Planner knows to record the review document paths in `state.json` while leaving verdict/action fields null (triage runs later in Mode 3 and Mode 4).

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/tactical-planner.agent.md` | Mode 2 section only — add two bullets to the "Apply the update" list |

## Implementation Steps

1. Open `.github/agents/tactical-planner.agent.md`.
2. Locate the **Mode 2: Update State** section (starts at the `## Mode 2: Update State` heading).
3. Inside step 2 ("**Apply the update** based on what the Orchestrator tells you:"), find the last existing bullet — it reads:
   ```
   - Tier transition → update `current_tier`
   ```
4. Immediately **after** that bullet, insert the following two new bullets (preserving the same indentation — three leading spaces before the dash):
   ```markdown
   - Code review complete → set `task.review_doc` to the review document path (e.g., `reports/CODE-REVIEW-P{NN}-T{NN}.md`). Leave `task.review_verdict` and `task.review_action` as `null` — triage has not run yet.
   - Phase review complete → set `phase.phase_review` to the phase review document path (e.g., `reports/PHASE-REVIEW-P{NN}.md`). Leave `phase.phase_review_verdict` and `phase.phase_review_action` as `null` — triage has not run yet.
   ```
5. Verify that the resulting bullet list now has **9 items** (the original 7 plus the 2 new ones).
6. Verify that **no other section** of the file has been modified — Mode 1, Mode 3, Mode 4, Mode 5, Skills, Output Contract, and Quality Standards must remain byte-identical.

## Contracts & Interfaces

### Mode 2 Extended Write Contract (inline from Architecture)

The two new operations the Planner performs in Mode 2:

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

### Exact Text to Insert

After the existing bullet `- Tier transition → update \`current_tier\``, insert these two lines (same indentation — 3 spaces before each dash):

```markdown
   - Code review complete → set `task.review_doc` to the review document path (e.g., `reports/CODE-REVIEW-P{NN}-T{NN}.md`). Leave `task.review_verdict` and `task.review_action` as `null` — triage has not run yet.
   - Phase review complete → set `phase.phase_review` to the phase review document path (e.g., `reports/PHASE-REVIEW-P{NN}.md`). Leave `phase.phase_review_verdict` and `phase.phase_review_action` as `null` — triage has not run yet.
```

### Current Bullet List (before)

```markdown
2. **Apply the update** based on what the Orchestrator tells you:
   - Planning step complete → set step status to `"complete"`, record output path
   - Task complete → set task status from task report, record report path
   - Task failed → increment retries, record error and severity
   - Phase complete → set phase status, advance current_phase
   - Pipeline halted → set `current_tier` to `"halted"`, record blockers
   - Human approved → set appropriate `human_approved` flag
   - Tier transition → update `current_tier`
```

### Expected Bullet List (after)

```markdown
2. **Apply the update** based on what the Orchestrator tells you:
   - Planning step complete → set step status to `"complete"`, record output path
   - Task complete → set task status from task report, record report path
   - Task failed → increment retries, record error and severity
   - Phase complete → set phase status, advance current_phase
   - Pipeline halted → set `current_tier` to `"halted"`, record blockers
   - Human approved → set appropriate `human_approved` flag
   - Tier transition → update `current_tier`
   - Code review complete → set `task.review_doc` to the review document path (e.g., `reports/CODE-REVIEW-P{NN}-T{NN}.md`). Leave `task.review_verdict` and `task.review_action` as `null` — triage has not run yet.
   - Phase review complete → set `phase.phase_review` to the phase review document path (e.g., `reports/PHASE-REVIEW-P{NN}.md`). Leave `phase.phase_review_verdict` and `phase.phase_review_action` as `null` — triage has not run yet.
```

## Styles & Design Tokens

N/A — this is an agent instruction file, not a UI task.

## Test Requirements

- [ ] The file `.github/agents/tactical-planner.agent.md` parses correctly as a `.agent.md` file (valid frontmatter, valid Markdown)
- [ ] A text search for `Code review complete` returns exactly one match in the Mode 2 section
- [ ] A text search for `Phase review complete` returns exactly one match in the Mode 2 section
- [ ] A text search for `review_verdict` and `review_action` confirms both appear in the new "Code review complete" bullet with the phrase "as `null`"
- [ ] A text search for `phase_review_verdict` and `phase_review_action` confirms both appear in the new "Phase review complete" bullet with the phrase "as `null`"
- [ ] The Mode 3 section is unchanged (compare before/after)
- [ ] The Mode 4 section is unchanged (compare before/after)
- [ ] The Mode 5 section is unchanged (compare before/after)
- [ ] The Skills section is unchanged (compare before/after)

## Acceptance Criteria

- [ ] Mode 2 "Apply the update" section has "Code review complete" as a named write operation
- [ ] Mode 2 "Apply the update" section has "Phase review complete" as a named write operation
- [ ] The "Code review complete" bullet explicitly states that `task.review_verdict` and `task.review_action` remain `null`
- [ ] The "Phase review complete" bullet explicitly states that `phase.phase_review_verdict` and `phase.phase_review_action` remain `null`
- [ ] No other sections of the file are modified (Mode 1, Mode 3, Mode 4, Mode 5, Skills, Output Contract, Quality Standards remain unchanged)
- [ ] No existing content is removed — all 7 original bullets in the "Apply the update" list are preserved verbatim

## Constraints

- ONLY modify the Mode 2 section — specifically the "Apply the update" bullet list in step 2
- Do NOT touch Mode 1, Mode 3, Mode 4, Mode 5, Skills, Output Contract, or Quality Standards sections
- Do NOT re-order existing bullets — append the two new bullets after the last existing one
- Do NOT modify the frontmatter of the agent file
- All changes are additive — no deletions, no rewrites
