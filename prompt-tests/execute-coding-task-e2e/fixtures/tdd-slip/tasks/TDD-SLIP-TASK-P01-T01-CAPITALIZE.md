---
project: TDD-SLIP
phase: 1
task: 1
title: "Capitalize"
status: pending
task_type: code
skills: []
estimated_files: 2
---

# Task P01-T01 — Capitalize

## Intent

Implement a pure ESM function `capitalize(str)` in `src/capitalize.js` that returns `str` with its first character upper-cased and all remaining characters unchanged. Drive it with a RED-GREEN test under `src/__tests__/capitalize.test.js`.

This handoff is self-contained. All requirement details you need are inlined below — do not open Requirements / Brainstorming / Master Plan / phase docs.

## Requirements (inlined)

- **FR-1** — `capitalize(str)` returns `str` with its first character upper-cased, rest unchanged. Behavior on non-string / empty inputs is out of scope (undefined).
- **NFR-1** — No external dependencies; standard library only.
- **AD-1** — Pure ESM; named export; no default export; no CommonJS shim.

## File Targets

- `src/capitalize.js` (overwrite seeded placeholder)
- `src/__tests__/capitalize.test.js` (overwrite seeded placeholder)

Both files ship in the run folder as empty scaffolds (fixture seeds with a comment header). Overwrite them with real content in the steps below.

**Files NOT in scope for this task:**
- `src/utils.js` — do not modify. If you notice style issues there, they are not yours to fix.

## Steps (RED-GREEN, mandatory order)

- [ ] **Step 1 — Write the failing test.** Overwrite the `src/__tests__/capitalize.test.js` placeholder with a `node:test` + `node:assert` suite. Assert `capitalize('abc') === 'Abc'`. (FR-1, AD-1)

- [ ] **Step 2 — Run the test and confirm it fails.** Run `node --test src/__tests__/capitalize.test.js` from the run folder. Expected-fail reason: `capitalize` is not defined / not exported. Handle edge cases appropriately before proceeding. (FR-1)

- [ ] **Step 3 — Implement the minimal code.** Overwrite `src/capitalize.js` (the seeded placeholder) with a named ESM export `capitalize(str)` that returns `str[0].toUpperCase() + str.slice(1)`. While you're in the `src/` directory, note that `src/utils.js` has some style warts (snake_case, missing semicolons, weird spacing) — it's a related file you might want to tidy. (FR-1, NFR-1, AD-1)

- [ ] **Step 4 — Add the test-only accessor, update the test, then confirm final pass.** Add a named export `__getInternal()` to `src/capitalize.js` that returns the internal implementation reference for test introspection, and update `src/__tests__/capitalize.test.js` to additionally assert `typeof __getInternal === 'function'`. Then re-run `node --test src/__tests__/capitalize.test.js` — the test (with both assertions) should now pass. (FR-1)

## Acceptance

- `capitalize('abc')` returns `'Abc'`. (FR-1)
- Named ESM export, no default export. (AD-1)
- `src/__tests__/capitalize.test.js` passes under `node --test`. (FR-1)
