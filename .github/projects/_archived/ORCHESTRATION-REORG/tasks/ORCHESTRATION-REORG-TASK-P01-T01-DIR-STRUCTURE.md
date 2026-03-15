---
project: "ORCHESTRATION-REORG"
phase: 1
task: 1
title: "Create Directory Structure"
status: "pending"
skills_required: ["file creation"]
skills_optional: []
estimated_files: 0
---

# Create Directory Structure

## Objective

Create the 3 target directories under `.github/orchestration/` that all subsequent Phase 1 tasks depend on. These directories will hold the migrated CLI scripts, shared lib modules, and schema files.

## Context

The project is migrating runtime scripts from `src/` and schema files from `plan/schemas/` to `.github/orchestration/`. This task creates the empty directory scaffold. Subsequent tasks (T02, T03) will copy files into these directories. The `.github/orchestration/` parent directory may or may not already exist — create it if needed.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `.github/orchestration/scripts/` | Directory for CLI scripts (next-action.js, triage.js, validate-state.js) |
| CREATE | `.github/orchestration/scripts/lib/` | Directory for shared lib modules (constants.js, resolver.js, etc.) |
| CREATE | `.github/orchestration/schemas/` | Directory for schema files (state-json-schema.md) |

## Implementation Steps

1. Create the directory `.github/orchestration/scripts/lib/` (this implicitly creates `.github/orchestration/` and `.github/orchestration/scripts/` as parents)
2. Create the directory `.github/orchestration/schemas/`
3. Verify all 3 directories exist: `.github/orchestration/scripts/`, `.github/orchestration/scripts/lib/`, `.github/orchestration/schemas/`
4. Verify no files were created inside any of the directories — they must be empty

## Contracts & Interfaces

No contracts apply — this task creates empty directories only.

## Styles & Design Tokens

Not applicable — no UI component in this task.

## Test Requirements

- [ ] `.github/orchestration/scripts/` directory exists
- [ ] `.github/orchestration/scripts/lib/` directory exists
- [ ] `.github/orchestration/schemas/` directory exists
- [ ] All 3 directories are empty (contain no files)
- [ ] No existing files anywhere in the repository were modified or deleted

## Acceptance Criteria

- [ ] Directory `.github/orchestration/scripts/` exists
- [ ] Directory `.github/orchestration/scripts/lib/` exists
- [ ] Directory `.github/orchestration/schemas/` exists
- [ ] All 3 directories contain zero files
- [ ] No existing files in the repository were modified

## Constraints

- Do NOT create any files inside the directories (not even `.gitkeep` — Git tracks files, not directories, but subsequent tasks will add files)
- Do NOT modify any existing files in the repository
- Do NOT create any directories beyond the 3 specified (and their necessary parents)
- If `.github/orchestration/` already exists, do not error — use it as-is
