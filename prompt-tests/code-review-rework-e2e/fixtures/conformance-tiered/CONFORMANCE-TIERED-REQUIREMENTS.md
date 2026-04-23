---
project: "CONFORMANCE-TIERED"
type: "requirements"
status: "approved"
author: "planner-agent"
created: "2026-04-21"
requirement_count: 5
approved_at: "2026-04-21T00:00:00.000Z"
---

# CONFORMANCE-TIERED Requirements

## FR-1: Ordered palette

The `getColors` function MUST return the color palette in the order `red`, `orange`, `yellow`. The return type MUST be `Color[]` where `Color` is the union `'red' | 'orange' | 'yellow'`.

**Acceptance criteria:**
- `getColors()` returns `['red', 'orange', 'yellow']` exactly in this order.
- Return type is the synchronous `Color[]` (no Promise wrapping).

## FR-2: Greeting formatter consumes palette synchronously

The `greet(name)` function MUST consume `getColors()` output synchronously and embed the comma-joined palette into the returned greeting string.

**Acceptance criteria:**
- `greet('world')` returns a string matching the shape `Hello, world! Palette: red, orange, yellow.`.
- `greet` treats `getColors()` as a synchronous call — no `await`, no `.then()`, no Promise handling.

## NFR-1: Synchronous public API

The public API (`getColors`, `greet`) MUST be synchronous. No Promise-returning signatures at the module surface.

**Acceptance criteria:**
- Every exported function signature in `src/colors.ts` and `src/greet.ts` has a non-Promise return type.

## NFR-2: Public-API documentation

The public API MUST be documented in a `README.md` at the project root.

**Acceptance criteria:**
- `README.md` exists at the project root.
- The file contains an `## API` section listing `getColors` and `greet` with their signatures.

## AD-1: Single-module-per-feature layout

Each public function lives in its own module file under `src/` — `getColors` in `src/colors.ts`, `greet` in `src/greet.ts`. No aggregating index file.

**Acceptance criteria:**
- `src/colors.ts` exports `getColors` (and `Color`).
- `src/greet.ts` exports `greet`.
- No barrel index file at `src/index.ts`.
