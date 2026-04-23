---
project: "CONFORMANCE-TIERED"
phase: 1
title: "Core Flow"
status: "active"
tasks:
  - id: "P01-T01"
    title: "Colors"
  - id: "P01-T02"
    title: "Greeting"
author: "explosion-script"
created: "2026-04-21"
---

# Phase 01 — Core Flow

**Requirements:** FR-1, FR-2, NFR-1, AD-1

## Exit Criteria

1. `src/colors.ts` exports `getColors(): Color[]` returning the ordered palette.
2. `src/greet.ts` exports `greet(name: string): string` that embeds the palette via a synchronous `getColors()` call.
3. Tests pass (if a test runner exists — for the harness, running tests is a no-op).
4. No Promise-returning signatures at the public-API surface.

## Tasks

| # | ID | Title | Summary |
|---|-----|-------|---------|
| 1 | P01-T01 | Colors | Implement `getColors` per FR-1. |
| 2 | P01-T02 | Greeting | Implement `greet` per FR-2; consume `getColors()` synchronously. |

## Notes

NFR-2 (README) and the final cumulative check are deferred to the final review pass. This phase focuses on the core public-API shapes.
