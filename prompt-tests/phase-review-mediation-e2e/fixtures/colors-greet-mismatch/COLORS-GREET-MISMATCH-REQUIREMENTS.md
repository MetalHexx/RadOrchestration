---
project: COLORS-GREET-MISMATCH
type: requirements
status: approved
approved_at: 2026-04-21T00:00:00.000Z
author: test-fixture
created: 2026-04-21
requirement_count: 2
---

# COLORS-GREET-MISMATCH — Requirements

## FR-1 — Colors API

The module `src/colors.js` exports a function `makeColors()` that returns the JavaScript array `['red', 'orange', 'yellow']` — exactly those three strings, in exactly that order.

## FR-2 — Greeting API

The module `src/greet.js` exports a function `greet(names)` that accepts the output of `makeColors()` and returns a single greeting string composed of one `Hello, {name}` segment per entry, joined by `', '`. Calling `greet(makeColors())` must produce `'Hello, red, Hello, orange, Hello, yellow'`.
