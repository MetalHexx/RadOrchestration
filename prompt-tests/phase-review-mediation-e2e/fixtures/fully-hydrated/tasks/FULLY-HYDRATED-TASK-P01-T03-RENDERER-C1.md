---
project: FULLY-HYDRATED
phase: 1
task: 3
title: "Renderer"
status: pending
skills: []
estimated_files: 1
corrective_index: 1
corrective_scope: task
budget_max: 5
budget_remaining: 4
---

# Task P01-T03 — Renderer (Corrective 1)

## Intent
Tighten `render(tree)` in `src/renderer.js` so it handles the tree shape produced by `parse()`.

## File Targets
- `src/renderer.js`

## Acceptance Criteria (FR-3)
- `render()` is a named ESM export.
- Consumes the output of `parse()` and produces a deterministic string.
