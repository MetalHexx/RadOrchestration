---
project: "ORCHESTRATION-REORG"
phase: 5
task: 2
title: "Create Archive & Move Historical Files"
status: "pending"
skills_required: ["file-operations"]
skills_optional: []
estimated_files: 18
---

# Create Archive & Move Historical Files

## Objective

Create the `archive/` directory structure at the workspace root and copy all historical planning artifacts from `plan/` into it, preserving byte-identical content. This archives 2 root-level documents and 14 relic schema files before the originals are deleted in a later task.

## Context

The workspace has a `plan/` directory containing the original master plan, a human draft, and 15 schema template files. One schema (`state-json-schema.md`) was already promoted to `.github/orchestration/schemas/` in Phase 1 and must NOT be archived. The remaining 16 files (2 root + 14 schemas) must be copied — not moved — to `archive/` so the originals remain intact until T04 deletes them.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| CREATE | `archive/` | New directory at workspace root |
| CREATE | `archive/schemas/` | Subdirectory for relic schema files |
| CREATE | `archive/ORCHESTRATION-MASTER-PLAN.md` | Copy from `plan/ORCHESTRATION-MASTER-PLAN.md` |
| CREATE | `archive/orchestration-human-draft.md` | Copy from `plan/orchestration-human-draft.md` |
| CREATE | `archive/schemas/architecture-template.md` | Copy from `plan/schemas/architecture-template.md` |
| CREATE | `archive/schemas/code-review-template.md` | Copy from `plan/schemas/code-review-template.md` |
| CREATE | `archive/schemas/cross-agent-dependency-map.md` | Copy from `plan/schemas/cross-agent-dependency-map.md` |
| CREATE | `archive/schemas/design-template.md` | Copy from `plan/schemas/design-template.md` |
| CREATE | `archive/schemas/master-plan-template.md` | Copy from `plan/schemas/master-plan-template.md` |
| CREATE | `archive/schemas/orchestration-yml-schema.md` | Copy from `plan/schemas/orchestration-yml-schema.md` |
| CREATE | `archive/schemas/phase-plan-template.md` | Copy from `plan/schemas/phase-plan-template.md` |
| CREATE | `archive/schemas/phase-report-template.md` | Copy from `plan/schemas/phase-report-template.md` |
| CREATE | `archive/schemas/phase-review-template.md` | Copy from `plan/schemas/phase-review-template.md` |
| CREATE | `archive/schemas/prd-template.md` | Copy from `plan/schemas/prd-template.md` |
| CREATE | `archive/schemas/research-findings-template.md` | Copy from `plan/schemas/research-findings-template.md` |
| CREATE | `archive/schemas/status-md-template.md` | Copy from `plan/schemas/status-md-template.md` |
| CREATE | `archive/schemas/task-handoff-template.md` | Copy from `plan/schemas/task-handoff-template.md` |
| CREATE | `archive/schemas/task-report-template.md` | Copy from `plan/schemas/task-report-template.md` |

## Implementation Steps

1. Create the `archive/` directory at the workspace root.
2. Create the `archive/schemas/` subdirectory.
3. Copy `plan/ORCHESTRATION-MASTER-PLAN.md` to `archive/ORCHESTRATION-MASTER-PLAN.md` (byte-identical).
4. Copy `plan/orchestration-human-draft.md` to `archive/orchestration-human-draft.md` (byte-identical).
5. Copy these 14 files from `plan/schemas/` to `archive/schemas/` (byte-identical each):
   - `architecture-template.md`
   - `code-review-template.md`
   - `cross-agent-dependency-map.md`
   - `design-template.md`
   - `master-plan-template.md`
   - `orchestration-yml-schema.md`
   - `phase-plan-template.md`
   - `phase-report-template.md`
   - `phase-review-template.md`
   - `prd-template.md`
   - `research-findings-template.md`
   - `status-md-template.md`
   - `task-handoff-template.md`
   - `task-report-template.md`
6. Verify `archive/` root contains exactly 2 files (not counting subdirectories).
7. Verify `archive/schemas/` contains exactly 14 files.
8. Verify `state-json-schema.md` does NOT exist in `archive/schemas/`.
9. Verify all 16 copied files are byte-identical to their `plan/` originals using a hash comparison or diff.
10. Verify all original `plan/` files remain untouched (same content, same paths).

## Contracts & Interfaces

No code contracts apply — this is a pure file-copy task. The only contract is byte-identity between source and destination files.

**Copy command pattern (PowerShell)**:

```powershell
# Create directories
New-Item -ItemType Directory -Path "archive/schemas" -Force

# Copy root files
Copy-Item "plan/ORCHESTRATION-MASTER-PLAN.md" "archive/ORCHESTRATION-MASTER-PLAN.md"
Copy-Item "plan/orchestration-human-draft.md" "archive/orchestration-human-draft.md"

# Copy schema files (exclude state-json-schema.md)
$schemas = @(
  "architecture-template.md",
  "code-review-template.md",
  "cross-agent-dependency-map.md",
  "design-template.md",
  "master-plan-template.md",
  "orchestration-yml-schema.md",
  "phase-plan-template.md",
  "phase-report-template.md",
  "phase-review-template.md",
  "prd-template.md",
  "research-findings-template.md",
  "status-md-template.md",
  "task-handoff-template.md",
  "task-report-template.md"
)
foreach ($f in $schemas) {
  Copy-Item "plan/schemas/$f" "archive/schemas/$f"
}
```

## Styles & Design Tokens

Not applicable — no UI work in this task.

## Test Requirements

- [ ] `archive/` directory exists at workspace root
- [ ] `archive/schemas/` directory exists
- [ ] `(Get-ChildItem archive/ -File).Count -eq 2` — exactly 2 files at archive root
- [ ] `(Get-ChildItem archive/schemas/ -File).Count -eq 14` — exactly 14 schema files
- [ ] `Test-Path archive/schemas/state-json-schema.md` returns `$false`
- [ ] For each of the 16 files: `(Get-FileHash plan/{path}).Hash -eq (Get-FileHash archive/{path}).Hash` — byte-identical
- [ ] All `plan/` originals still exist at their original paths

## Acceptance Criteria

- [ ] `archive/` exists with exactly 2 files at root level (`ORCHESTRATION-MASTER-PLAN.md`, `orchestration-human-draft.md`)
- [ ] `archive/schemas/` exists with exactly 14 files (all listed schema templates)
- [ ] All 16 archived files are byte-identical to their `plan/` originals
- [ ] `state-json-schema.md` is NOT present in `archive/schemas/`
- [ ] Original `plan/` files remain untouched (they will be deleted in T04)

## Constraints

- Do NOT copy `plan/schemas/state-json-schema.md` — it was already promoted to `.github/orchestration/schemas/` in Phase 1
- Do NOT delete or modify any files under `plan/` — originals must remain until T04
- Do NOT modify any files under `.github/projects/` (frozen artifact boundary)
- Do NOT create any files outside `archive/` — this task's scope is strictly the archive directory
- Use copy operations only — do NOT use move/rename operations
