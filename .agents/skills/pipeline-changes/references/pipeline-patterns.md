# Pipeline Patterns

How to change pipeline engine code safely. Each pattern lists the files you'll touch and the gotcha that will bite you if you miss it.

## Change Decision Table

| What You're Changing | Files to Touch | Key Gotcha |
|---------------------|----------------|------------|
| **New event** | `mutations.js` (handler + MUTATIONS map), `constants.js` (if new enum value), `pre-reads.js` (if event needs doc validation) | Pre-reads are opt-in — most events don't have handlers. Check `PRE_READ_HANDLERS` for the current list. If your event reads a document, add one explicitly. |
| **New action** | `constants.js` (NEXT_ACTIONS), `resolver.js` (routing logic in the appropriate tier function) | Must also update `action-event-reference.md` in the orchestration skill — the Orchestrator routes entirely from that table. |
| **New status or stage value** | `constants.js` (frozen enum + transition map), `schemas/state-v4.schema.json`, `validator.js` (if new invariant needed) | Three things to update: the `Object.freeze()` enum, the `ALLOWED_*_TRANSITIONS` map, and the JSON schema. Miss any one and writes are rejected. |
| **Pointer advancement** | `mutations.js` (the specific mutation handler) | Three distinct paths: (1) immediate advance, (2) deferred to gate (`handleGateApproved`), (3) deferred to commit (`handleTaskCommitted`). Controlled by gate mode + `auto_commit`. |
| **Corrective re-entry** | `mutations.js` (the re-entry handler) | Must clear stale fields: `docs.review → null`, `review.verdict → null`, `review.action → null`. Missing any one creates inconsistent state that passes validation but breaks resolution. |
| **New state field** | `mutations.js`, `constants.js`, `schemas/state-v4.schema.json`, `state-io.js` (if in scaffoldInitialState) | Schema validation runs on every write. A field not in the schema is rejected. |

## Gotchas

**Status vs. Stage** — `status` is the coarse gate (`not_started → in_progress → complete`). `stage` is the precise work focus (`planning → coding → reviewing`). The resolver routes on **stage**, not status. Setting the wrong one breaks routing silently.

**Pre-reads are opt-in** — `preRead()` passes context through unchanged for events without a registered handler. If your new event consumes document frontmatter, add a handler in `PRE_READ_HANDLERS` to validate and enrich context before the mutation runs.

**Frozen enums** — All constants use `Object.freeze()`. Adding a new status, stage, action, or verdict means updating the frozen object AND the relevant `ALLOWED_*_TRANSITIONS` map. The validator enforces both.

**Schema validation** — The JSON Schema at `schemas/state-v4.schema.json` validates every write. New state fields need schema updates, not just code changes.

**Timestamp collision guard** — The engine auto-advances `project.updated` by +1ms on collision. Never manually set `project.updated` in a mutation handler.

**`deepClone()` before mutation** — Mutations receive a clone, not live state. The validator compares old → proposed. Bypassing the clone (e.g., mutating state before passing to `getMutation`) defeats validation.

**Pointer deferral pattern** — After `code_review_completed` with `approved` verdict, pointer advancement follows three paths:
1. `gate_mode === 'task'` → deferred to `handleGateApproved`
2. `auto_commit === 'always'` with branch → deferred to `handleTaskCommitted`
3. Otherwise → immediate advance (`phase.current_task += 1`)

Same pattern applies at phase level after `phase_review_completed`.

## Red Flags

If your change does any of the following without explicit task instructions to do so, stop and escalate to the Tactical Planner:

- Adding a state field without updating `state-v4.schema.json`
- Advancing a pointer outside the deferral pattern
- Reading context fields that weren't enriched by a pre-read handler
- Using string literals (e.g. `'approved'`) instead of frozen enum constants (e.g.`REVIEW_VERDICTS.APPROVED`)
- Adding logic that bypasses the linear processing recipe (`preRead → mutate → validate → write → resolve`)
- Modifying the validator to relax an existing invariant check
- Changing transition maps without corresponding handler updates
