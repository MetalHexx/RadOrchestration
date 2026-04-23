---
project: "CONFORMANCE-TIERED"
type: "master_plan"
status: "approved"
author: "planner-agent"
created: "2026-04-21"
total_phases: 1
total_tasks: 2
---

# CONFORMANCE-TIERED Master Plan

## P01: Core flow

Implement the palette source and greeting formatter.

### P01-T01: Colors

Implement `getColors(): Color[]` per FR-1 + AD-1.

### P01-T02: Greeting

Implement `greet(name: string): string` per FR-2 + AD-1. Consumes `getColors()` synchronously.
