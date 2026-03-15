---
project: "ORCHESTRATION-REORG"
phase: 5
task: 4
title: "Delete Original Directories"
status: "pending"
skills_required: ["file-operations"]
skills_optional: ["run-tests"]
estimated_files: 42
---

# Delete Original Directories

## Objective

Delete the four original workspace-root directories (`src/`, `tests/`, `plan/`, `bin/`) whose contents have been fully migrated (Phases 1–2), archived (T02), or were already empty. This is a destructive, irreversible operation — all pre-deletion verifications must pass before any directory is removed.

## Context

Phase 1 migrated 7 script files from `src/` to `.github/orchestration/scripts/` (3 CLI scripts) and `.github/orchestration/scripts/lib/` (4 lib modules). Phase 2 migrated 18 test files from `tests/` to `.github/orchestration/scripts/tests/`. Phase 5 T02 archived 16 files from `plan/` into `archive/`. The promoted schema (`state-json-schema.md`) was moved to `.github/orchestration/schemas/` in Phase 1. `bin/` has been empty since project start with zero references found in research. All migrated/archived copies have been verified byte-identical to originals.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| DELETE | `src/next-action.js` | Migrated to `.github/orchestration/scripts/next-action.js` (Phase 1) |
| DELETE | `src/triage.js` | Migrated to `.github/orchestration/scripts/triage.js` (Phase 1) |
| DELETE | `src/validate-state.js` | Migrated to `.github/orchestration/scripts/validate-state.js` (Phase 1) |
| DELETE | `src/lib/constants.js` | Migrated to `.github/orchestration/scripts/lib/constants.js` (Phase 1) |
| DELETE | `src/lib/resolver.js` | Migrated to `.github/orchestration/scripts/lib/resolver.js` (Phase 1) |
| DELETE | `src/lib/state-validator.js` | Migrated to `.github/orchestration/scripts/lib/state-validator.js` (Phase 1) |
| DELETE | `src/lib/triage-engine.js` | Migrated to `.github/orchestration/scripts/lib/triage-engine.js` (Phase 1) |
| DELETE | `src/lib/` | Directory — empty after file deletion |
| DELETE | `src/` | Directory — empty after file deletion |
| DELETE | `tests/agents.test.js` | Migrated to `.github/orchestration/scripts/tests/agents.test.js` (Phase 2) |
| DELETE | `tests/config.test.js` | Migrated to `.github/orchestration/scripts/tests/config.test.js` (Phase 2) |
| DELETE | `tests/constants.test.js` | Migrated to `.github/orchestration/scripts/tests/constants.test.js` (Phase 2) |
| DELETE | `tests/cross-refs.test.js` | Migrated to `.github/orchestration/scripts/tests/cross-refs.test.js` (Phase 2) |
| DELETE | `tests/frontmatter.test.js` | Migrated to `.github/orchestration/scripts/tests/frontmatter.test.js` (Phase 2) |
| DELETE | `tests/fs-helpers.test.js` | Migrated to `.github/orchestration/scripts/tests/fs-helpers.test.js` (Phase 2) |
| DELETE | `tests/instructions.test.js` | Migrated to `.github/orchestration/scripts/tests/instructions.test.js` (Phase 2) |
| DELETE | `tests/next-action.test.js` | Migrated to `.github/orchestration/scripts/tests/next-action.test.js` (Phase 2) |
| DELETE | `tests/prompts.test.js` | Migrated to `.github/orchestration/scripts/tests/prompts.test.js` (Phase 2) |
| DELETE | `tests/reporter.test.js` | Migrated to `.github/orchestration/scripts/tests/reporter.test.js` (Phase 2) |
| DELETE | `tests/resolver.test.js` | Migrated to `.github/orchestration/scripts/tests/resolver.test.js` (Phase 2) |
| DELETE | `tests/skills.test.js` | Migrated to `.github/orchestration/scripts/tests/skills.test.js` (Phase 2) |
| DELETE | `tests/state-validator.test.js` | Migrated to `.github/orchestration/scripts/tests/state-validator.test.js` (Phase 2) |
| DELETE | `tests/structure.test.js` | Migrated to `.github/orchestration/scripts/tests/structure.test.js` (Phase 2) |
| DELETE | `tests/triage-engine.test.js` | Migrated to `.github/orchestration/scripts/tests/triage-engine.test.js` (Phase 2) |
| DELETE | `tests/triage.test.js` | Migrated to `.github/orchestration/scripts/tests/triage.test.js` (Phase 2) |
| DELETE | `tests/validate-state.test.js` | Migrated to `.github/orchestration/scripts/tests/validate-state.test.js` (Phase 2) |
| DELETE | `tests/yaml-parser.test.js` | Migrated to `.github/orchestration/scripts/tests/yaml-parser.test.js` (Phase 2) |
| DELETE | `tests/` | Directory — empty after file deletion |
| DELETE | `plan/ORCHESTRATION-MASTER-PLAN.md` | Archived to `archive/ORCHESTRATION-MASTER-PLAN.md` (T02) |
| DELETE | `plan/orchestration-human-draft.md` | Archived to `archive/orchestration-human-draft.md` (T02) |
| DELETE | `plan/schemas/architecture-template.md` | Archived to `archive/schemas/architecture-template.md` (T02) |
| DELETE | `plan/schemas/code-review-template.md` | Archived to `archive/schemas/code-review-template.md` (T02) |
| DELETE | `plan/schemas/cross-agent-dependency-map.md` | Archived to `archive/schemas/cross-agent-dependency-map.md` (T02) |
| DELETE | `plan/schemas/design-template.md` | Archived to `archive/schemas/design-template.md` (T02) |
| DELETE | `plan/schemas/master-plan-template.md` | Archived to `archive/schemas/master-plan-template.md` (T02) |
| DELETE | `plan/schemas/orchestration-yml-schema.md` | Archived to `archive/schemas/orchestration-yml-schema.md` (T02) |
| DELETE | `plan/schemas/phase-plan-template.md` | Archived to `archive/schemas/phase-plan-template.md` (T02) |
| DELETE | `plan/schemas/phase-report-template.md` | Archived to `archive/schemas/phase-report-template.md` (T02) |
| DELETE | `plan/schemas/phase-review-template.md` | Archived to `archive/schemas/phase-review-template.md` (T02) |
| DELETE | `plan/schemas/prd-template.md` | Archived to `archive/schemas/prd-template.md` (T02) |
| DELETE | `plan/schemas/research-findings-template.md` | Archived to `archive/schemas/research-findings-template.md` (T02) |
| DELETE | `plan/schemas/status-md-template.md` | Archived to `archive/schemas/status-md-template.md` (T02) |
| DELETE | `plan/schemas/task-handoff-template.md` | Archived to `archive/schemas/task-handoff-template.md` (T02) |
| DELETE | `plan/schemas/task-report-template.md` | Archived to `archive/schemas/task-report-template.md` (T02) |
| DELETE | `plan/schemas/state-json-schema.md` | Promoted to `.github/orchestration/schemas/state-json-schema.md` (Phase 1) |
| DELETE | `plan/schemas/` | Directory — empty after file deletion |
| DELETE | `plan/` | Directory — empty after file deletion |
| DELETE | `bin/` | Directory — already empty (zero files, zero references) |

## Implementation Steps

1. **PRE-DELETION VERIFICATION — Migrated scripts exist at new locations.** Run the following checks and confirm ALL return `True`. Do NOT proceed to any deletion step if any check fails:
   - `Test-Path .github/orchestration/scripts/next-action.js`
   - `Test-Path .github/orchestration/scripts/triage.js`
   - `Test-Path .github/orchestration/scripts/validate-state.js`
   - `Test-Path .github/orchestration/scripts/lib/constants.js`
   - `Test-Path .github/orchestration/scripts/lib/resolver.js`
   - `Test-Path .github/orchestration/scripts/lib/state-validator.js`
   - `Test-Path .github/orchestration/scripts/lib/triage-engine.js`

2. **PRE-DELETION VERIFICATION — Migrated tests exist at new locations.** Confirm ALL 18 test files exist under `.github/orchestration/scripts/tests/`:
   - `agents.test.js`, `config.test.js`, `constants.test.js`, `cross-refs.test.js`, `frontmatter.test.js`, `fs-helpers.test.js`, `instructions.test.js`, `next-action.test.js`, `prompts.test.js`, `reporter.test.js`, `resolver.test.js`, `skills.test.js`, `state-validator.test.js`, `structure.test.js`, `triage-engine.test.js`, `triage.test.js`, `validate-state.test.js`, `yaml-parser.test.js`
   - Use: `(Get-ChildItem .github/orchestration/scripts/tests/*.test.js).Count` — must equal `18`.

3. **PRE-DELETION VERIFICATION — Archived files exist.** Confirm:
   - `Test-Path archive/ORCHESTRATION-MASTER-PLAN.md` → `True`
   - `Test-Path archive/orchestration-human-draft.md` → `True`
   - `(Get-ChildItem archive/schemas/*.md).Count` equals `14`

4. **PRE-DELETION VERIFICATION — Promoted schema exists.** Confirm:
   - `Test-Path .github/orchestration/schemas/state-json-schema.md` → `True`

5. **PRE-DELETION VERIFICATION — Snapshot `.github/projects/` before deletion.** Record a hash manifest of all files under `.github/projects/` for post-deletion integrity comparison:
   ```powershell
   Get-ChildItem -Recurse .github/projects/ -File | ForEach-Object { "$($_.FullName)|$(Get-FileHash $_.FullName -Algorithm SHA256 | Select-Object -ExpandProperty Hash)" } | Sort-Object > $env:TEMP/projects-integrity-before.txt
   ```

6. **DELETE `src/` directory.** Remove the entire directory tree:
   ```powershell
   Remove-Item -Recurse -Force src/
   ```
   Verify: `Test-Path src/` → `False`

7. **DELETE `tests/` directory.** Remove the entire directory tree:
   ```powershell
   Remove-Item -Recurse -Force tests/
   ```
   Verify: `Test-Path tests/` → `False`

8. **DELETE `plan/` directory.** Remove the entire directory tree:
   ```powershell
   Remove-Item -Recurse -Force plan/
   ```
   Verify: `Test-Path plan/` → `False`

9. **DELETE `bin/` directory.** Remove the empty directory:
   ```powershell
   Remove-Item -Recurse -Force bin/
   ```
   Verify: `Test-Path bin/` → `False`

10. **POST-DELETION VERIFICATION.** Run all of the following and confirm results:
    - **Frozen artifact integrity**: Regenerate the hash manifest, compare against pre-deletion snapshot:
      ```powershell
      Get-ChildItem -Recurse .github/projects/ -File | ForEach-Object { "$($_.FullName)|$(Get-FileHash $_.FullName -Algorithm SHA256 | Select-Object -ExpandProperty Hash)" } | Sort-Object > $env:TEMP/projects-integrity-after.txt
      $diff = Compare-Object (Get-Content $env:TEMP/projects-integrity-before.txt) (Get-Content $env:TEMP/projects-integrity-after.txt)
      if ($diff) { throw "FROZEN ARTIFACT BOUNDARY VIOLATED — files under .github/projects/ were modified!" } else { Write-Host "Frozen artifact integrity: PASS" }
      ```
    - **Migrated scripts still accessible**: `(Get-ChildItem .github/orchestration/scripts/*.js).Count` equals `3`
    - **Migrated lib modules still accessible**: `(Get-ChildItem .github/orchestration/scripts/lib/*.js).Count` equals `4`
    - **Migrated tests still accessible**: `(Get-ChildItem .github/orchestration/scripts/tests/*.test.js).Count` equals `18`
    - **Full test suite passes**: `node --test .github/orchestration/scripts/tests/*.test.js` — expect all tests pass (307+)
    - **Deleted directories gone**: `Test-Path src/`, `Test-Path tests/`, `Test-Path plan/`, `Test-Path bin/` — all `False`

## Contracts & Interfaces

No code contracts apply — this task performs only file/directory deletion. No source files are created or modified.

## Styles & Design Tokens

Not applicable — no UI work in this task.

## Test Requirements

- [ ] Pre-deletion: All 7 migrated scripts exist at `.github/orchestration/scripts/` and `.github/orchestration/scripts/lib/`
- [ ] Pre-deletion: All 18 migrated test files exist at `.github/orchestration/scripts/tests/`
- [ ] Pre-deletion: All 16 archived files exist at `archive/` and `archive/schemas/`
- [ ] Pre-deletion: Promoted `state-json-schema.md` exists at `.github/orchestration/schemas/`
- [ ] Post-deletion: `src/` does not exist (`Test-Path src/` → `False`)
- [ ] Post-deletion: `tests/` does not exist (`Test-Path tests/` → `False`)
- [ ] Post-deletion: `plan/` does not exist (`Test-Path plan/` → `False`)
- [ ] Post-deletion: `bin/` does not exist (`Test-Path bin/` → `False`)
- [ ] Post-deletion: Full test suite passes from `.github/orchestration/scripts/tests/` (307+ tests)
- [ ] Post-deletion: `.github/projects/` file hashes are byte-identical to pre-deletion snapshot

## Acceptance Criteria

- [ ] `src/` does not exist
- [ ] `tests/` does not exist
- [ ] `plan/` does not exist
- [ ] `bin/` does not exist
- [ ] No files under `.github/projects/` were modified (frozen artifact boundary intact — hash comparison proves it)
- [ ] `.github/orchestration/scripts/` contains exactly 3 CLI scripts: `next-action.js`, `triage.js`, `validate-state.js`
- [ ] `.github/orchestration/scripts/lib/` contains exactly 4 lib modules: `constants.js`, `resolver.js`, `state-validator.js`, `triage-engine.js`
- [ ] `.github/orchestration/scripts/tests/` contains exactly 18 test files: `agents.test.js`, `config.test.js`, `constants.test.js`, `cross-refs.test.js`, `frontmatter.test.js`, `fs-helpers.test.js`, `instructions.test.js`, `next-action.test.js`, `prompts.test.js`, `reporter.test.js`, `resolver.test.js`, `skills.test.js`, `state-validator.test.js`, `structure.test.js`, `triage-engine.test.js`, `triage.test.js`, `validate-state.test.js`, `yaml-parser.test.js`
- [ ] Full test suite passes from new locations (307+ tests, 0 failures)
- [ ] No lint errors
- [ ] Build succeeds (no broken imports)

## Constraints

- **Do NOT modify any files under `.github/projects/`** — this is a frozen artifact boundary. No reads-to-modify, no find-and-replace, no accidental writes. Use the hash manifest comparison (Step 5 vs Step 10) to prove compliance.
- **Do NOT delete `.github/`, `archive/`, `assets/`, `docs/`, `ui/`, or `README.md`** — these are the surviving post-reorg directories and must remain untouched.
- **Do NOT delete any directory until ALL pre-deletion verifications (Steps 1–5) pass** — if any migrated/archived file is missing, STOP and report the failure. Do not partially delete.
- **Delete directories using `Remove-Item -Recurse -Force`** — ensure the entire tree is removed in one operation per directory. Do not delete individual files first and then the directory (unless debugging a failure).
- **Order of deletion does not matter** (src, tests, plan, bin are independent) — but all pre-checks must pass before ANY deletion begins, and all post-checks must run after ALL deletions complete.
- **Git preserves history** — these deletions are recoverable via `git checkout` if needed. This is the safety net, not a reason to skip verification.
