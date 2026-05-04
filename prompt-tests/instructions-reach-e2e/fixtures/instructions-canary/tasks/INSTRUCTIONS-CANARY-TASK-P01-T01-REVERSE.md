---
project: INSTRUCTIONS-CANARY
phase: 1
task: 1
title: "Reverse"
status: pending
task_type: code
skills: []
estimated_files: 2
---

# Task P01-T01 — Reverse

## Intent

Implement a pure ESM function `reverseString(str)` in `src/reverse.js` that returns `str` with its character order reversed. Drive it with a RED-GREEN test under `src/__tests__/reverse.test.js`.

This handoff is self-contained. All requirement details you need are inlined below — do not open Requirements / Brainstorming / Master Plan / phase docs.

## Requirements (inlined)

- **R1** — `reverseString(str)` returns `str` with its character order reversed (UTF-16 code-unit reversal is acceptable; grapheme-cluster handling is out of scope).
- **R2** — No external dependencies; standard library only.
- **R3** — Pure ESM; named export; no default export; no CommonJS shim.

## File Targets

- `src/reverse.js` (overwrite seeded placeholder)
- `src/__tests__/reverse.test.js` (overwrite seeded placeholder)

Both files ship in the run folder as empty scaffolds. Overwrite them with real content in the steps below.

## Steps (RED-GREEN, mandatory order)

- [ ] **Step 1 — Write the failing test.** Overwrite the `src/__tests__/reverse.test.js` placeholder with a `node:test` + `node:assert` suite. Assert `reverseString('abc') === 'cba'`. (R1, R3)

- [ ] **Step 2 — Run the test and confirm it fails.** Run `node --test src/__tests__/reverse.test.js` from the run folder. Expected-fail reason: `reverseString` is not defined / not exported. (R1)

- [ ] **Step 3 — Implement the minimal code.** Overwrite `src/reverse.js` (the seeded placeholder) with a named ESM export `reverseString(str)` that returns `str.split('').reverse().join('')`. (R1, R2, R3)

- [ ] **Step 4 — Re-run the test and confirm it passes.** Run `node --test src/__tests__/reverse.test.js` from the run folder. The test should now pass. (R1)

## Acceptance

- `reverseString('abc')` returns `'cba'`. (R1)
- Named ESM export, no default export. (R3)
- `src/__tests__/reverse.test.js` passes under `node --test`. (R1)
