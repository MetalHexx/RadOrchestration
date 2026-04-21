---
project: "COLORS-GREET-MISMATCH"
author: "test-fixture"
created: "2026-04-21"
---

# COLORS-GREET-MISMATCH — Brainstorming

Tiny two-function utility designed to exercise phase-scope orchestrator mediation end-to-end.

- `makeColors()` in `src/colors.js` returns a small array of color strings.
- `greet(names)` in `src/greet.js` returns a greeting string for each name obtained via `makeColors()`.

The two tasks share an implicit contract on the shape of the items returned by `makeColors()` — that shape is deliberately unpinned in the T2 Task Handoff so the task-scope code reviewers cannot catch the cross-task drift in isolation. Each task-level review approves; phase review catches the integration bug and opens a phase-scope corrective cycle.
