# installers Module

## Purpose

This module hosts every installer variant and shared installer helpers for the rad-orchestration ecosystem. It serves as the assembly layer where adapter output, runtime configuration, and harness files converge into publishable, harness-specific plugins and CLIs.

## Organization

**Day-one contents (Phase 1):**
- `claude-plugin/` — self-contained npm package producing the Claude marketplace plugin
- `shared/build-helpers/` — mechanical helpers (bundle emitters, token expansion) reusable across installer variants

**Iteration-2 expansion:**
- `standard/` — additional installer variant for non-Claude targets

## Freeze Rule

The legacy `/installer/` folder at the repo root remains untouched during iteration 1. It is replaced entirely by this greenfield structure in a later cutover phase.

## Seams to Other Modules

**Upstream input boundary:** `harness-adapters/output/`
- Adapters produce the compiled agent/skill payloads that each installer consumes
- Installers never read canonical adapter source; they read only the adapter engine's output tree

**Harness-neutral content source:** `runtime-config/`
- System configuration (`orchestration.yml`) and review-intensity templates ship verbatim from this folder
- Installers consume but do not modify this content

## Coding Standards

- Each installer owns its own directory with self-contained `package.json`, build scripts, and tests
- Build outputs are gitignored (`.gitignore` entries maintain cleanliness)
- No cross-installer shared code except via `shared/build-helpers/`
- Module-level documentation (this file) is the reference for newcomers

## Further Reading

- `claude-plugin/AGENTS.md` — structure and build contract of the Claude plugin variant
- `shared/build-helpers/AGENTS.md` — installer-blind mechanical helper patterns
- `runtime-config/AGENTS.md` — harness-neutral configuration content
