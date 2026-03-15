---
project: "V3-FIXES"
phase: 3
task: 1
title: "orchestrator.agent.md Updates — Additions A–E + Event Row"
status: "pending"
skills: []
estimated_files: 1
---

# orchestrator.agent.md Updates — Additions A–E + Event Row

## Objective

Apply five instruction additions (A–E) and one event table row update to `.github/agents/orchestrator.agent.md`. Each addition is a verbatim insertion at a specified location — no existing text is removed or reworded.

## Context

The file `.github/agents/orchestrator.agent.md` is the Orchestrator agent's behavioral instruction file. It has these relevant sections in order: `### What you do NOT do:` (line 35), `### First Call` (line 65), `### Loop Termination` (line 73), `### Error Handling` (line 77), `## Action Routing Table` (line 108), `## Event Signaling Reference` (line 133). All insertions target specific locations within these existing sections. No new top-level sections are created.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/agents/orchestrator.agent.md` | 6 insertions/edits — no deletions |

## Implementation Steps

1. **Open** `.github/agents/orchestrator.agent.md` for editing.

2. **Addition A** — In the `### What you do NOT do:` section, insert a new bullet **immediately after** the existing bullet `- **Never write, create, or modify any file** — you are read-only`. The new bullet is:
   ```
   - **Never modify pipeline source files as a self-healing action** — this includes `mutations.js`, `pipeline-engine.js`, `pre-reads.js`, `resolver.js`, `state-io.js`, agent `.agent.md` files, and skill files. Self-healing is limited to re-signaling events and editing `state.json`.
   ```

3. **Addition B** — In the same `### What you do NOT do:` section, insert a new bullet **immediately after** Addition A. The new bullet is:
   ```
   - **Never pause the event loop to ask the human "should I continue?"** — after error logging, status reporting, or workaround application, resume the loop immediately. The only valid pause/stop points are: `display_halted`, `display_complete`, `request_plan_approval`, `request_final_approval`, `gate_task`, `gate_phase`.
   ```

4. **Addition E** — In the `## Event Loop` section, insert a new sub-section `### Pipeline Invocation Rule` **immediately after** the `### First Call` sub-section (after the paragraph "The `start` event is always safe...") and **before** `### Loop Termination`. The new sub-section is:
   ```markdown
   ### Pipeline Invocation Rule

   Always invoke `pipeline.js` from the workspace root. Use one of:
   - `cd <workspace-root>; node .github/orchestration/scripts/pipeline.js ...`
   - Absolute path: `node <workspace-root>/.github/orchestration/scripts/pipeline.js ...`
   ```

5. **Addition D** — In the `## Event Loop` section, insert a new sub-section `### Valid Pause and Stop Points` **immediately after** the `### Loop Termination` sub-section (after the sentence "These are terminal actions with no follow-up event.") and **before** `### Error Handling`. The new sub-section is:
   ```markdown
   ### Valid Pause and Stop Points

   Only these `result.action` values should pause execution for human input or stop the loop:

   | Action | Behavior |
   |--------|----------|
   | `display_halted` | Stop — display message, loop terminates |
   | `display_complete` | Stop — display summary, loop terminates |
   | `request_plan_approval` | Pause — wait for human approval |
   | `request_final_approval` | Pause — wait for human approval |
   | `gate_task` | Pause — wait for human approval |
   | `gate_phase` | Pause — wait for human approval |

   All other actions must be executed immediately without asking the human.
   ```

6. **Addition C** — In the `### Error Handling` section, insert a new sub-section `### Self-Healing Hierarchy` **immediately before** the existing paragraph that starts with `**On every \`success: false\` result, follow these 3 steps in order:**` (and after the closing ` ``` ` of the JSON code block). The new sub-section is:
   ```markdown
   ### Self-Healing Hierarchy

   When the pipeline returns `success: false`, attempt recovery in this order before logging/halting:

   1. **Re-signal** the correct event — try the event again with corrected context
   2. **Edit `state.json`** conservatively — only null or clear stale fields; never set a field to a value not derived from a pipeline result
   3. **Log and halt** — if neither re-signaling nor state editing resolves the issue
   ```

7. **Event row update** — In the `## Event Signaling Reference` table, find the row:
   ```
   | `plan_approved` | `{}` | After human approves master plan |
   ```
   Replace it with:
   ```
   | `plan_approved` | `{ "doc_path": "<path>" }` (optional — handler derives from state if absent) | After human approves master plan |
   ```

8. **Verify** no existing text was deleted or reworded. All original bullets, paragraphs, tables, and code blocks remain intact.

## Contracts & Interfaces

Not applicable — this task modifies a markdown instruction file, not source code. No interfaces or contracts apply.

## Styles & Design Tokens

Not applicable — no UI or design tokens involved.

## Test Requirements

- [ ] After all edits, the file remains valid Markdown (no broken tables, unclosed code fences, or orphaned headings)
- [ ] The YAML frontmatter at the top of the file is unchanged and valid
- [ ] Each of the 5 additions appears exactly once in the file at the specified location

## Acceptance Criteria

- [ ] **Addition A** is present as a bullet in `### What you do NOT do:`, immediately after the "Never write, create, or modify any file" bullet
- [ ] **Addition B** is present as a bullet in `### What you do NOT do:`, immediately after Addition A
- [ ] **Addition C** (`### Self-Healing Hierarchy`) is present in the Error Handling section, immediately before the "On every `success: false` result" paragraph
- [ ] **Addition D** (`### Valid Pause and Stop Points`) is present immediately after `### Loop Termination`
- [ ] **Addition E** (`### Pipeline Invocation Rule`) is present immediately after `### First Call`
- [ ] The `plan_approved` row in the Event Signaling Reference table shows `{ "doc_path": "<path>" }` as optional context
- [ ] Each addition is concise (≤5 lines of instruction text, excluding headers and table formatting)
- [ ] No existing instruction text has been removed or broken
- [ ] No contradictions exist between the new additions and existing rules
- [ ] Only `.github/agents/orchestrator.agent.md` is modified — no other files touched
- [ ] Build succeeds (no build step — file is markdown; criterion is auto-pass)

## Constraints

- Do NOT remove or reword any existing text in the file
- Do NOT modify any file other than `.github/agents/orchestrator.agent.md`
- Do NOT change the YAML frontmatter
- Do NOT change the Action Routing Table (rows 1–18) other than reading it for context
- Do NOT add content beyond the 5 specified additions and the 1 event row update
- Do NOT create new top-level `##` sections — Additions C, D, and E are `###` sub-sections within existing `##` sections
