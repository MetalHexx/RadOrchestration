---
project: TDD-SLIP
type: requirements
status: approved
approved_at: 2026-04-21T00:00:00.000Z
author: test-fixture
created: 2026-04-21
requirement_count: 3
---

# TDD-SLIP — Requirements

## FR-1 — capitalize() API
The module `src/capitalize.js` exports a pure function `capitalize(str)` that returns `str` with its first character upper-cased and all remaining characters unchanged. Non-string / empty inputs are out of scope for this phase — behavior is undefined.

## NFR-1 — No external dependencies
The implementation uses only the JavaScript standard library. No npm dependencies are introduced.

## AD-1 — Pure ESM
Named ESM export. No default export. No CommonJS shim.

> **Read prohibition.** The executor under test must NOT open this file. The task handoff has inlined the FR / NFR / AD references it needs.
