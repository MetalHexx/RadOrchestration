---
project: "CONFORMANCE-TIERED"
phase: 1
task: 2
title: "Greeting"
status: "pending"
skills: []
estimated_files: 1
---

# Task P01-T02: Greeting

## Objective

Implement the greeting formatter at `src/greet.ts` that consumes `getColors()` synchronously.

## Inlined Requirements

### FR-2: Greeting formatter consumes palette synchronously

`greet(name)` MUST consume `getColors()` output synchronously and embed the comma-joined palette into the returned greeting. The function returns a plain `string`.

**Acceptance criteria:**
- `greet('world')` returns `Hello, world! Palette: red, orange, yellow.` exactly.
- The function treats `getColors()` as a synchronous call — no `await`, no `.then()`.

### AD-1: Single-module-per-feature layout

This task owns `src/greet.ts` exclusively. No barrel index file.

## File Targets

- `src/greet.ts` — new file.

## Acceptance Criteria

- `greet` imports `getColors` from `./colors.js`.
- Return type is `string` (synchronous).
- Output shape matches `Hello, ${name}! Palette: red, orange, yellow.`.

## Implementation Notes

Reference (clean shape):

```ts
import { getColors } from './colors.js';
export function greet(name: string): string {
  return `Hello, ${name}! Palette: ${getColors().join(', ')}.`;
}
```
