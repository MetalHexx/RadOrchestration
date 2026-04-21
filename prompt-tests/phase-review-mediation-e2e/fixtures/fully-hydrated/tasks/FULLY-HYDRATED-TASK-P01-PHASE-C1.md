---
project: FULLY-HYDRATED
phase: 1
title: "Phase 01 Corrective 1"
status: pending
skills: []
estimated_files: 2
corrective_index: 1
corrective_scope: phase
budget_max: 5
budget_remaining: 4
---

# Task P01-PHASE-C1 — Phase-Scope Corrective 1

## Intent
Reconcile the cross-module contract between `parser.js` and `renderer.js` so the phase-level integration criterion is satisfied.

## File Targets
- `src/parser.js`
- `src/renderer.js`

## Acceptance Criteria
- `render(parse(input))` produces the deterministic output described in the Phase Plan's exit criteria.
