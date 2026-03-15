---
project: "ORCHESTRATION-REORG"
phase: 4
task: 6
title: "Verify Copilot Instructions & Validation Gate"
status: "pending"
skills_required: ["verification", "validation"]
skills_optional: []
estimated_files: 1
---

# Verify Copilot Instructions & Validation Gate

## Objective

Verify that `.github/copilot-instructions.md` contains no stale path references to pre-reorg directories, confirm all `docs/*.md` and `README.md` are free of stale `src/` or `tests/` path prefixes, run the full test suite and validate-orchestration script, and verify `docs/dashboard.md` contains all required sections.

## Context

Phase 4 updated all documentation files (`docs/scripts.md`, `docs/project-structure.md`, `docs/getting-started.md`, `docs/validation.md`, `docs/dashboard.md`, `README.md`) to reflect the post-reorg structure. This task is the final validation gate to confirm zero stale references remain and all systems pass. The repository was reorganized to move scripts from `src/` to `.github/orchestration/scripts/` and tests from `tests/` to `.github/orchestration/scripts/tests/`. A pre-existing `triage-report` failure in validate-orchestration is a known issue and does not block.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `.github/copilot-instructions.md` | Only if stale path references are found; otherwise no changes |

## Implementation Steps

1. **Grep `.github/copilot-instructions.md` for stale path references.** Search for occurrences of `src/`, `tests/`, `plan/`, `bin/` used as path prefixes (not inside words like "tests pass" or "source"). Specific patterns to search:
   - `src/` as a path prefix (e.g., `src/lib/`, `src/next-action.js`, `src/triage.js`, `src/validate-state.js`)
   - `tests/` as a path prefix (e.g., `tests/*.test.js`)
   - `plan/` as a path prefix (e.g., `plan/schemas/`)
   - `bin/` as a directory reference
   If any stale references are found, update them:
   - `src/` paths → `.github/orchestration/scripts/`
   - `tests/` paths → `.github/orchestration/scripts/tests/`
   - `plan/schemas/` paths → `.github/orchestration/schemas/`
   - `bin/` references → remove or update as appropriate

2. **Grep all `docs/*.md` files for stale `src/` or `tests/` path prefixes.** Run:
   ```powershell
   Select-String -Path "docs/*.md" -Pattern "(^|[^a-zA-Z])src/" | Where-Object { $_.Line -notmatch "\.github/projects/" }
   Select-String -Path "docs/*.md" -Pattern "(^|[^a-zA-Z])tests/" | Where-Object { $_.Line -notmatch "\.github/projects/" }
   ```
   Expected result: zero matches. If any are found, they represent missed updates from T1–T3 and must be fixed.

3. **Grep `README.md` for stale `src/` or `tests/` path prefixes.** Run:
   ```powershell
   Select-String -Path "README.md" -Pattern "(^|[^a-zA-Z])src/"
   Select-String -Path "README.md" -Pattern "(^|[^a-zA-Z])tests/"
   ```
   Expected result: zero matches.

4. **Run the full test suite.** Execute:
   ```powershell
   node --test .github/orchestration/scripts/tests/*.test.js 2>&1
   ```
   All 307+ tests must pass. Zero failures allowed. Record the exact pass count.

5. **Run validate-orchestration.** Execute:
   ```powershell
   node .github/skills/validate-orchestration/scripts/validate-orchestration.js 2>&1
   ```
   Check output for errors. The pre-existing `triage-report` templates/ failure is acceptable and known. Any **new** errors beyond that are blockers.

6. **Verify `docs/dashboard.md` exists and contains all required sections.** Confirm the file exists and contains these section headings:
   - `# Monitoring Dashboard` (title)
   - `## Prerequisites`
   - `## Getting Started`
   - `## Features`
   - `## Data Sources`
   - `## Real-Time Updates`
   - `## Component Architecture`
   - `## Next Steps`
   Also confirm the introductory paragraph and screenshot reference (`![Monitoring Dashboard]`) are present.

7. **Record all results.** Document each check as pass/fail with details. If step 1 required modifications, list the exact changes made.

## Contracts & Interfaces

No code contracts — this is a verification-only task.

## Styles & Design Tokens

Not applicable — no UI changes.

## Test Requirements

- [ ] Grep `.github/copilot-instructions.md` for stale `src/`, `tests/`, `plan/`, `bin/` path prefixes — zero found (or all fixed)
- [ ] Grep `docs/*.md` for stale `src/` or `tests/` path prefixes — zero matches
- [ ] Grep `README.md` for stale `src/` or `tests/` path prefixes — zero matches
- [ ] `node --test .github/orchestration/scripts/tests/*.test.js` — all 307+ pass, 0 fail
- [ ] `node .github/skills/validate-orchestration/scripts/validate-orchestration.js` — no new errors beyond pre-existing `triage-report` failure
- [ ] `docs/dashboard.md` exists with all required section headings

## Acceptance Criteria

- [ ] `.github/copilot-instructions.md` contains zero stale `src/`, `tests/`, `plan/`, `bin/` path references (or they were updated in this task)
- [ ] Zero stale `src/` or `tests/` path prefixes in any `docs/*.md` file
- [ ] Zero stale `src/` or `tests/` path prefixes in `README.md`
- [ ] Test suite passes: 307+ tests, 0 failures
- [ ] validate-orchestration reports no new errors (pre-existing `triage-report` failure acceptable)
- [ ] `docs/dashboard.md` exists and contains all required sections (title, prerequisites, getting started, features, data sources, real-time updates, component architecture, next steps)
- [ ] If `.github/copilot-instructions.md` was modified, changes are limited to path reference updates only

## Constraints

- Do NOT modify any file in `.github/projects/` — project artifacts are historical records
- Do NOT modify any file in `.github/orchestration/scripts/` — scripts were migrated in earlier phases
- Do NOT modify `docs/*.md` files — if stale references are found there, report them as a failure (T1–T3 should have fixed them)
- Only `.github/copilot-instructions.md` may be modified, and only for stale path reference updates
- Do NOT modify `README.md` — T5 already updated it; any stale references found are a failure
- The pre-existing `triage-report` validate-orchestration failure is known and acceptable — do NOT attempt to fix it
