---
project: "CONFORMANCE-TIERED"
phase: 1
task: 1
title: "Colors"
status: "pending"
skills: []
estimated_files: 1
---

# Task P01-T01: Colors

## Objective

Implement the synchronous color-palette source at `src/colors.ts`.

## Inlined Requirements

### FR-1: Ordered palette

The `getColors` function MUST return `['red', 'orange', 'yellow']` in that order. Return type MUST be the synchronous `Color[]` where `Color = 'red' | 'orange' | 'yellow'`.

### AD-1: Single-module-per-feature layout

This task owns `src/colors.ts` exclusively. No barrel index file.

### NFR-1: Synchronous public API (task-scoped slice)

Exported functions MUST be synchronous.

## File Targets

- `src/colors.ts` — new file.

## Acceptance Criteria

- `getColors()` returns `['red', 'orange', 'yellow']`.
- Return type is `Color[]` (synchronous, not `Promise<Color[]>`).
- `Color` is exported as the union type.

## Implementation Notes

```ts
export type Color = 'red' | 'orange' | 'yellow';
export function getColors(): Color[] {
  return ['red', 'orange', 'yellow'];
}
```
