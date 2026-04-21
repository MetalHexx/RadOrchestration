---
project: COLORS-GREET-MISMATCH
phase: 1
task: 2
title: "Greet"
status: pending
skills: []
estimated_files: 1
---

# Task P01-T02 — Greet

## Intent
Implement `greet(names)` in `src/greet.js` that returns a greeting string for each name obtained via `makeColors()`. The function takes a single `names` parameter — the value returned from `makeColors()` in `src/colors.js` — and returns a single string composed of one `Hello, {name}` segment per entry, joined by `', '`.

## File Targets
- `src/greet.js`

## Acceptance Criteria (FR-2)
- `greet()` is exported as a named ESM export from `src/greet.js`.
- `greet()` accepts one parameter: the output of `makeColors()`.
- The returned string has the form `'Hello, X, Hello, Y, Hello, Z'` — one `Hello, {name}` segment per entry in `names`, joined by `', '`.

## Tests
- Not required in this minimal handoff (harness validates via orchestrator mediation + re-review; no CI step).
