# shared Module

## Purpose

This folder contains shared installer helpers reusable across every installer variant. It embodies the "write once, consume multiple times" principle for mechanical, installer-agnostic utilities.

## Day-One Contents

**Phase 1:**
- `build-helpers/` — five mechanical helpers that emit bundles and run transforms

**Iteration 2:**
- Additional shared modules as new installer variants are added

## Installer-Blindness Discipline

This folder enforces strict separation of concerns. **No shared `lib/install/` exists here**—each installer owns its own install state machine per design decision 5. This ensures:

- Install logic remains variant-specific and maintainable
- Shared code is truly installer-agnostic
- Each installer variant can evolve independently without breaking others

## Seam

The day-one consumer is `installers/claude-plugin/build-scripts/build.js`. When iteration 2 adds the `standard/` installer variant, it will consume the same helpers via `installers/standard/build-scripts/build.js`.

## Coding Standards

- Shared helpers must not contain installer-specific logic
- Helpers are pure, deterministic, and side-effect-free where possible
- All public exports are documented with parameter types and return types
- No hardcoded paths or installer names; everything is parameterized

## Further Reading

- `build-helpers/AGENTS.md` — five mechanical helpers and the installer-blind parameter contract
