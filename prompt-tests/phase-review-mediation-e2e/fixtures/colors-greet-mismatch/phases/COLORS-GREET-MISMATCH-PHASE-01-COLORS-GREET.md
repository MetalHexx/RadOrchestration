---
project: COLORS-GREET-MISMATCH
phase: 1
title: "Colors + Greet"
status: complete
author: test-fixture
created: 2026-04-21
type: phase_plan
tasks:
  - id: T01
    title: "Make Colors"
  - id: T02
    title: "Greet"
---

# COLORS-GREET-MISMATCH — Phase 01 — Colors + Greet

Expose `makeColors()` in `src/colors.js` and a `greet(names)` function in `src/greet.js` that composes a greeting string from the output of `makeColors()`.

**Requirements:** FR-1, FR-2

**Execution order:**
    T01 → T02

## Exit Criteria

- `makeColors()` is importable from `src/colors.js` and returns `['red', 'orange', 'yellow']`.
- `greet()` is importable from `src/greet.js`.
- `greet(makeColors())` returns `'Hello, red, Hello, orange, Hello, yellow'` — the cross-task integration behavior.

## Tasks

- **T01**: Make Colors
- **T02**: Greet
