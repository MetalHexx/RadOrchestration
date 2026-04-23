# CONFORMANCE-TIERED Brainstorming

A minimal 1-phase, 2-task project designed to exercise the iter-12 code-review rework across all three review modes in a single pipeline run.

## Goal

Implement a tiny greeting library with a color palette. Phase 1 has two tasks:

1. **T1: Colors** — implement a synchronous `getColors(): Color[]` returning the ordered palette `['red', 'orange', 'yellow']`.
2. **T2: Greeting** — implement a `greet(name: string): string` that consumes `getColors()` and embeds the comma-joined palette into the greeting.

## Known drift (deliberate)

T2's initial implementation (pre-seeded in the fixture's `src/`) deliberately consumes `getColors()` assuming a `Promise<Color[]>` return type — a cross-task contract mismatch with T1's synchronous signature. The first task-review at T2 scope should catch this as a `drift` finding against FR-2. The orchestrator mediates, authors a corrective handoff, and the re-review approves once the coder fixes `src/greet.ts` to consume `getColors()` synchronously.

## Coverage

- **Task review (first attempt)** — changes_requested with one drift row.
- **Task review (re-review)** — approved, all on-track.
- **Phase review (single-pass)** — approved backstop; no residual cross-task drift.
- **Final review** — strict conformance pass against every FR/NFR in the Requirements doc; expect `met` on all rows.
