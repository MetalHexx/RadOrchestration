---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 4
task: 6
title: "Update README.md + Final Reference Sweep"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 1
---

# Update README.md + Final Reference Sweep

## Objective

Update the top-level `README.md` to replace all references to the old 3-script architecture (Next-Action Resolver, Triage Executor, State Validator) and Tactical Planner state authority with the unified `pipeline.js` architecture. Then perform a final grep sweep across `README.md` and all `docs/*.md` files to confirm zero remaining stale references to deleted scripts, removed documents, or renamed skills.

## Context

The orchestration system replaced three standalone CLI scripts (`next-action.js`, `triage.js`, `validate-state.js`) with a single unified pipeline script (`pipeline.js`). The pipeline script internalizes all state mutations, validation, triage, and next-action resolution into one deterministic call per cycle. The Tactical Planner no longer writes `state.json` — only the pipeline script does. All seven `docs/*.md` files have already been updated in Tasks T1–T5 of this phase. `README.md` is the last file with stale references.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `README.md` | Update 4 stale sections referencing old scripts/architecture |

## Implementation Steps

1. **Line ~5** — Update the introductory sentence from:
   > "Routing, triage, and state validation are handled by pure JavaScript functions."
   
   to:
   > "Routing, triage, and state validation are handled by a unified pipeline script (`pipeline.js`) — a single deterministic CLI call per cycle. No external services, no Docker, no npm install."

2. **Line ~64** — In the "Specialized Agents" feature section, replace:
   > "Only the Tactical Planner touches state."
   
   with:
   > "Only the pipeline script (`pipeline.js`) touches state."

3. **Lines ~80–84** — Replace the entire "Deterministic Routing & Triage" subsection body from:
   > "Pipeline routing and triage decisions are handled by Node.js CLI scripts — not LLM interpretation of prose. The Next-Action Resolver encodes ~30 routing paths as a pure function. The Triage Executor evaluates decision tables for task and phase reviews. The State Validator checks 15 invariants before every state write. Same input always produces the same output."
   
   with:
   > "Pipeline routing, triage, and state validation are handled by a unified pipeline script (`pipeline.js`) — not LLM interpretation of prose. One event in, one deterministic action out. The script encodes ~18 external actions as a pure event-action lookup, internalizes triage decisions, and validates state invariants before every write. Same input always produces the same output."

4. **Line ~136** — In the Documentation table, replace the "Deterministic Scripts" row from:
   > `| [Deterministic Scripts](docs/scripts.md) | Next-Action Resolver, Triage Executor, State Validator CLIs |`
   
   with:
   > `| [Pipeline Script](docs/scripts.md) | Unified event-driven CLI — routing, triage, state mutations, validation |`

5. **Verify the Mermaid diagram** (lines ~12–35) does NOT reference Next-Action Resolver, Triage Executor, State Validator, STATUS.md, or deleted scripts. (It should be clean — the diagram uses generic pipeline steps. Confirm and move on.)

6. **Final sweep** — Run grep across `README.md` and all `docs/*.md` for each of these stale terms:
   - `STATUS.md`
   - `next-action.js`
   - `triage.js` (as a script filename, not the word "triage" by itself)
   - `validate-state.js`
   - `state-json-schema`
   - `state-management.instructions`
   - `triage-report` (as a skill name)
   - `review-code` (as a skill name — not the phrase "review code")
   - `Next-Action Resolver`
   - `Triage Executor`
   - `State Validator` (as a proper noun referencing the old script)

7. **If any stale references are found in the sweep**, fix them in place using the same patterns established by T1–T5 (replace with `pipeline.js` / pipeline script equivalents). If a match is a false positive (e.g., "review code" as a verb phrase, not a skill name), leave it.

8. **Verify cross-links** — Confirm that `[scripts.md]` links in `README.md` and across `docs/` still resolve correctly (the file exists and the link target path is valid). Confirm `[Pipeline Script](docs/scripts.md)` resolves.

## Contracts & Interfaces

Not applicable — this is a documentation-only task with no code interfaces.

## Styles & Design Tokens

Not applicable — no UI components.

## Test Requirements

- [ ] Grep `README.md` for each stale term in step 6 — zero matches
- [ ] Grep all `docs/*.md` for each stale term in step 6 — zero matches
- [ ] All markdown links in `README.md` resolve to existing files (no broken `docs/*.md` links)
- [ ] The Mermaid diagram in `README.md` renders without referencing deleted concepts

## Acceptance Criteria

- [ ] `README.md` line ~5 references the unified pipeline script, not "pure JavaScript functions" in the generic sense
- [ ] `README.md` states "Only the pipeline script (`pipeline.js`) touches state" — not Tactical Planner
- [ ] `README.md` "Deterministic Routing & Triage" section describes `pipeline.js` with ~18 actions — no mention of Next-Action Resolver, Triage Executor, or State Validator
- [ ] `README.md` documentation table row reads "Pipeline Script" with updated description — not "Deterministic Scripts" with old CLI names
- [ ] Final grep sweep across `README.md` and all `docs/*.md` returns zero matches for: `STATUS.md`, `next-action.js`, `triage.js`, `validate-state.js`, `state-json-schema`, `state-management.instructions`, `triage-report` (skill), `review-code` (skill), `Next-Action Resolver`, `Triage Executor`, `State Validator` (proper noun)
- [ ] No broken cross-links in `README.md` — all `docs/*.md` link targets exist
- [ ] Mermaid diagram is unchanged (it was already clean) or corrected if stale terms were present

## Constraints

- Do NOT rewrite sections of `README.md` that are not stale — keep changes minimal and targeted
- Do NOT modify any `docs/*.md` files unless the final sweep finds a stale reference that T1–T5 missed
- Do NOT modify `state.json` — the pipeline script handles all state mutations
- Do NOT change the Mermaid diagram unless it contains stale references (it should be clean)
- Do NOT rename or move any files
- Preserve the existing tone, structure, and formatting of `README.md`
