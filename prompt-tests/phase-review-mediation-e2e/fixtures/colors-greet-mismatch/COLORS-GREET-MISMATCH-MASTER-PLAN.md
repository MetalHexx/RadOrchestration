---
project: COLORS-GREET-MISMATCH
type: master_plan
status: approved
author: test-fixture
created: 2026-04-21
total_phases: 1
total_tasks: 2
---

# COLORS-GREET-MISMATCH — Master Plan

## P01: Colors + Greet

One-phase project: expose the colors API and a greet function that consumes it.

### P01-T01: Make Colors

**File Targets**: `src/colors.js`

**Acceptance**: FR-1 — `makeColors()` returns `['red', 'orange', 'yellow']` in that exact order, as an array of strings.

### P01-T02: Greet

**File Targets**: `src/greet.js`

**Acceptance**: FR-2 — `greet(names)` accepts the output of `makeColors()` and returns `'Hello, red, Hello, orange, Hello, yellow'`.
