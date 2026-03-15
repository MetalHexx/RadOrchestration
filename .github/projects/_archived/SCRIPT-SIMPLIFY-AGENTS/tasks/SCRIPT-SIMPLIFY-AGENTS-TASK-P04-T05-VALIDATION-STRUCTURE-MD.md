---
project: "SCRIPT-SIMPLIFY-AGENTS"
phase: 4
task: 5
title: "Update validation.md & project-structure.md"
status: "pending"
skills_required: []
skills_optional: []
estimated_files: 2
---

# Update validation.md & project-structure.md

## Objective

Update `docs/validation.md` and `docs/project-structure.md` to accurately reflect the post-refactor architecture: the unified pipeline script (`pipeline.js`) as the sole state-mutation authority, the embedded 15-invariant validation in `state-validator.js` (called by `pipeline-engine.js`), the current file tree (no standalone scripts, no `schemas/` directory, no `STATUS.md`), and the pipeline script as sole writer of `state.json`.

## Context

The orchestration system was refactored from 3 standalone scripts (`next-action.js`, `triage.js`, `validate-state.js`) into a unified `pipeline.js` CLI backed by a 4-layer module architecture. The old `schemas/` directory and `state-json-schema.md` were deleted. State validation now runs embedded inside `pipeline-engine.js` (calling `state-validator.js`) on every event — there is no separate CLI validator. The pipeline script (`pipeline.js`) is the sole writer of `state.json`; the Tactical Planner no longer touches state. The `state-management.instructions.md` file was deleted; only `project-docs.instructions.md` remains in `.github/instructions/`.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `docs/validation.md` | Replace stale `validate-state.js` CLI section; document embedded validation and 15 invariants |
| MODIFY | `docs/project-structure.md` | Update workspace layout tree, project folder structure, state files table, scoped instructions, state management section |

## Implementation Steps

### `docs/validation.md`

1. **Replace "State Validation" section** (currently lines ~136–148). Remove the `validate-state.js` CLI example and the text "use the separate State Transition Validator". Replace with a section titled **"State Transition Validation"** that explains:
   - Validation runs automatically inside `pipeline-engine.js` on every event — no separate CLI needed
   - The engine calls `validateTransition(currentState, proposedState)` from `state-validator.js` before writing state
   - For triage-triggering events, validation runs twice: once after mutation, once after triage
   - If any invariant fails, the pipeline returns an error result and does **not** write `state.json`

2. **Add "Invariant Catalog (V1–V15)" subsection** inside the new State Transition Validation section. Document each invariant in a table:

   | ID | Name | Check Type | Description |
   |----|------|-----------|-------------|
   | V1 | Phase index bounds | Proposed-only | `current_phase` must be a valid index into `execution.phases[]` (0 when empty) |
   | V2 | Task index bounds | Proposed-only | Each phase's `current_task` must be a valid index into its `tasks[]` (0 when empty, may equal length when all complete) |
   | V3 | Retry limit | Proposed-only | No task's `retries` may exceed `limits.max_retries_per_task` |
   | V4 | Max phases | Proposed-only | `phases.length` must not exceed `limits.max_phases` |
   | V5 | Max tasks per phase | Proposed-only | Each phase's `tasks.length` must not exceed `limits.max_tasks_per_phase` |
   | V6 | Single active task | Proposed-only | At most one task across the entire project may have status `in_progress` |
   | V7 | Human approval gate | Proposed-only | `current_tier` cannot be `execution` unless `planning.human_approved` is `true` |
   | V8 | Task triage consistency | Proposed-only | A task with `review_doc` set must also have `review_verdict` set (triage must have run) |
   | V9 | Phase triage consistency | Proposed-only | A phase with `phase_review` set must also have `phase_review_verdict` set |
   | V10 | Structural validation | Proposed-only | Required top-level keys (`execution`, `pipeline`, `planning`, `limits`) must exist and not be null |
   | V11 | Retry monotonicity | Current→Proposed | Task `retries` count must never decrease between transitions |
   | V12 | Task status transitions | Current→Proposed | Tasks must follow valid status transitions: `not_started→in_progress→complete\|failed\|halted`, `failed→in_progress` |
   | V13 | Timestamp monotonicity | Current→Proposed | `project.updated` must strictly increase on every write |
   | V14 | Write ordering | Current→Proposed | `review_doc` and `review_verdict`/`review_action` must not change in the same write operation |
   | V15 | Cross-task immutability | Current→Proposed | At most one task's verdict/action fields may change per write |

3. **Update the "See Deterministic Scripts" link** at the end of the old State Validation section. Replace `[Deterministic Scripts](scripts.md)` with `[Pipeline Script](scripts.md)` (the rewritten scripts.md already documents the pipeline).

4. **Verify the rest of the file** — the ecosystem validation sections (Quick Start, CLI Options, What It Checks) document `validate-orchestration.js` which is **unchanged** and should be left as-is.

### `docs/project-structure.md`

5. **Update "Workspace Layout" tree** — replace the `.github/orchestration/` subtree. The current tree shows `next-action.js`, `triage.js`, `validate-state.js`, `schemas/`, and `state-json-schema.md`. Replace with:

   ```
   .github/
   ├── agents/                    # 9 agent definitions
   │   └── ...
   ├── skills/                    # 15 skill bundles
   │   └── ...
   ├── instructions/              # Scoped instruction files
   │   └── ...
   ├── prompts/                   # Utility prompt files
   │   └── ...
   ├── orchestration/             # Runtime scripts and tests
   │   └── scripts/
   │       ├── pipeline.js        # Unified pipeline CLI (sole state writer)
   │       ├── lib/
   │       │   ├── constants.js
   │       │   ├── mutations.js
   │       │   ├── pipeline-engine.js
   │       │   ├── resolver.js
   │       │   ├── state-io.js
   │       │   ├── state-validator.js
   │       │   └── triage-engine.js
   │       └── tests/             # All test files (19 total)
   │           └── ...
   ├── orchestration.yml          # System configuration
   ├── copilot-instructions.md    # Workspace-level instructions
   └── projects/                  # Project artifacts
       └── {PROJECT-NAME}/
           └── ...
   ```

   Key differences from current:
   - Remove `next-action.js`, `triage.js`, `validate-state.js` (3 lines)
   - Add `pipeline.js` with comment "Unified pipeline CLI (sole state writer)"
   - Replace `lib/` contents: remove `resolver.js` → keep `resolver.js`; remove `state-validator.js` → keep `state-validator.js`; remove `triage-engine.js` → keep `triage-engine.js`; **add** `mutations.js`, `pipeline-engine.js`, `state-io.js`
   - Remove `schemas/` directory and `state-json-schema.md` entirely
   - Change skills count from 17 to 15
   - Change `# Runtime scripts, tests, and schemas` comment to `# Runtime scripts and tests`
   - Change test count from 18 to 19

6. **Update "Project Folder Structure" tree** — remove `STATUS.md` entry and change `state.json` comment from `(sole writer: Tactical Planner)` to `(sole writer: pipeline script)`:

   ```
   {PROJECT-NAME}/
   ├── state.json                 # Pipeline state (sole writer: pipeline script)
   ├── BRAINSTORMING.md           # Optional ideation output
   ```

   Remove the `├── STATUS.md                  # Human-readable progress summary` line entirely.

7. **Update "State Files" table** — remove the `STATUS.md` row and change the `state.json` sole writer:

   | File | Sole Writer | Purpose |
   |------|-------------|---------|
   | `state.json` | Pipeline Script (`pipeline.js`) | Machine-readable pipeline state |

   Delete the `STATUS.md | Tactical Planner | Human-readable progress summary` row.

8. **Update "Scoped Instructions" table** — remove the `state-management.instructions.md` row. The table should only contain:

   | File | Applies To | Rules |
   |------|-----------|-------|
   | `project-docs.instructions.md` | `.github/projects/**` | Naming conventions, file ownership (sole writer policy), document quality standards |

9. **Update "System Files" table** — if `state-management.instructions.md` appears as an example in the Instructions row, remove it.

10. **Update "State Management" section** — replace "Only the Tactical Planner writes `state.json`" with "Only the pipeline script (`pipeline.js`) writes `state.json`". Replace the reference to the "[State Transition Validator](scripts.md)" with "the pipeline engine (`pipeline-engine.js`) runs all 15 invariant checks (V1–V15) on every state transition — see [Validation](validation.md) for the full invariant catalog". Remove all references to `STATUS.md`. Remove references to `validate-state.js`.

## Contracts & Interfaces

### `validateTransition()` Signature (from `state-validator.js`)

```javascript
/**
 * @param {Object} current  - The current (committed) state.json object
 * @param {Object} proposed - The proposed (uncommitted) state.json object
 * @returns {{ valid: boolean, invariants_checked: 15, errors?: InvariantError[] }}
 */
function validateTransition(current, proposed) { ... }
```

### `InvariantError` Shape

```javascript
/**
 * @typedef {Object} InvariantError
 * @property {string} invariant  - "V1" through "V15"
 * @property {string} message    - Human-readable description
 * @property {'critical'} severity - Always "critical"
 */
```

### Valid Task Status Transitions (enforced by V12)

```
not_started → in_progress
in_progress → complete | failed | halted
failed      → in_progress  (retry path)
complete    → (terminal)
halted      → (terminal)
```

## Styles & Design Tokens

Not applicable — documentation-only task.

## Test Requirements

- [ ] `docs/validation.md` contains no references to `validate-state.js` CLI
- [ ] `docs/validation.md` contains an invariant catalog table with all 15 entries (V1–V15)
- [ ] `docs/validation.md` explains that validation runs inside `pipeline-engine.js` automatically
- [ ] `docs/project-structure.md` workspace layout tree lists `pipeline.js` (not `next-action.js`, `triage.js`, `validate-state.js`)
- [ ] `docs/project-structure.md` workspace layout tree includes `mutations.js`, `pipeline-engine.js`, `state-io.js` in `lib/`
- [ ] `docs/project-structure.md` does not contain `schemas/` directory or `state-json-schema.md`
- [ ] `docs/project-structure.md` does not contain `STATUS.md`
- [ ] `docs/project-structure.md` state files table lists sole writer as "Pipeline Script (`pipeline.js`)"
- [ ] `docs/project-structure.md` scoped instructions table does not contain `state-management.instructions.md`
- [ ] `docs/project-structure.md` state management section says "pipeline script" (not "Tactical Planner") writes `state.json`

## Acceptance Criteria

- [ ] `docs/validation.md` contains zero occurrences of `validate-state.js`
- [ ] `docs/validation.md` contains a complete V1–V15 invariant catalog table with 15 rows
- [ ] `docs/validation.md` documents the dual-validation pass for triage events
- [ ] `docs/project-structure.md` workspace layout tree shows `pipeline.js` under `.github/orchestration/scripts/`
- [ ] `docs/project-structure.md` workspace layout tree shows `mutations.js`, `pipeline-engine.js`, `state-io.js` under `lib/`
- [ ] `docs/project-structure.md` contains zero occurrences of `next-action.js`, `triage.js`, `validate-state.js`
- [ ] `docs/project-structure.md` contains zero occurrences of `STATUS.md`
- [ ] `docs/project-structure.md` contains zero occurrences of `schemas/` directory reference
- [ ] `docs/project-structure.md` contains zero occurrences of `state-management.instructions.md`
- [ ] `docs/project-structure.md` state.json sole writer is "Pipeline Script" (not "Tactical Planner")
- [ ] No lint errors in either file
- [ ] Both files are valid Markdown

## Constraints

- Do NOT modify any files other than `docs/validation.md` and `docs/project-structure.md`
- Do NOT change the ecosystem validation sections in `docs/validation.md` (Quick Start, CLI Options, What It Checks, Output Format, CI Integration, When to Run) — those document `validate-orchestration.js` which is unchanged
- Do NOT rewrite sections that are already accurate — only update stale content
- Do NOT reference planning documents (PRD, Architecture, Design, Master Plan) in the output
- Do NOT modify `state.json`
- Do NOT add or remove any heading levels that would break existing cross-document anchor links to `validation.md` or `project-structure.md` (keep `## State Validation` → rename to `## State Transition Validation` is acceptable since no other doc links to that specific anchor)
- The skill count in the workspace layout comment should be 15 (2 skills were deleted: `review-code` renamed to `review-task`, `triage-report` deleted)
- The test count should be 19 (verify against actual: 19 `.test.js` files exist in `tests/`)
