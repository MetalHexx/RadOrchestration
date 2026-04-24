# Conformance-Tiered

A tiny 2-module TypeScript project exercising synchronous public-API contracts. Used as an iter-12 code-review rework harness fixture.

## API

### `getColors(): Color[]`

Returns the ordered color palette `['red', 'orange', 'yellow']`. Synchronous — does not return a Promise.

- **Source:** `src/colors.ts`
- **Type:** `Color = 'red' | 'orange' | 'yellow'`

### `greet(name: string): string`

Returns a greeting of the shape `Hello, ${name}! Palette: red, orange, yellow.`. Consumes `getColors()` synchronously.

- **Source:** `src/greet.ts`

## Layout

- `src/colors.ts` — owns `getColors` (FR-1 + AD-1)
- `src/greet.ts` — owns `greet` (FR-2 + AD-1)
- No barrel index file — each public function lives in its own module (AD-1).
