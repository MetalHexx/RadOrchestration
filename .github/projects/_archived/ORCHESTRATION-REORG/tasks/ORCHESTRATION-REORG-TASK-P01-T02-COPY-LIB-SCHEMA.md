---
project: "ORCHESTRATION-REORG"
phase: 1
task: 2
title: "Copy Lib Modules and Schema"
status: "pending"
skills_required: ["file copy"]
skills_optional: []
estimated_files: 5
---

# Copy Lib Modules and Schema

## Objective

Copy the 4 shared lib modules and 1 schema file verbatim from their current locations to the new `.github/orchestration/` directory structure. No file content modifications — byte-identical copies only.

## Context

Task T01 created the target directories: `.github/orchestration/scripts/lib/` and `.github/orchestration/schemas/`. This task populates them with verbatim copies of the lib modules and schema. The lib modules use sibling-relative imports (`./constants`, etc.) that are preserved because the directory structure is identical at the target. The original files in `src/lib/` and `plan/schemas/` must remain untouched — the project maintains dual-path coexistence during migration. Note: Git does not track empty directories, so if the directories from T01 are missing, recreate them before copying.

## File Targets

| Action | Source Path | Target Path | Notes |
|--------|------------|-------------|-------|
| CREATE | `src/lib/constants.js` | `.github/orchestration/scripts/lib/constants.js` | Byte-identical copy |
| CREATE | `src/lib/resolver.js` | `.github/orchestration/scripts/lib/resolver.js` | Byte-identical copy |
| CREATE | `src/lib/state-validator.js` | `.github/orchestration/scripts/lib/state-validator.js` | Byte-identical copy |
| CREATE | `src/lib/triage-engine.js` | `.github/orchestration/scripts/lib/triage-engine.js` | Byte-identical copy |
| CREATE | `plan/schemas/state-json-schema.md` | `.github/orchestration/schemas/state-json-schema.md` | Byte-identical copy |

## Implementation Steps

1. Verify the target directories exist: `.github/orchestration/scripts/lib/` and `.github/orchestration/schemas/`. If missing, create them.
2. Copy `src/lib/constants.js` to `.github/orchestration/scripts/lib/constants.js` — no modifications.
3. Copy `src/lib/resolver.js` to `.github/orchestration/scripts/lib/resolver.js` — no modifications.
4. Copy `src/lib/state-validator.js` to `.github/orchestration/scripts/lib/state-validator.js` — no modifications.
5. Copy `src/lib/triage-engine.js` to `.github/orchestration/scripts/lib/triage-engine.js` — no modifications.
6. Copy `plan/schemas/state-json-schema.md` to `.github/orchestration/schemas/state-json-schema.md` — no modifications.
7. Verify each target file exists and is byte-identical to its source (compare file contents or use a diff tool).
8. Verify original source files have not been modified (they must remain in place for the existing pipeline).

## Contracts & Interfaces

No contracts apply — this task copies files verbatim with zero content modifications. The internal `require()` paths within lib modules (e.g., `require('./constants')`) are sibling-relative and resolve correctly at the new location because the `lib/` directory structure is preserved.

## Styles & Design Tokens

Not applicable — no UI component in this task.

## Test Requirements

- [ ] `.github/orchestration/scripts/lib/constants.js` exists and is byte-identical to `src/lib/constants.js`
- [ ] `.github/orchestration/scripts/lib/resolver.js` exists and is byte-identical to `src/lib/resolver.js`
- [ ] `.github/orchestration/scripts/lib/state-validator.js` exists and is byte-identical to `src/lib/state-validator.js`
- [ ] `.github/orchestration/scripts/lib/triage-engine.js` exists and is byte-identical to `src/lib/triage-engine.js`
- [ ] `.github/orchestration/schemas/state-json-schema.md` exists and is byte-identical to `plan/schemas/state-json-schema.md`
- [ ] Original source files `src/lib/constants.js`, `src/lib/resolver.js`, `src/lib/state-validator.js`, `src/lib/triage-engine.js`, and `plan/schemas/state-json-schema.md` remain untouched

## Acceptance Criteria

- [ ] File `.github/orchestration/scripts/lib/constants.js` exists at target
- [ ] File `.github/orchestration/scripts/lib/resolver.js` exists at target
- [ ] File `.github/orchestration/scripts/lib/state-validator.js` exists at target
- [ ] File `.github/orchestration/scripts/lib/triage-engine.js` exists at target
- [ ] File `.github/orchestration/schemas/state-json-schema.md` exists at target
- [ ] All 5 target files are byte-identical to their respective source files
- [ ] All 5 original source files remain unmodified

## Constraints

- Do NOT modify any file contents — copies must be byte-identical to their sources
- Do NOT delete or rename the original source files — they must remain at their current locations
- Do NOT copy any files beyond the 5 specified in this handoff
- Do NOT modify any `require()` or `import` paths — these files need zero path changes
- Do NOT create any additional directories beyond what T01 already created (recreate only if missing)
