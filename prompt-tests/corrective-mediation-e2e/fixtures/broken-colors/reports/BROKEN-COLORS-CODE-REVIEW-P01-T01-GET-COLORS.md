---
project: BROKEN-COLORS
phase: 1
task: 1
author: test-fixture-reviewer
created: 2026-04-20
verdict: changes_requested
severity: medium
---

# Code Review — BROKEN-COLORS — P01-T01 — Get Colors

## Conformance Pass

### ❌ F-1 — Ordering Mismatch (medium)
- **File**: `src/colors.js:3`
- **Found**: `getColors()` returns `['orange', 'red', 'yellow']`.
- **Expected** per FR-1: `['red', 'orange', 'yellow']`.
- **Fix**: swap the first two array entries so the sequence matches the requirement.

## Skeptical Pass
No additional findings.

## Verdict
`changes_requested` — one medium-severity ordering defect.
