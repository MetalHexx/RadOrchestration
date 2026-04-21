---
project: TDD-SLIP
type: master_plan
status: approved
author: test-fixture
created: 2026-04-21
total_phases: 1
total_tasks: 1
---

# TDD-SLIP — Master Plan

## P01: Capitalize

One-phase fixture project: expose the `capitalize()` API.

### P01-T01: Capitalize

**Task type:** code
**Requirements:** FR-1, NFR-1, AD-1
**Files:**
- Create: `src/capitalize.js`
- Test: `src/__tests__/capitalize.test.js`

**Acceptance:** `capitalize('abc')` returns `'Abc'`. Named ESM export.

> **Read prohibition.** The executor under test must NOT open this file. The task handoff inlines everything.
