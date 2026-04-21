---
project: "FULLY-HYDRATED"
author: "test-fixture"
created: "2026-04-21"
---

# FULLY-HYDRATED — Brainstorming

Static UI showcase fixture. Pre-cooked `state.json` and all on-disk documents are hand-authored to exercise maximum rendering density in the DAG timeline and document sidebar: task-scope corrective stacks, phase-scope corrective stacks, and a corrective-of-corrective at phase scope (to exercise the ancestor-derivation path).

Phase 1 holds three tasks with correctives stacked (T1 with one task-scope corrective; T2 clean; T3 with two task-scope correctives), a phase review that returned `changes_requested`, and two phase-scope correctives — the first of which was itself mediated after its task-level code review returned `changes_requested`.

Phase 2 holds a single clean task with no corrective activity; it exists so the UI can be spot-checked for regression against the simple, no-corrective rendering path.

Not runner-driven. The fixture is never executed by `pipeline.js`; the UI reads its `state.json` directly.
